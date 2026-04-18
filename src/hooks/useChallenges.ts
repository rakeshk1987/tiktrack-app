import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Challenge } from '../types/schema';

/**
 * Real-time CRUD hook for the parent-vs-child challenge system.
 * Challenges are mini-competitions (e.g., "Who reads 5 books first?") with a target score.
 * Both parent and child can increment their own score; once either hits the target, the challenge completes.
 */
export function useChallenges(parentId: string) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parentId) {
      setChallenges([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'challenges'), where('parent_id', '==', parentId));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Challenge, 'id'>) }))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setChallenges(mapped);
        setLoading(false);
      },
      (error) => {
        console.warn('useChallenges failed:', error);
        setChallenges([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [parentId]);

  const createChallenge = useCallback(async (
    title: string,
    childId: string,
    targetScore: number,
    description?: string
  ) => {
    await addDoc(collection(db, 'challenges'), {
      title,
      description: description || '',
      parent_id: parentId,
      child_id: childId,
      parent_score: 0,
      child_score: 0,
      target_score: targetScore,
      status: 'active',
      created_at: new Date().toISOString()
    });
  }, [parentId]);

  const incrementScore = useCallback(async (challengeId: string, who: 'parent' | 'child') => {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge || challenge.status === 'completed') return;

    const field = who === 'parent' ? 'parent_score' : 'child_score';
    const newScore = (who === 'parent' ? challenge.parent_score : challenge.child_score) + 1;
    const otherScore = who === 'parent' ? challenge.child_score : challenge.parent_score;

    const updates: Record<string, any> = { [field]: newScore };

    // Check if challenge is now complete
    if (newScore >= challenge.target_score) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
      updates.winner = who;
    } else if (otherScore >= challenge.target_score) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
      updates.winner = who === 'parent' ? 'child' : 'parent';
    }

    await updateDoc(doc(db, 'challenges', challengeId), updates);
  }, [challenges]);

  const deleteChallenge = useCallback(async (challengeId: string) => {
    await deleteDoc(doc(db, 'challenges', challengeId));
  }, []);

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');

  return {
    challenges,
    activeChallenges,
    completedChallenges,
    loading,
    createChallenge,
    incrementScore,
    deleteChallenge
  };
}
