import { useCallback, useEffect, useState } from 'react';
import { MOCK_PLANNER_PROGRAMS } from '../constants/planner.mock';
import { fetchPlannerPrograms } from '../services/planner.firestore';
import type { PlannerProgram } from '../types/planner.types';

export function usePlannerPrograms(childId: string, useMockFallback = true) {
  const [programs, setPrograms] = useState<PlannerProgram[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!childId) {
      setPrograms(useMockFallback ? MOCK_PLANNER_PROGRAMS : []);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await fetchPlannerPrograms(childId);
      if (rows.length === 0 && useMockFallback) {
        setPrograms(MOCK_PLANNER_PROGRAMS.map((program) => ({ ...program, childId })));
      } else {
        setPrograms(rows);
      }
    } catch (err) {
      console.error('usePlannerPrograms error:', err);
      setPrograms(useMockFallback ? MOCK_PLANNER_PROGRAMS.map((program) => ({ ...program, childId })) : []);
    } finally {
      setLoading(false);
    }
  }, [childId, useMockFallback]);

  useEffect(() => {
    void load();
  }, [load]);

  return { programs, loading, refresh: load };
}
