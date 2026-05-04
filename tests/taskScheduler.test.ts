import { describe, it, expect } from 'vitest';
import {
  generateTasksForSlot,
  generateDailyTasks,
  generateExamPrepTasks,
  generateChallengeTasks,
  generateMotivationalTasks,
  generateSmartDailyTasks,
  DEFAULT_TASK_RULES,
} from '../utils/taskScheduler';
import { RoutineSlot, ChildProfile } from '../types/schema';

describe('Task Scheduler', () => {
  const mockProfile: ChildProfile = {
    id: '1',
    name: 'Test Child',
    date_of_birth: '2015-01-01',
    height_cm: 150,
    weight_kg: 45,
    streak_count: 5,
    streak_shields: 1,
    consistency_score: 70,
    total_stars: 50,
    is_sick_mode: false,
    user_id: 'test',
  };

  const mockStudySlot: RoutineSlot = {
    name: 'Study Time',
    start_time: '18:45',
    end_time: '20:00',
    category: 'study',
  };

  const mockLeisureSlot: RoutineSlot = {
    name: 'Leisure',
    start_time: '20:00',
    end_time: '21:30',
    category: 'leisure',
  };

  describe('generateTasksForSlot', () => {
    it('should generate tasks for study slot', () => {
      const tasks = generateTasksForSlot(mockStudySlot, mockProfile);

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].category).toBe('Mathematics');
      expect(tasks[0].priority).toBe('high');
      expect(tasks[0].energy_level).toBe('high');
    });

    it('should generate tasks for leisure slot', () => {
      const tasks = generateTasksForSlot(mockLeisureSlot, mockProfile);

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].energy_level).toBe('low');
    });

    it('should adjust difficulty based on streak', () => {
      const strongProfile: ChildProfile = {
        ...mockProfile,
        streak_count: 21,
      };

      const tasks = generateTasksForSlot(mockStudySlot, strongProfile);
      expect(tasks[0].difficulty_level).toBeGreaterThan(5);
    });

    it('should adjust stars for sad mood', () => {
      const tasksSad = generateTasksForSlot(mockStudySlot, mockProfile, [], [], 'sad');
      const tasksHappy = generateTasksForSlot(mockStudySlot, mockProfile, [], [], 'happy');

      expect(tasksSad[0].star_value).toBeLessThanOrEqual(tasksHappy[0].star_value);
    });

    it('should boost priority for weak subjects', () => {
      const tasks = generateTasksForSlot(mockStudySlot, mockProfile, ['Mathematics']);

      // At least one task should be boosted to high priority
      expect(tasks.some(t => t.priority === 'high')).toBe(true);
    });

    it('should include generation reason', () => {
      const tasks = generateTasksForSlot(mockStudySlot, mockProfile);

      expect(tasks[0].generation_reason).toContain('Study Time');
    });
  });

  describe('generateDailyTasks', () => {
    it('should generate tasks for full day', () => {
      const routineSlots = [mockStudySlot, mockLeisureSlot];
      const tasks = generateDailyTasks(routineSlots, mockProfile, [], []);

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.length).toBeLessThanOrEqual(10); // Max tasks per day
    });

    it('should detect weak subjects from exams', () => {
      const exams = [
        {
          id: '1',
          child_id: '1',
          subject: 'Math',
          marks_scored: 40,
          total_marks: 100,
          exam_date: '2026-04-01',
        },
        {
          id: '2',
          child_id: '1',
          subject: 'English',
          marks_scored: 85,
          total_marks: 100,
          exam_date: '2026-04-01',
        },
      ];

      const tasks = generateDailyTasks([mockStudySlot], mockProfile, exams, []);
      // Tasks should include Math content
      expect(tasks.some(t => t.title.includes('Math'))).toBe(true);
    });

    it('should cap tasks at maxTasksPerDay', () => {
      const routineSlots = Array(5).fill(mockStudySlot);
      const tasks = generateDailyTasks(routineSlots, mockProfile, [], [], undefined, 3);

      expect(tasks.length).toBeLessThanOrEqual(3);
    });
  });

  describe('generateExamPrepTasks', () => {
    it('should generate exam prep tasks', () => {
      const exam = {
        id: '1',
        child_id: '1',
        type: 'exam',
        title: 'Math Exam',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        reminder_days_before: 7,
      };

      const tasks = generateExamPrepTasks(exam, 3, mockProfile);

      expect(tasks.length).toBe(3);
      expect(tasks[0].title).toContain('Math');
      expect(tasks[0].priority).toBe('high');
      expect(tasks[0].requires_proof).toBe(true);
    });

    it('should increase tasks as exam gets closer', () => {
      const exam = {
        id: '1',
        child_id: '1',
        type: 'exam',
        title: 'Math',
        date: new Date().toISOString(),
        reminder_days_before: 0,
      };

      const tasks1DayBefore = generateExamPrepTasks(exam, 1, mockProfile);
      const tasks3DaysBefore = generateExamPrepTasks(exam, 3, mockProfile);

      expect(tasks1DayBefore.length).toBeGreaterThan(tasks3DaysBefore.length);
    });

    it('should increase star value as exam approaches', () => {
      const exam = {
        id: '1',
        child_id: '1',
        type: 'exam',
        title: 'Math',
        date: new Date().toISOString(),
        reminder_days_before: 0,
      };

      const tasks1DayBefore = generateExamPrepTasks(exam, 1, mockProfile);
      const tasks7DaysBefore = generateExamPrepTasks(exam, 7, mockProfile);

      expect(tasks1DayBefore[0].star_value).toBeGreaterThan(tasks7DaysBefore[0].star_value);
    });
  });

  describe('generateChallengeTasks', () => {
    it('should not generate challenge tasks for non-mastery', () => {
      const tasks = generateChallengeTasks(mockProfile, 75);
      expect(tasks.length).toBe(0);
    });

    it('should generate challenge tasks for mastery level', () => {
      const masteryProfile: ChildProfile = {
        ...mockProfile,
        streak_count: 21,
      };

      const tasks = generateChallengeTasks(masteryProfile, 85);
      expect(tasks.length).toBeGreaterThan(0);
    });

    it('should have high difficulty for challenges', () => {
      const masteryProfile: ChildProfile = {
        ...mockProfile,
        streak_count: 21,
      };

      const tasks = generateChallengeTasks(masteryProfile, 85);
      expect(tasks[0].difficulty_level).toBeGreaterThanOrEqual(8);
    });
  });

  describe('generateMotivationalTasks', () => {
    it('should generate motivational task for sad mood', () => {
      const tasks = generateMotivationalTasks(mockProfile, 'sad');
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].energy_level).toBe('low');
    });

    it('should generate quick win task for zero streak', () => {
      const noStreakProfile: ChildProfile = {
        ...mockProfile,
        streak_count: 0,
      };

      const tasks = generateMotivationalTasks(noStreakProfile);
      expect(tasks.some(t => t.title.includes('Fresh Start'))).toBe(true);
    });

    it('should not generate motivational tasks for strong performers', () => {
      const strongProfile: ChildProfile = {
        ...mockProfile,
        streak_count: 10,
        consistency_score: 85,
      };

      const tasks = generateMotivationalTasks(strongProfile);
      expect(tasks.length).toBe(0);
    });
  });

  describe('generateSmartDailyTasks', () => {
    it('should generate comprehensive daily tasks', () => {
      const routineSlots = [mockStudySlot, mockLeisureSlot];
      const tasks = generateSmartDailyTasks(
        routineSlots,
        mockProfile,
        [],
        [],
        undefined,
        75
      );

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.length).toBeLessThanOrEqual(12);
    });

    it('should combine routine, exam, and challenge tasks', () => {
      const routineSlots = [mockStudySlot];
      const exam = {
        id: '1',
        child_id: '1',
        type: 'exam',
        title: 'Math',
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        reminder_days_before: 7,
      };

      const masteryProfile: ChildProfile = {
        ...mockProfile,
        streak_count: 21,
      };

      const tasks = generateSmartDailyTasks(
        routineSlots,
        masteryProfile,
        [],
        [exam],
        undefined,
        90
      );

      // Should have routine + exam + challenge tasks
      expect(tasks.length).toBeGreaterThan(2);
    });

    it('should prioritize high-priority tasks', () => {
      const routineSlots = [mockStudySlot, mockLeisureSlot];
      const tasks = generateSmartDailyTasks(routineSlots, mockProfile, [], []);

      // First task should be high priority
      expect(tasks[0].priority).toBe('high');
    });
  });

  describe('DEFAULT_TASK_RULES', () => {
    it('should have rules for all routine categories', () => {
      expect(DEFAULT_TASK_RULES.study).toBeDefined();
      expect(DEFAULT_TASK_RULES.leisure).toBeDefined();
      expect(DEFAULT_TASK_RULES.prayer).toBeDefined();
      expect(DEFAULT_TASK_RULES.health).toBeDefined();
    });

    it('should have templates for each category', () => {
      Object.values(DEFAULT_TASK_RULES).forEach(rule => {
        expect(rule.task_templates.length).toBeGreaterThan(0);
        rule.task_templates.forEach(template => {
          expect(template.title_pattern).toBeDefined();
          expect(template.category).toBeDefined();
          expect(template.base_star_value).toBeGreaterThan(0);
        });
      });
    });
  });
});
