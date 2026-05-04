import { useEffect, useState, useCallback } from 'react';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import type { Reminder, ReminderLog, Task, Event, MoodLog } from '../types/schema';

/**
 * Calculate next reminder send time based on frequency and schedule
 */
const calculateNextSendTime = (
  reminder: Omit<Reminder, 'id'>,
  fromTime: Date = new Date()
): Date => {
  const now = new Date(fromTime);

  if (reminder.frequency === 'once') {
    // One-time reminders: set for next occurrence if schedule_time provided
    if (reminder.schedule_time) {
      const [hours, minutes] = reminder.schedule_time.split(':').map(Number);
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    return new Date(now.getTime() + 1 * 60 * 1000); // Default: 1 min from now
  }

  if (reminder.frequency === 'daily' && reminder.schedule_time) {
    const [hours, minutes] = reminder.schedule_time.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (reminder.frequency === 'weekly' && reminder.days_of_week && reminder.schedule_time) {
    const [hours, minutes] = reminder.schedule_time.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    const currentDay = next.getDay();
    const nextDay = reminder.days_of_week.find(d => d > currentDay) || reminder.days_of_week[0];
    const daysAhead = nextDay >= currentDay ? nextDay - currentDay : 7 - currentDay + nextDay;

    if (daysAhead === 0 && next <= now) {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + daysAhead);
    }
    return next;
  }

  return new Date(now.getTime() + 1 * 60 * 1000); // Default fallback
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Send a browser notification
 */
export const sendNotification = (title: string, options?: NotificationOptions) => {
  if (Notification.permission === 'granted') {
    // Use service worker if available
    if ('serviceWorker' in navigator && 'ready' in navigator.serviceWorkerContainer) {
      navigator.serviceWorkerContainer.ready.then(registration => {
        registration.showNotification(title, {
          badge: '/tiktrack-badge.png',
          icon: '/tiktrack-icon.png',
          ...options,
        });
      });
    } else {
      // Fallback to regular notification
      new Notification(title, {
        badge: '/tiktrack-badge.png',
        icon: '/tiktrack-icon.png',
        ...options,
      });
    }
  }
};

/**
 * Get default reminders for a child
 */
export const getDefaultReminders = (
  childId: string,
  parentId: string
): Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>[] => {
  return [
    {
      child_id: childId,
      parent_id: parentId,
      type: 'morning_greeting',
      title: 'Good Morning! 🌅',
      message: 'Time to start your day with amazing quests!',
      schedule_time: '07:00',
      is_enabled: true,
      frequency: 'daily',
      days_of_week: [1, 2, 3, 4, 5], // Mon-Fri (school days)
    },
    {
      child_id: childId,
      parent_id: parentId,
      type: 'task_reminder',
      title: 'Quest Time! ⏰',
      message: 'You have pending quests waiting for you.',
      schedule_time: '18:00',
      is_enabled: true,
      frequency: 'daily',
    },
    {
      child_id: childId,
      parent_id: parentId,
      type: 'exam_countdown',
      title: 'Exam Alert 📝',
      message: 'Your exam is coming up! Start preparing.',
      is_enabled: true,
      frequency: 'daily',
    },
  ];
};

export const useReminders = (childId: string, parentId: string) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    'default'
  );

  // Fetch reminders on mount
  useEffect(() => {
    const fetchReminders = async () => {
      try {
        setLoading(true);
        const remindersRef = collection(db, 'reminders');
        const q = query(
          remindersRef,
          where('child_id', '==', childId),
          where('parent_id', '==', parentId)
        );

        const snapshot = await getDocs(q);
        const fetchedReminders = snapshot.docs.map(doc => doc.data() as Reminder);
        setReminders(fetchedReminders);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch reminders');
      } finally {
        setLoading(false);
      }
    };

    if (childId && parentId) {
      fetchReminders();
    }

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [childId, parentId]);

  const createReminder = async (newReminder: Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>) => {
    try {
      const remindersRef = collection(db, 'reminders');
      const now = new Date();
      const nextSendTime = calculateNextSendTime(newReminder, now);

      const docRef = await addDoc(remindersRef, {
        ...newReminder,
        next_send_at: nextSendTime.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      });

      const created: Reminder = {
        ...newReminder,
        id: docRef.id,
        next_send_at: nextSendTime.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      setReminders([...reminders, created]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reminder');
      throw err;
    }
  };

  const updateReminder = async (id: string, updates: Partial<Omit<Reminder, 'id' | 'created_at' | 'next_send_at'>>) => {
    try {
      const remindersRef = doc(db, 'reminders', id);
      const now = new Date();
      const existingReminder = reminders.find(r => r.id === id);

      if (!existingReminder) {
        throw new Error('Reminder not found');
      }

      const updatedReminder = { ...existingReminder, ...updates };
      const nextSendTime = calculateNextSendTime(updatedReminder, now);

      await updateDoc(remindersRef, {
        ...updates,
        next_send_at: nextSendTime.toISOString(),
        updated_at: now.toISOString(),
      });

      setReminders(
        reminders.map(r =>
          r.id === id
            ? {
                ...r,
                ...updates,
                next_send_at: nextSendTime.toISOString(),
                updated_at: now.toISOString(),
              }
            : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reminder');
      throw err;
    }
  };

  const deleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
      setReminders(reminders.filter(r => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete reminder');
      throw err;
    }
  };

  const requestPermission = async () => {
    const granted = await requestNotificationPermission();
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    return granted;
  };

  const triggerReminder = (reminder: Reminder) => {
    sendNotification(reminder.title, {
      body: reminder.message,
      tag: reminder.id,
      requireInteraction: reminder.type === 'missed_task_alert',
    });
  };

  return {
    reminders,
    loading,
    error,
    createReminder,
    updateReminder,
    deleteReminder,
    requestPermission,
    triggerReminder,
    notificationPermission,
  };
};

/**
 * Create automatic reminders based on tasks and exams
 */
export const createAutoReminders = (
  childId: string,
  parentId: string,
  tasks: Task[],
  exams: Event[],
  recentMood?: MoodLog
): Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>[] => {
  const autoReminders: Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>[] = [];

  // Create exam countdown reminders
  exams.forEach(exam => {
    const examDate = new Date(exam.date);
    const daysUntil = Math.ceil(
      (examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntil > 0 && daysUntil <= 7) {
      autoReminders.push({
        child_id: childId,
        parent_id: parentId,
        type: 'exam_countdown',
        title: `${daysUntil} day${daysUntil > 1 ? 's' : ''} until ${exam.title}! 📚`,
        message: `Start preparing for your ${exam.title} exam.`,
        schedule_time: '07:00',
        exam_event_id: exam.id,
        is_enabled: true,
        frequency: 'daily',
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
      });
    }
  });

  // Create mood-based adjustment reminder
  if (recentMood?.mood === 'sad') {
    autoReminders.push({
      child_id: childId,
      parent_id: parentId,
      type: 'custom',
      title: 'We Care About You 💙',
      message: 'Remember, tough days make strong people. How about a break activity?',
      schedule_time: '18:00',
      is_enabled: true,
      frequency: 'once',
    });
  }

  return autoReminders;
};
