# Background Job Runner - Firebase Cloud Functions Setup Guide

## Overview
The Background Job Runner implements **Feature #16** from the TikTrack skill file, providing automated task generation, reminder dispatching, and data cleanup through Firebase Cloud Functions.

## Architecture

### Scheduled Jobs
1. **Daily Task Generation** (`generateDailyTasksJob`)
   - **Schedule:** 6:00 AM daily (Asia/Karachi timezone)
   - **Purpose:** Generate 7-12 personalized tasks for each active child
   - **Data Sources:** Child profiles, routines, exam history, mood logs, task completion rates

2. **Reminder Dispatch** (`dispatchRemindersJob`)
   - **Schedule:** Every hour on the hour
   - **Purpose:** Send push notifications for active reminders
   - **Data Sources:** Active reminders, child FCM tokens, current time

3. **Exam Prep Tasks** (`generateExamPrepTasksJob`)
   - **Schedule:** 7:00 AM daily (after task generation)
   - **Purpose:** Create intensive study tasks for exams within 14 days
   - **Data Sources:** Upcoming exam events, child profiles

4. **Data Cleanup** (`cleanupExpiredDataJob`)
   - **Schedule:** 2:00 AM every Sunday
   - **Purpose:** Remove expired tasks and old reminder logs
   - **Data Sources:** Task expiration dates, log timestamps

### Manual Triggers (for testing)
- `triggerDailyTasksJob` - HTTP endpoint to manually run daily task generation
- `triggerReminderDispatchJob` - HTTP endpoint to manually run reminder dispatch
- `triggerExamPrepJob` - HTTP endpoint to manually run exam prep generation
- `triggerCleanupJob` - HTTP endpoint to manually run cleanup

## Prerequisites

### 1. Firebase Project Setup
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project (if not already done)
firebase init functions
```

### 2. Enable Required APIs
In Google Cloud Console → APIs & Services:
- ✅ Cloud Functions API
- ✅ Cloud Firestore API
- ✅ Firebase Cloud Messaging API
- ✅ Cloud Scheduler API (for scheduled functions)

### 3. Billing Setup
```bash
# Enable billing for your Firebase project
# Required for Cloud Functions and Cloud Scheduler
```

### 4. Service Account Permissions
Ensure the default Cloud Functions service account has:
- Firestore Read/Write access
- Cloud Messaging access

## Deployment Steps

### Step 1: Install Dependencies
```bash
cd functions
npm install
```

### Step 2: Configure Environment
Create `.env` file in functions directory:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_DATABASE_URL=https://your-project-id.firebaseio.com
```

### Step 3: Build Functions
```bash
npm run build
```

### Step 4: Deploy Functions
```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:generateDailyTasksJob
firebase deploy --only functions:dispatchRemindersJob
firebase deploy --only functions:generateExamPrepTasksJob
firebase deploy --only functions:cleanupExpiredDataJob
```

### Step 5: Verify Deployment
```bash
# Check function URLs
firebase functions:list

# Test manual triggers
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/triggerDailyTasksJob
```

## Configuration

### Timezone Settings
All scheduled functions use `Asia/Karachi` timezone. Update in code if needed:

```typescript
.timeZone('Asia/Karachi')  // Change to your preferred timezone
```

### Schedule Customization
Modify cron expressions in `backgroundJobs.ts`:

```typescript
// Daily at 6 AM
.schedule('0 6 * * *')

// Every hour
.schedule('0 * * * *')

// Weekly on Sunday at 2 AM
.schedule('0 2 * * 0')
```

### Data Retention Settings
Configure cleanup job parameters:

```typescript
// Delete logs older than 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(now.getDate() - 30);
```

## Monitoring & Debugging

### View Function Logs
```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only generateDailyTasksJob

# Last 24 hours
firebase functions:log --since 1d
```

### Check Job Execution Status
```bash
# View scheduled jobs in Cloud Scheduler
gcloud scheduler jobs list --project=YOUR_PROJECT_ID
```

### Manual Testing
Use the HTTP trigger endpoints for testing:

```bash
# Test daily task generation
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/triggerDailyTasksJob

# Test reminder dispatch
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/triggerReminderDispatchJob

# Test exam prep generation
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/triggerExamPrepJob

# Test cleanup
curl -X POST https://us-central1-YOUR-PROJECT.cloudfunctions.net/triggerCleanupJob
```

