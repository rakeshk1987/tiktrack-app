import * as functions from 'firebase-functions';
export declare const telegramMiniAppBootstrap: functions.HttpsFunction;
export declare const telegramMiniAppCreateSchedule: functions.HttpsFunction;
export declare const telegramMiniAppListToday: functions.HttpsFunction;
export declare const telegramMiniAppListWeek: functions.HttpsFunction;
export declare const telegramMiniAppDeleteSchedule: functions.HttpsFunction;
/**
 * Firestore trigger: fires whenever a new approval document is created.
 * Sends a Telegram push to all parents linked to the family so they can
 * approve or reject directly from the chat.
 */
export declare const onApprovalCreated: functions.CloudFunction<functions.firestore.QueryDocumentSnapshot>;
export declare const telegramWebhook: functions.HttpsFunction;
