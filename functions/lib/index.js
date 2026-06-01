"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramWebhook = exports.telegramMiniAppListWeek = exports.telegramMiniAppListToday = exports.telegramMiniAppDeleteSchedule = exports.telegramMiniAppCreateSchedule = exports.telegramMiniAppBootstrap = exports.triggerCleanupJob = exports.triggerMandatoryTaskExpiryJob = exports.triggerExamPrepJob = exports.triggerReminderDispatchJob = exports.triggerDailyTasksJob = exports.cleanupExpiredDataJob = exports.processExpiredMandatoryTasksJob = exports.generateExamPrepTasksJob = exports.dispatchRemindersJob = exports.generateDailyTasksJob = void 0;
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin
admin.initializeApp();
// Export all background jobs
var backgroundJobs_1 = require("./backgroundJobs");
Object.defineProperty(exports, "generateDailyTasksJob", { enumerable: true, get: function () { return backgroundJobs_1.generateDailyTasksJob; } });
Object.defineProperty(exports, "dispatchRemindersJob", { enumerable: true, get: function () { return backgroundJobs_1.dispatchRemindersJob; } });
Object.defineProperty(exports, "generateExamPrepTasksJob", { enumerable: true, get: function () { return backgroundJobs_1.generateExamPrepTasksJob; } });
Object.defineProperty(exports, "processExpiredMandatoryTasksJob", { enumerable: true, get: function () { return backgroundJobs_1.processExpiredMandatoryTasksJob; } });
Object.defineProperty(exports, "cleanupExpiredDataJob", { enumerable: true, get: function () { return backgroundJobs_1.cleanupExpiredDataJob; } });
Object.defineProperty(exports, "triggerDailyTasksJob", { enumerable: true, get: function () { return backgroundJobs_1.triggerDailyTasksJob; } });
Object.defineProperty(exports, "triggerReminderDispatchJob", { enumerable: true, get: function () { return backgroundJobs_1.triggerReminderDispatchJob; } });
Object.defineProperty(exports, "triggerExamPrepJob", { enumerable: true, get: function () { return backgroundJobs_1.triggerExamPrepJob; } });
Object.defineProperty(exports, "triggerMandatoryTaskExpiryJob", { enumerable: true, get: function () { return backgroundJobs_1.triggerMandatoryTaskExpiryJob; } });
Object.defineProperty(exports, "triggerCleanupJob", { enumerable: true, get: function () { return backgroundJobs_1.triggerCleanupJob; } });
var telegramBot_1 = require("./telegramBot");
Object.defineProperty(exports, "telegramMiniAppBootstrap", { enumerable: true, get: function () { return telegramBot_1.telegramMiniAppBootstrap; } });
Object.defineProperty(exports, "telegramMiniAppCreateSchedule", { enumerable: true, get: function () { return telegramBot_1.telegramMiniAppCreateSchedule; } });
Object.defineProperty(exports, "telegramMiniAppDeleteSchedule", { enumerable: true, get: function () { return telegramBot_1.telegramMiniAppDeleteSchedule; } });
Object.defineProperty(exports, "telegramMiniAppListToday", { enumerable: true, get: function () { return telegramBot_1.telegramMiniAppListToday; } });
Object.defineProperty(exports, "telegramMiniAppListWeek", { enumerable: true, get: function () { return telegramBot_1.telegramMiniAppListWeek; } });
Object.defineProperty(exports, "telegramWebhook", { enumerable: true, get: function () { return telegramBot_1.telegramWebhook; } });
// Export types for use in other functions
__exportStar(require("./types/schema"), exports);
__exportStar(require("./taskScheduler"), exports);
//# sourceMappingURL=index.js.map