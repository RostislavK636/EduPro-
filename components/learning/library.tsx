"use client";
import { useEffect, useState } from 'react';
import { CheckCircle2, FileCheck, Sparkles } from 'lucide-react';
import { api } from '@/lib/client';
import { useApp } from '../app-context';
import { Field, GlassCard, GradientButton } from '../ui/edupilot';
import { LearningEmpty, LearningError, LearningLoading, Question, Topic, dateLabel } from './shared';

type TaskStatus = 'draft' | 'pending' | 'approved' | 'rejected';
type Task = { id: string; questionJson: Question; status: TaskStatus; origin: string; model: string | null; classId: string | null; version: number; createdAt: string };
type ClassOption = { id: string; name: string };
const statusNames = { draft: 'Черновик', pending: 'На проверке', approved: 'Одобрено', rejected: 'Отклонено' };

export function LearningLibrary() {
  const { ai } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selected, setSelected] = useState('');
  const [topic, setTopic] = useState('fractions');
  const [level, setLevel] = useState(1);
  const [classId, setClassId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [list, catalog, analytics] = await Promise.all([api('learning/tasks'), api('learning/catalog'), api('learning/analytics')]);
      setTasks(list.tasks); setTopics(catalog.topics); setClasses(analytics.classes);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const create = async () => {
    if (busy) return; setBusy(true); setError('');
    try {
      const { task } = await api('learning/tasks', 'POST', { topic, level, ...(classId ? { classId } : {}) });
      setTasks(old => [task, ...old]); setSelected(task.id);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const save = (next: Task) => setTasks(old => old.map(t => t.id === next.id ? next : t));
  const active = tasks.find(t => t.id === selected);
  if (loading) return <LearningLoading />;
  return <div className="learning-stack"><LearningError error={error} retry={load} /><GlassCard className="learning-card"><div className="learning-row"><div><span className="eyebrow">ОТ ИДЕИ К ПРОВЕРЕННОМУ ЗАДАНИЮ</span><h2>AI создаёт черновик. Решение проверяете вы.</h2></div><FileCheck size={28} /></div><p className="learning-library-note">Проверка схемы JSON не подтверждает правильность ответа. Перед одобрением проверьте условие, эталон, критерии, объяснение и соответствие классу.</p><div className="learning-library-create"><Field label="Тема нового задания"><select value={topic} onChange={e => setTopic(e.target.value)}>{topics.map(t => <option key={t.id} value={t.id}>{t.subject} · {t.name}</option>)}</select></Field><Field label="Сложность нового задания"><select value={level} onChange={e => setLevel(Number(e.target.value))}><option value="1">1 · Базовая</option><option value="2">2 · Средняя</option><option value="3">3 · Продвинутая</option></select></Field><Field label="Класс для нового задания"><select value={classId} onChange={e => setClassId(e.target.value)}><option value="">Без привязки к классу</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><GradientButton onClick={create} disabled={busy || !topics.length}><Sparkles size={16} />{busy ? 'Создаём черновик…' : 'Создать AI-черновик'}</GradientButton></div><small>{ai?.mode === 'live' ? 'AI настроен. Результат запроса будет сохранён только после проверки формата; предметная проверка — за учителем.' : 'Демо AI: будет создан образец из локального банка. Запрос к модели не выполняется.'}</small></GlassCard>
    {!tasks.length ? <LearningEmpty title="В библиотеке пока нет заданий">Создайте первый черновик, отредактируйте его и проведите проверку.</LearningEmpty> : <div className="learning-library-layout"><GlassCard className="learning-card learning-task-list"><div className="learning-row"><h2>Мои задания · {tasks.length}</h2><button className="text-button" onClick={load}>Обновить</button></div>{tasks.map(t => <button className={`learning-task-item ${t.id === selected ? 'active' : ''}`} key={t.id} onClick={() => setSelected(t.id)}><span className={`learning-badge status-${t.status}`}>{statusNames[t.status]}</span><strong>{t.questionJson.prompt}</strong><small>Уровень {t.questionJson.level} · {t.origin === 'demo' ? 'Демо-образец' : 'AI-черновик'} · v{t.version}</small><small>{dateLabel(t.createdAt)}</small></button>)}</GlassCard>{active ? <TaskEditor key={active.id} task={active} classes={classes} onSaved={save} /> : <LearningEmpty title="Выберите задание">Откройте черновик слева, чтобы проверить условие и провести его по этапам проверки.</LearningEmpty>}</div>}
  </div>;
}

function TaskEditor({ task: initialTask, classes, onSaved }: { task: Task; classes: ClassOption[]; onSaved: (task: Task) => void }) {
  const [currentTask, setCurrentTask] = useState(initialTask);
  const [raw, setRaw] = useState(JSON.stringify(initialTask.questionJson, null, 2));
  const [classId, setClassId] = useState(initialTask.classId || '');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setCurrentTask(initialTask); setRaw(JSON.stringify(initialTask.questionJson, null, 2)); setClassId(initialTask.classId || ''); setChecked(false); }, [initialTask]);
  const task = currentTask;
  const dirty = raw !== JSON.stringify(currentTask.questionJson, null, 2) || classId !== (currentTask.classId || '');
  const update = async (status: TaskStatus, editing = false) => {
    if (busy) return; setError('');
    let question: Question | undefined;
    if (editing) {
      try { question = JSON.parse(raw); } catch { setError('JSON не читается. Проверьте кавычки, запятые и скобки.'); return; }
      if (!question || !question.prompt || !question.answer || !question.criteria || !question.explanation) { setError('У задания должны быть условие (prompt), ответ (answer), критерии (criteria) и объяснение (explanation).'); return; }
    }
    setBusy(true);
    try {
      const result = await api(`learning/tasks/${currentTask.id}`, 'PATCH', { version: currentTask.version, status, ...(editing ? { question, classId: classId || null } : {}) });
      setCurrentTask(result.task);
      onSaved(result.task); setChecked(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <GlassCard className="learning-card learning-task-editor" data-testid="learning-task-editor"><div className="learning-row"><span className={`learning-badge status-${task.status}`} data-testid="learning-task-status">{statusNames[task.status]}</span><span className="learning-muted">Версия {task.version}</span></div><span className="learning-badge">{task.origin === 'demo' ? 'Демо-образец' : `AI · ${task.model || 'модель не указана'}`}</span><h2>Предметная проверка задания</h2>{task.origin === 'demo' && <p className="learning-sample-warning">Демо-образцы помечены явно и даже после одобрения не добавляются к обычным тренировкам учеников.</p>}<div className="learning-task-preview"><p><b>Условие:</b> {task.questionJson.prompt}</p><p><b>Эталон для проверки:</b> {task.questionJson.answer}</p><p><b>Критерии:</b> {task.questionJson.criteria}</p><p><b>Объяснение:</b> {task.questionJson.explanation}</p></div><Field label="Класс задания"><select value={classId} onChange={e => setClassId(e.target.value)} disabled={busy}><option value="">Без привязки к классу</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="JSON задания"><textarea className="learning-json" value={raw} onChange={e => { setRaw(e.target.value); setChecked(false); }} spellCheck={false} disabled={busy} /></Field><small>Редактируйте условие, answer, criteria, explanation и метки в JSON. Любые сохранённые правки возвращают задание в черновик и требуют новой проверки. Привязка к своему классу определяет, кому доступно одобренное задание.</small><LearningError error={error} /><div className="learning-editor-actions"><button className="button secondary" onClick={() => update('draft', true)} disabled={busy || !dirty}>Сохранить правки в черновик</button>{(task.status === 'draft' || task.status === 'rejected') && <GradientButton onClick={() => update('pending')} disabled={busy || dirty}>На проверку</GradientButton>}{task.status === 'pending' && <><label className="learning-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} disabled={busy || dirty} /><span>Я проверил условие, ответ, критерии и объяснение</span></label><GradientButton onClick={() => update('approved')} disabled={busy || dirty || !checked}><CheckCircle2 size={16} />Одобрить</GradientButton><button className="button secondary" onClick={() => update('rejected')} disabled={busy || dirty}>Отклонить</button></>}{task.status === 'approved' && <p className="learning-correct">Одобрено преподавателем. Чтобы изменить задание, сохраните правки в черновик.</p>}{dirty && <p className="learning-muted">Есть несохранённые правки. Сохраните их до изменения статуса.</p>}</div></GlassCard>;
}
