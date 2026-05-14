import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  generateSmartDailyTasks,
  generateExamPrepTasks,
  GeneratedTask,
} from './taskScheduler';
import { Reminder, RoutineConfiguration, ChildProfile, ExamResult, Event, MoodLog } from './types/schema';

// Firestore references
const db = admin.firestore();
const tasksRef = db.collection('tasks');
const remindersRef = db.collection('reminders');
const profilesRef = db.collection('child_profile');
const routinesRef = db.collection('routine_configurations');
const examsRef = db.collection('exams');
const eventsRef = db.collection('events');
const moodsRef = db.collection('mood_logs');

/**
 * Background job: Generate daily tasks for all children at 6:00 AM
 */
export const generateDailyTasksJob = functions
  .pubsub
  .schedule('0 6 * * *')  // 6:00 AM every day
  .timeZone('Asia/Karachi')
  .onRun(async (context) => {
    console.log('🚀 Starting daily task generation job');

    try {
      // Get all child profiles. Current client schema does not set is_active.
      const childrenSnapshot = await profilesRef.get();

      const results = {
        totalChildren: childrenSnapshot.size,
        successfulGenerations: 0,
        failedGenerations: 0,
        totalTasksGenerated: 0,
      };

      for (const childDoc of childrenSnapshot.docs) {
        const childId = childDoc.id;
        const profile = childDoc.data() as ChildProfile;

        try {
          // Get child's routine
          const routineDoc = await routinesRef
            .where('child_id', '==', childId)
            .limit(1)
            .get();

          if (routineDoc.empty) {
            console.log(`⚠️ No routine found for child ${childId}`);
            continue;
          }

          const routine = routineDoc.docs[0].data() as RoutineConfiguration;

          // Get recent data for task generation
          const [examsSnapshot, eventsSnapshot, moodSnapshot] = await Promise.all([
            examsRef.where('child_id', '==', childId).orderBy('exam_date', 'desc').limit(20).get(),
            eventsRef.where('child_id', '==', childId).where('date', '>=', new Date().toISOString().split('T')[0]).get(),
            moodsRef.where('child_id', '==', childId).orderBy('date', 'desc').limit(1).get(),
          ]);

          const exams = examsSnapshot.docs.map(doc => doc.data() as ExamResult);
          const events = eventsSnapshot.docs.map(doc => doc.data() as Event);
          const currentMood = moodSnapshot.empty ? undefined : moodSnapshot.docs[0].data() as MoodLog;

          // Calculate weekly completion rate
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const taskLogsSnapshot = await db.collection('task_logs')
            .where('child_id', '==', childId)
            .where('date', '>=', weekAgo.toISOString().split('T')[0])
            .get();

          const completedTasks = taskLogsSnapshot.docs.filter(log => log.data().status === 'completed').length;
          const weeklyCompletionRate = taskLogsSnapshot.size > 0 ? (completedTasks / taskLogsSnapshot.size) * 100 : 50;

          // Generate tasks
          const routineSlots = routine.current_mode === 'academic'
            ? routine.school_days_routine
            : routine.vacation_routine;

          const generatedTasks = generateSmartDailyTasks(
            routineSlots,
            profile,
            exams,
            events,
            currentMood?.mood,
            weeklyCompletionRate
          );

          // Save generated tasks (avoid duplicates)
          let savedCount = 0;
          for (const task of generatedTasks) {
            const existingQuery = await tasksRef
              .where('child_id', '==', childId)
              .where('title', '==', task.title)
              .where('is_generated', '==', true)
              .get();

            if (existingQuery.empty) {
              await tasksRef.add({
                ...task,
                child_id: childId,
                is_generated: true,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
              });
              savedCount++;
            }
          }

          console.log(`✅ Generated ${savedCount} tasks for child ${childId}`);
          results.successfulGenerations++;
          results.totalTasksGenerated += savedCount;

        } catch (error) {
          console.error(`❌ Failed to generate tasks for child ${childId}:`, error);
          results.failedGenerations++;
        }
      }

      console.log('📊 Daily task generation job completed:', results);
      return results;

    } catch (error) {
      console.error('💥 Daily task generation job failed:', error);
      throw error;
    }
  });

/**
 * Background job: Check and dispatch reminders every hour
 */
