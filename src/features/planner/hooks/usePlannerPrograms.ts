import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { mapPlannerProgram } from '../services/planner.firestore';
import type { PlannerProgram } from '../types/planner.types';

export function usePlannerPrograms(childId: string) {
  const [programs, setPrograms] = useState<PlannerProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setPrograms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'programs'),
      where('child_id', '==', childId),
      limit(500)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .map((docRow) => mapPlannerProgram(docRow.id, docRow.data() as Record<string, unknown>))
          .filter((p) => p.isActive)
          .sort((a, b) => a.name.localeCompare(b.name));

        const now = new Date();
        const active = rows.filter((p) => {
          if (!p.endDate) return true;
          const end = new Date(p.endDate);
          end.setHours(23, 59, 59, 999);
          return end >= now;
        });

        setPrograms(active);
        setLoading(false);
      },
      (err) => {
        console.error('usePlannerPrograms error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [childId]);

  return { programs, loading, refresh: () => {} };
}

