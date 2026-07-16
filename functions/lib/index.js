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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onApprovalCreated = exports.telegramWebhook = exports.triggerCleanupJob = exports.triggerMandatoryTaskExpiryJob = exports.triggerExamPrepJob = exports.triggerReminderDispatchJob = exports.triggerDailyTasksJob = exports.cleanupExpiredDataJob = exports.processExpiredMandatoryTasksJob = exports.generateExamPrepTasksJob = exports.dispatchRemindersJob = exports.generateDailyTasksJob = void 0;
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
// Export Telegram bot functions (webhook + approval trigger)
var telegramBot_1 = require("./telegramBot");
Object.defineProperty(exports, "telegramWebhook", { enumerable: true, get: function () { return telegramBot_1.telegramWebhook; } });
Object.defineProperty(exports, "onApprovalCreated", { enumerable: true, get: function () { return telegramBot_1.onApprovalCreated; } });
// Export types for use in other functions
__exportStar(require("./types/schema"), exports);
__exportStar(require("./taskScheduler"), exports);
//# sourceMappingURL=index.js.map