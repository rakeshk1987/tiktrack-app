import type { Reminder } from '../types/schema';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { sendNotification } from '../hooks/useReminders';

/**
 * Check if a reminder should be sent based on its schedule
 */
const shouldSendReminder = (reminder: Reminder): boolean => {
  if (!reminder.is_enabled) {
    return false;
  }

  const nextSendTime = reminder.next_send_at ? new Date(reminder.next_send_at) : null;
  if (!nextSendTime) {
    return false;
  }

  return new Date() >= nextSendTime;
};

/**
 * Calculate the next send time for a reminder
 */
const calculateNextSendTime = (reminder: Reminder): Date => {
  const now = new Date();

  if (reminder.frequency === 'once') {
    return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // Far future
  }

  if (reminder.frequency === 'daily' && reminder.schedule_time) {
    const [hours, minutes] = reminder.schedule_time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    next.setDate(next.getDate() + 1);
    return next;
  }

  if (reminder.frequency === 'weekly' && reminder.days_of_week && reminder.schedule_time) {
    const [hours, minutes] = reminder.schedule_time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);

    const currentDay = next.getDay();
    const nextDay = reminder.days_of_week.find(d => d > currentDay) || reminder.days_of_week[0];
    const daysAhead = nextDay >= currentDay ? nextDay - currentDay : 7 - currentDay + nextDay;

    next.setDate(next.getDate() + (daysAhead || 7));
    return next;
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default: tomorrow
};

/**
 * Process due reminders for a child
 * Sends notifications and updates next send times
 */
export const processChildReminders = async (childId: string): Promise<number> => {
  try {
    const remindersRef = collection(db, 'reminders');
    const q = query(
      remindersRef,
      where('child_id', '==', childId),
      where('is_enabled', '==', true)
    );

    const snapshot = await getDocs(q);
    const reminders = snapshot.docs.map(doc => doc.data() as Reminder);

    let sentCount = 0;

    for (const reminder of reminders) {
      if (shouldSendReminder(reminder)) {
        // Send notification
        sendNotification(reminder.title, {
          body: reminder.message,
          tag: reminder.id,
          requireInteraction: reminder.type === 'missed_task_alert',
        });

        // Log the reminder send
        const logsRef = collection(db, 'reminder_logs');
        await addDoc(logsRef, {
          reminder_id: reminder.id,
          child_id: childId,
          sent_at: new Date().toISOString(),
          status: 'sent',
        });

        // Update next send time
        const nextSendTime = calculateNextSendTime(reminder);
        await updateDoc(doc(db, 'reminders', reminder.id), {
          next_send_at: nextSendTime.toISOString(),
        });

        sentCount++;
      }
    }

    return sentCount;
  } catch (err) {
    console.error('Error processing reminders:', err);
    return 0;
  }
};

/**
 * Process reminders for all active children
 * Should be called periodically (e.g., every minute or by a background job)
 */
export const processAllReminders = async (parentId: string): Promise<void> => {
  try {
    // This would need a list of active children under this parent
    // For now, it's a placeholder that would need to fetch from a children collection
    // and call processChildReminders for each
    console.log('Processing reminders for parent:', parentId);
  } catch (err) {
    console.error('Error processing all reminders:', err);
  }
};

/**
 * Start a reminder checker that runs periodically
 * Returns an interval ID that can be used to stop the checker
 */
export const startReminderChecker = (childId: string, intervalMs: number = 60000): NodeJS.Timer => {
  // Process immediately
  processChildReminders(childId);

  // Then set up periodic checks
  return setInterval(() => {
    processChildReminders(childId);
  }, intervalMs);
};

/**
 * Stop the reminder checker
 */
export const stopReminderChecker = (intervalId: NodeJS.Timer): void => {
  clearInterval(intervalId);
};

/**
 * Initialize reminders for a child (create default reminders if none exist)
 */
export const initializeRemindersForChild = async (
  childId: string,
  parentId: string,
  defaultReminders: Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>[]
): Promise<void> => {
  try {
    const remindersRef = collection(db, 'reminders');
    const q = query(
      remindersRef,
      where('child_id', '==', childId),
      where('parent_id', '==', parentId)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      // No reminders exist, create defaults
      const now = new Date();

      for (const reminder of defaultReminders) {
        // Calculate next send time based on type
        let nextSendTime: Date;

        if (reminder.schedule_time) {
          const [hours, minutes] = reminder.schedule_time.split(':').map(Number);
          nextSendTime = new Date();
          nextSendTime.setHours(hours, minutes, 0, 0);

          // If time already passed today, schedule for tomorrow
          if (nextSendTime <= now) {
            nextSendTime.setDate(nextSendTime.getDate() + 1);
          }
        } else {
          // If no schedule time, set for 1 hour from now
          nextSendTime = new Date(now.getTime() + 60 * 60 * 1000);
        }

        await addDoc(remindersRef, {
          ...reminder,
          next_send_at: nextSendTime.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
      }

      console.log('Initialized default reminders for child:', childId);
    }
  } catch (err) {
    console.error('Error initializing reminders:', err);
  }
};
