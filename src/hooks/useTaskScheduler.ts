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
import type { Task, RoutineConfiguration, ChildProfile, ExamResult, Event, MoodLog } from '../types/schema';
import {
  generateSmartDailyTasks,
  generateExamPrepTasks,
  GeneratedTask,
} from '../utils/taskScheduler';

interface ScheduledTask extends Task {
  generated_at: string;
  generation_reason: string;
  expires_at?: string;
  is_generated: boolean;
}

export const useTaskScheduler = (
  childId: string,
  parentId: string,
  routine: RoutineConfiguration | null,
  profile: ChildProfile | null,
  exams: ExamResult[],
  events: Event[],
  currentMood?: MoodLog
) => {
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate weekly completion rate
  const calculateWeeklyRate = useCallback(async (): Promise<number> => {
    try {
      const taskLogsRef = collection(db, 'task_logs');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];

      const q = query(
        taskLogsRef,
        where('child_id', '==', childId),
        where('date', '>=', weekAgoStr),
        where('date', '<=', todayStr)
      );

      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => doc.data() as any);

      if (logs.length === 0) return 0;

      const completed = logs.filter(log => log.status === 'completed').length;
      return Math.round((completed / logs.length) * 100);
    } catch (err) {
      console.error('Error calculating weekly rate:', err);
      return 50;
    }
  }, [childId]);

  // Generate and save tasks for today
  const generateTodaysTasks = useCallback(async () => {
    if (!routine || !profile) {
      setError('Routine or profile not available');
      return;
    }

    try {
      setLoading(true);
      const weeklyRate = await calculateWeeklyRate();
      const routineSlots = routine.current_mode === 'academic'
        ? routine.school_days_routine
        : routine.vacation_routine;

      const generatedTasks = generateSmartDailyTasks(
        routineSlots,
        profile,
        exams,
        events,
        currentMood?.mood,
        weeklyRate
      );

      // Convert to ScheduledTask and save to Firestore
      const tasksRef = collection(db, 'tasks');
      const savedTasks: ScheduledTask[] = [];

      for (const generated of generatedTasks) {
        // Check if similar task already exists today
        const q = query(
          tasksRef,
          where('child_id', '==', childId),
          where('title', '==', generated.title)
        );
        const existing = await getDocs(q);

        if (existing.empty) {
          const docRef = await addDoc(tasksRef, {
            ...generated,
            child_id: childId,
            is_generated: true,
          });

          savedTasks.push({
            id: docRef.id,
            child_id: childId,
            ...generated,
            is_generated: true,
          } as ScheduledTask);
        }
      }

      setScheduledTasks(savedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tasks');
    } finally {
      setLoading(false);
    }
  }, [routine, profile, exams, events, currentMood, childId, calculateWeeklyRate]);

  // Generate exam prep tasks
  const generateExamTasks = useCallback(async (exam: Event, daysUntil: number) => {
    if (!profile) {
      setError('Profile not available');
      return;
    }

    try {
      setLoading(true);
      const generatedTasks = generateExamPrepTasks(exam, daysUntil, profile);

      const tasksRef = collection(db, 'tasks');
      const savedTasks: ScheduledTask[] = [];

      for (const generated of generatedTasks) {
        const docRef = await addDoc(tasksRef, {
          ...generated,
          child_id: childId,
          is_generated: true,
        });

        savedTasks.push({
          id: docRef.id,
          child_id: childId,
          ...generated,
          is_generated: true,
        } as ScheduledTask);
      }

      setScheduledTasks(prev => [...prev, ...savedTasks]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate exam tasks');
    } finally {
      setLoading(false);
    }
  }, [childId, profile]);

  // Clean up expired tasks
  const cleanupExpiredTasks = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef,
        where('child_id', '==', childId),
        where('expires_at', '<', now),
        where('is_generated', '==', true)
      );

      const snapshot = await getDocs(q);
      for (const doc of snapshot.docs) {
        await deleteDoc(doc.ref);
      }

      setScheduledTasks(prev =>
        prev.filter(t => !t.expires_at || new Date(t.expires_at) > new Date())
      );
    } catch (err) {
      console.error('Error cleaning up expired tasks:', err);
    }
  }, [childId]);

  // Fetch existing scheduled tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tasksRef = collection(db, 'tasks');
        const q = query(
          tasksRef,
          where('child_id', '==', childId),
          where('is_generated', '==', true)
        );

        const snapshot = await getDocs(q);
        const tasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as ScheduledTask));

        setScheduledTasks(tasks);
      } catch (err) {
        console.error('Error fetching scheduled tasks:', err);
      }
    };

    if (childId) {
      fetchTasks();
      cleanupExpiredTasks();
    }
  }, [childId, cleanupExpiredTasks]);

  return {
    scheduledTasks,
    loading,
    error,
    generateTodaysTasks,
    generateExamTasks,
    cleanupExpiredTasks,
  };
};
