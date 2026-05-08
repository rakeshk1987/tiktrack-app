import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGetDocs, mockAddDoc, mockDeleteDoc, mockDeleteFile, mockSendMessage } = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockAddDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockSendMessage: vi.fn(),
}));

// Mock Firebase Admin
vi.mock('firebase-admin', () => {
  const createQuery = () => {
    const query: any = {
      where: vi.fn(() => query),
      orderBy: vi.fn(() => query),
      limit: vi.fn(() => query),
      get: vi.fn(() => mockGetDocs()),
    };
    return query;
  };

  const createDb = () => ({
    collection: vi.fn(() => ({
      ...createQuery(),
      doc: vi.fn(() => ({
        get: vi.fn(() => mockGetDocs()),
      })),
      add: mockAddDoc,
    })),
  });

  const firestore: any = vi.fn(createDb);
  firestore.FieldValue = {
    serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  };
  firestore.Timestamp = {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  };

  return {
    initializeApp: vi.fn(),
    firestore,
    storage: vi.fn(() => ({
      bucket: vi.fn(() => ({
        file: vi.fn(() => ({
          delete: mockDeleteFile,
        })),
      })),
    })),
    messaging: vi.fn(() => ({
      send: mockSendMessage,
    })),
    default: {
      initializeApp: vi.fn(),
      firestore,
      storage: vi.fn(() => ({
        bucket: vi.fn(() => ({
          file: vi.fn(() => ({
            delete: mockDeleteFile,
          })),
        })),
      })),
      messaging: vi.fn(() => ({
        send: mockSendMessage,
      })),
    },
  };
});

vi.mock('firebase-admin/firestore', () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
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

vi.mock('firebase-functions', () => ({
  pubsub: {
    schedule: vi.fn(() => ({
      timeZone: vi.fn(() => ({
        onRun: vi.fn((handler) => ({ run: handler })),
      })),
    })),
  },
  https: {
    onRequest: vi.fn((handler) => handler),
  },
}));

/*
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
*/

import * as admin from 'firebase-admin';
import {
  generateDailyTasksJob,
  dispatchRemindersJob,
  generateExamPrepTasksJob,
  cleanupExpiredDataJob,
} from '../functions/src/backgroundJobs';

describe('Background Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocs.mockReset();
    mockAddDoc.mockReset();
    mockDeleteDoc.mockReset();
    mockDeleteFile.mockReset();
    mockSendMessage.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
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
        .mockResolvedValueOnce({ size: 0, empty: true, docs: [] }) // task logs
        .mockResolvedValue({ empty: true, docs: [] }); // duplicate checks

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
      vi.setSystemTime(new Date('2026-01-12T02:30:00Z'));

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
      vi.setSystemTime(new Date('2026-01-12T02:30:00Z'));

      const result = await dispatchRemindersJob.run({});

      expect(result.totalReminders).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.dispatched).toBe(0);
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

      vi.setSystemTime(new Date('2026-01-12T02:30:00Z'));

      const result = await dispatchRemindersJob.run({});

      expect(result.totalReminders).toBe(1);
      expect(result.errors).toBe(1);
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
        .mockResolvedValueOnce(mockProfile) // profile
        .mockResolvedValue({ empty: true, docs: [] }); // duplicate checks

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
          { ref: { delete: mockDeleteDoc } },
          { ref: { delete: mockDeleteDoc } },
        ],
      };

      const mockOldLogs = {
        size: 1,
        docs: [
          { ref: { delete: mockDeleteDoc } },
        ],
      };

      const mockOldProofLogs = {
        size: 1,
        docs: [
          {
            data: () => ({
              image_url: 'gs://tiktrack-f112b.appspot.com/proofs/child1/proof1.jpg',
            }),
            ref: { delete: mockDeleteDoc },
          },
        ],
      };

      mockDeleteDoc.mockResolvedValue(undefined);
      mockGetDocs
        .mockResolvedValueOnce(mockExpiredTasks) // expired tasks
        .mockResolvedValueOnce(mockOldLogs) // old logs
        .mockResolvedValueOnce(mockOldProofLogs); // old proof logs

      const result = await cleanupExpiredDataJob.run({});

      expect(result.expiredTasksDeleted).toBe(2);
      expect(result.oldLogsDeleted).toBe(1);
      expect(result.proofLogsDeleted).toBe(1);
      expect(mockDeleteDoc).toHaveBeenCalledTimes(4);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Database error'));

      const result = await cleanupExpiredDataJob.run({});

      expect(result.errors).toBe(1);
    });
  });
});
