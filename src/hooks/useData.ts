import { useState, useEffect } from 'react';
import type { ChildProfile, Task, TaskLog } from '../types/schema';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

// Mock hook for fetching child's profile data
export function useChildProfile(childId: string) {
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fallbackProfile: ChildProfile = {
      id: childId,
      name: 'Explorer',
      date_of_birth: '2016-01-01',
      height_cm: 140,
      weight_kg: 32,
      streak_count: 0,
      streak_shields: 0,
      consistency_score: 0,
      total_stars: 0,
      is_sick_mode: false,
      user_id: childId
    };

    const load = async () => {
      if (!childId) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'child_profile', childId));
        if (!cancelled) {
          if (snap.exists()) {
            setProfile(snap.data() as ChildProfile);
          } else {
            setProfile(fallbackProfile);
          }
        }
      } catch (error) {
        console.warn('useChildProfile fallback mode:', error);
        if (!cancelled) {
          setProfile(fallbackProfile);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [childId]);

  return { profile, loading };
}

// Mock hook for fetching today's tasks
export function useTodaysTasks(childId: string) {
  const [tasks, setTasks] = useState<{ task: Task; log?: TaskLog }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fallbackTasks: { task: Task; log?: TaskLog }[] = [
      {
        task: { id: '1', title: 'Math Homework', category: 'Academic', difficulty_level: 5, energy_level: 'high', priority: 'high', requires_proof: true, star_value: 2 }
      },
      {
        task: { id: '2', title: 'Read a Book for 20 mins', category: 'Creative', difficulty_level: 2, energy_level: 'low', priority: 'medium', requires_proof: false, star_value: 1 }
      }
    ];

    const load = async () => {
      if (!childId) {
        setTasks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const logSnap = await getDocs(
          query(collection(db, 'task_logs'), where('child_id', '==', childId), limit(20))
        );

        const logs = logSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskLog, 'id'>) })) as TaskLog[];

        if (logs.length > 0) {
          const taskResults: Array<{ task: Task; log: TaskLog } | null> = await Promise.all(
            logs.map(async (log) => {
              const taskSnap = await getDoc(doc(db, 'tasks', log.task_id));
              if (!taskSnap.exists()) {
                return null;
              }
              return { task: taskSnap.data() as Task, log };
            })
          );

          const resolved = taskResults.filter((item): item is { task: Task; log: TaskLog } => item !== null);
          if (!cancelled) {
            setTasks(resolved.length > 0 ? resolved : fallbackTasks);
          }
        } else {
          const taskSnap = await getDocs(query(collection(db, 'tasks'), limit(7)));
          const baseTasks = taskSnap.docs.map((d) => ({ task: d.data() as Task }));
          if (!cancelled) {
            setTasks(baseTasks.length > 0 ? baseTasks : fallbackTasks);
          }
        }
      } catch (error) {
        console.warn('useTodaysTasks fallback mode:', error);
        if (!cancelled) {
          setTasks(fallbackTasks);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [childId]);

  return { tasks, loading };
}
