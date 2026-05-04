import { describe, it, expect } from 'vitest';
import {
  calculateMetrics,
  analyzePerformance,
  analyzeHealth,
  analyzeMood,
  generateAlerts,
  generateRecommendations,
} from '../utils/dashboardAnalytics';
import {
  getTaskRecommendations,
  generateMotivationalMessage,
  suggestFocusArea,
  suggestChallenge,
  suggestReward,
} from '../utils/childRecommendations';

describe('Dashboard Analytics', () => {
  describe('calculateMetrics', () => {
    it('should calculate basic metrics from profile', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 5,
        streak_shields: 1,
        consistency_score: 75,
        total_stars: 50,
        is_sick_mode: false,
        user_id: 'test',
      };

      const metrics = calculateMetrics(profile, [], '2026-04-19');

      expect(metrics.current_streak).toBe(5);
      expect(metrics.consistency_score).toBe(75);
      expect(metrics.total_stars_earned).toBe(50);
      expect(metrics.streak_shields).toBe(1);
    });

    it('should calculate level from total stars', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 0,
        streak_shields: 0,
        consistency_score: 50,
        total_stars: 40,
        is_sick_mode: false,
        user_id: 'test',
      };

      const metrics = calculateMetrics(profile, [], '2026-04-19');
      expect(metrics.level).toBe(3); // Math.floor(40 / 20) + 1
    });

    it('should determine consistency trend', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 5,
        streak_shields: 0,
        consistency_score: 85,
        total_stars: 50,
        is_sick_mode: false,
        user_id: 'test',
      };

      const metrics = calculateMetrics(profile, [], '2026-04-19');
      expect(metrics.consistency_trend).toBe('improving');
    });
  });

  describe('analyzePerformance', () => {
    it('should return empty analysis for no exams', () => {
      const analysis = analyzePerformance([]);
      expect(analysis.total_exams_taken).toBe(0);
      expect(analysis.average_exam_score).toBe(0);
    });

    it('should calculate average exam score', () => {
      const exams = [
        {
          id: '1',
          child_id: '1',
          subject: 'Math',
          marks_scored: 80,
          total_marks: 100,
          exam_date: '2026-04-01',
        },
        {
          id: '2',
          child_id: '1',
          subject: 'Math',
          marks_scored: 90,
          total_marks: 100,
          exam_date: '2026-04-15',
        },
      ];

      const analysis = analyzePerformance(exams);
      expect(analysis.average_exam_score).toBe(85);
    });

    it('should identify weak and strong subjects', () => {
      const exams = [
        {
          id: '1',
          child_id: '1',
          subject: 'Math',
          marks_scored: 50,
          total_marks: 100,
          exam_date: '2026-04-01',
        },
        {
          id: '2',
          child_id: '1',
          subject: 'English',
          marks_scored: 90,
          total_marks: 100,
          exam_date: '2026-04-01',
        },
      ];

      const analysis = analyzePerformance(exams);
      expect(analysis.weakest_subjects).toContain('Math');
      expect(analysis.strongest_subjects).toContain('English');
    });
  });

  describe('analyzeHealth', () => {
    it('should return null for no growth logs', () => {
      const health = analyzeHealth([]);
      expect(health).toBeNull();
    });

    it('should calculate BMI correctly', () => {
      const growthLogs = [
        {
          id: '1',
          child_id: '1',
          height_cm: 150,
          weight_kg: 50,
          date: '2026-04-19',
        },
      ];

      const health = analyzeHealth(growthLogs);
      expect(health?.latest_bmi).toBe(Math.round((50 / (1.5 * 1.5)) * 10) / 10);
    });
  });

  describe('analyzeMood', () => {
    it('should identify dominant mood', () => {
      const moods = [
        { id: '1', child_id: '1', date: '2026-04-19', mood: 'happy' as const },
        { id: '2', child_id: '1', date: '2026-04-18', mood: 'happy' as const },
        { id: '3', child_id: '1', date: '2026-04-17', mood: 'sad' as const },
      ];

      const analysis = analyzeMood(moods);
      expect(analysis.dominant_mood).toBe('happy');
    });

    it('should count sad days', () => {
      const moods = [
        { id: '1', child_id: '1', date: '2026-04-19', mood: 'sad' as const },
        { id: '2', child_id: '1', date: '2026-04-18', mood: 'sad' as const },
        { id: '3', child_id: '1', date: '2026-04-17', mood: 'happy' as const },
      ];

      const analysis = analyzeMood(moods);
      expect(analysis.days_sad_this_week).toBe(2);
    });
  });

  describe('generateAlerts', () => {
    it('should generate alert for zero streak', () => {
      const metrics = {
        consistency_score: 50,
        consistency_trend: 'stable' as const,
        total_stars_earned: 10,
        tasks_completed_this_week: 0,
        tasks_completed_this_month: 0,
        completion_rate_this_week: 0,
        current_streak: 0,
        streak_shields: 0,
        level: 1,
        next_level_progress: 50,
      };

      const alerts = generateAlerts(metrics, { total_exams_taken: 0, average_exam_score: 0, recent_exam_trend: 'stable', strongest_subjects: [], weakest_subjects: [] }, { days_sad_this_week: 0, dominant_mood: 'happy', mood_trend: 'healthy', recent_moods: [] }, null);
      expect(alerts.some(a => a.includes('Streak at risk'))).toBe(true);
    });

    it('should generate alert for mastery achievement', () => {
      const metrics = {
        consistency_score: 90,
        consistency_trend: 'improving' as const,
        total_stars_earned: 100,
        tasks_completed_this_week: 5,
        tasks_completed_this_month: 20,
        completion_rate_this_week: 80,
        current_streak: 21,
        streak_shields: 3,
        level: 5,
        next_level_progress: 0,
      };

      const alerts = generateAlerts(metrics, { total_exams_taken: 0, average_exam_score: 0, recent_exam_trend: 'stable', strongest_subjects: [], weakest_subjects: [] }, { days_sad_this_week: 0, dominant_mood: 'happy', mood_trend: 'healthy', recent_moods: [] }, null);
      expect(alerts.some(a => a.includes('mastery'))).toBe(true);
    });
  });
});

