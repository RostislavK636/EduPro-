"use client";
import { BookOpen, ChartNoAxesCombined, Library, Route } from 'lucide-react';
import { useApp } from '../app-context';
import { AnimatedPage } from '../ui/edupilot';
import { Training } from './training';
import { LearningProgress, TeacherAnalytics } from './progress';
import { LearningLibrary } from './library';
import { LearningEmpty } from './shared';

export function LearningPage({ section }: { section?: string }) {
  const { user, navigate } = useApp();
  const teacher = user.role === 'teacher';
  const current = section || 'train';
  const tabs = [{ id: 'train', name: 'Тренировка', icon: Route, path: '/learning' }, { id: 'progress', name: 'Мой прогресс', icon: BookOpen, path: '/learning/progress' }, ...(teacher ? [{ id: 'analytics', name: 'Аналитика обучения', icon: ChartNoAxesCombined, path: '/learning/analytics' }, { id: 'library', name: 'Библиотека заданий', icon: Library, path: '/learning/library' }] : [])];
  const title = current === 'progress' ? 'Мой прогресс' : current === 'analytics' ? 'Аналитика обучения' : current === 'library' ? 'Библиотека заданий' : 'Учебная траектория';
  return <AnimatedPage><div className="learning-page"><header className="page-heading"><span className="eyebrow">ОТ ПЕРВОГО ШАГА К ПОНИМАНИЮ</span><h1>{title}</h1><p>Практика с объяснимым подбором сложности и историей каждого решения.</p></header><nav className="learning-tabs" aria-label="Разделы обучения">{tabs.map(t => <button key={t.id} aria-current={current === t.id ? 'page' : undefined} className={current === t.id ? 'active' : ''} onClick={() => navigate(t.path)}><t.icon size={17} />{t.name}</button>)}</nav>{!teacher && (current === 'analytics' || current === 'library') ? <LearningEmpty title="Раздел для преподавателя">Ученику доступны тренировки и собственный прогресс.</LearningEmpty> : current === 'progress' ? <LearningProgress /> : current === 'analytics' ? <TeacherAnalytics /> : current === 'library' ? <LearningLibrary /> : current === 'train' ? <Training /> : <LearningEmpty title="Раздел не найден">Откройте тренировку или свой прогресс.</LearningEmpty>}</div></AnimatedPage>;
}
