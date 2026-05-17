import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { MOCK_PLANNER_TIMETABLE } from '../constants/planner.mock';
import type { PlannerTimetable } from '../types/planner.types';

export function usePlannerTimetable(childId: string, useMockFallback = true) {
  const [timetable, setTimetable] = useState<PlannerTimetable | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setTimetable(useMockFallback ? MOCK_PLANNER_TIMETABLE : null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'school_timetables'),
      where('child_id', '==', childId),
      where('is_active', '==', true),
      limit(1)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setTimetable(useMockFallback ? MOCK_PLANNER_TIMETABLE : null);
        } else {
          const raw = snap.docs[0].data() as Record<string, unknown>;
          setTimetable({
            periods: Array.isArray(raw.periods) ? (raw.periods as string[]) : [],
            days: Array.isArray(raw.days) ? (raw.days as string[]) : [],
            data: (raw.data as PlannerTimetable['data']) || {}
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('usePlannerTimetable error:', err);
        setTimetable(useMockFallback ? MOCK_PLANNER_TIMETABLE : null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [childId, useMockFallback]);

  return { timetable, loading, refresh: () => {} };
}

