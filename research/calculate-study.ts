import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const HEADERS = 'protocol_version,participant_code,group_code,allocation_unit_code,consent_status,phase,session_code,session_order,topic_code,test_form_code,bank_version,algorithm_config_version,app_version,duration_total_seconds,inactive_seconds,correct_count,item_count,score_points,score_max_points,repeat_error_count,repeat_error_opportunities,hint_count,teacher_help_count,technical_incident_code,completion_status,missing_reason_code,usability_clarity_1_5,usability_navigation_1_5,usability_feedback_1_5,notes_no_pii'.split(',');
type Observation = Record<string, string>;
type Mean = { n: number; mean: number | null };
const missingFields = ['duration_total_seconds', 'inactive_seconds', 'correct_count', 'item_count', 'score_points', 'score_max_points', 'repeat_error_count', 'repeat_error_opportunities', 'hint_count', 'teacher_help_count'];
const ratingFields = ['usability_clarity_1_5', 'usability_navigation_1_5', 'usability_feedback_1_5'];

function csvRecords(source: string) {
  const records: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const finishCell = () => { row.push(cell); cell = ''; closed = false; };
  const finishRow = () => { finishCell(); if (row.some(value => value !== '')) records.push(row); row = []; };
  const input = source.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"') {
      if (cell || closed) throw new Error('Malformed CSV quote');
      quoted = true;
    } else if (char === ',') finishCell();
    else if (char === '\r' || char === '\n') { if (char === '\r' && input[index + 1] === '\n') index++; finishRow(); }
    else { if (closed) throw new Error('Malformed CSV after closing quote'); cell += char; }
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (cell || row.length || closed) finishRow();
  return records;
}

function numberValue(row: Observation, key: string) { return row[key] === '' ? null : Number(row[key]); }
function invalid(line: number, field: string, reason: string): never { throw new Error(`Row ${line}: ${field}: ${reason}`); }

export function parseObservationCsv(source: string): Observation[] {
  const records = csvRecords(source);
  if (records[0]?.join(',') !== HEADERS.join(',')) throw new Error('CSV header must exactly match research/forms/observations.csv; unknown fields are not accepted');
  const sessions = new Set<string>();
  const allocation = new Map<string, { group: string; unit: string; consent: string }>();
  return records.slice(1).map((values, index) => {
    const line = index + 2;
    if (values.length !== HEADERS.length) invalid(line, 'columns', 'incorrect field count');
    const row = Object.fromEntries(HEADERS.map((key, position) => [key, values[position].trim()]));
    for (const [key, prefix] of [['participant_code', 'P'], ['allocation_unit_code', 'U'], ['session_code', 'S']]) {
      if (!new RegExp(`^${prefix}_[A-Za-z0-9]{8,32}$`).test(row[key])) invalid(line, key, `use a random ${prefix}_ code with 8–32 alphanumeric characters`);
    }
    if (row.notes_no_pii) invalid(line, 'notes_no_pii', 'leave free text empty in analysis input; retain reviewed notes separately');
    for (const [field, allowed] of Object.entries({ group_code: ['adaptive', 'fixed'], consent_status: ['confirmed', 'not_confirmed'], phase: ['pre', 'practice', 'post', 'delayed'], completion_status: ['completed', 'partial', 'withdrawn', 'technical_failure'] })) {
      if (!allowed.includes(row[field])) invalid(line, field, 'unsupported code');
    }
    for (const field of ['protocol_version', 'topic_code', 'bank_version', 'algorithm_config_version', 'app_version']) if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(row[field])) invalid(line, field, 'required non-identifying code');
    for (const field of ['test_form_code', 'technical_incident_code', 'missing_reason_code']) if (row[field] && !/^[A-Za-z0-9_.:-]{1,100}$/.test(row[field])) invalid(line, field, 'use a non-identifying code');
    for (const field of [...missingFields, ...ratingFields, 'session_order']) {
      if (!row[field]) continue;
      const value = numberValue(row, field)!;
      if (!/^\d+(?:\.\d+)?$/.test(row[field]) || !Number.isFinite(value) || value < 0) invalid(line, field, 'must be a finite nonnegative number or blank');
      if ((field.includes('count') || field.includes('opportunities') || field === 'item_count' || field === 'session_order' || ratingFields.includes(field)) && !Number.isInteger(value)) invalid(line, field, 'must be an integer');
      if (ratingFields.includes(field) && (value < 1 || value > 5)) invalid(line, field, 'rating must be 1–5');
    }
    if (!row.session_order || Number(row.session_order) < 1) invalid(line, 'session_order', 'positive integer required');
    if (missingFields.some(field => row[field] === '') && !row.missing_reason_code) invalid(line, 'missing_reason_code', 'required when a core measurement is missing');
    for (const [numerator, denominator] of [['correct_count', 'item_count'], ['score_points', 'score_max_points'], ['repeat_error_count', 'repeat_error_opportunities'], ['inactive_seconds', 'duration_total_seconds']]) {
      const a = numberValue(row, numerator), b = numberValue(row, denominator);
      if (a !== null && b !== null && a > b) invalid(line, numerator, `cannot exceed ${denominator}`);
    }
    if (row.score_max_points !== '' && Number(row.score_max_points) === 0) invalid(line, 'score_max_points', 'must be positive when observed');
    const sessionKey = `${row.participant_code}:${row.session_code}`;
    if (sessions.has(sessionKey)) invalid(line, 'session_code', 'duplicate participant/session row');
    sessions.add(sessionKey);
    const previous = allocation.get(row.participant_code);
    if (previous && previous.group !== row.group_code) invalid(line, 'group_code', 'participant allocation must remain consistent');
    if (previous && previous.unit !== row.allocation_unit_code) invalid(line, 'allocation_unit_code', 'participant allocation must remain consistent');
    if (previous && previous.consent !== row.consent_status) invalid(line, 'consent_status', 'resolve consent/withdrawal status consistently before analysis');
    allocation.set(row.participant_code, { group: row.group_code, unit: row.allocation_unit_code, consent: row.consent_status });
    return row;
  });
}

