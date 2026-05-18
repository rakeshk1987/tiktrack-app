import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Approval, Settlement } from '../types/schema';

export function useApprovals(familyId: string, childId?: string) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch approvals
  useEffect(() => {
    if (!familyId) return;

    let q = query(
      collection(db, 'approvals'),
      where('family_id', '==', familyId)
    );

    if (childId) {
      q = query(q, where('child_id', '==', childId));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Approval));
        // Client-side sort by created_at desc to avoid needing complex composite index if not present immediately
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setApprovals(results);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching approvals:', err);
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [familyId, childId]);

  // Fetch settlements
  useEffect(() => {
    if (!familyId) return;

    let q = query(
      collection(db, 'settlements'),
      where('family_id', '==', familyId)
    );

    if (childId) {
      q = query(q, where('child_id', '==', childId));
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Settlement));
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setSettlements(results);
      },
      (err) => {
        console.error('Error fetching settlements:', err);
      }
    );
    return () => unsub();
  }, [familyId, childId]);

  const requestApproval = async (approval: Omit<Approval, 'id' | 'created_at' | 'status'>) => {
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'approvals'), {
        ...approval,
        status: 'pending',
        created_at: now,
      });
      return docRef.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const resolveApproval = async (
    approvalId: string,
    status: 'approved' | 'rejected',
    parentId: string,
    options: { notifyChild?: boolean; awardPoints?: boolean } = {}
  ) => {
    try {
      const { notifyChild = true, awardPoints = true } = options;
      const ref = doc(db, 'approvals', approvalId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error('Approval not found');
      
      const data = snap.data() as Approval;

      await updateDoc(ref, {
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: parentId,
      });

      // If approved and has points, award to child
      if (awardPoints && status === 'approved' && data.points && data.points > 0) {
        const profileRef = doc(db, 'child_profile', data.child_id);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const currentStars = profileSnap.data().total_stars || 0;
          await updateDoc(profileRef, {
            total_stars: currentStars + data.points
          });
        }
      }

      // Send notification message to the child's inbox
      if (notifyChild) {
        await addDoc(collection(db, 'messages'), {
          child_id: data.child_id,
          parent_id: parentId,
          content: `Your ${data.type} request "${data.title}" was ${status}!`,
          timestamp: new Date().toISOString(),
          is_read: false,
          sender_role: 'parent',
          sender_id: parentId,
          subject: `Quest Resolution`
        });
      }

    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const createSettlement = async (settlement: Omit<Settlement, 'id' | 'created_at' | 'status'>) => {
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'settlements'), {
        ...settlement,
        status: 'draft',
        created_at: now,
      });
      return docRef.id;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const markSettlementPaid = async (settlementId: string) => {
    try {
      const ref = doc(db, 'settlements', settlementId);
      await updateDoc(ref, {
        status: 'paid',
        paid_at: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    approvals,
    settlements,
    loading,
    error,
    requestApproval,
    resolveApproval,
    createSettlement,
    markSettlementPaid
  };
}
