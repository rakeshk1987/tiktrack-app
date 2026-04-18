import { describe, it, expect } from 'vitest';
import { computeLevelFromStars, evaluateBadges, applyTaskCompletionToProfile, processDailyConsistency, getExamPlannerStats } from '../src/hooks/useCoreLogic';
import type { Task, Event } from '../src/types/schema';

describe('useCoreLogic', () => {
  
  describe('computeLevelFromStars', () => {
    it('computes level correctly for 0 stars', () => {
      const res = computeLevelFromStars(0);
      expect(res.level).toBe(1);
      expect(res.progress).toBe(0);
    });

    it('computes level correctly for exact multiple (e.g. 20, 40)', () => {
      const res1 = computeLevelFromStars(20);
      expect(res1.level).toBe(2);
      expect(res1.progress).toBe(0);
      
      const res2 = computeLevelFromStars(40);
      expect(res2.level).toBe(3);
      expect(res2.progress).toBe(0);
    });

    it('computes sub-level progress percentage', () => {
      const res = computeLevelFromStars(5);
      expect(res.level).toBe(1);
      expect(res.progress).toBe(25); // 5/20 = 25%
    });
  });

  describe('evaluateBadges', () => {
    it('grants Legendary Star for >= 200 stars', () => {
      const badges = evaluateBadges({ total_stars: 200, streak_count: 0, consistency_score: 0 });
      expect(badges).toContain('Legendary Star');
    });

    it('grants Master Star for >= 100 stars', () => {
      const badges = evaluateBadges({ total_stars: 150, streak_count: 0, consistency_score: 0 });
      expect(badges).toContain('Master Star');
      expect(badges).not.toContain('Legendary Star');
    });

    it('grants Rising Star for >= 50 stars', () => {
      const badges = evaluateBadges({ total_stars: 55, streak_count: 0, consistency_score: 0 });
      expect(badges).toContain('Rising Star');
    });

    it('grants Consistency Champion for >= 21 streak', () => {
      const badges = evaluateBadges({ total_stars: 0, streak_count: 22, consistency_score: 0 });
      expect(badges).toContain('Consistency Champion');
    });

    it('grants Steady Streak for >= 7 streak', () => {
      const badges = evaluateBadges({ total_stars: 0, streak_count: 7, consistency_score: 0 });
      expect(badges).toContain('Steady Streak');
    });

    it('grants Consistent Hero for >= 85 consistency score', () => {
      const badges = evaluateBadges({ total_stars: 0, streak_count: 0, consistency_score: 85 });
      expect(badges).toContain('Consistent Hero');
    });
  });

  describe('applyTaskCompletionToProfile', () => {
    it('adds stars on success', () => {
      const prof = { total_stars: 10, consistency_score: 50 };
      const res = applyTaskCompletionToProfile(prof, 3, true, '2026-04-18');
      expect(res.updatedProfile.total_stars).toBe(13);
      // EMA logic: prev=50, sample=100 -> 50*0.8 + 100*0.2 = 40 + 20 = 60
      expect(res.updatedProfile.consistency_score).toBe(60);
    });

    it('adds Early Bird bonus if successful', () => {
      const prof = { total_stars: 10, consistency_score: 50 };
      const res = applyTaskCompletionToProfile(prof, 3, true, '2026-04-18', true); // earlyBird=true
      expect(res.updatedProfile.total_stars).toBe(18); // 10 + 3 + 5 (bonus)
    });

    it('fails task gracefully, doesn\'t add stars, drops consistency', () => {
      const prof = { total_stars: 10, consistency_score: 50 };
      const res = applyTaskCompletionToProfile(prof, 3, false, '2026-04-18');
      expect(res.updatedProfile.total_stars).toBe(10);
      // EMA logic: prev=50, sample=0 -> 50*0.8 + 0 = 40
      expect(res.updatedProfile.consistency_score).toBe(40);
    });

    it('increments streak and grants shield at multiples of 7', () => {
      const prof = { streak_count: 6, streak_shields: 0 };
      const res = applyTaskCompletionToProfile(prof, 1, true, '2026-04-18');
      expect(res.updatedProfile.streak_count).toBe(7);
      expect(res.updatedProfile.streak_shields).toBe(1);
    });

    it('ignores streak if same day', () => {
      const prof = { streak_count: 6, last_task_date: '2026-04-18' };
      const res = applyTaskCompletionToProfile(prof, 1, true, '2026-04-18');
      expect(res.updatedProfile.streak_count).toBe(6); // should not increment
    });
  });

  describe('processDailyConsistency', () => {
    it('returns empty if identical day', () => {
      const profile = { last_streak_eval: '2026-04-18', streak_count: 5, total_stars: 10 };
      const res = processDailyConsistency(profile, '2026-04-18');
      expect(res.updated.streak_count).toBe(5);
      expect(res.updated.total_stars).toBe(10);
      expect(res.missedDays).toBe(0);
    });

    it('returns empty if first initialization', () => {
      const profile = {};
      const res = processDailyConsistency(profile, '2026-04-18');
      expect(res.updated.last_streak_eval).toBe('2026-04-18');
      expect(res.updated.streak_count).toBeUndefined();
    });

    it('absorbs missed day using a streak shield', () => {
      const profile = { last_streak_eval: '2026-04-16', last_task_date: '2026-04-16', streak_count: 10, streak_shields: 1, total_stars: 50 };
      const res = processDailyConsistency(profile, '2026-04-18'); 
      // Diff = 2 days -> 1 day missed
      expect(res.shieldUsed).toBe(true);
      expect(res.updated.streak_shields).toBe(0);
      expect(res.updated.streak_count).toBe(10); // Protected!
      expect(res.updated.total_stars).toBe(50); // Protected!
    });
    
    it('resets streak and deducts stars if no shield on missed day', () => {
      const profile = { last_streak_eval: '2026-04-16', last_task_date: '2026-04-16', streak_count: 10, streak_shields: 0, total_stars: 50 };
      const res = processDailyConsistency(profile, '2026-04-18'); 
      expect(res.shieldUsed).toBe(false);
      expect(res.streakReset).toBe(true);
      expect(res.updated.streak_count).toBe(0); // Lost!
      expect(res.updated.total_stars).toBe(40); // 10 points deducted
    });

    it('ignores missed days if is_sick_mode is true', () => {
      const profile = { is_sick_mode: true, last_streak_eval: '2026-04-10', streak_count: 10, total_stars: 50 };
      const res = processDailyConsistency(profile, '2026-04-18'); 
      expect(res.updated.streak_count).toBe(10); // Protected!
      expect(res.updated.total_stars).toBe(50); // Protected!
    });
  });

  describe('getExamPlannerStats', () => {
    // Tests for dates relative to today
    it('returns nulls if no exams', () => {
      const res = getExamPlannerStats([], []);
      expect(res.nearestExam).toBeNull();
      expect(res.virtualTasks.length).toBe(0);
    });

    it('detects nearest exam and generates virtual task if under 14 days', () => {
      const today = new Date();
      const examDate = new Date();
      examDate.setDate(today.getDate() + 3); // 3 days away
      
      const events = [
        { id: '1', title: 'Math Final', date: examDate.toISOString(), type: 'exam', child_id: 'x', created_at: '' } as Event
      ];
      const res = getExamPlannerStats(events, []);
      
      expect(res.nearestExam?.title).toBe('Math Final');
      expect(res.daysRemaining).toBe(3);
      expect(res.virtualTasks.length).toBe(1);
      expect(res.virtualTasks[0].title).toBe('Focus Quest: Study for Math Final');
      expect(res.virtualTasks[0].star_value).toBe(4); // Under 3 days -> higher reward
    });
  });
});