function mean(values: number[]): Mean { return { n: values.length, mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null }; }
function observedValues(rows: Observation[], field: string) { return rows.map(row => numberValue(row, field)).filter((value): value is number => value !== null); }
function phaseScore(rows: Observation[], phase: string) {
  const observed = rows.filter(row => row.phase === phase && row.completion_status === 'completed' && row.score_points !== '' && row.score_max_points !== '');
  if (!observed.length) return null;
  const maximum = observed.reduce((sum, row) => sum + Number(row.score_max_points), 0);
  return 100 * observed.reduce((sum, row) => sum + Number(row.score_points), 0) / maximum;
}

export function calculateStudy(input: Observation[]) {
  const included = input.filter(row => row.consent_status === 'confirmed');
  const groups = Object.fromEntries((['adaptive', 'fixed'] as const).map(group => {
    const rows = included.filter(row => row.group_code === group);
    const participants = [...new Set(rows.map(row => row.participant_code))].map(code => rows.filter(row => row.participant_code === code));
    const pre = participants.map(person => phaseScore(person, 'pre'));
    const post = participants.map(person => phaseScore(person, 'post'));
    const practices = rows.filter(row => row.phase === 'practice');
    const observedRepeats = practices.filter(row => row.repeat_error_count !== '' && row.repeat_error_opportunities !== '');
    const numerator = observedRepeats.reduce((sum, row) => sum + Number(row.repeat_error_count), 0);
    const denominator = observedRepeats.reduce((sum, row) => sum + Number(row.repeat_error_opportunities), 0);
    const usability = Object.fromEntries(['clarity', 'navigation', 'feedback'].map(item => {
      const values = participants.flatMap(person => {
        const values = observedValues(person, `usability_${item}_1_5`);
        return values.length ? [mean(values).mean!] : [];
      });
      return [item, mean(values)];
    }));
    return [group, {
      participants: participants.length, allocationUnits: new Set(rows.map(row => row.allocation_unit_code)).size,
      prePercent: mean(pre.filter((value): value is number => value !== null)),
      postPercent: mean(post.filter((value): value is number => value !== null)),
      pairedGainPercentagePoints: mean(pre.flatMap((value, index) => value !== null && post[index] !== null ? [post[index]! - value] : [])),
      practiceTotalSeconds: mean(participants.flatMap(person => {
        const practice = person.filter(row => row.phase === 'practice');
        return practice.length && practice.every(row => row.duration_total_seconds !== '') ? [practice.reduce((sum, row) => sum + Number(row.duration_total_seconds), 0)] : [];
      })),
      repeatedErrors: { numerator, denominator, ratio: denominator ? numerator / denominator : null, observedSessions: observedRepeats.length },
      usability,
      missing: { participantsWithoutPre: pre.filter(value => value === null).length, participantsWithoutPost: post.filter(value => value === null).length, practiceSessionsWithoutTime: practices.filter(row => row.duration_total_seconds === '').length, practiceSessionsWithoutRepeatCounts: practices.length - observedRepeats.length },
      completionStatusRows: Object.fromEntries(['completed', 'partial', 'withdrawn', 'technical_failure'].map(status => [status, rows.filter(row => row.completion_status === status).length])),
    }];
  })) as unknown as Record<'adaptive' | 'fixed', { participants: number; allocationUnits: number; prePercent: Mean; postPercent: Mean; pairedGainPercentagePoints: Mean; practiceTotalSeconds: Mean; repeatedErrors: { numerator: number; denominator: number; ratio: number | null; observedSessions: number }; usability: Record<string, Mean>; missing: Record<string, number>; completionStatusRows: Record<string, number> }>;
  return {
    kind: 'OBSERVATION_DESCRIPTIVES' as const,
    includedParticipants: new Set(included.map(row => row.participant_code)).size,
    inputRows: input.length, includedRows: included.length, excludedUnconfirmedRows: input.length - included.length,
    groups,
    limitations: ['Descriptive only; no significance tests, confidence intervals, causal or effectiveness claims.', 'Means are participant-weighted; repeated-error rates are opportunity-weighted.', 'Pre/post use completed observed scores; paired gain includes only participants with both scores. Missing is never imputed as zero.', 'Practice time sums observed sessions per participant and excludes participants with any missing practice duration; it is total recorded time, not active time.', 'Three usability items are separate custom 1–5 items, not a validated scale.', 'Code syntax cannot prove absence of identifying information; a responsible human must review pseudonymisation, consent and release risk.', 'Raw coded observations must not be committed or published automatically.'],
  };
}

function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: node node_modules/tsx/dist/cli.mjs research/calculate-study.ts <observations.csv> [private-output.json]');
  const output = process.argv[3];
  if (output && resolve(output) === resolve(input)) throw new Error('Output must not overwrite input observations');
  const result = { generatedAt: new Date().toISOString(), ...calculateStudy(parseObservationCsv(readFileSync(input, 'utf8'))) };
  if (output) { writeFileSync(output, JSON.stringify(result, null, 2) + '\n'); console.log(`Observation descriptives written: ${result.includedParticipants} included participants; ${result.excludedUnconfirmedRows} rows excluded for unconfirmed consent.`); }
  else console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
