import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BANK, TOPICS } from '../lib/learning/bank';
import { ALGORITHM_VERSION, DEFAULT_CONFIG, mark, recommendations, selectQuestion, summarize, type Evidence, type Question } from '../lib/learning/engine';

type Mode = 'fixed' | 'adaptive';
export type ResponseProfile = {
  id: string;
  description: string;
  initialProbabilityByLevel: readonly number[];
  gainPerLevelExposure: number;
  capByLevel: readonly number[];
};

// These assumptions are declared before execution; they are not fitted to outcomes.
export const PROFILES: readonly ResponseProfile[] = [
  { id: 'stable-capable', description: 'Stable high response probability, lower on harder tasks.', initialProbabilityByLevel: [.96, .90, .80], gainPerLevelExposure: 0, capByLevel: [.96, .90, .80] },
  { id: 'recurring-errors', description: 'Persistent difficulty-sensitive errors without simulated improvement.', initialProbabilityByLevel: [.65, .32, .12], gainPerLevelExposure: 0, capByLevel: [.65, .32, .12] },
  { id: 'improving', description: 'Response probability rises with prior exposure to the same difficulty.', initialProbabilityByLevel: [.55, .28, .10], gainPerLevelExposure: .14, capByLevel: [.97, .94, .90] },
];

export type SimulationMetadata = {
  generatedAt: string;
  gitCommit: string;
  workingTreeDirty: boolean;
  bankSha256: string;
  engineSha256?: string;
};

export function simulateResponse(profile: ResponseProfile, question: Question, levelExposure: number, seed: string) {
  if (!Number.isInteger(levelExposure) || levelExposure < 1) throw new Error('levelExposure must be a positive integer');
  const probability = Math.min(profile.capByLevel[question.level - 1], profile.initialProbabilityByLevel[question.level - 1] + profile.gainPerLevelExposure * (levelExposure - 1));
  const draw = createHash('sha256').update(JSON.stringify([seed, profile.id, question.id, levelExposure])).digest().readUInt32BE(0) / 0x100000000;
  // A synthetic oracle emits the reference or a guaranteed incorrect answer.
  // Actual correctness is determined below by the application's exported mark().
  const answer = draw < probability ? question.answer : question.kind === 'numeric' ? String(Number(question.answer) + 1) : `${question.answer} [simulated error]`;
  return { answer, probability, draw, levelExposure };
}

function selectionEvidence(pool: Question[], question: Question, history: Evidence[], targetLevel: number, mode: Mode) {
  const recent = [...new Set(history.slice(-3).map(row => row.questionId))];
  const alternativesExist = pool.some(candidate => !recent.includes(candidate.id));
  const errorCounts = new Map<string, number>();
  for (const row of history) if (!row.correct) for (const tag of row.errorTags ?? []) errorCounts.set(tag, (errorCounts.get(tag) ?? 0) + 1);
  return {
    targetLevel,
    selectedLevel: question.level,
    priorTaskAttempts: history.filter(row => row.questionId === question.id).length,
    excludedRecentTaskIds: alternativesExist ? recent : [],
    recentExclusionFallback: !alternativesExist,
    repeatedErrorTags: [...errorCounts].filter(([, count]) => count >= 2).map(([tag, count]) => ({ tag, count })),
    selectedRepeatedErrorTagMatches: mode === 'adaptive' ? question.knowledgeTags.filter(tag => (errorCounts.get(tag) ?? 0) >= 2) : [],
    policy: mode === 'fixed' ? 'fixed difficulty cycle by absolute attempt index; recent exclusion, least exposure, id tie-break' : 'target difficulty; recent exclusion, least exposure, repeated-error tag priority, id tie-break',
  };
}