## Database Schema Requirements

### Required Collections
- `profiles` - Child profiles with FCM tokens
- `routines` - Routine configurations
- `tasks` - Generated tasks
- `reminders` - Active reminders
- `events` - Exam events
- `exams` - Exam results
- `moods` - Mood logs
- `task_logs` - Task completion logs
- `reminder_logs` - Reminder dispatch logs
- `job_logs` - Background job execution logs

### Required Fields
```typescript
// ChildProfile (add to existing)
interface ChildProfile {
  // ... existing fields
  fcm_token?: string;  // For push notifications
}

// Reminder (add to existing)
interface Reminder {
  // ... existing fields
  is_active: boolean;  // For background job filtering
  scheduled_time?: number;  // Hour 0-23
  scheduled_day?: number;  // Day 0-6 for weekly
}

// Task (add to existing)
interface Task {
  // ... existing fields
  generated_at?: string;
  generation_reason?: string;
  expires_at?: string;
  is_generated?: boolean;
}
```

## Error Handling

### Automatic Retries
Cloud Functions automatically retry failed executions up to 3 times with exponential backoff.

### Error Logging
All errors are logged to:
- Firebase Functions logs
- `job_logs` collection in Firestore

### Graceful Degradation
- Jobs continue processing other children if one fails
- Missing data (routines, tokens) is logged but doesn't stop the job
- Network failures trigger automatic retries

## Performance Optimization

### Cold Starts
- Functions may experience cold starts (5-10 seconds)
- Keep functions lightweight and focused on single responsibilities

### Batch Processing
- Jobs process children in parallel where possible
- Large datasets are paginated to avoid memory limits

### Cost Optimization
- Functions run on-demand with automatic scaling
- Scheduled jobs minimize unnecessary executions
- Cleanup job prevents database bloat

## Security Considerations

### Authentication
- Functions use Firebase Admin SDK with service account authentication
- No user-facing authentication required for scheduled jobs

### Data Access
- Functions only access necessary collections
- Read/write operations are scoped to required data
- No sensitive data logging

### Network Security
- HTTPS-only endpoints for manual triggers
- Internal Firebase network for scheduled jobs

## Troubleshooting

### Common Issues

**Functions not deploying:**
```bash
# Check Firebase project
firebase projects:list

# Verify billing is enabled
# Check function logs for specific errors
```

**Scheduled jobs not running:**
```bash
# Check Cloud Scheduler status
gcloud scheduler jobs describe generateDailyTasksJob

# Verify timezone and cron syntax
# Check function permissions
```

**Push notifications not working:**
```bash
# Verify FCM tokens are stored in profiles
# Check Firebase Console → Cloud Messaging
# Test with manual trigger
```

**Database permission errors:**
```bash
# Check service account permissions
# Verify Firestore rules allow admin access
# Test with Firebase Admin SDK locally
```

### Local Testing
```bash
# Test functions locally
npm run serve

# Use Firebase emulator for full testing
firebase emulators:start
```

## Cost Estimation

### Monthly Costs (approximate)
- **Cloud Functions:** $0.40 per million invocations (~$0.10/month for 4 daily jobs)
- **Cloud Firestore:** Additional reads/writes (~$0.05/month)
- **Cloud Scheduler:** $0.10 per job per month (~$0.40/month)
- **Cloud Messaging:** $0 per 10,000 messages (~$0 for typical usage)

**Total estimated cost:** <$1/month for typical usage

## Features Checklist

- ✅ Daily task generation at 6 AM
- ✅ Hourly reminder dispatch
- ✅ Exam prep task generation at 7 AM
- ✅ Weekly data cleanup (Sunday 2 AM)
- ✅ Manual trigger endpoints for testing
- ✅ Comprehensive error handling
- ✅ Automatic retries and logging
- ✅ Timezone-aware scheduling
- ✅ Push notification support
- ✅ Duplicate task prevention
- ✅ Performance optimization
- ✅ Security best practices

## Next Steps

1. ✅ **Current:** Background job runner complete
2. 🔄 **Next:** Real-time sync enhancement (WebSocket upgrades)
3. 🔄 **Then:** Integration testing and deployment

---

**Status**: Feature **16/17** complete. Progress: **94%** (was 88%)
