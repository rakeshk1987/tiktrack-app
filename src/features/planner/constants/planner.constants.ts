import type { PlannerCategory } from '../types/planner.types';

export const PLANNER_EVENT_CATEGORIES: PlannerCategory[] = [
  'school',
  'exam',
  'homework',
  'extracurricular',
  'tuition',
  'personal',
  'custom',
  'holiday',
  'rest_day'
];

export const PLANNER_CATEGORY_COLORS: Record<PlannerCategory, string> = {
  school: '#3b82f6',
  exam: '#ef4444',
  homework: '#eab308',
  extracurricular: '#a855f7',
  tuition: '#f97316',
  personal: '#38bdf8',
  custom: '#c084fc',
  holiday: '#22c55e',
  rest_day: '#14b8a6'
};

export const PLANNER_CATEGORY_ICONS: Record<PlannerCategory, string> = {
  school: '📘',
  exam: '📝',
  homework: '📚',
  extracurricular: '⚽',
  tuition: '🎯',
  personal: '🌟',
  custom: '🧩',
  holiday: '🏖️',
  rest_day: '🛌'
};

export const PLANNER_CATEGORY_PRIORITIES: Record<PlannerCategory, 1 | 2 | 3 | 4> = {
  exam: 1,
  school: 2,
  tuition: 2,
  homework: 2,
  extracurricular: 3,
  personal: 3,
  rest_day: 3,
  holiday: 4,
  custom: 4
};

export const PLANNER_DEFAULT_REMINDERS_MINUTES = [30];

export const PLANNER_BURNOUT_THRESHOLDS = {
  heavy: 24,
  risk: 30
} as const;

export const PLANNER_FEATURE_FLAGS = {
  googleSync: false,
  burnoutEngine: false,
  advancedRecurrence: false
} as const;
