import * as functions from 'firebase-functions';
/**
 * Background job: Generate daily tasks for all children at 6:00 AM
 */
export declare const generateDailyTasksJob: functions.CloudFunction<unknown>;
/**
 * Background job: Check and dispatch reminders every hour
 */
export declare const dispatchRemindersJob: functions.CloudFunction<unknown>;
/**
 * Background job: Generate exam prep tasks when exams are approaching
 */
export declare const generateExamPrepTasksJob: functions.CloudFunction<unknown>;
/**
 * Background job: close mandatory timed tasks that passed their expiry window.
 */
export declare const processExpiredMandatoryTasksJob: functions.CloudFunction<unknown>;
/**
 * Background job: Clean up expired tasks and old logs weekly
 */
export declare const cleanupExpiredDataJob: functions.CloudFunction<unknown>;
/**
 * HTTP trigger for manual job execution (for testing)
 */
export declare const triggerDailyTasksJob: functions.HttpsFunction;
export declare const triggerReminderDispatchJob: functions.HttpsFunction;
export declare const triggerExamPrepJob: functions.HttpsFunction;
export declare const triggerMandatoryTaskExpiryJob: functions.HttpsFunction;
export declare const triggerCleanupJob: functions.HttpsFunction;
