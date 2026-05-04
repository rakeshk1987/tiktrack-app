import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
} from 'firebase/firestore';
import type { RoutineConfiguration, RoutineSlot } from '../types/schema';

const ACADEMIC_MODE_START = '06-01'; // June 1
const ACADEMIC_MODE_END = '03-31'; // March 31

/**
 * Determine if today is in academic mode based on current date
 */
export const isAcademicMode = (): boolean => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${month}-${day}`;

  // Academic mode: June 1 to March 31
  if (ACADEMIC_MODE_START <= ACADEMIC_MODE_END) {
    // Normal year
    return todayStr >= ACADEMIC_MODE_START && todayStr <= ACADEMIC_MODE_END;
  } else {
    // Wraps around year (June to Dec, then Jan to March)
    return todayStr >= ACADEMIC_MODE_START || todayStr <= ACADEMIC_MODE_END;
  }
};

/**
 * Get current time in HH:MM format
 */
export const getCurrentTimeInHHMM = (): string => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
};

/**
 * Compare times in HH:MM format
 * Returns: -1 if timeA < timeB, 0 if equal, 1 if timeA > timeB
 */
const compareTime = (timeA: string, timeB: string): number => {
  const [hoursA, minutesA] = timeA.split(':').map(Number);
  const [hoursB, minutesB] = timeB.split(':').map(Number);
  const totalA = hoursA * 60 + minutesA;
  const totalB = hoursB * 60 + minutesB;
  return totalA < totalB ? -1 : totalA > totalB ? 1 : 0;
};

/**
 * Find current routine slot based on time
 */
export const getCurrentRoutineSlot = (
  routine: RoutineSlot[]
): RoutineSlot | null => {
  const currentTime = getCurrentTimeInHHMM();

  for (const slot of routine) {
    if (
      compareTime(currentTime, slot.start_time) >= 0 &&
      compareTime(currentTime, slot.end_time) < 0
    ) {
      return slot;
    }
  }

  return null;
};

/**
 * Get next routine slot
 */
export const getNextRoutineSlot = (
  routine: RoutineSlot[],
  offset: number = 1
): RoutineSlot | null => {
  const currentTime = getCurrentTimeInHHMM();
  const upcomingSlots = routine.filter(
    (slot) => compareTime(slot.start_time, currentTime) > 0
  );

  return upcomingSlots[offset - 1] || null;
};

export const useRoutineConfiguration = (parentId: string, childId?: string) => {
  const [routine, setRoutine] = useState<RoutineConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch routine configuration
  useEffect(() => {
    const fetchRoutine = async () => {
      try {
        setLoading(true);
        const routineRef = collection(db, 'routine_configurations');
        let q;

        if (childId) {
          q = query(
            routineRef,
            where('parent_id', '==', parentId),
            where('child_id', '==', childId)
          );
        } else {
          // Get parent's default routine
          q = query(
            routineRef,
            where('parent_id', '==', parentId),
            where('child_id', '==', '')
          );
        }

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setRoutine(snapshot.docs[0].data() as RoutineConfiguration);
        } else {
          // No routine found, set default
          setRoutine(getDefaultRoutine(parentId, childId));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch routine');
      } finally {
        setLoading(false);
      }
    };

    if (parentId) {
      fetchRoutine();
    }
  }, [parentId, childId]);

  const createRoutine = async (
    newRoutine: Omit<RoutineConfiguration, 'id' | 'created_at' | 'updated_at'>
  ) => {
    try {
      const routineRef = collection(db, 'routine_configurations');
      const docRef = await addDoc(routineRef, {
        ...newRoutine,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const createdRoutine: RoutineConfiguration = {
        ...newRoutine,
        id: docRef.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setRoutine(createdRoutine);
      return createdRoutine;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create routine');
      throw err;
    }
  };

  const updateRoutine = async (
    updates: Partial<Omit<RoutineConfiguration, 'id' | 'created_at'>>
  ) => {
    if (!routine) {
      throw new Error('No routine to update');
    }

    try {
      const routineRef = doc(db, 'routine_configurations', routine.id);
      await updateDoc(routineRef, {
        ...updates,
        updated_at: new Date().toISOString(),
      });

      const updated: RoutineConfiguration = {
        ...routine,
        ...updates,
        updated_at: new Date().toISOString(),
      };

      setRoutine(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update routine');
      throw err;
    }
  };

  return {
    routine,
    loading,
    error,
    createRoutine,
    updateRoutine,
    currentMode: routine?.current_mode || (isAcademicMode() ? 'academic' : 'vacation'),
    currentRoutineSlots:
      routine?.current_mode === 'academic'
        ? routine.school_days_routine
        : routine?.vacation_routine || [],
    currentTimeSlot: routine
      ? getCurrentRoutineSlot(
          routine.current_mode === 'academic'
            ? routine.school_days_routine
            : routine.vacation_routine
        )
      : null,
  };
};

/**
 * Get default routine configuration
 */
export const getDefaultRoutine = (
  parentId: string,
  childId?: string
): RoutineConfiguration => {
  const now = new Date();

  return {
    id: '', // Will be set by Firestore
    parent_id: parentId,
    child_id: childId,
    school_days_routine: [
      {
        name: 'Wake Up & Prep',
        start_time: '06:45',
        end_time: '08:15',
        category: 'health',
      },
      {
        name: 'School',
        start_time: '08:30',
        end_time: '15:00',
        category: 'study',
      },
      {
        name: 'Play Time',
        start_time: '15:30',
        end_time: '18:30',
        category: 'leisure',
      },
      {
        name: 'Prayer',
        start_time: '18:30',
        end_time: '18:45',
        category: 'prayer',
      },
      {
        name: 'Study',
        start_time: '18:45',
        end_time: '20:00',
        category: 'study',
      },
      {
        name: 'Brain Gym',
        start_time: '20:00',
        end_time: '20:30',
        category: 'study',
      },
      {
        name: 'Dinner',
        start_time: '20:30',
        end_time: '21:00',
        category: 'health',
      },
      {
        name: 'Reading',
        start_time: '21:00',
        end_time: '22:00',
        category: 'leisure',
      },
    ],
    vacation_routine: [
      {
        name: 'Wake Up & Breakfast',
        start_time: '07:00',
        end_time: '08:30',
        category: 'health',
      },
      {
        name: 'Activity/Play',
        start_time: '08:30',
        end_time: '12:00',
        category: 'leisure',
      },
      {
        name: 'Lunch Break',
        start_time: '12:00',
        end_time: '13:00',
        category: 'health',
      },
      {
        name: 'Rest/Activity',
        start_time: '13:00',
        end_time: '15:30',
        category: 'leisure',
      },
      {
        name: 'Light Study',
        start_time: '15:30',
        end_time: '16:30',
        category: 'study',
      },
      {
        name: 'Play/Hobby',
        start_time: '16:30',
        end_time: '18:30',
        category: 'leisure',
      },
      {
        name: 'Dinner & Family Time',
        start_time: '18:30',
        end_time: '20:00',
        category: 'health',
      },
      {
        name: 'Evening Activity',
        start_time: '20:00',
        end_time: '21:30',
        category: 'leisure',
      },
    ],
    academic_mode_start: ACADEMIC_MODE_START,
    academic_mode_end: ACADEMIC_MODE_END,
    current_mode: isAcademicMode() ? 'academic' : 'vacation',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
};
