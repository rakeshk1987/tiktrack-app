import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all background jobs
export {
  generateDailyTasksJob,
  dispatchRemindersJob,
  generateExamPrepTasksJob,
  processExpiredMandatoryTasksJob,
  cleanupExpiredDataJob,
  triggerDailyTasksJob,
  triggerReminderDispatchJob,
  triggerExamPrepJob,
  triggerMandatoryTaskExpiryJob,
  triggerCleanupJob,
} from './backgroundJobs';

// Export types for use in other functions
export * from './types/schema';
export * from './taskScheduler';
