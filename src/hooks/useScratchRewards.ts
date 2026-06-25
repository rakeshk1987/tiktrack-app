import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Redemption, RewardItem, ScratchRewardCard, ScratchRewardTemplate } from '../types/schema';
import { createRewardLedgerEntry } from './useRewardLedger';

export type NewScratchRewardCard = Omit<ScratchRewardCard, 'id' | 'created_at' | 'status' | 'revealed_at'>;
export type NewScratchRewardTemplate = Omit<ScratchRewardTemplate, 'id' | 'created_at' | 'updated_at'>;

const cleanUndefined = <T extends Record<string, any>>(obj: T): T => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
};

const createScratchCardDoc = async (card: NewScratchRewardCard) => {
  const now = new Date().toISOString();
  const cleaned = cleanUndefined(card);
  const docRef = await addDoc(collection(db, 'scratch_rewards'), {
    ...cleaned,
    status: 'available',
    created_at: now,
  });

  return {
    ...card,
    id: docRef.id,
    status: 'available',
    created_at: now,
  } as ScratchRewardCard;
};

export const awardScratchRewardForTrigger = async ({
  childId,
  familyId,
  parentId,
  sourceId,
  sourceType,
  reason,
  trigger = 'task_completion',
  streakCount,
}: {
  childId: string;
  familyId: string;
  parentId: string;
  sourceId: string;
  sourceType: 'task' | 'routine' | 'approval' | 'exam';
  reason: string;
  trigger?: ScratchRewardTemplate['trigger'];
  streakCount?: number;
}) => {
  if (!childId || !familyId || !sourceId) return null;

  const triggerCandidates: ScratchRewardTemplate['trigger'][] =
    trigger === 'task_completion' ? ['task_completion', 'random_task', 'streak'] : [trigger];
  if (triggerCandidates.length === 0 || trigger === 'manual') return null;

  const existingSnapshot = await getDocs(query(
    collection(db, 'scratch_rewards'),
    where('child_id', '==', childId),
    where('source_id', '==', sourceId)
  ));
  if (!existingSnapshot.empty) return null;

  const templateSnapshots = await Promise.all(triggerCandidates.map((candidate) => getDocs(query(
    collection(db, 'scratch_reward_templates'),
    where('family_id', '==', familyId),
    where('trigger', '==', candidate),
    where('is_active', '==', true)
  ))));

  const templates = templateSnapshots.flatMap((snapshot) => snapshot.docs)
    .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<ScratchRewardTemplate, 'id'>) }))
    .filter((template) => !template.child_id || template.child_id === childId)
    .filter((template) => {
      if (template.trigger === 'random_task') return Math.random() < 0.25;
      if (template.trigger === 'streak') return Boolean(streakCount && streakCount > 0 && streakCount % 7 === 0);
      return true;
    });

  const orderedTemplates = templates.sort((a, b) => triggerCandidates.indexOf(a.trigger) - triggerCandidates.indexOf(b.trigger));
  const template = orderedTemplates[0];
  if (!template) return null;

  return createScratchCardDoc({
    child_id: childId,
    parent_id: template.parent_id || parentId,
    family_id: familyId,
    template_id: template.id,
    source_id: sourceId,
    source_type: sourceType,
    title: template.title,
    reveal_type: template.reveal_type || 'scratch',
    prize_type: template.prize_type,
    prize_label: template.prize_label,
    stars_value: template.prize_type === 'stars' || template.prize_type === 'cash' ? Number(template.stars_value || template.cash_value || 0) : 0,
    cash_value: template.prize_type === 'cash' ? Number(template.cash_value || template.stars_value || 0) : 0,
    wheel_segments: template.wheel_segments,
    reason,
  });
};

const createAwardedPrizeRedemption = async (card: ScratchRewardCard) => {
  const now = new Date().toISOString();
  const rewardItem: RewardItem = {
    id: `scratch_${card.id}`,
    parent_id: card.parent_id,
    family_id: card.family_id,
    child_id: card.child_id,
    name: card.prize_label,
    description: `Awarded from scratch reward: ${card.title}`,
    star_cost: 0,
    icon: card.prize_type === 'book' ? '📚' : card.prize_type === 'toy' ? '🧸' : card.prize_type === 'treat' ? '🍦' : '🎁',
    category: card.prize_type === 'book' ? 'learning' : card.prize_type === 'treat' ? 'treat' : 'item',
    is_available: false,
    created_at: now,
    updated_at: now,
  };

  await addDoc(collection(db, 'redemptions'), {
    child_id: card.child_id,
    parent_id: card.parent_id,
    reward_item_id: rewardItem.id,
    reward_item: rewardItem,
    stars_spent: 0,
    status: 'approved',
    requested_at: now,
    notes: `Scratch reward fulfillment: ${card.prize_label}`,
  } satisfies Omit<Redemption, 'id'>);
};

