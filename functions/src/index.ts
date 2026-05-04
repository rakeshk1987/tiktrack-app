import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all background jobs
export {
  generateDailyTasksJob,
  dispatchRemindersJob,
  generateExamPrepTasksJob,
  cleanupExpiredDataJob,
  triggerDailyTasksJob,
  triggerReminderDispatchJob,
  triggerExamPrepJob,
  triggerCleanupJob,
} from './backgroundJobs';

// Export types for use in other functions
export * from './types/schema';
export * from './taskScheduler';