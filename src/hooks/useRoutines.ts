import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, doc, getDocs, orderBy, limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Routine, RoutineLog } from '../types/schema';
import { useSickMode } from './useSickMode';

/** Returns the effective day range key for today */
export function getTodayDayRange(): 'weekday' | 'weekend' {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return (day === 0 || day === 6) ? 'weekend' : 'weekday';
}

export function useRoutines(familyId: string, childId?: string) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getActiveSickPeriod } = useSickMode(familyId, childId || '');

  useEffect(() => {
    if (!familyId) {
      setRoutines([]);
      setLoading(false);
      return;
    }

    // Query by family_id only to avoid composite index requirements;
    // filter child_id client-side to handle null/''/childId cases.
    const q = query(
      collection(db, 'routines'),
      where('family_id', '==', familyId),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Routine));

        // Client-side filter: include routines assigned to this child OR to all children
        if (childId) {
          results = results.filter(r => !r.child_id || r.child_id === '' || r.child_id === childId);
        }

        // Normalize: support old schedule_time field on existing docs
        results = results.map(r => ({
          ...r,
          start_time: r.start_time || r.schedule_time || '07:00',
          end_time: r.end_time || r.schedule_time || '08:00',
          day_range: r.day_range || 'everyday',
          requires_approval: r.requires_approval ?? false,
          created_by: r.created_by || 'parent',
        }));

        // Sort by start_time ascending
        results.sort((a, b) => a.start_time.localeCompare(b.start_time));
        setRoutines(results);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching routines:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [familyId, childId]);

  const createRoutine = async (
    routine: Omit<Routine, 'id' | 'created_at' | 'updated_at' | 'streak'>
  ) => {
    try {
      const now = new Date().toISOString();
      const payload = {
        ...routine,
        // keep backward-compat field
        schedule_time: routine.start_time,
        streak: 0,
        created_at: now,
        updated_at: now,
      };
      const docRef = await addDoc(collection(db, 'routines'), payload);
      return docRef.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateRoutine = async (id: string, updates: Partial<Routine>) => {
    try {
      const ref = doc(db, 'routines', id);
      const payload: any = { ...updates, updated_at: new Date().toISOString() };
      if (updates.start_time) payload.schedule_time = updates.start_time;
      await updateDoc(ref, payload);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const archiveRoutine = async (id: string) => {
    return updateRoutine(id, { status: 'archived' });
  };

  const logRoutine = async (
    routine: Routine,
    targetChildId: string,
    status: 'completed' | 'missed' | 'sick'
  ) => {
    try {
      const today = new Date();
      const dateStr =
        today.getFullYear() +
        '-' + String(today.getMonth() + 1).padStart(2, '0') +
        '-' + String(today.getDate()).padStart(2, '0');

      // Sick mode override
      const sickPeriod = getActiveSickPeriod(targetChildId);
      if (sickPeriod) status = 'sick';

      const logData: Omit<RoutineLog, 'id'> = {
        routine_id: routine.id,
        family_id: familyId,
        child_id: targetChildId,
        date: dateStr,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : undefined,
      };

      await addDoc(collection(db, 'routine_logs'), logData);

      if (status === 'completed') {
        // If approval required, create pending approval; otherwise grant stars directly
        if (routine.requires_approval) {
          await addDoc(collection(db, 'approvals'), {
            family_id: familyId,
            child_id: targetChildId,
            type: 'routine',
            reference_id: routine.id,
            title: routine.title,
            points: Number(routine.points || 0),
            status: 'pending',
            created_at: new Date().toISOString(),
          });
        }

        // Evaluate and update streak
        const qLogs = query(
          collection(db, 'routine_logs'),
          where('routine_id', '==', routine.id),
          where('child_id', '==', targetChildId),
          where('status', '==', 'completed'),
          orderBy('date', 'desc'),
          limit(2)
        );
        const snapshot = await getDocs(qLogs);
        const completedLogs = snapshot.docs.map(d => d.data() as RoutineLog);

        let newStreak = routine.streak || 0;
        if (completedLogs.length > 1) {
          const previousDate = new Date(completedLogs[1].date);
          const diffDays = Math.floor(
            (today.getTime() - previousDate.getTime()) / (1000 * 3600 * 24)
          );
          newStreak = diffDays === 1 ? newStreak + 1 : 1;
        } else {
          newStreak = 1;
        }

        await updateRoutine(routine.id, { streak: newStreak });
      }
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const getTodayLogs = async (targetChildId: string) => {
    const today = new Date();
    const dateStr =
      today.getFullYear() +
      '-' + String(today.getMonth() + 1).padStart(2, '0') +
      '-' + String(today.getDate()).padStart(2, '0');

    const qLogs = query(
      collection(db, 'routine_logs'),
      where('family_id', '==', familyId),
      where('child_id', '==', targetChildId),
      where('date', '==', dateStr)
    );
    const snapshot = await getDocs(qLogs);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RoutineLog));
  };

  return {
    routines,
    loading,
    error,
    createRoutine,
    updateRoutine,
    archiveRoutine,
    logRoutine,
    getTodayLogs,
  };
}
