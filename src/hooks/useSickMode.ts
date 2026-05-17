import { useState, useEffect, useCallback } from 'react';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  orderBy,
} from 'firebase/firestore';

export interface SickPeriod {
  id: string;
  family_id: string;
  child_id: string;
  initiated_by: string;
  initiated_by_role: 'parent' | 'child';
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: 'active' | 'pending_approval' | 'rejected' | 'ended';
  approved_by?: string;
  approved_at?: string;
  reason?: string;
  created_at: string;
  updated_at: string;
}

export function useSickMode(familyId: string, childId?: string) {
  const [sickPeriods, setSickPeriods] = useState<SickPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) return;
    
    let q = query(
      collection(db, 'sick_periods'),
      where('family_id', '==', familyId)
    );

    if (childId) {
      q = query(q, where('child_id', '==', childId));
    }

    const unsub = onSnapshot(q, (snap) => {
      const periods = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as SickPeriod[];
      
      // Sort in memory since we might not have a composite index for start_date yet
      periods.sort((a, b) => b.start_date.localeCompare(a.start_date));
      setSickPeriods(periods);
      setLoading(false);
    });

    return () => unsub();
  }, [familyId, childId]);

  const initiateSickPeriod = useCallback(
    async (
      targetChildId: string,
      role: 'parent' | 'child',
      initiatorId: string,
      startDate: string,
      endDate: string,
      reason?: string
    ) => {
      const payload: Omit<SickPeriod, 'id'> = {
        family_id: familyId,
        child_id: targetChildId,
        initiated_by: initiatorId,
        initiated_by_role: role,
        start_date: startDate,
        end_date: endDate,
        status: role === 'parent' ? 'active' : 'pending_approval',
        reason,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (role === 'parent') {
        payload.approved_by = initiatorId;
        payload.approved_at = payload.created_at;
      }

      await addDoc(collection(db, 'sick_periods'), payload);
    },
    [familyId]
  );

  const updateSickPeriodStatus = useCallback(
    async (id: string, status: SickPeriod['status'], approverId?: string) => {
      const payload: Partial<SickPeriod> = {
        status,
        updated_at: new Date().toISOString(),
      };
      
      if (status === 'active' && approverId) {
        payload.approved_by = approverId;
        payload.approved_at = new Date().toISOString();
      }

      await updateDoc(doc(db, 'sick_periods', id), payload);
    },
    []
  );

  const getActiveSickPeriod = useCallback((targetChildId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return sickPeriods.find(
      (p) =>
        p.child_id === targetChildId &&
        p.status === 'active' &&
        p.start_date <= today &&
        p.end_date >= today
    );
  }, [sickPeriods]);

  const isDateSick = useCallback((targetChildId: string, dateStr: string) => {
    return sickPeriods.some(
      (p) =>
        p.child_id === targetChildId &&
        p.status === 'active' &&
        p.start_date <= dateStr &&
        p.end_date >= dateStr
    );
  }, [sickPeriods]);

  const pendingRequests = sickPeriods.filter((p) => p.status === 'pending_approval');

  return {
    sickPeriods,
    pendingRequests,
    loading,
    initiateSickPeriod,
    updateSickPeriodStatus,
    getActiveSickPeriod,
    isDateSick,
  };
}
