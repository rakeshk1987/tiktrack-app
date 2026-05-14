import { useCallback, useEffect, useState } from 'react';
import { MOCK_PLANNER_TIMETABLE } from '../constants/planner.mock';
import { fetchSchoolTimetable } from '../services/planner.firestore';
import type { PlannerTimetable } from '../types/planner.types';

export function usePlannerTimetable(childId: string, useMockFallback = true) {
  const [timetable, setTimetable] = useState<PlannerTimetable | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!childId) {
      setTimetable(useMockFallback ? MOCK_PLANNER_TIMETABLE : null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const row = await fetchSchoolTimetable(childId);
      setTimetable(row || (useMockFallback ? MOCK_PLANNER_TIMETABLE : null));
    } catch {
      setTimetable(useMockFallback ? MOCK_PLANNER_TIMETABLE : null);
    } finally {
      setLoading(false);
    }
  }, [childId, useMockFallback]);

  useEffect(() => {
    void load();
  }, [load]);

  return { timetable, loading, refresh: load };
}