describe('Child Recommendations', () => {
  describe('generateMotivationalMessage', () => {
    it('should generate sad mood message', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 0,
        streak_shields: 0,
        consistency_score: 50,
        total_stars: 10,
        is_sick_mode: false,
        user_id: 'test',
      };

      const msg = generateMotivationalMessage(profile, 'sad');
      expect(msg).toContain('💙');
    });

    it('should generate excited mood message', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 0,
        streak_shields: 0,
        consistency_score: 50,
        total_stars: 10,
        is_sick_mode: false,
        user_id: 'test',
      };

      const msg = generateMotivationalMessage(profile, 'excited');
      expect(msg).toContain('🚀');
    });

    it('should generate mastery message', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 21,
        streak_shields: 3,
        consistency_score: 90,
        total_stars: 100,
        is_sick_mode: false,
        user_id: 'test',
      };

      const msg = generateMotivationalMessage(profile);
      expect(msg).toContain('🏆');
    });
  });

  describe('suggestFocusArea', () => {
    it('should suggest focus area for weak subject', () => {
      const exams = [
        {
          id: '1',
          child_id: '1',
          subject: 'Math',
          marks_scored: 40,
          total_marks: 100,
          exam_date: '2026-04-01',
        },
      ];

      const suggestion = suggestFocusArea(exams);
      expect(suggestion).toContain('Math');
    });

    it('should return undefined for strong subjects', () => {
      const exams = [
        {
          id: '1',
          child_id: '1',
          subject: 'Math',
          marks_scored: 90,
          total_marks: 100,
          exam_date: '2026-04-01',
        },
      ];

      const suggestion = suggestFocusArea(exams);
      expect(suggestion).toBeUndefined();
    });
  });

  describe('suggestChallenge', () => {
    it('should suggest start challenge for zero streak', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 0,
        streak_shields: 0,
        consistency_score: 50,
        total_stars: 10,
        is_sick_mode: false,
        user_id: 'test',
      };

      const challenge = suggestChallenge(profile);
      expect(challenge).toContain('3-day');
    });

    it('should suggest almost mastery for 20 day streak', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 20,
        streak_shields: 2,
        consistency_score: 85,
        total_stars: 80,
        is_sick_mode: false,
        user_id: 'test',
      };

      const challenge = suggestChallenge(profile);
      expect(challenge).toContain('mastery');
    });
  });

  describe('suggestReward', () => {
    it('should suggest reward for 50+ stars', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 5,
        streak_shields: 0,
        consistency_score: 60,
        total_stars: 50,
        is_sick_mode: false,
        user_id: 'test',
      };

      const reward = suggestReward(profile);
      expect(reward).toContain('50+');
    });

    it('should return undefined for low stars', () => {
      const profile = {
        id: '1',
        name: 'Test',
        date_of_birth: '2015-01-01',
        height_cm: 150,
        weight_kg: 45,
        streak_count: 0,
        streak_shields: 0,
        consistency_score: 50,
        total_stars: 10,
        is_sick_mode: false,
        user_id: 'test',
      };

      const reward = suggestReward(profile);
      expect(reward).toBeUndefined();
    });
  });
});