export const dispatchRemindersJob = functions
  .pubsub
  .schedule('0 * * * *')  // Every hour at minute 0
  .timeZone('Asia/Karachi')
  .onRun(async (context) => {
    console.log('🔔 Starting reminder dispatch job');

    try {
      const now = new Date();
      const { hour: currentHour, day: currentDay, dateKey: currentDateKey } = getKarachiHourAndDay(now);

      // Primary filter for current schema (`is_enabled`), fallback to legacy (`is_active`).
      let remindersSnapshot = await remindersRef.where('is_enabled', '==', true).get();
      if (remindersSnapshot.empty) {
        remindersSnapshot = await remindersRef.where('is_active', '==', true).get();
      }

      const results = {
        totalReminders: remindersSnapshot.size,
        dispatched: 0,
        skipped: 0,
        errors: 0,
      };

      for (const reminderDoc of remindersSnapshot.docs) {
        const reminder = reminderDoc.data() as Reminder;

        try {
          // Check if reminder should trigger now
          if (!shouldDispatchReminder(reminder, currentHour, currentDay, currentDateKey)) {
            results.skipped++;
            continue;
          }

          // Get child's FCM token for push notifications
          const profileDoc = await profilesRef.doc(reminder.child_id).get();
          if (!profileDoc.exists) {
            console.log(`⚠️ Profile not found for reminder ${reminderDoc.id}`);
            results.errors++;
            continue;
          }

          const profile = profileDoc.data() as ChildProfile;
          if (!profile.fcm_token) {
            console.log(`⚠️ No FCM token for child ${reminder.child_id}`);
            results.errors++;
            continue;
          }

          // Send push notification
          const message = {
            token: profile.fcm_token,
            notification: {
              title: reminder.title,
              body: reminder.message,
            },
            data: {
              type: 'reminder',
              reminder_id: reminderDoc.id,
              child_id: reminder.child_id,
            },
          };

          await admin.messaging().send(message);

          // Log the reminder dispatch
          await db.collection('reminder_logs').add({
            reminder_id: reminderDoc.id,
            child_id: reminder.child_id,
            dispatched_at: admin.firestore.FieldValue.serverTimestamp(),
            type: reminder.type,
            title: reminder.title,
            message: reminder.message,
          });

          console.log(`📤 Dispatched reminder: ${reminder.title} to child ${reminder.child_id}`);
          results.dispatched++;

        } catch (error) {
          console.error(`❌ Failed to dispatch reminder ${reminderDoc.id}:`, error);
          results.errors++;
        }
      }

      console.log('📊 Reminder dispatch job completed:', results);
      return results;

    } catch (error) {
      console.error('💥 Reminder dispatch job failed:', error);
      throw error;
    }
  });

/**
 * Background job: Generate exam prep tasks when exams are approaching
 */
export const generateExamPrepTasksJob = functions
  .pubsub
  .schedule('0 7 * * *')  // 7:00 AM every day (after daily tasks)
  .timeZone('Asia/Karachi')
  .onRun(async (context) => {
    console.log('📚 Starting exam prep task generation job');

    try {
      const today = new Date();
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(today.getDate() + 14);

      // Get all upcoming exams in next 14 days
      const examsSnapshot = await eventsRef
        .where('type', 'in', ['exam', 'Exam'])
        .where('date', '>=', today.toISOString().split('T')[0])
        .where('date', '<=', twoWeeksFromNow.toISOString().split('T')[0])
        .get();

      const results = {
        totalExams: examsSnapshot.size,
        tasksGenerated: 0,
        errors: 0,
      };

      for (const examDoc of examsSnapshot.docs) {
        const exam = examDoc.data() as Event;

        try {
          // Calculate days until exam and ignore anything outside the prep window.
          const examDate = new Date(exam.date);
          const daysUntil = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil < 0 || daysUntil > 14) {
            continue;
          }

          // Get child profile
          const profileDoc = await profilesRef.doc(exam.child_id).get();
          if (!profileDoc.exists) continue;

          const profile = profileDoc.data() as ChildProfile;

          // Generate exam prep tasks
          const examTasks = generateExamPrepTasks(exam, daysUntil, profile);

          // Save tasks (avoid duplicates)
          let savedCount = 0;
          for (const task of examTasks) {
            const existingQuery = await tasksRef
              .where('child_id', '==', exam.child_id)
              .where('title', '==', task.title)
              .where('expires_at', '==', exam.date)
              .get();

            if (existingQuery.empty) {
              await tasksRef.add({
                ...task,
                child_id: exam.child_id,
                is_generated: true,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
              });
              savedCount++;
            }
          }

          console.log(`📝 Generated ${savedCount} exam prep tasks for ${exam.title} (${daysUntil} days)`);
          results.tasksGenerated += savedCount;

        } catch (error) {
          console.error(`❌ Failed to generate exam prep tasks for exam ${examDoc.id}:`, error);
          results.errors++;
        }
      }

      console.log('📊 Exam prep task generation job completed:', results);
      return results;

    } catch (error) {
      console.error('💥 Exam prep task generation job failed:', error);
      throw error;
    }
  });

/**
 * Background job: Clean up expired tasks and old logs weekly
 */