function runTrajectory(profile: ResponseProfile, mode: Mode, topic: string, seed: string) {
  const pool = BANK.filter(question => question.topic === topic);
  const history: Evidence[] = [];
  const trace = [];
  let tasksToMastery: number | null = null;
  let repeatErrorOpportunities = 0;
  let repeatedErrors = 0;
  const previousByGoal = new Map<string, boolean>();
  for (let sequence = 0; sequence < DEFAULT_CONFIG.diagnostic + DEFAULT_CONFIG.practice; sequence++) {
    const before = summarize(history, mode);
    const phase = before.diagnosticDone ? 'practice' : 'diagnostic';
    const selectionMode: Mode = before.diagnosticDone ? mode : 'adaptive';
    const requestedLevel = before.diagnosticDone ? before.level : [1, 1, 2, 2, 3][sequence];
    const targetLevel = selectionMode === 'fixed' ? [1, 2, 3][sequence % 3] : requestedLevel;
    const question = selectQuestion(pool, requestedLevel, history, selectionMode, sequence);
    const selection = selectionEvidence(pool, question, history, targetLevel, selectionMode);
    const response = simulateResponse(profile, question, history.filter(row => row.level === question.level).length + 1, seed);
    const correct = mark(question, response.answer);
    const errorTags = correct ? [] : [...question.errorTags];
    const repeatErrorOpportunity = previousByGoal.get(question.subtopic) === false;
    if (repeatErrorOpportunity) {
      repeatErrorOpportunities++;
      if (!correct) repeatedErrors++;
    }
    previousByGoal.set(question.subtopic, correct);
    history.push({ questionId: question.id, level: question.level, correct, errorTags });
    const after = summarize(history, mode);
    if (after.mastered && tasksToMastery === null) tasksToMastery = sequence + 1;
    const decision = after.decisions.at(-1)!;
    trace.push({
      attempt: sequence + 1, phase, taskId: question.id, level: question.level,
      answer: response.answer, referenceAnswer: question.answer, correct, errorTags,
      mastery: after.mastery, mastered: after.mastered,
      levelBefore: decision.before, levelAfter: decision.after, reason: decision.reason,
      selectionEvidence: selection, responseEvidence: response,
      feedback: { explanationAvailable: !correct, explanation: correct ? null : question.explanation },
      repeatErrorOpportunity, repeatedError: repeatErrorOpportunity && !correct,
    });
  }
  const state = summarize(history, mode);
  const numerator = history.filter(row => row.correct).length;
  const changes = trace.filter(row => row.levelBefore !== row.levelAfter);
  const errors = trace.filter(row => !row.correct);
  const availableRecommendations = recommendations(history);
  return {
    profileId: profile.id, mode, topic,
    metrics: {
      accuracy: { numerator, denominator: history.length, ratio: numerator / history.length },
      levelChanges: { total: changes.length, diagnostic: changes.filter(row => row.phase === 'diagnostic').length, practice: changes.filter(row => row.phase === 'practice').length },
      repeats: history.length - new Set(history.map(row => row.questionId)).size,
      tasksToMastery, finalMastery: state.mastery, finalMastered: state.mastered,
      difficultyExposure: [1, 2, 3].map(level => ({ level, attempts: history.filter(row => row.level === level).length })),
      recommendationsAvailable: availableRecommendations.length,
      errorResponse: { incorrectAnswers: errors.length, explanationsAvailable: errors.filter(row => row.feedback.explanationAvailable).length, repeatedErrors, repeatErrorOpportunities, repeatErrorRate: repeatErrorOpportunities ? repeatedErrors / repeatErrorOpportunities : null },
    },
    recommendations: availableRecommendations,
    teacherInformation: {
      dataKind: 'SIMULATION', attempts: history.length, correct: numerator,
      currentRuleLevel: state.level, masteryIndicator: state.mastery,
      repeatedErrorTags: selectionEvidence(pool, pool[0], history, state.level, mode).repeatedErrorTags,
      availableFields: ['task/difficulty exposure', 'submitted answers and correctness', 'rule decisions and reasons', 'repeat opportunities', 'recommendations'],
      unavailableMeasures: ['real learner characteristics', 'real time on task', 'independent pre/post knowledge', 'usability', 'educational effectiveness'],
    },
    trace,
  };
}

