import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import type { Challenge } from '../../../types/schema';

export function usePlannerChallenges(childId: string, programId?: string | null, challengePoints?: number | null) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!childId) {
      setChallenges([]);
      setLoading(false);
      return;
    }

    let q = query(collection(db, 'challenges'), where('child_id', '==', childId));
    
    // If we have a programId, we could filter by it, but maybe we want to see all challenges for this child?
    // User said "under an activity", so filtering by programId is appropriate.
    if (programId) {
      q = query(collection(db, 'challenges'), where('child_id', '==', childId), where('linked_program_id', '==', programId));
    }

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
        console.warn('usePlannerChallenges failed:', error);
        setChallenges([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [childId, programId]);

  const createChallenge = useCallback(async (
    title: string,
    parentId: string,
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
      linked_program_id: programId || null,
      created_at: new Date().toISOString()
    });
  }, [childId, programId]);

  const incrementScore = useCallback(async (challengeId: string, who: 'parent' | 'child') => {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge || challenge.status === 'completed') return;

    const field = who === 'parent' ? 'parent_score' : 'child_score';
    const newScore = (who === 'parent' ? challenge.parent_score : challenge.child_score) + 1;
    
    const updates: Record<string, any> = { 
      [field]: newScore,
      updated_at: new Date().toISOString()
    };

    if (newScore >= challenge.target_score) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
      updates.winner = who;
    }

    await updateDoc(doc(db, 'challenges', challengeId), updates);

    // Award stars if challenge is now complete and points are configured
    if (newScore >= challenge.target_score && challengePoints && challengePoints > 0 && childId) {
      const profileRef = doc(db, 'child_profile', childId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const currentStars = profileSnap.data().total_stars || 0;
        await updateDoc(profileRef, {
          total_stars: currentStars + challengePoints
        });
      }
    }
  }, [challenges, challengePoints, childId]);

  const deleteChallenge = useCallback(async (challengeId: string) => {
    await deleteDoc(doc(db, 'challenges', challengeId));
  }, []);

  return {
    challenges,
    loading,
    createChallenge,
    incrementScore,
    deleteChallenge
  };
}
