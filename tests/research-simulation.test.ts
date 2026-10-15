import { describe, expect, it } from 'vitest';
import { BANK } from '../lib/learning/bank';
import { mark, summarize } from '../lib/learning/engine';
import { PROFILES, runSimulation, simulateResponse, tracesToCsv } from '../research/run-simulation';
import { calculateStudy, parseObservationCsv } from '../research/calculate-study';

const metadata = { generatedAt: '2026-10-15T00:00:00.000Z', gitCommit: 'a'.repeat(40), workingTreeDirty: false, bankSha256: 'b'.repeat(64) };
const headers = 'protocol_version,participant_code,group_code,allocation_unit_code,consent_status,phase,session_code,session_order,topic_code,test_form_code,bank_version,algorithm_config_version,app_version,duration_total_seconds,inactive_seconds,correct_count,item_count,score_points,score_max_points,repeat_error_count,repeat_error_opportunities,hint_count,teacher_help_count,technical_incident_code,completion_status,missing_reason_code,usability_clarity_1_5,usability_navigation_1_5,usability_feedback_1_5,notes_no_pii';
function csvRow(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = { protocol_version: 'v1', participant_code: 'P_a1b2c3d4', group_code: 'adaptive', allocation_unit_code: 'U_d4c3b2a1', consent_status: 'confirmed', phase: 'pre', session_code: 'S_a1b2c3d4', session_order: '1', topic_code: 'fractions', test_form_code: 'A', bank_version: 'v1', algorithm_config_version: 'rules-1.0', app_version: 'v1', duration_total_seconds: '60', inactive_seconds: '0', correct_count: '2', item_count: '4', score_points: '2', score_max_points: '4', repeat_error_count: '0', repeat_error_opportunities: '0', hint_count: '0', teacher_help_count: '0', technical_incident_code: 'none', completion_status: 'completed', missing_reason_code: '', usability_clarity_1_5: '', usability_navigation_1_5: '', usability_feedback_1_5: '', notes_no_pii: '', ...overrides };
  return headers.split(',').map(key => values[key]).join(',');
}

describe('deterministic SIMULATION of the exported learning engine', () => {
  it('reproduces all 24 trajectories and preserves their explicit simulated status', () => {
    const result = runSimulation({ seed: 'review-seed', metadata });
    expect(result).toEqual(runSimulation({ seed: 'review-seed', metadata }));
    expect(result.kind).toBe('SIMULATION');
    expect(result.realLearners).toBe(0);
    expect(result.runs).toHaveLength(24);
    expect(result.comparisons).toHaveLength(6);
    expect(result.runs.every(run => run.trace.length === 15)).toBe(true);
  });

  it('uses common response draws for identical task/exposure inputs and changes draws with the seed', () => {
    const question = BANK[0];
    const first = simulateResponse(PROFILES[0], question, 1, 'alpha');
    expect(first).toEqual(simulateResponse(PROFILES[0], question, 1, 'alpha'));
    expect(first.draw).not.toBe(simulateResponse(PROFILES[0], question, 1, 'beta').draw);
    expect(first.probability).toBe(.96);
    expect(simulateResponse(PROFILES[2], question, 3, 'alpha').probability).toBeCloseTo(.83);
  });

  it('shares the five diagnostic tasks and responses across modes', () => {
    const { runs } = runSimulation({ seed: 'review-seed', metadata });
    for (const profile of PROFILES) for (const topic of ['fractions', 'equations', 'algorithms', 'binary']) {
      const pair = runs.filter(run => run.profileId === profile.id && run.topic === topic);
      expect(pair).toHaveLength(2);
      expect(pair[0].trace.slice(0, 5).map(row => [row.taskId, row.answer, row.correct])).toEqual(pair[1].trace.slice(0, 5).map(row => [row.taskId, row.answer, row.correct]));
      expect(pair[0].trace.slice(0, 5).map(row => row.level)).toEqual([1, 1, 2, 2, 3]);
    }
  });

  it('marks actual generated answers and derives every state from engine evidence', () => {
    const { runs } = runSimulation({ seed: 'review-seed', metadata });
    for (const run of runs) {
      const history: Parameters<typeof summarize>[0] = [];
      let firstMastered: number | null = null;
      for (const row of run.trace) {
        const question = BANK.find(q => q.id === row.taskId)!;
        expect(mark(question, row.answer)).toBe(row.correct);
        history.push({ questionId: question.id, level: question.level, correct: row.correct, errorTags: row.errorTags });
        const state = summarize(history, run.mode);
        expect(row.mastery).toBe(state.mastery);
        expect(row.mastered).toBe(state.mastered);
        expect(row.levelAfter).toBe(state.level);
        expect(row.selectionEvidence.priorTaskAttempts).toBe(run.trace.slice(0, row.attempt - 1).filter(previous => previous.taskId === row.taskId).length);
        expect(row.selectionEvidence.excludedRecentTaskIds).not.toContain(row.taskId);
        if (state.mastered && firstMastered === null) firstMastered = row.attempt;
      }
      expect(run.metrics.tasksToMastery).toBe(firstMastered);
      expect(run.metrics.accuracy).toEqual({ numerator: run.trace.filter(row => row.correct).length, denominator: 15, ratio: run.trace.filter(row => row.correct).length / 15 });
      expect(run.metrics.repeats).toBe(15 - new Set(run.trace.map(row => row.taskId)).size);
      expect(run.recommendations.length).toBeGreaterThan(0);
      expect(run.teacherInformation.attempts).toBe(15);
    }
  });

  it('keeps fixed practice on the predefined 3,1,2 cycle while adaptive selections follow the current level', () => {
    const { runs } = runSimulation({ seed: 'review-seed', metadata });
    for (const run of runs) {
      if (run.mode === 'fixed') {
        expect(run.trace.slice(5).map(row => row.level)).toEqual([3, 1, 2, 3, 1, 2, 3, 1, 2, 3]);
        expect(run.metrics.levelChanges.practice).toBe(0);
      } else {
        expect(run.trace.slice(5).every(row => row.level === row.levelBefore)).toBe(true);
      }
    }
  });

  it('reports failure to reach mastery as null and writes full, escaped trace CSV', () => {
    const result = runSimulation({ seed: 'review-seed', metadata });
    expect(result.runs.some(run => run.metrics.tasksToMastery === null)).toBe(true);
    const csv = tracesToCsv(result);
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(361);
    expect(csv).toContain('SIMULATION');
    expect(csv).toContain('selection_evidence_json');
    expect(csv).toContain('""priorTaskAttempts""');
  });
});