export function runSimulation({ seed = 'edupilot-simulation-v1', metadata }: { seed?: string; metadata: SimulationMetadata }) {
  const runs = PROFILES.flatMap(profile => TOPICS.flatMap(topic => (['fixed', 'adaptive'] as const).map(mode => runTrajectory(profile, mode, topic.id, seed))));
  const comparisons = PROFILES.flatMap(profile => (['fixed', 'adaptive'] as const).map(mode => {
    const selected = runs.filter(run => run.profileId === profile.id && run.mode === mode);
    const numerator = selected.reduce((sum, run) => sum + run.metrics.accuracy.numerator, 0);
    const denominator = selected.reduce((sum, run) => sum + run.metrics.accuracy.denominator, 0);
    return { profileId: profile.id, mode, topics: selected.length, accuracy: { numerator, denominator, ratio: numerator / denominator }, practiceLevelChanges: selected.reduce((sum, run) => sum + run.metrics.levelChanges.practice, 0), repeats: selected.reduce((sum, run) => sum + run.metrics.repeats, 0), masteredRuns: selected.filter(run => run.metrics.tasksToMastery !== null).length, tasksToMasteryByTopic: selected.map(run => ({ topic: run.topic, tasks: run.metrics.tasksToMastery })) };
  }));
  return {
    kind: 'SIMULATION' as const, realLearners: 0,
    interpretation: 'Deterministic software behavior under assumed response profiles. No observed learners and no evidence of educational effectiveness. Accuracy differs with difficulty exposure; cross-mode accuracy alone is not a learning effect.',
    metadata, seed, algorithmVersion: ALGORITHM_VERSION, config: DEFAULT_CONFIG,
    bank: { questions: BANK.length, topics: TOPICS.map(topic => topic.id), subjects: [...new Set(BANK.map(question => question.subject))] },
    responseModel: { hash: 'SHA-256 first unsigned 32 bits / 2^32', key: ['seed', 'profileId', 'taskId', 'levelExposure'], branchModeIncluded: false, exposure: '1 + prior attempts at the selected difficulty in this trajectory', profiles: PROFILES },
    protocol: { diagnosticLevels: [1, 1, 2, 2, 3], fixedPracticeCycle: '1,2,3 indexed by absolute attempt index; practice begins at index 5 (level 3)', budgetPerRun: DEFAULT_CONFIG.diagnostic + DEFAULT_CONFIG.practice, stopAtMastery: false, masteryCriterion: 'Application summarize(): >=6 answers, weighted mastery >=0.8, >=2 correct answers at level >=2; repeats downweighted by application mastery()', repeatedErrorCriterion: 'Wrong response at the next opportunity for the same bank subtopic after its previous wrong response and explanation' },
    comparisons, runs,
  };
}

export type SimulationResult = ReturnType<typeof runSimulation>;
function csvCell(value: unknown) {
  const text = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function tracesToCsv(result: SimulationResult) {
  const rows: unknown[][] = [['data_kind', 'profile_id', 'mode', 'topic', 'attempt', 'phase', 'task_id', 'level', 'answer', 'correct', 'mastery', 'mastered', 'level_before', 'level_after', 'reason', 'selection_evidence_json', 'response_evidence_json', 'error_tags_json', 'explanation_available', 'repeat_error_opportunity', 'repeated_error', 'git_commit', 'generated_at']];
  for (const run of result.runs) for (const row of run.trace) rows.push(['SIMULATION', run.profileId, run.mode, run.topic, row.attempt, row.phase, row.taskId, row.level, row.answer, row.correct, row.mastery, row.mastered, row.levelBefore, row.levelAfter, row.reason, row.selectionEvidence, row.responseEvidence, row.errorTags, row.feedback.explanationAvailable, row.repeatErrorOpportunity, row.repeatedError, result.metadata.gitCommit, result.metadata.generatedAt]);
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const metadata: SimulationMetadata = {
    generatedAt: new Date().toISOString(),
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    workingTreeDirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0,
    bankSha256: createHash('sha256').update(JSON.stringify(BANK)).digest('hex'),
    engineSha256: createHash('sha256').update(readFileSync(join(root, 'lib/learning/engine.ts'))).digest('hex'),
  };
  const result = runSimulation({ metadata });
  const output = join(root, 'research/results');
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'simulation.json'), JSON.stringify(result, null, 2) + '\n');
  writeFileSync(join(output, 'traces.csv'), tracesToCsv(result));
  console.log(`SIMULATION: ${result.runs.length} trajectories, ${result.runs.reduce((sum, run) => sum + run.trace.length, 0)} attempts; no real learners. Written to ${output}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
