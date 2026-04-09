import { describe, expect, it } from 'vitest';
import {
  GAMIFICATION_RULES,
  calculateTaskReward,
  convertStarsToCurrency,
  handleTaskFailure
} from './gamification';

describe('calculateTaskReward', () => {
  it('returns high-focus reward for high energy task', () => {
    expect(
      calculateTaskReward({
        id: '1',
        title: 'Math',
        category: 'Academic',
        priority: 'high',
        energy_level: 'high',
        difficulty_level: 5,
        star_value: 1,
        requires_proof: true
      })
    ).toBe(GAMIFICATION_RULES.STARS_PER_HIGH_FOCUS_TASK);
  });

  it('returns explicit star value for non-high energy tasks', () => {
    expect(
      calculateTaskReward({
        id: '2',
        title: 'Reading',
        category: 'Creative',
        priority: 'medium',
        energy_level: 'low',
        difficulty_level: 2,
        star_value: 3,
        requires_proof: false
      })
    ).toBe(3);
  });

  it('falls back to standard reward when star_value is zero', () => {
    expect(
      calculateTaskReward({
        id: '3',
        title: 'Light task',
        category: 'Habit',
        priority: 'low',
        energy_level: 'low',
        difficulty_level: 1,
        star_value: 0,
        requires_proof: false
      })
    ).toBe(GAMIFICATION_RULES.STARS_PER_STANDARD_TASK);
  });
});

describe('convertStarsToCurrency', () => {
  it('converts stars to rupee-equivalent value', () => {
    expect(convertStarsToCurrency(4)).toBe(20);
  });

  it('returns zero for zero stars', () => {
    expect(convertStarsToCurrency(0)).toBe(0);
  });

  it('preserves sign for negative values', () => {
    expect(convertStarsToCurrency(-2)).toBe(-10);
  });
});

describe('handleTaskFailure', () => {
  it('uses a shield when shields are available', () => {
    const result = handleTaskFailure(2);
    expect(result.shieldUsed).toBe(true);
    expect(result.remainingShields).toBe(1);
    expect(result.success).toBe(false);
  });

  it('does not use a shield when none are available', () => {
    const result = handleTaskFailure(0);
    expect(result.shieldUsed).toBe(false);
    expect(result.remainingShields).toBe(0);
    expect(result.success).toBe(false);
  });

  it('treats negative shield count as no shields', () => {
    const result = handleTaskFailure(-1);
    expect(result.shieldUsed).toBe(false);
    expect(result.remainingShields).toBe(0);
  });
});