export const cleanupExpiredDataJob = functions
  .pubsub
  .schedule('0 2 * * 0')  // 2:00 AM every Sunday
  .timeZone('Asia/Karachi')
    .onRun(async (context) => {
    console.log('🧹 Starting cleanup job');

    const results = {
      expiredTasksDeleted: 0,
      oldLogsDeleted: 0,
      proofLogsDeleted: 0,
      proofAssetsDeleted: 0,
      errors: 0,
    };

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);

      // Delete expired tasks
      const expiredTasksQuery = await tasksRef
        .where('expires_at', '<', now.toISOString())
        .where('is_generated', '==', true)
        .get();

      const deletePromises = expiredTasksQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      results.expiredTasksDeleted = expiredTasksQuery.size;

      // Delete old reminder logs (older than 30 days)
      const oldLogsQuery = await db.collection('reminder_logs')
        .where('dispatched_at', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .get();

      const deleteLogPromises = oldLogsQuery.docs.map(doc => doc.ref.delete());
      await Promise.all(deleteLogPromises);
      results.oldLogsDeleted = oldLogsQuery.size;

      // Delete proof logs and proof assets older than 60 days (best-effort per file).
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(now.getDate() - 60);
      const oldProofLogsQuery = await db.collection('proof_logs')
        .where('timestamp', '<', sixtyDaysAgo.toISOString())
        .get();

      const maybeStorageBucket = typeof admin.storage === 'function' ? admin.storage().bucket() : null;
      for (const proofDoc of oldProofLogsQuery.docs) {
        const proof = proofDoc.data() as { image_url?: string };
        const storagePath = extractStoragePathFromProofUrl(proof.image_url);

        if (maybeStorageBucket && storagePath) {
          try {
            await maybeStorageBucket.file(storagePath).delete();
            results.proofAssetsDeleted++;
          } catch (error) {
            // Continue cleanup even if file is already missing or URL is stale.
            console.warn(`⚠️ Failed to delete proof asset: ${storagePath}`, error);
          }
        }

        await proofDoc.ref.delete();
        results.proofLogsDeleted++;
      }

      console.log('📊 Cleanup job completed:', results);
      return results;

    } catch (error) {
      console.error('💥 Cleanup job failed:', error);
      results.errors++;
      return results;
    }
  });

/**
 * Helper function to determine if a reminder should be dispatched
 */
function shouldDispatchReminder(reminder: Reminder, currentHour: number, currentDay: number, currentDateKey: string): boolean {
  const scheduledHour =
    reminder.scheduled_time ??
    (reminder.schedule_time ? Number(reminder.schedule_time.split(':')[0]) : undefined);
  const scheduledDay = reminder.scheduled_day ?? reminder.days_of_week?.[0];

  if (reminder.type === 'exam_countdown' && reminder.target_date) {
    const offset = Number(reminder.offset_days || 0);
    const target = new Date(reminder.target_date);
    target.setHours(0, 0, 0, 0);
    const dispatchDate = new Date(target);
    dispatchDate.setDate(dispatchDate.getDate() - offset);
    const dispatchKey = dispatchDate.toISOString().slice(0, 10);
    return dispatchKey === currentDateKey && scheduledHour === currentHour;
  }

  // Check frequency
  switch (reminder.frequency) {
    case 'once':
      // Only dispatch once, check if already dispatched
      return false; // Would need to check logs, simplified for now

    case 'daily':
      return scheduledHour === currentHour;

    case 'weekly':
      // Support both single-day legacy and multi-day current schema.
      if (Array.isArray(reminder.days_of_week) && reminder.days_of_week.length > 0) {
        return reminder.days_of_week.includes(currentDay) && scheduledHour === currentHour;
      }
      return scheduledDay === currentDay && scheduledHour === currentHour;

    default:
      return false;
  }
}

function getKarachiHourAndDay(date: Date): { hour: number; day: number; dateKey: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const weekdayShort = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const dayOfMonth = parts.find((p) => p.type === 'day')?.value ?? '01';
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const roundedHour = minute >= 30 ? (hour + 1) % 24 : hour;
  return { hour: roundedHour, day: dayMap[weekdayShort] ?? 0, dateKey: `${year}-${month}-${dayOfMonth}` };
}

function extractStoragePathFromProofUrl(imageUrl?: string): string | null {
  if (!imageUrl) return null;

  // Handle gs://bucket/path format.
  if (imageUrl.startsWith('gs://')) {
    const withoutScheme = imageUrl.slice('gs://'.length);
    const slashIndex = withoutScheme.indexOf('/');
    if (slashIndex === -1) return null;
    return withoutScheme.slice(slashIndex + 1);
  }

  // Handle Firebase download URL format:
  // https://firebasestorage.googleapis.com/.../o/<encodedPath>?...
  try {
    const parsed = new URL(imageUrl);
    const marker = '/o/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const encodedPath = parsed.pathname.slice(markerIndex + marker.length);
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

/**
 * HTTP trigger for manual job execution (for testing)
 */
export const triggerDailyTasksJob = functions.https.onRequest(async (req, res) => {
  try {
    const result = await generateDailyTasksJob.run({});
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export const triggerReminderDispatchJob = functions.https.onRequest(async (req, res) => {
  try {
    const result = await dispatchRemindersJob.run({});
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export const triggerExamPrepJob = functions.https.onRequest(async (req, res) => {
  try {
    const result = await generateExamPrepTasksJob.run({});
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export const triggerCleanupJob = functions.https.onRequest(async (req, res) => {
  try {
    const result = await cleanupExpiredDataJob.run({});
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
