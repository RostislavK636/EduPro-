"use client";
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleHelp, RotateCcw, Sparkles, Target } from 'lucide-react';
import { api } from '@/lib/client';
import { useApp } from '../app-context';
import { Field, GlassCard, GradientButton } from '../ui/edupilot';
import { Attempt, LearningError, LearningLoading, levelName, percent, readLocal, Recommendations, Rules, RulesExplanation, SessionSummary, SessionView, Topic, writeLocal } from './shared';

export function Training() {
  const { user, navigate, ai } = useApp();
  const [catalog, setCatalog] = useState<{ topics: Topic[]; config: Rules; algorithmVersion: string } | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [data, setData] = useState<SessionView | null>(null);
  const [subject, setSubject] = useState('Математика');
  const [topic, setTopic] = useState('fractions');
  const [grade, setGrade] = useState(7);
  const [mode, setMode] = useState('adaptive');
  const [demo, setDemo] = useState(false);
  const [answer, setAnswer] = useState('');
  const [holdTurnId, setHoldTurnId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assist, setAssist] = useState<{ text: string; label: string; demo: boolean } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const submitLock = useRef(false);
  const activeKey = `edupilot:learning:${user.id}`;
  const holdKey = (id: string) => `edupilot:learning:feedback:${user.id}:${id}`;
  const acceptSession = (next: SessionView) => {
    setData(next); setAnswer(''); setAssist(null);
    const held = readLocal(holdKey(next.session.id));
    setHoldTurnId(next.attempts.some(a => a.turnId === held) ? held : null);
    writeLocal(activeKey, next.session.id);
  };
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [nextCatalog, list] = await Promise.all([api('learning/catalog'), api('learning/sessions')]);
      setCatalog(nextCatalog); setSessions(list.sessions);
      const active = readLocal(activeKey);
      if (active && list.sessions.some((s: SessionSummary) => s.id === active)) acceptSession(await api(`learning/sessions/${active}`));
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [user.id]); // Account-specific browser resume; answers remain server-side.
  const start = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const next = await api<SessionView>('learning/sessions', 'POST', { topic, grade, mode, dataKind: demo ? 'demo' : 'user' });
      acceptSession(next);
      setSessions((await api('learning/sessions')).sessions);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const resume = async (id: string) => {
    setBusy(true); setError('');
    try { acceptSession(await api(`learning/sessions/${id}`)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!data?.turn || submitLock.current || holdTurnId) return;
    const turnId = data.turn.id;
    const value = answer.trim();
    if (!value) return;
    if (data.turn.question.kind === 'numeric' && !/^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)) { setError('Введите число. Для дробной части подойдёт точка или запятая.'); return; }
    submitLock.current = true; setBusy(true); setError('');
    const key = `edupilot:learning:request:${user.id}:${turnId}`;
    let request: { answer: string; requestId: string } | null = null;
    try { const raw = readLocal(key); if (raw) request = JSON.parse(raw); } catch { /* A fresh id is safe before the first accepted answer. */ }
    if (!request || request.answer !== value) request = { answer: value, requestId: crypto.randomUUID() };
    writeLocal(key, JSON.stringify(request));
    writeLocal(holdKey(data.session.id), turnId);
    try {
      let next: SessionView;
      try {
        next = await api<SessionView>(`learning/sessions/${data.session.id}/answer`, 'POST', { turnId, ...request });
      } catch (firstError) {
        // Keep the same request id so a retry is idempotent if the server already stored the answer.
        try {
          next = await api<SessionView>(`learning/sessions/${data.session.id}/answer`, 'POST', { turnId, ...request });
        } catch {
          throw firstError;
        }
      }
      setData(next); setHoldTurnId(turnId); setAssist(null);
    } catch (e) {
      // Reconcile a response lost after the server accepted an answer, without advancing past its explanation.
      try {
        const next = await api<SessionView>(`learning/sessions/${data.session.id}`);
        if (next.attempts.some(a => a.turnId === turnId)) { setData(next); setHoldTurnId(turnId); }
        else setError((e as Error).message);
      } catch { setError((e as Error).message); }
    } finally { submitLock.current = false; setBusy(false); }
  };
  const continueTraining = () => {
    if (!data) return;
    writeLocal(holdKey(data.session.id), null); setHoldTurnId(null); setAnswer(''); setAssist(null); setError('');
  };
  const askAi = async (action: 'explain' | 'error' | 'recommend') => {
    if (!data) return; setAiBusy(true); setError('');
    try { setAssist(await api('learning/assist', 'POST', { sessionId: data.session.id, action })); } catch (e) { setError((e as Error).message); } finally { setAiBusy(false); }
  };
  const feedback: Attempt | undefined = holdTurnId ? data?.attempts.find(a => a.turnId === holdTurnId) : undefined;
  const question = feedback?.question || data?.turn?.question;
  const chooseNew = () => { setData(null); setHoldTurnId(null); setError(''); setAssist(null); writeLocal(activeKey, null); };
  if (loading) return <LearningLoading />;
  return <div className="learning-stack"><LearningError error={error} retry={!catalog ? load : undefined} />{data ? <>
    <div className="learning-row learning-session-heading"><div><span className="learning-badge">{data.session.dataKind === 'demo' ? 'Демо-данные · отдельно от вашего прогресса' : 'Личная тренировка'}</span><h2>{catalog?.topics.find(t => t.id === data.session.topic)?.name || data.session.topic}</h2><p>{data.session.grade} класс · {data.session.mode === 'adaptive' ? 'Адаптивная' : 'Фиксированная'} · сохранено в аккаунте</p></div><button className="button secondary" onClick={chooseNew} disabled={busy}><RotateCcw size={16} />Выбрать другую тренировку</button></div>
    <div className="learning-training-grid"><div className="learning-stack"><GlassCard className="learning-card learning-question-card">
      <div className="learning-row"><span className="eyebrow">{data.count < data.session.config.diagnostic ? 'ДИАГНОСТИКА' : 'ПРАКТИКА'}</span><span data-testid="learning-counter">{data.count} / {data.total} ответов</span></div><progress className="learning-progress" value={data.count} max={data.total} aria-label="Завершённые задания" />
      {data.state.completed && !feedback ? <div className="learning-complete"><CheckCircle2 size={44} /><h2>Тренировка завершена</h2><p>{data.attempts.filter(a => a.correct).length} верных ответов из {data.total}. Диагностика и практика сохранены.</p><GradientButton onClick={() => navigate('/learning/progress')}>Мой прогресс <ArrowRight size={16} /></GradientButton><button className="text-button" onClick={chooseNew}>Новая тренировка</button></div> : question ? <>
        <div className="learning-row"><span className="learning-badge">Задание уровня {question.level} · {levelName(question.level)}</span><span className="learning-muted">{question.kind === 'numeric' ? 'Числовой ответ' : 'Короткий текстовый ответ'}</span></div><h2 className="learning-question" data-testid="learning-question">{question.prompt}</h2><p className="learning-criteria">Как проверяем: {question.criteria}</p>
        <form onSubmit={submit} className="learning-answer-form"><Field label="Ваш ответ"><input value={feedback ? feedback.answer : answer} onChange={e => setAnswer(e.target.value)} inputMode={question.kind === 'numeric' ? 'decimal' : 'text'} maxLength={300} required disabled={!!feedback || busy} autoComplete="off" placeholder={question.kind === 'numeric' ? 'Введите число' : 'Введите короткий ответ'} /></Field>{!feedback && <GradientButton type="submit" disabled={busy || !answer.trim()}>{busy ? 'Проверяем…' : 'Проверить ответ'}<ArrowRight size={16} /></GradientButton>}</form>
        {feedback && <div className={`learning-feedback ${feedback.correct ? 'correct' : 'incorrect'}`} data-testid="learning-feedback" role="status"><strong>{feedback.correct ? 'Верно. Продолжайте в том же духе.' : 'Разберём решение'}</strong><p><b>Правильный ответ: {feedback.question.answer}</b></p><p>{feedback.question.explanation}</p><p className="learning-decision">{feedback.reason} Уровень {feedback.levelBefore} → {feedback.levelAfter}.</p>{feedback.errorTagsJson.length > 0 && <div className="learning-tags">{feedback.errorTagsJson.map(t => <span key={t}>{t}</span>)}</div>}<GradientButton onClick={continueTraining}>Продолжить <ArrowRight size={16} /></GradientButton></div>}
        <div className="learning-ai-actions"><button className="button secondary" disabled={aiBusy || busy} onClick={() => askAi(feedback ? 'error' : 'explain')}><Sparkles size={16} />{aiBusy ? 'Готовим объяснение…' : feedback ? 'AI-разбор ответа' : 'AI: объяснить тему'}</button><small>{ai?.mode === 'live' ? 'Ответ модели требует проверки' : 'Демо AI · без запроса к модели'}</small></div>
      </> : null}
    </GlassCard>{assist && <GlassCard className="learning-card learning-assist" role="status"><span className="learning-badge">{assist.demo ? 'Демо AI' : 'AI-помощник'}</span><h3>{assist.label}</h3><p>{assist.text}</p></GlassCard>}</div>
    <aside className="learning-stack"><GlassCard className="learning-card learning-state"><Target size={24} /><span>Текущий уровень</span><strong>{data.state.level} · {levelName(data.state.level)}</strong><span>Освоение темы · mastery</span><strong>{percent(data.state.mastery)}</strong><small>{data.state.mastered ? 'Критерий «освоено» достигнут' : 'Пока собираем свидетельства'}</small><p>{data.state.diagnosticDone ? 'Диагностика завершена. Практика закрепляет тему.' : `Диагностика: ${Math.min(data.count, data.session.config.diagnostic)} из ${data.session.config.diagnostic} ответов.`}</p><small>Mastery учитывает историю этой темы в выбранном наборе данных.</small></GlassCard><GlassCard className="learning-card"><Recommendations items={data.recommendations} /><button className="text-button" disabled={aiBusy} onClick={() => askAi('recommend')}><Sparkles size={14} />Попросить AI-рекомендацию</button></GlassCard></aside></div>
    {data.turn && !feedback && <p className="learning-muted learning-selection"><CircleHelp size={15} />Основание выбора: {data.turn.selectionReason}</p>}<RulesExplanation config={data.session.config} version={data.session.algorithmVersion} />
  </> : catalog ? <>
    <div className="learning-intro-grid"><GlassCard className="learning-card"><span className="eyebrow">15 ШАГОВ ПО ТЕМЕ</span><h2>Сначала узнаем точку старта</h2><p>5 заданий диагностики и 10 заданий практики. После каждого ответа — проверка, объяснение и причина выбора сложности.</p><form onSubmit={start} className="learning-catalog-form"><div className="learning-form-grid"><Field label="Предмет"><select value={subject} onChange={e => { const value = e.target.value; setSubject(value); setTopic(catalog.topics.find(t => t.subject === value)!.id); }}>{[...new Set(catalog.topics.map(t => t.subject))].map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Класс"><select value={grade} onChange={e => setGrade(Number(e.target.value))}>{Array.from({ length: 11 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} класс</option>)}</select></Field><Field label="Тема"><select value={topic} onChange={e => setTopic(e.target.value)}>{catalog.topics.filter(t => t.subject === subject).map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select></Field><Field label="Режим подбора"><select value={mode} onChange={e => setMode(e.target.value)}><option value="adaptive">Адаптивный · по результатам</option><option value="fixed">Фиксированный · цикл 1 → 2 → 3</option></select></Field></div><p>{catalog.topics.find(t => t.id === topic)?.description}</p><label className="learning-check"><input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} /><span>Пробная тренировка с флагом «демо-данные»<small>Сохраняется отдельно и не входит в обычный прогресс или аналитику учителя.</small></span></label><GradientButton type="submit" disabled={busy}>{busy ? 'Начинаем…' : 'Начать тренировку'}<ArrowRight size={16} /></GradientButton></form></GlassCard><GlassCard className="learning-card learning-roadmap"><span className="learning-orbit"><Target size={34} /></span><h2>Тема за темой.<br />В вашем темпе.</h2><ol><li><strong>01</strong><span>Диагностика<small>Пять ответов, чтобы выбрать стартовый уровень</small></span></li><li><strong>02</strong><span>Практика<small>Десять заданий с объяснением каждого решения</small></span></li><li><strong>03</strong><span>Следующий шаг<small>История ошибок и рекомендации по вашим данным</small></span></li></ol></GlassCard></div><RulesExplanation config={catalog.config} version={catalog.algorithmVersion} />
    {sessions.length > 0 && <GlassCard className="learning-card"><h2>Ваши тренировки</h2><div className="learning-session-list">{sessions.map(s => <button className="learning-session-item" key={s.id} onClick={() => resume(s.id)} disabled={busy}><span><strong>{catalog.topics.find(t => t.id === s.topic)?.name || s.topic}</strong><small>{s.mode === 'adaptive' ? 'Адаптивная' : 'Фиксированная'} · {s.grade} класс{s.dataKind === 'demo' ? ' · Демо-данные' : ''}</small></span><span>{s.count} / {s.configJson.diagnostic + s.configJson.practice}<small>{s.completed ? 'Посмотреть итог' : 'Продолжить'} →</small></span></button>)}</div></GlassCard>}
  </> : null}</div>;
}
