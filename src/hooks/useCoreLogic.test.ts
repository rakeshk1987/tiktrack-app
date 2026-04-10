import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateAgeFromDob,
  calculateBmi,
  detectWeakSubjects,
  determineDifficultyAdjustment,
  evaluateStreak,
  getMoodAdjustedTaskLoad,
  useEnergySync
} from './useCoreLogic';
import type { ExamResult, Task } from '../types/schema';

const baseTasks: Task[] = [
  {
    id: '1',
    title: 'Math Homework',
    category: 'Academic',
    priority: 'high',
    energy_level: 'high',
    difficulty_level: 5,
    star_value: 2,
    requires_proof: true
  },
  {
    id: '2',
    title: 'Drawing',
    category: 'Creative',
    priority: 'medium',
    energy_level: 'low',
    difficulty_level: 2,
    star_value: 1,
    requires_proof: false
  },
  {
    id: '3',
    title: 'Science Notes',
    category: 'Academic',
    priority: 'medium',
    energy_level: 'medium',
    difficulty_level: 3,
    star_value: 1,
    requires_proof: false
  }
];

describe('useEnergySync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recommends high-focus tasks in morning', () => {
    vi.setSystemTime(new Date(2026, 3, 9, 9, 0, 0));
    const result = useEnergySync(baseTasks);
    expect(result.timeOfDay).toBe('morning');
    expect(result.recommendedTasks.map((t) => t.id)).toEqual(['1']);
  });

  it('recommends low/creative tasks in evening', () => {
    vi.setSystemTime(new Date(2026, 3, 9, 18, 30, 0));
    const result = useEnergySync(baseTasks);
    expect(result.timeOfDay).toBe('evening');
    expect(result.recommendedTasks.map((t) => t.id)).toEqual(['2']);
  });

  it('returns all tasks in afternoon', () => {
    vi.setSystemTime(new Date(2026, 3, 9, 14, 0, 0));
    const result = useEnergySync(baseTasks);
    expect(result.timeOfDay).toBe('afternoon');
    expect(result.recommendedTasks).toHaveLength(baseTasks.length);
  });
});

describe('evaluateStreak', () => {
  it('marks mastery when streak reaches 21', () => {
    const result = evaluateStreak(21);
    expect(result.masteryAchieved).toBe(true);
    expect(result.message).toContain('Mastery unlocked');
  });

  it('shows remaining days when below threshold', () => {
    const result = evaluateStreak(20);
    expect(result.masteryAchieved).toBe(false);
    expect(result.message).toContain('1 days left');
  });

  it('handles zero streak as non-mastery', () => {
    const result = evaluateStreak(0);
    expect(result.masteryAchieved).toBe(false);
    expect(result.message).toContain('21 days left');
  });
});

describe('calculateAgeFromDob', () => {
  it('calculates age based on birthday passed in current year', () => {
    expect(calculateAgeFromDob('2016-01-10', new Date('2026-04-10'))).toBe(10);
  });

  it('reduces age when birthday has not yet happened this year', () => {
    expect(calculateAgeFromDob('2016-12-10', new Date('2026-04-10'))).toBe(9);
  });
});

describe('calculateBmi', () => {
  it('returns bmi rounded to one decimal place', () => {
    expect(calculateBmi(140, 32)).toBe(16.3);
  });

  it('returns zero for invalid values', () => {
    expect(calculateBmi(0, 20)).toBe(0);
  });
});

describe('detectWeakSubjects', () => {
  const exams: ExamResult[] = [
    { id: '1', child_id: 'c1', subject: 'Math', marks_scored: 45, total_marks: 100, exam_date: '2026-04-01' },
    { id: '2', child_id: 'c1', subject: 'Science', marks_scored: 80, total_marks: 100, exam_date: '2026-04-01' },
    { id: '3', child_id: 'c1', subject: 'Math', marks_scored: 25, total_marks: 50, exam_date: '2026-04-03' }
  ];

  it('sorts subjects from weakest to strongest', () => {
    const result = detectWeakSubjects(exams);
    expect(result[0]).toEqual({ subject: 'Math', percentage: 47 });
    expect(result[1]).toEqual({ subject: 'Science', percentage: 80 });
  });
});

describe('getMoodAdjustedTaskLoad', () => {
  it('reduces task load for sad mood', () => {
    expect(getMoodAdjustedTaskLoad('sad').loadFactor).toBe(0.7);
  });

  it('increases task load for excited mood', () => {
    expect(getMoodAdjustedTaskLoad('excited').loadFactor).toBe(1.2);
  });
});

describe('determineDifficultyAdjustment', () => {
  it('suggests decreasing difficulty after repeated misses', () => {
    expect(determineDifficultyAdjustment(1, 3).direction).toBe('decrease');
  });

  it('suggests increasing difficulty after a strong streak', () => {
    expect(determineDifficultyAdjustment(5, 0).direction).toBe('increase');
  });

  it('keeps difficulty when neither threshold is met', () => {
    expect(determineDifficultyAdjustment(2, 1).direction).toBe('keep');
  });
});
