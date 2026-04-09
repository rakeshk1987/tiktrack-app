import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateStreak, useEnergySync } from './useCoreLogic';
import type { Task } from '../types/schema';

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
