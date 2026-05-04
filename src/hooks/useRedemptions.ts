import { useEffect, useState } from 'react';
import { db } from '../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import type { RewardItem, Redemption } from '../types/schema';

/**
 * Get default reward items to suggest
 */
export const getDefaultRewards = (parentId: string): Omit<RewardItem, 'id' | 'created_at' | 'updated_at'>[] => {
  return [
    {
      parent_id: parentId,
      name: 'Extra Gaming Time',
      description: 'Get 1 extra hour of gaming time',
      star_cost: 20,
      icon: '🎮',
      category: 'privilege',
      is_available: true,
      max_redemptions_per_week: 1,
    },
    {
      parent_id: parentId,
      name: 'Movie Night',
      description: 'Watch a movie of your choice',
      star_cost: 30,
      icon: '🎬',
      category: 'experience',
      is_available: true,
      max_redemptions_per_week: 2,
    },
    {
      parent_id: parentId,
      name: 'Ice Cream Treat',
      description: 'Get your favorite ice cream',
      star_cost: 15,
      icon: '🍦',
      category: 'item',
      is_available: true,
      max_redemptions_per_week: 3,
    },
    {
      parent_id: parentId,
      name: 'Special Outing',
      description: 'Go to a place of your choice',
      star_cost: 50,
      icon: '🚗',
      category: 'experience',
      is_available: true,
      max_redemptions_per_week: 1,
    },
    {
      parent_id: parentId,
      name: 'Device Free Pass',
      description: 'Skip screen time limit for a day',
      star_cost: 25,
      icon: '📵',
      category: 'privilege',
      is_available: true,
      max_redemptions_per_week: 1,
    },
    {
      parent_id: parentId,
      name: 'Favorite Dinner',
      description: 'Request your favorite meal',
      star_cost: 18,
      icon: '🍕',
      category: 'item',
      is_available: true,
      max_redemptions_per_week: 2,
    },
    {
      parent_id: parentId,
      name: 'Extra Allowance',
      description: 'Get ₹50 bonus allowance',
      star_cost: 40,
      icon: '💰',
      category: 'item',
      is_available: true,
      max_redemptions_per_week: 1,
    },
    {
      parent_id: parentId,
      name: 'Play Date',
      description: 'Invite a friend for a playdate',
      star_cost: 35,
      icon: '👫',
      category: 'experience',
      is_available: true,
      max_redemptions_per_week: 1,
    },
  ];
};

export const useRewards = (parentId: string) => {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        setLoading(true);
        const rewardsRef = collection(db, 'reward_items');
        const q = query(
          rewardsRef,
          where('parent_id', '==', parentId),
          where('is_available', '==', true)
        );

        const snapshot = await getDocs(q);
        const fetchedRewards = snapshot.docs.map(doc => doc.data() as RewardItem);
        setRewards(fetchedRewards.sort((a, b) => a.star_cost - b.star_cost));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch rewards');
      } finally {
        setLoading(false);
      }
    };

    if (parentId) {
      fetchRewards();
    }
  }, [parentId]);

  const createReward = async (newReward: Omit<RewardItem, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const rewardsRef = collection(db, 'reward_items');
      const now = new Date().toISOString();

      const docRef = await addDoc(rewardsRef, {
        ...newReward,
        created_at: now,
        updated_at: now,
      });

      const created: RewardItem = {
        ...newReward,
        id: docRef.id,
        created_at: now,
        updated_at: now,
      };

      setRewards([...rewards, created].sort((a, b) => a.star_cost - b.star_cost));
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reward');
      throw err;
    }
  };

  const updateReward = async (id: string, updates: Partial<Omit<RewardItem, 'id' | 'created_at'>>) => {
    try {
      const rewardsRef = doc(db, 'reward_items', id);
      const now = new Date().toISOString();

      await updateDoc(rewardsRef, {
        ...updates,
        updated_at: now,
      });

      setRewards(
        rewards.map(r =>
          r.id === id
            ? {
                ...r,
                ...updates,
                updated_at: now,
              }
            : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update reward');
      throw err;
    }
  };

  const deleteReward = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reward_items', id));
      setRewards(rewards.filter(r => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete reward');
      throw err;
    }
  };

  return {
    rewards,
    loading,
    error,
    createReward,
    updateReward,
    deleteReward,
  };
};

export const useRedemptions = (childId: string, parentId: string) => {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRedemptions = async () => {
      try {
        setLoading(true);
        const redemptionsRef = collection(db, 'redemptions');
        const q = query(
          redemptionsRef,
          where('child_id', '==', childId),
          where('parent_id', '==', parentId)
        );

        const snapshot = await getDocs(q);
        const fetchedRedemptions = snapshot.docs.map(doc => doc.data() as Redemption);
        setRedemptions(fetchedRedemptions);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch redemptions');
      } finally {
        setLoading(false);
      }
    };

    if (childId && parentId) {
      fetchRedemptions();
    }
  }, [childId, parentId]);

  const requestRedemption = async (
    rewardItemId: string,
    rewardItem: RewardItem,
    currentStars: number
  ): Promise<Redemption> => {
    if (currentStars < rewardItem.star_cost) {
      throw new Error('Not enough stars for this reward');
    }

    try {
      const redemptionsRef = collection(db, 'redemptions');
      const now = new Date().toISOString();

      const docRef = await addDoc(redemptionsRef, {
        child_id: childId,
        parent_id: parentId,
        reward_item_id: rewardItemId,
        reward_item: rewardItem,
        stars_spent: rewardItem.star_cost,
        status: 'pending',
        requested_at: now,
      });

      const newRedemption: Redemption = {
        id: docRef.id,
        child_id: childId,
        parent_id: parentId,
        reward_item_id: rewardItemId,
        reward_item: rewardItem,
        stars_spent: rewardItem.star_cost,
        status: 'pending',
        requested_at: now,
      };

      setRedemptions([...redemptions, newRedemption]);
      return newRedemption;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request redemption');
      throw err;
    }
  };

  const updateRedemptionStatus = async (
    id: string,
    status: 'approved' | 'completed' | 'rejected',
    notes?: string
  ) => {
    try {
      const redemptionsRef = doc(db, 'redemptions', id);
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      if (notes) {
        updates.notes = notes;
      }

      await updateDoc(redemptionsRef, updates);

      setRedemptions(
        redemptions.map(r =>
          r.id === id
            ? {
                ...r,
                status,
                completed_at: status === 'completed' ? new Date().toISOString() : r.completed_at,
                notes: notes || r.notes,
              }
            : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update redemption');
      throw err;
    }
  };

  return {
    redemptions,
    loading,
    error,
    requestRedemption,
    updateRedemptionStatus,
  };
};
