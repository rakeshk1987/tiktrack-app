import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, addDoc,
  updateDoc, doc, getDocs, orderBy, limit, setDoc, getDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Routine, RoutineLog } from '../types/schema';
import { useSickMode } from './useSickMode';
import { createRewardLedgerEntry } from './useRewardLedger';
import { calculateCashReward, fetchCashRewardSettings } from '../utils/rewards';

export interface RoutineLogResult {
  status: 'completed' | 'missed' | 'sick';
  inTimeWindow: boolean;
  starsAwarded: number;
  starsDelta: number;
  requiresApproval: boolean;
  alreadyLogged?: boolean;
}

/** Returns the effective day range key for today */
export function getTodayDayRange(): 'weekday' | 'weekend' {
  const day = new Date().getDay(); // 0=Sun, 6=Sat
  return (day === 0 || day === 6) ? 'weekend' : 'weekday';
}

function getTodayKey() {
  const today = new Date();
  return (
    today.getFullYear() +
    '-' + String(today.getMonth() + 1).padStart(2, '0') +
    '-' + String(today.getDate()).padStart(2, '0')
  );
}

async function runRoutineSideEffect(label: string, work: () => Promise<void>) {
  try {
    await work();
  } catch (error) {
    console.warn(`${label} skipped:`, error);
  }
}

function timeToMinutes(value: string | undefined | null) {
  if (!value) return null;
  const [hoursRaw, minutesRaw] = value.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function isTimeInRange(actualTime: string | undefined, startTime: string, endTime: string) {
  const actual = timeToMinutes(actualTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (actual == null || start == null || end == null) return false;
  if (start <= end) return actual >= start && actual <= end;
  return actual >= start || actual <= end;
}

async function applyStarsDelta(childId: string, familyId: string, routine: Routine, starsDelta: number, reason: string) {
  if (!starsDelta) return;
  const profileRef = doc(db, 'child_profile', childId);
  const profileSnap = await getDoc(profileRef);
  const profile = profileSnap.exists() ? profileSnap.data() : null;
  const currentStars = Number(profile?.total_stars || 0);
  await updateDoc(profileRef, {
    total_stars: Math.max(0, currentStars + starsDelta)
  });
  await createRewardLedgerEntry({
    child_id: childId,
    parent_id: familyId,
    family_id: familyId,
    type: starsDelta > 0 ? 'bonus' : 'adjustment',
    stars_delta: starsDelta,
    title: routine.title,
    reason,
    source_id: routine.id,
    source_type: 'routine',
    visible_to_child: true,
  });
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
    status: 'completed' | 'missed' | 'sick',
    actualCompletedTime?: string
  ): Promise<RoutineLogResult> => {
    try {
      const today = new Date();
      const dateStr = getTodayKey();

      // Sick mode override
      const sickPeriod = getActiveSickPeriod(targetChildId);
      if (sickPeriod) status = 'sick';

      const logId = `${targetChildId}_${routine.id}_${dateStr}`;
      const logRef = doc(db, 'routine_logs', logId);
      const existingLogSnap = await getDoc(logRef);
      if (existingLogSnap.exists()) {
        const existingLog = existingLogSnap.data() as RoutineLog;
        if (existingLog.status === status || existingLog.status === 'completed' || existingLog.status === 'sick') {
          return {
            status: existingLog.status,
            inTimeWindow: existingLog.in_time_window ?? true,
            starsAwarded: Number(existingLog.stars_awarded || 0),
            starsDelta: Number(existingLog.stars_delta || 0),
            requiresApproval: routine.requires_approval,
            alreadyLogged: true
          };
        }
      }

      const routineStart = routine.start_time || routine.schedule_time || '00:00';
      const routineEnd = routine.end_time || routine.schedule_time || routineStart;
      const inTimeWindow = status === 'completed' ? isTimeInRange(actualCompletedTime, routineStart, routineEnd) : false;
      const rewardSettings = status === 'completed' && inTimeWindow
        ? await fetchCashRewardSettings(familyId, familyId)
        : undefined;
      const routineCashReward = status === 'completed' && inTimeWindow
        ? calculateCashReward(Number((routine as any).base_cash_value ?? routine.points ?? 0), Number((routine as any).performance_stars || 5), rewardSettings)
        : { amount: 0 };
      const starsAwarded = routineCashReward.amount;
      const starsDelta = status === 'missed' ? -Math.abs(Number(routine.points || 0)) : (routine.requires_approval ? 0 : starsAwarded);

      const logData: RoutineLog = {
        id: logId,
        routine_id: routine.id,
        family_id: familyId,
        child_id: targetChildId,
        date: dateStr,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : undefined,
        actual_completed_time: status === 'completed' ? actualCompletedTime : undefined,
        in_time_window: status === 'completed' ? inTimeWindow : undefined,
        stars_awarded: starsAwarded,
        stars_delta: starsDelta,
      };

      await setDoc(logRef, logData, { merge: true });

      if (status === 'missed' && starsDelta < 0) {
        await runRoutineSideEffect('Routine missed penalty', async () => {
          await applyStarsDelta(targetChildId, familyId, routine, starsDelta, `Missed routine after daily lockout: ${routine.title}`);
        });
      }

      if (status === 'completed') {
        // If approval required, create pending approval; otherwise grant stars directly
        if (routine.requires_approval && starsAwarded > 0) {
          await runRoutineSideEffect('Routine approval creation', async () => {
            const pendingApprovalsQuery = query(
              collection(db, 'approvals'),
              where('family_id', '==', familyId),
              where('child_id', '==', targetChildId),
              where('type', '==', 'routine'),
              where('reference_id', '==', routine.id),
              where('status', '==', 'pending')
            );
            const pendingApprovalsSnapshot = await getDocs(pendingApprovalsQuery);
            const hasPendingApprovalToday = pendingApprovalsSnapshot.docs.some((approvalDoc) => {
              const approval = approvalDoc.data();
              const submittedDate = approval.created_at
                ? new Date(approval.created_at).toISOString().slice(0, 10)
                : '';

              return submittedDate === dateStr;
            });

            if (!hasPendingApprovalToday) {
              const approvalRef = await addDoc(collection(db, 'approvals'), {
                family_id: familyId,
                child_id: targetChildId,
                type: 'routine',
                reference_id: routine.id,
                title: routine.title,
                points: starsAwarded,
                status: 'pending',
                created_at: new Date().toISOString(),
              });
              // Fire-and-forget Telegram notification — never blocks the UI
              fetch('/api/telegram/notify-approval', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  family_id: familyId,
                  child_id: targetChildId,
                  type: 'routine',
                  title: routine.title,
                  approval_id: approvalRef.id,
                }),
              }).catch(() => {});
            }
          });
        } else if (!routine.requires_approval && starsAwarded > 0) {
          await runRoutineSideEffect('Routine star award', async () => {
            await applyStarsDelta(targetChildId, familyId, routine, starsAwarded, `Completed routine on time: ${routine.title}`);
          });
        }

        // Evaluate and update streak
        await runRoutineSideEffect('Routine streak update', async () => {
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
        });
      }

      return {
        status,
        inTimeWindow,
        starsAwarded,
        starsDelta,
        requiresApproval: routine.requires_approval
      };
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