export function useScratchRewards(childId: string, familyId?: string) {
  const [cards, setCards] = useState<ScratchRewardCard[]>([]);
  const [templates, setTemplates] = useState<ScratchRewardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    const loadCards = async () => {
      if (!childId) {
        setCards([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const snapshot = await getDocs(query(collection(db, 'scratch_rewards'), where('child_id', '==', childId)));
        const fetched = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<ScratchRewardCard, 'id'>) }))
          .filter((card) => !familyId || !card.family_id || card.family_id === familyId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setCards(fetched);
      } finally {
        setLoading(false);
      }
    };

    void loadCards();
  }, [childId, familyId]);

  useEffect(() => {
    const loadTemplates = async () => {
      if (!familyId) {
        setTemplates([]);
        setTemplatesLoading(false);
        return;
      }

      setTemplatesLoading(true);
      try {
        const snapshot = await getDocs(query(collection(db, 'scratch_reward_templates'), where('family_id', '==', familyId)));
        const fetched = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<ScratchRewardTemplate, 'id'>) }))
          .filter((template) => !childId || !template.child_id || template.child_id === childId)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setTemplates(fetched);
      } finally {
        setTemplatesLoading(false);
      }
    };

    void loadTemplates();
  }, [childId, familyId]);

  const availableCards = useMemo(() => cards.filter((card) => card.status === 'available'), [cards]);

  const createScratchCard = useCallback(async (card: NewScratchRewardCard) => {
    const created = await createScratchCardDoc(card);
    setCards((current) => [created, ...current]);
    return created;
  }, []);

  const createScratchTemplate = useCallback(async (template: NewScratchRewardTemplate) => {
    const now = new Date().toISOString();
    const cleaned = cleanUndefined(template);
    const docRef = await addDoc(collection(db, 'scratch_reward_templates'), {
      ...cleaned,
      created_at: now,
      updated_at: now,
    });

    const created = {
      ...template,
      id: docRef.id,
      created_at: now,
      updated_at: now,
    } as ScratchRewardTemplate;
    setTemplates((current) => [created, ...current]);
    return created;
  }, []);

  const updateScratchTemplate = useCallback(async (id: string, updates: Partial<NewScratchRewardTemplate>) => {
    const now = new Date().toISOString();
    const cleaned = cleanUndefined(updates);
    await updateDoc(doc(db, 'scratch_reward_templates', id), {
      ...cleaned,
      updated_at: now,
    });
    setTemplates((current) => current.map((template) => template.id === id ? { ...template, ...updates, updated_at: now } : template));
  }, []);

  const revealScratchCard = useCallback(async (cardId: string) => {
    const card = cards.find((item) => item.id === cardId);
    if (!card || card.status === 'revealed') return null;

    const revealedAt = new Date().toISOString();
    const wheelSegments = (card.reveal_type === 'wheel' ? card.wheel_segments || [] : []).filter(Boolean);
    const landedSegment = wheelSegments.length
      ? wheelSegments[Math.floor(Math.random() * wheelSegments.length)]
      : card.prize_label;
    const revealedPrizeLabel = card.reveal_type === 'wheel' ? landedSegment : card.prize_label;
    const revealedCard = card.reveal_type === 'wheel'
      ? {
          ...card,
          prize_type: 'custom' as const,
          prize_label: revealedPrizeLabel,
          stars_value: 0,
          cash_value: 0,
        }
      : card;

    await updateDoc(doc(db, 'scratch_rewards', cardId), {
      status: 'revealed',
      revealed_at: revealedAt,
      prize_label: revealedPrizeLabel,
      ...(card.reveal_type === 'wheel' ? { prize_type: 'custom', stars_value: 0, cash_value: 0 } : {}),
    });

    if ((revealedCard.prize_type === 'stars' || revealedCard.prize_type === 'cash') && Number(revealedCard.stars_value || revealedCard.cash_value || 0) > 0) {
      const profileRef = doc(db, 'child_profile', card.child_id);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const currentStars = Number(profileSnap.data().total_stars || 0);
        await updateDoc(profileRef, {
          total_stars: currentStars + Number(revealedCard.stars_value || revealedCard.cash_value || 0),
        });
      }
    } else {
      await createAwardedPrizeRedemption(revealedCard);
    }

    await createRewardLedgerEntry({
      child_id: card.child_id,
      parent_id: card.parent_id,
      family_id: card.family_id,
      type: 'scratch_reward',
      stars_delta: revealedCard.prize_type === 'stars' || revealedCard.prize_type === 'cash' ? Number(revealedCard.stars_value || revealedCard.cash_value || 0) : 0,
      title: card.title,
      reason: `${card.reveal_type === 'wheel' ? 'Wheel reward' : 'Scratch reward'}: ${revealedPrizeLabel}. ${card.reason}`,
      source_id: card.id,
      source_type: 'scratch',
      visible_to_child: true,
    });

    const revealed = { ...revealedCard, status: 'revealed' as const, revealed_at: revealedAt };
    setCards((current) => current.map((item) => item.id === cardId ? revealed : item));
    return revealed;
  }, [cards]);

  return {
    cards,
    availableCards,
    templates,
    loading,
    templatesLoading,
    createScratchCard,
    createScratchTemplate,
    updateScratchTemplate,
    revealScratchCard,
  };
}
