import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { RewardLedgerEntry } from '../types/schema';

export type NewRewardLedgerEntry = Omit<RewardLedgerEntry, 'id' | 'created_at'> & {
  created_at?: string;
};

export const createRewardLedgerEntry = async (entry: NewRewardLedgerEntry) => {
  const now = new Date().toISOString();
  const docRef = await addDoc(collection(db, 'reward_ledger'), {
    ...entry,
    created_at: entry.created_at || now,
    surprise_state: entry.surprise_state || 'none',
  });

  return {
    ...entry,
    id: docRef.id,
    created_at: entry.created_at || now,
    surprise_state: entry.surprise_state || 'none',
  } as RewardLedgerEntry;
};

export function useRewardLedger(childId: string, familyId?: string) {
  const [entries, setEntries] = useState<RewardLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLedger = async () => {
      if (!childId) {
        setEntries([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const rewardLedgerRef = collection(db, 'reward_ledger');
        const snapshot = await getDocs(query(rewardLedgerRef, where('child_id', '==', childId)));
        const fetched = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<RewardLedgerEntry, 'id'>) }))
          .filter((entry) => !familyId || !entry.family_id || entry.family_id === familyId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setEntries(fetched);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reward timeline');
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    void loadLedger();
  }, [childId, familyId]);

  const visibleEntries = useMemo(
    () => entries.filter((entry) => entry.visible_to_child),
    [entries]
  );

  const surpriseEntries = useMemo(
    () => visibleEntries.filter((entry) => entry.surprise_state === 'hidden' && entry.stars_delta > 0),
    [visibleEntries]
  );

  const revealEntry = useCallback(async (entryId: string) => {
    const ref = doc(db, 'reward_ledger', entryId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const revealedAt = new Date().toISOString();
    await updateDoc(ref, {
      surprise_state: 'revealed',
      revealed_at: revealedAt,
    });

    setEntries((current) =>
      current.map((entry) =>
        entry.id === entryId
          ? { ...entry, surprise_state: 'revealed', revealed_at: revealedAt }
          : entry
      )
    );
  }, []);

  return {
    entries,
    visibleEntries,
    surpriseEntries,
    loading,
    error,
    revealEntry,
  };
}