describe('future observation calculator (separate from SIMULATION)', () => {
  it('returns missing descriptives for the empty observation template', () => {
    const result = calculateStudy(parseObservationCsv(`${headers}\r\n`));
    expect(result.kind).toBe('OBSERVATION_DESCRIPTIVES');
    expect(result.includedParticipants).toBe(0);
    expect(result.groups.adaptive.prePercent).toEqual({ n: 0, mean: null });
    expect(result.groups.fixed.repeatedErrors).toEqual({ numerator: 0, denominator: 0, ratio: null, observedSessions: 0 });
  });

  it('calculates literal paired gains, observed time, repeat opportunities and item-level usability', () => {
    const csv = [headers, csvRow(), csvRow({ phase: 'practice', session_code: 'S_b1b2c3d4', duration_total_seconds: '120', correct_count: '3', repeat_error_count: '1', repeat_error_opportunities: '2', usability_clarity_1_5: '4', usability_navigation_1_5: '5', usability_feedback_1_5: '3' }), csvRow({ phase: 'post', session_code: 'S_c1b2c3d4', score_points: '3', correct_count: '3' })].join('\n');
    const result = calculateStudy(parseObservationCsv(csv));
    expect(result.includedParticipants).toBe(1);
    expect(result.groups.adaptive.prePercent).toEqual({ n: 1, mean: 50 });
    expect(result.groups.adaptive.postPercent).toEqual({ n: 1, mean: 75 });
    expect(result.groups.adaptive.pairedGainPercentagePoints).toEqual({ n: 1, mean: 25 });
    expect(result.groups.adaptive.practiceTotalSeconds).toEqual({ n: 1, mean: 120 });
    expect(result.groups.adaptive.repeatedErrors).toEqual({ numerator: 1, denominator: 2, ratio: .5, observedSessions: 1 });
    expect(result.groups.adaptive.usability).toEqual({ clarity: { n: 1, mean: 4 }, navigation: { n: 1, mean: 5 }, feedback: { n: 1, mean: 3 } });
  });

  it('excludes unconfirmed consent and does not turn missing post scores into zero', () => {
    const result = calculateStudy(parseObservationCsv([headers, csvRow(), csvRow({ participant_code: 'P_z1b2c3d4', session_code: 'S_z1b2c3d4', consent_status: 'not_confirmed' }), csvRow({ phase: 'post', session_code: 'S_c1b2c3d4', score_points: '', missing_reason_code: 'technical_loss', duration_total_seconds: '' })].join('\n')));
    expect(result.excludedUnconfirmedRows).toBe(1);
    expect(result.includedParticipants).toBe(1);
    expect(result.groups.adaptive.postPercent).toEqual({ n: 0, mean: null });
    expect(result.groups.adaptive.pairedGainPercentagePoints).toEqual({ n: 0, mean: null });
  });

  it.each([
    [{ participant_code: 'Jane Doe' }, 'participant_code'],
    [{ notes_no_pii: 'jane@example.org' }, 'notes_no_pii'],
    [{ group_code: 'control' }, 'group_code'],
    [{ consent_status: 'yes' }, 'consent_status'],
    [{ phase: 'exam' }, 'phase'],
    [{ duration_total_seconds: '-1' }, 'duration_total_seconds'],
    [{ duration_total_seconds: 'NaN' }, 'duration_total_seconds'],
    [{ inactive_seconds: '61' }, 'inactive_seconds'],
    [{ correct_count: '5' }, 'correct_count'],
    [{ score_points: '5' }, 'score_points'],
    [{ repeat_error_count: '2', repeat_error_opportunities: '1' }, 'repeat_error_count'],
    [{ usability_clarity_1_5: '6' }, 'usability_clarity_1_5'],
    [{ score_points: '', missing_reason_code: '' }, 'missing_reason_code'],
  ])('rejects invalid or identifying input %j', (change, field) => {
    expect(() => parseObservationCsv([headers, csvRow(change)].join('\n'))).toThrow(field);
  });

  it('rejects repeated session rows and conflicting group allocation', () => {
    expect(() => parseObservationCsv([headers, csvRow(), csvRow()].join('\n'))).toThrow('duplicate');
    expect(() => parseObservationCsv([headers, csvRow(), csvRow({ group_code: 'fixed', session_code: 'S_b1b2c3d4' })].join('\n'))).toThrow('group_code');
  });
});
