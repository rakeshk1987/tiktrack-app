import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTaskCompletionToProfile,
  calculateAgeFromDob,
  calculateBmi,
  computeLevelFromStars,
  detectWeakSubjects,
  determineDifficultyAdjustment,
  evaluateBadges,
  evaluateStreak,
  getExamPlannerStats,
  getMoodAdjustedTaskLoad,
  processDailyConsistency,
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

  it('prioritizes decrease over increase when both thresholds met', () => {
    expect(determineDifficultyAdjustment(5, 3).direction).toBe('decrease');
  });

  it('provides a reason string for each direction', () => {
    expect(determineDifficultyAdjustment(5, 0).reason).toBeTruthy();
    expect(determineDifficultyAdjustment(1, 3).reason).toBeTruthy();
    expect(determineDifficultyAdjustment(2, 1).reason).toBeTruthy();
  });
});

describe('computeLevelFromStars', () => {
  it('returns level 1 at 0 stars', () => {
    const result = computeLevelFromStars(0);
    expect(result.level).toBe(1);
    expect(result.progress).toBe(0);
  });

  it('returns level 2 at 20 stars', () => {
    const result = computeLevelFromStars(20);
    expect(result.level).toBe(2);
    expect(result.progress).toBe(0);
  });

  it('returns level 1 with 50% progress at 10 stars', () => {
    const result = computeLevelFromStars(10);
    expect(result.level).toBe(1);
    expect(result.progress).toBe(50);
  });

  it('returns level 6 at 100 stars', () => {
    const result = computeLevelFromStars(100);
    expect(result.level).toBe(6);
    expect(result.progress).toBe(0);
  });

  it('handles large star counts', () => {
    const result = computeLevelFromStars(999);
    expect(result.level).toBe(50);
    expect(result.progress).toBe(95);
  });
});

describe('evaluateBadges', () => {
  it('returns Legendary Star for 200+ stars', () => {
    const badges = evaluateBadges({ total_stars: 200, streak_count: 0, consistency_score: 0 });
    expect(badges).toContain('Legendary Star');
  });

  it('returns Master Star for 100+ stars', () => {
    const badges = evaluateBadges({ total_stars: 100, streak_count: 0, consistency_score: 0 });
    expect(badges).toContain('Master Star');
    expect(badges).not.toContain('Legendary Star');
  });

  it('returns Rising Star for 50+ stars', () => {
    const badges = evaluateBadges({ total_stars: 50, streak_count: 0, consistency_score: 0 });
    expect(badges).toContain('Rising Star');
  });

  it('returns no star badge below 50', () => {
    const badges = evaluateBadges({ total_stars: 10, streak_count: 0, consistency_score: 0 });
    expect(badges.filter(b => b.includes('Star'))).toHaveLength(0);
  });

  it('returns Consistency Champion for 21+ streak', () => {
    const badges = evaluateBadges({ total_stars: 0, streak_count: 21, consistency_score: 0 });
    expect(badges).toContain('Consistency Champion');
  });

  it('returns Steady Streak for 7+ streak', () => {
    const badges = evaluateBadges({ total_stars: 0, streak_count: 7, consistency_score: 0 });
    expect(badges).toContain('Steady Streak');
    expect(badges).not.toContain('Consistency Champion');
  });

  it('returns Consistent Hero for 85+ consistency', () => {
    const badges = evaluateBadges({ total_stars: 0, streak_count: 0, consistency_score: 85 });
    expect(badges).toContain('Consistent Hero');
  });

  it('returns empty for a fresh profile', () => {
    const badges = evaluateBadges({ total_stars: 0, streak_count: 0, consistency_score: 0 });
    expect(badges).toEqual([]);
  });

  it('handles undefined fields gracefully', () => {
    const badges = evaluateBadges({});
    expect(badges).toEqual([]);
  });
});

describe('applyTaskCompletionToProfile', () => {
  const baseProfile = {
    total_stars: 10,
    streak_count: 3,
    streak_shields: 0,
    consistency_score: 50,
    last_task_date: '2026-04-08'
  };

  it('adds star value on success', () => {
    const { updatedProfile } = applyTaskCompletionToProfile(baseProfile, 2, true, '2026-04-09');
    expect(updatedProfile.total_stars).toBe(12);
  });

  it('adds early bird bonus on success', () => {
    const { updatedProfile } = applyTaskCompletionToProfile(baseProfile, 2, true, '2026-04-09', true);
    expect(updatedProfile.total_stars).toBe(17); // 10 + 2 + 5
  });

  it('increments streak only once per day', () => {
    const { updatedProfile } = applyTaskCompletionToProfile(baseProfile, 1, true, '2026-04-09');
    expect(updatedProfile.streak_count).toBe(4);
    expect(updatedProfile.last_task_date).toBe('2026-04-09');

    // Second task same day
    const { updatedProfile: second } = applyTaskCompletionToProfile(updatedProfile, 1, true, '2026-04-09');
    expect(second.streak_count).toBe(4); // unchanged
  });

  it('grants shield at 7-day milestone', () => {
    const profile = { ...baseProfile, streak_count: 6, streak_shields: 0 };
    const { updatedProfile } = applyTaskCompletionToProfile(profile, 1, true, '2026-04-09');
    expect(updatedProfile.streak_count).toBe(7);
    expect(updatedProfile.streak_shields).toBe(1);
  });

  it('does not add stars on failure', () => {
    const { updatedProfile } = applyTaskCompletionToProfile(baseProfile, 5, false, '2026-04-09');
    expect(updatedProfile.total_stars).toBe(10);
  });

  it('updates consistency score with exponential moving average', () => {
    const { updatedProfile } = applyTaskCompletionToProfile(baseProfile, 1, true, '2026-04-09');
    // prev=50, sample=100 => 50*0.8 + 100*0.2 = 60
    expect(updatedProfile.consistency_score).toBe(60);
  });

  it('returns levelInfo and badges', () => {
    const result = applyTaskCompletionToProfile(baseProfile, 1, true, '2026-04-09');
    expect(result.levelInfo).toBeDefined();
    expect(result.badges).toBeDefined();
    expect(result.levelInfo.level).toBeGreaterThanOrEqual(1);
  });
});

