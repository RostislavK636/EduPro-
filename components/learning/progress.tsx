"use client";
import { useEffect, useState } from 'react';
import { BarChart, Bar, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/client';
import { Field, GlassCard } from '../ui/edupilot';
import { Attempt, DecisionTimeline, LearningEmpty, LearningError, LearningLoading, Metrics, MetricsCards, percent, Recommendations } from './shared';

function TopicTable({ metrics }: { metrics: Metrics }) {
  return <GlassCard className="learning-card"><h2>Темы и свидетельства</h2><div className="learning-table-scroll"><table className="learning-table"><thead><tr><th>Тема</th><th>Верно / всего</th><th>Точность</th><th>Mastery</th></tr></thead><tbody>{metrics.topics.map(t => <tr key={t.id}><td>{t.name}</td><td>{t.correct} / {t.total}</td><td>{percent(t.accuracy)}</td><td>{percent(t.mastery)}</td></tr>)}</tbody></table></div><small>«—» означает отсутствие ответов. Mastery — показатель по правилам с учётом сложности и повторов, а не школьная оценка.</small></GlassCard>;
}

function ErrorPatterns({ attempts }: { attempts: Attempt[] }) {
  const errors = new Map<string, number>();
  for (const a of attempts) if (!a.correct) for (const tag of a.errorTagsJson) errors.set(tag, (errors.get(tag) || 0) + 1);
  return <GlassCard className="learning-card"><h2>Над чем поработать</h2>{errors.size ? <ul className="learning-error-patterns">{[...errors].sort((a, b) => b[1] - a[1]).map(([tag, count]) => <li key={tag}><span>{tag}</span><strong>{count} {count === 1 ? 'ошибка' : count < 5 ? 'ошибки' : 'ошибок'}</strong></li>)}</ul> : <p>{attempts.length ? 'В этой истории нет ответов с ошибками.' : 'Метки появятся после ответов с ошибками.'}</p>}<small>Метки описывают связанные с заданием знания. Это основание для повторения темы, а не диагноз причины ошибки.</small></GlassCard>;
}

function EvidenceWarning({ metrics }: { metrics: Metrics }) {
  return metrics.smallSample ? <p className="learning-sample-warning" role="note">Малая выборка: {metrics.total} ответов, меньше 10. Выводы предварительные; проценты могут заметно меняться после каждого ответа.</p> : null;
}

export function LearningProgress() {
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState<{ dataKind: string; metrics: Metrics; attempts: Attempt[]; recommendations: string[] } | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true; setData(null); setError('');
    api(`learning/progress${demo ? '?demo=1' : ''}`).then(result => { if (current) setData(result); }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [demo, revision]);
  return <div className="learning-stack"><label className="learning-check learning-data-switch"><input type="checkbox" checked={demo} onChange={e => setDemo(e.target.checked)} /><span>Показать мои демо-данные<small>Пробные ответы хранятся отдельно от обычного прогресса.</small></span></label><LearningError error={error} retry={() => setRevision(n => n + 1)} />{data ? <><span className="learning-badge">{data.dataKind === 'demo' ? 'Демо-данные' : 'Мои реальные ответы'}</span><MetricsCards metrics={data.metrics} /><EvidenceWarning metrics={data.metrics} />{data.metrics.total === 0 && <LearningEmpty title="Всё начинается с первого ответа">Пройдите тренировку: здесь появятся ваши результаты, ошибки и история подбора сложности.</LearningEmpty>}<TopicTable metrics={data.metrics} /><div className="learning-two-columns"><ErrorPatterns attempts={data.attempts} /><GlassCard className="learning-card"><Recommendations items={data.recommendations} /></GlassCard></div><DecisionTimeline attempts={data.attempts} /></> : !error ? <LearningLoading /> : null}</div>;
}

type Student = { id: string; firstName: string; lastName: string };
type AnalyticsData = { classes: { id: string; name: string }[]; students: Student[]; metrics: Metrics; learners: (Student & Metrics & { mastery: number })[]; attempts: Attempt[] };

export function TeacherAnalytics() {
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true; setLoading(true); setError('');
    const params = new URLSearchParams(); if (classId) params.set('classId', classId); if (studentId) params.set('studentId', studentId);
    api(`learning/analytics?${params}`).then(result => { if (current) setData(result); }).catch(e => { if (current) setError(e.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [classId, studentId, revision]);
  if (!data && loading) return <LearningLoading />;
  return <div className="learning-stack"><LearningError error={error} retry={() => setRevision(n => n + 1)} />{data && <><GlassCard className="learning-card"><div className="learning-form-grid"><Field label="Мой класс"><select value={classId} onChange={e => { setClassId(e.target.value); setStudentId(''); }}><option value="">Все мои классы</option>{data.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Ученик"><select value={studentId} onChange={e => setStudentId(e.target.value)} disabled={loading}><option value="">Все ученики выбранных классов</option>{data.students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}</select></Field></div><p className="learning-muted">Только ваши классы и обычные ответы учеников. Пробные демо-данные исключены. {data.students.length} учеников в выбранных классах.</p></GlassCard>{loading ? <LearningLoading /> : !error && <><MetricsCards metrics={data.metrics} /><EvidenceWarning metrics={data.metrics} />{data.metrics.total === 0 ? <LearningEmpty title="Пока нет ответов учеников">{data.classes.length ? 'Предложите ученикам пройти тренировку. Графики появятся по сохранённым ответам.' : 'Создайте класс и пригласите учеников в разделе «Мои классы».'}</LearningEmpty> : <LearningCharts metrics={data.metrics} />}<TopicTable metrics={data.metrics} />
    <GlassCard className="learning-card"><h2>Ученики выбранных классов</h2>{data.learners.length ? <div className="learning-table-scroll"><table className="learning-table"><thead><tr><th>Ученик</th><th>Верно / всего</th><th>Точность</th><th>Mastery</th><th>Тренировки</th></tr></thead><tbody>{data.learners.map(s => <tr key={s.id}><td><button className="text-button" onClick={() => setStudentId(s.id)}>{s.firstName} {s.lastName}</button></td><td>{s.correct} / {s.total}</td><td>{percent(s.accuracy)}</td><td>{s.total ? percent(s.mastery) : 'Нет данных'}</td><td>{s.completedTrainings}</td></tr>)}</tbody></table></div> : <p>В выбранных классах пока нет учеников.</p>}</GlassCard>{studentId ? <><ErrorPatterns attempts={data.attempts} /><DecisionTimeline attempts={data.attempts} /></> : <p className="learning-muted">Выберите ученика, чтобы открыть его ошибки и журнал решений алгоритма.</p>}</>}</>}</div>;
}

function LearningCharts({ metrics }: { metrics: Metrics }) {
  const tooltipStyle = { background: 'var(--background-secondary)', border: '1px solid var(--border-glass)', borderRadius: 10, color: 'var(--text-primary)' };
  const topicData = metrics.topics.filter(t => t.total > 0).map(t => ({ name: t.name, 'Верных ответов, %': Math.round((t.accuracy || 0) * 100), total: t.total }));
  const distribution = (metrics.masteryDistribution || []).map(d => ({ name: d.level === 1 ? 'Менее 50%' : d.level === 2 ? '50–79%' : '80% и выше', 'Учеников': d.count }));
  return <div className="learning-charts"><GlassCard className="learning-card"><h2>Точность по темам</h2><p>Верные ответы / все ответы по теме</p><div className="learning-chart" role="img" aria-label="Столбчатый график точности по темам"><ResponsiveContainer width="100%" height="100%"><BarChart data={topicData} margin={{ top: 12, right: 8, left: -20, bottom: 40 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" /><XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" /><YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="Верных ответов, %" fill="var(--accent-primary)" radius={[5, 5, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></GlassCard><GlassCard className="learning-card"><h2>Ответы по дням</h2><p>Количество ответов, не накопленная оценка</p><div className="learning-chart" role="img" aria-label="Динамика общего количества и верных ответов по дням"><ResponsiveContainer width="100%" height="100%"><LineChart data={metrics.trend} margin={{ top: 12, right: 12, left: -20, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" /><XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Legend /><Line type="monotone" name="Все ответы" dataKey="total" stroke="var(--accent-secondary)" strokeWidth={2} isAnimationActive={false} /><Line type="monotone" name="Верные" dataKey="correct" stroke="var(--accent-primary)" strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></GlassCard><GlassCard className="learning-card"><h2>Распределение освоения</h2><p>Mastery по ученикам, у которых есть ответы</p><div className="learning-chart" role="img" aria-label="Распределение учеников по показателю освоения"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution} margin={{ top: 12, right: 12, left: -20, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" /><XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="Учеников" fill="var(--accent-secondary)" radius={[5, 5, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><small>Ученики без ответов не включены и не считаются группой с низким освоением.</small><div className="learning-tags">{distribution.map(d => <span key={d.name}>{d.name}: {d['Учеников']}</span>)}</div></GlassCard></div>;
}
