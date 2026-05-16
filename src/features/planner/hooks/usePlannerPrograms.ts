import { useCallback, useEffect, useState } from 'react';
import { fetchPlannerPrograms } from '../services/planner.firestore';
import type { PlannerProgram } from '../types/planner.types';

export function usePlannerPrograms(childId: string) {
  const [programs, setPrograms] = useState<PlannerProgram[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!childId) {
      setPrograms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await fetchPlannerPrograms(childId);
      const now = new Date();
      // Filter out programs that have an end date in the past
      const active = rows.filter(p => {
        if (!p.endDate) return true;
        const end = new Date(p.endDate);
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        return end >= now;
      });
      setPrograms(active);
    } catch (err) {
      console.error('usePlannerPrograms error:', err);
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }, [childId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { programs, loading, refresh: load };
}