describe('processDailyConsistency', () => {
  it('initializes last_streak_eval on first run', () => {
    const profile = { streak_count: 5, streak_shields: 1, total_stars: 20 };
    const result = processDailyConsistency(profile, '2026-04-09');
    expect(result.updated.last_streak_eval).toBe('2026-04-09');
    expect(result.adjustmentTrigger).toBe('normal');
    expect(result.missedDays).toBe(0);
  });

  it('returns unchanged if already evaluated today', () => {
    const profile = { streak_count: 5, streak_shields: 1, total_stars: 20, last_streak_eval: '2026-04-09' };
    const result = processDailyConsistency(profile, '2026-04-09');
    expect(result.shieldUsed).toBe(false);
    expect(result.streakReset).toBe(false);
  });

  it('returns mastery trigger for 21+ streak evaluated today', () => {
    const profile = { streak_count: 21, streak_shields: 0, total_stars: 100, last_streak_eval: '2026-04-09' };
    const result = processDailyConsistency(profile, '2026-04-09');
    expect(result.adjustmentTrigger).toBe('mastery');
  });

  it('consumes shield when one missed day exists', () => {
    const profile = {
      streak_count: 5, streak_shields: 1, total_stars: 20,
      last_streak_eval: '2026-04-07', last_task_date: '2026-04-07'
    };
    const result = processDailyConsistency(profile, '2026-04-09');
    expect(result.shieldUsed).toBe(true);
    expect(result.updated.streak_shields).toBe(0);
    expect(result.updated.streak_count).toBe(5); // protected
  });

  it('resets streak and penalizes stars when no shields', () => {
    const profile = {
      streak_count: 5, streak_shields: 0, total_stars: 50,
      last_streak_eval: '2026-04-06', last_task_date: '2026-04-06'
    };
    const result = processDailyConsistency(profile, '2026-04-09');
    expect(result.streakReset).toBe(true);
    expect(result.updated.streak_count).toBe(0);
    expect(result.pointsReduced).toBeGreaterThan(0);
  });

  it('triggers struggle when 3+ days missed', () => {
    const profile = {
      streak_count: 5, streak_shields: 0, total_stars: 50,
      last_streak_eval: '2026-04-05', last_task_date: '2026-04-05'
    };
    const result = processDailyConsistency(profile, '2026-04-09');
    expect(result.adjustmentTrigger).toBe('struggle');
  });

  it('skips penalties in sick mode', () => {
    const profile = {
      streak_count: 5, streak_shields: 0, total_stars: 50,
      last_streak_eval: '2026-04-06', last_task_date: '2026-04-06',
      is_sick_mode: true
    };
    const result = processDailyConsistency(profile, '2026-04-09');
    expect(result.streakReset).toBe(false);
    expect(result.pointsReduced).toBe(0);
  });
});

describe('getExamPlannerStats', () => {
  it('returns null for nearest exam when no exams exist', () => {
    const result = getExamPlannerStats([], []);
    expect(result.nearestExam).toBeNull();
    expect(result.isLightDay).toBe(false);
    expect(result.daysRemaining).toBe(-1);
    expect(result.virtualTasks).toHaveLength(0);
  });

  it('generates virtual study task within 14-day window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T08:00:00'));
    const events = [{ id: 'e1', type: 'exam', title: 'Math Final', date: '2026-04-15T00:00:00', reminder_days_before: 3 }];
    const result = getExamPlannerStats(events as any, []);
    expect(result.nearestExam).not.toBeNull();
    expect(result.virtualTasks.length).toBeGreaterThan(0);
    expect(result.virtualTasks[0].title).toContain('Math Final');
    vi.useRealTimers();
  });

  it('marks light day when exam is 1 day away', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-14T08:00:00'));
    const events = [{ id: 'e1', type: 'exam', title: 'Science', date: '2026-04-15T00:00:00', reminder_days_before: 1 }];
    const result = getExamPlannerStats(events as any, []);
    expect(result.isLightDay).toBe(true);
    vi.useRealTimers();
  });

  it('generates Final Review task on exam day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T08:00:00'));
    const events = [{ id: 'e1', type: 'exam', title: 'English', date: '2026-04-15T00:00:00', reminder_days_before: 1 }];
    const result = getExamPlannerStats(events as any, []);
    expect(result.daysRemaining).toBe(0);
    expect(result.virtualTasks[0].title).toContain('Final Review');
    vi.useRealTimers();
  });

  it('ignores past exams', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T08:00:00'));
    const events = [{ id: 'e1', type: 'exam', title: 'Old', date: '2026-04-10T00:00:00', reminder_days_before: 1 }];
    const result = getExamPlannerStats(events as any, []);
    expect(result.nearestExam).toBeNull();
    vi.useRealTimers();
  });

  it('awards more stars when exam is closer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T08:00:00'));
    const events = [{ id: 'e1', type: 'exam', title: 'Math', date: '2026-04-15T00:00:00', reminder_days_before: 1 }];
    const result = getExamPlannerStats(events as any, []);
    expect(result.virtualTasks[0].star_value).toBe(4); // <=3 days = 4 stars
    vi.useRealTimers();
  });
});

