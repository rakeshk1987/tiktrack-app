import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
  initializeApp: vi.fn(),
  firestore: {
    Timestamp: {
      fromDate: vi.fn((date) => ({ toDate: () => date })),
    },
  },
  messaging: vi.fn(() => ({
    send: vi.fn(),
  })),
}));

// Mock Firestore
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
      })),
      where: vi.fn(() => ({
        get: vi.fn(() => mockGetDocs()),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(() => mockGetDocs()),
          })),
          get: vi.fn(() => mockGetDocs()),
        })),
      })),
      add: mockAddDoc,
      delete: mockDeleteDoc,
    })),
  })),
}));

import * as admin from 'firebase-admin';
import {
  generateDailyTasksJob,
  dispatchRemindersJob,
  generateExamPrepTasksJob,
  cleanupExpiredDataJob,
} from '../src/backgroundJobs';

describe('Background Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDailyTasksJob', () => {
    it('should generate tasks for active children', async () => {
      // Mock children data
      const mockChildren = [
        {
          id: 'child1',
          data: () => ({
            name: 'Test Child',
            date_of_birth: '2015-01-01',
            streak_count: 5,
            consistency_score: 70,
            total_stars: 50,
            is_active: true,
            user_id: 'user1',
          }),
        },
      ];

      const mockRoutine = {
        docs: [{
          data: () => ({
            current_mode: 'academic',
            school_days_routine: [
              { name: 'Study Time', start_time: '18:00', end_time: '19:00', category: 'study' },
            ],
          }),
        }],
      };

      // Setup mocks
      mockGetDocs
        .mockResolvedValueOnce({ size: 1, docs: mockChildren }) // children
        .mockResolvedValueOnce({ empty: false, docs: mockRoutine.docs }) // routine
        .mockResolvedValueOnce({ empty: true, docs: [] }) // exams
        .mockResolvedValueOnce({ empty: true, docs: [] }) // events
        .mockResolvedValueOnce({ empty: true, docs: [] }) // mood
        .mockResolvedValueOnce({ empty: true, docs: [] }); // task logs

      mockAddDoc.mockResolvedValue({ id: 'task1' });

      const result = await generateDailyTasksJob.run({});

      expect(result.totalChildren).toBe(1);
      expect(result.successfulGenerations).toBe(1);
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should handle children without routines', async () => {
      const mockChildren = [
        {
          id: 'child1',
          data: () => ({
            name: 'Test Child',
            is_active: true,
          }),
        },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ size: 1, docs: mockChildren }) // children
        .mockResolvedValueOnce({ empty: true, docs: [] }); // no routine

      const result = await generateDailyTasksJob.run({});

      expect(result.totalChildren).toBe(1);
      expect(result.successfulGenerations).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      const mockChildren = [
        {
          id: 'child1',
          data: () => ({
            name: 'Test Child',
            is_active: true,
          }),
        },
      ];

      mockGetDocs
        .mockResolvedValueOnce({ size: 1, docs: mockChildren })
        .mockRejectedValueOnce(new Error('Database error'));

      const result = await generateDailyTasksJob.run({});

      expect(result.totalChildren).toBe(1);
      expect(result.failedGenerations).toBe(1);
    });
  });

  describe('dispatchRemindersJob', () => {
    it('should dispatch active reminders', async () => {
      const mockReminders = [
        {
          id: 'reminder1',
          data: () => ({
            child_id: 'child1',
            parent_id: 'parent1',
            type: 'morning_greeting',
            title: 'Good Morning!',
            message: 'Time to start your day!',
            is_active: true,
            frequency: 'daily',
            scheduled_time: 8, // 8 AM
          }),
        },
      ];

      const mockProfile = {
        exists: true,
        data: () => ({
          fcm_token: 'token123',
        }),
      };

      // Setup mocks
      mockGetDocs
        .mockResolvedValueOnce({ size: 1, docs: mockReminders }) // reminders
        .mockResolvedValueOnce(mockProfile); // profile

      const mockMessaging = {
        send: vi.fn().mockResolvedValue('messageId'),
      };
      (admin.messaging as any).mockReturnValue(mockMessaging);

      // Mock current time to be 8 AM
      const originalDate = Date;
      global.Date = vi.fn(() => ({
        getHours: () => 8,
        getDay: () => 1, // Monday
        toISOString: () => '2026-01-15T08:00:00Z',
      })) as any;

      const result = await dispatchRemindersJob.run({});

      expect(result.totalReminders).toBe(1);
      expect(result.dispatched).toBe(1);
      expect(mockMessaging.send).toHaveBeenCalledWith({
        token: 'token123',
        notification: {
          title: 'Good Morning!',
          body: 'Time to start your day!',
        },
        data: {
          type: 'reminder',
          reminder_id: 'reminder1',
          child_id: 'child1',
        },
      });

      global.Date = originalDate;
    });

    it('should skip reminders not scheduled for current time', async () => {
      const mockReminders = [
        {
          id: 'reminder1',
          data: () => ({
            is_active: true,
            frequency: 'daily',
            scheduled_time: 9, // 9 AM
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ size: 1, docs: mockReminders });

      // Mock current time to be 8 AM
      const originalDate = Date;
      global.Date = vi.fn(() => ({
        getHours: () => 8, // Different from scheduled time
        getDay: () => 1,
      })) as any;

      const result = await dispatchRemindersJob.run({});

      expect(result.totalReminders).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.dispatched).toBe(0);

      global.Date = originalDate;
    });

    it('should handle missing FCM tokens', async () => {
      const mockReminders = [
        {
          id: 'reminder1',
          data: () => ({
            child_id: 'child1',
            is_active: true,
            frequency: 'daily',
            scheduled_time: 8,
          }),
        },
      ];

      const mockProfile = {
        exists: true,
        data: () => ({
          // No fcm_token
        }),
      };

      mockGetDocs
        .mockResolvedValueOnce({ size: 1, docs: mockReminders })
        .mockResolvedValueOnce(mockProfile);

      const originalDate = Date;
      global.Date = vi.fn(() => ({
        getHours: () => 8,
        getDay: () => 1,
      })) as any;

      const result = await dispatchRemindersJob.run({});

      expect(result.totalReminders).toBe(1);
      expect(result.errors).toBe(1);

      global.Date = originalDate;
    });
  });

  describe('generateExamPrepTasksJob', () => {
    it('should generate exam prep tasks for upcoming exams', async () => {
      const mockExams = [
        {
          id: 'exam1',
          data: () => ({
            child_id: 'child1',
            type: 'exam',
            title: 'Math Exam',
            date: '2026-01-20T00:00:00Z', // 5 days from now
          }),
        },
      ];

      const mockProfile = {
        exists: true,
        data: () => ({
          name: 'Test Child',
          streak_count: 5,
          consistency_score: 70,
        }),
      };

      mockGetDocs
        .mockResolvedValueOnce({ size: 1, docs: mockExams }) // exams
        .mockResolvedValueOnce(mockProfile); // profile

      mockAddDoc.mockResolvedValue({ id: 'task1' });

      const result = await generateExamPrepTasksJob.run({});

      expect(result.totalExams).toBe(1);
      expect(result.tasksGenerated).toBeGreaterThan(0);
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should skip exams that are too far in the future', async () => {
      const mockExams = [
        {
          id: 'exam1',
          data: () => ({
            child_id: 'child1',
            type: 'exam',
            title: 'Math Exam',
            date: '2026-02-15T00:00:00Z', // 31 days from now
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ size: 1, docs: mockExams });

      const result = await generateExamPrepTasksJob.run({});

      expect(result.totalExams).toBe(1);
      expect(result.tasksGenerated).toBe(0);
    });
  });

  describe('cleanupExpiredDataJob', () => {
    it('should delete expired tasks and old logs', async () => {
      const mockExpiredTasks = {
        size: 2,
        docs: [
          { ref: { delete: mockDeleteDoc.mockResolvedValueOnce() } },
          { ref: { delete: mockDeleteDoc.mockResolvedValueOnce() } },
        ],
      };

      const mockOldLogs = {
        size: 1,
        docs: [
          { ref: { delete: mockDeleteDoc.mockResolvedValueOnce() } },
        ],
      };

      mockGetDocs
        .mockResolvedValueOnce(mockExpiredTasks) // expired tasks
        .mockResolvedValueOnce(mockOldLogs); // old logs

      const result = await cleanupExpiredDataJob.run({});

      expect(result.expiredTasksDeleted).toBe(2);
      expect(result.oldLogsDeleted).toBe(1);
      expect(mockDeleteDoc).toHaveBeenCalledTimes(3);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Database error'));

      const result = await cleanupExpiredDataJob.run({});

      expect(result.errors).toBe(1);
    });
  });
});