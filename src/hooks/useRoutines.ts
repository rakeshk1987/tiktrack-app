import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Routine, RoutineLog } from '../types/schema';
import { useSickMode } from './useSickMode';

export function useRoutines(familyId: string, childId?: string) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getActiveSickPeriod } = useSickMode(familyId, childId || '');

  // Fetch routines
  useEffect(() => {
    if (!familyId) {
      setRoutines([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, 'routines'),
      where('family_id', '==', familyId),
      where('status', '==', 'active')
    );

    if (childId) {
      q = query(
        collection(db, 'routines'),
        where('family_id', '==', familyId),
        where('child_id', 'in', [childId, null, '']),
        where('status', '==', 'active')
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine));
        // Sort by schedule_time
        results.sort((a, b) => a.schedule_time.localeCompare(b.schedule_time));
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

  const createRoutine = async (routine: Omit<Routine, 'id' | 'created_at' | 'updated_at' | 'streak'>) => {
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'routines'), {
        ...routine,
        streak: 0,
        created_at: now,
        updated_at: now,
      });
      return docRef.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateRoutine = async (id: string, updates: Partial<Routine>) => {
    try {
      const ref = doc(db, 'routines', id);
      await updateDoc(ref, {
        ...updates,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const archiveRoutine = async (id: string) => {
    return updateRoutine(id, { status: 'archived' });
  };

  const logRoutine = async (routine: Routine, targetChildId: string, status: 'completed' | 'missed' | 'sick') => {
    try {
      const today = new Date();
      // Format as YYYY-MM-DD in local time
      const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

      // Check if sick mode is active for the child
      const sickPeriod = getActiveSickPeriod(targetChildId);
      if (sickPeriod) {
        status = 'sick';
      }

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
        // Create an approval request for the parent
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

      if (status === 'completed') {
        // Evaluate streak
        const logsRef = collection(db, 'routine_logs');
        const qLogs = query(
          logsRef,
          where('routine_id', '==', routine.id),
          where('child_id', '==', targetChildId),
          where('status', '==', 'completed'),
          orderBy('date', 'desc'),
          limit(2) // Get today's (just added) and the previous one
        );
        const snapshot = await getDocs(qLogs);
        const completedLogs = snapshot.docs.map(d => d.data() as RoutineLog);
        
        let newStreak = routine.streak || 0;
        
        if (completedLogs.length > 1) {
          const previousDate = new Date(completedLogs[1].date);
          const diffDays = Math.floor((today.getTime() - previousDate.getTime()) / (1000 * 3600 * 24));
          
          if (diffDays === 1) {
            newStreak += 1;
          } else if (diffDays > 1) {
            // Check if there was a sick period in between
            // For now, if there is a gap > 1 day, we reset, but we could check sick logs.
            // Simplified: if they completed it today but missed yesterday, streak resets to 1
            newStreak = 1;
          }
        } else {
          // First completion
          newStreak = 1;
        }

        // Update routine streak
        await updateRoutine(routine.id, { streak: newStreak });
      }

    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const getTodayLogs = async (targetChildId: string) => {
    const today = new Date();
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

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
    getTodayLogs
  };
}
