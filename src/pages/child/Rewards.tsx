import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import RewardMarketplace from '../../components/RewardMarketplace';
import { db } from '../../config/firebase';
import { useRedemptions, useRewards } from '../../hooks/useRedemptions';
import { useRewardLedger } from '../../hooks/useRewardLedger';
import { useScratchRewards } from '../../hooks/useScratchRewards';
import { useChildLayout } from './ChildLayout';
import { computeMonthlyStars, getChildBadges, getLevelProgress } from '../../utils/childProgression';
import type { RewardItem, RewardLedgerEntry, ScratchRewardCard } from '../../types/schema';

export default function ChildRewards() {
  const { panelClass, mutedTextClass, profile, tasks } = useChildLayout();
  const parentId = profile.family_id || profile.parent_id || '';
  const { rewards, loading: rewardsLoading } = useRewards(parentId);
  const { redemptions, requestRedemption } = useRedemptions(profile.id, parentId);
  const { visibleEntries, surpriseEntries, loading: ledgerLoading, revealEntry } = useRewardLedger(profile.id, parentId);
  const { availableCards, loading: scratchLoading, revealScratchCard } = useScratchRewards(profile.id, parentId);

  const [monthlyEarnedStars, setMonthlyEarnedStars] = useState(0);
  const [conversionRate, setConversionRate] = useState(1);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [redemptionMode, setRedemptionMode] = useState<'cash' | 'rewards'>('cash');
  const [cashStars, setCashStars] = useState<number | ''>('');
  const [cashRequesting, setCashRequesting] = useState(false);
  const [cashMessage, setCashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openingGiftId, setOpeningGiftId] = useState<string | null>(null);
  const [openedScratch, setOpenedScratch] = useState<ScratchRewardCard | null>(null);

  const level = useMemo(() => getLevelProgress(Number(profile.total_stars || 0)), [profile.total_stars]);
  const pendingRewards = useMemo(() => redemptions.filter((item) => item.status === 'pending').length, [redemptions]);

  const badges = useMemo(() => getChildBadges({
    consistencyScore: Number(profile.consistency_score || 0),
    streakCount: Number(profile.streak_count || 0),
    earlyBirdCompletions: Number(profile.early_bird_count || 0),
    readingCompletions: Number(profile.reading_completed_count || 0),
    studyCompletions: Number(profile.study_completed_count || 0),
    perfectWeekCount: Number(profile.perfect_week_count || 0)
  }), [profile.consistency_score, profile.early_bird_count, profile.perfect_week_count, profile.reading_completed_count, profile.streak_count, profile.study_completed_count]);

  useEffect(() => {
    const loadSummary = async () => {
      setLoadingSummary(true);
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        const [tasksSnap, logsSnap, rewardSettingsByFamilySnap, rewardSettingsByParentSnap] = await Promise.all([
          getDocs(query(collection(db, 'tasks'), where('child_id', '==', profile.id))),
          getDocs(query(collection(db, 'task_logs'), where('child_id', '==', profile.id), where('status', '==', 'completed'), where('date', '>=', from), where('date', '<=', to))),
          getDocs(query(collection(db, 'reward_settings'), where('family_id', '==', parentId))),
          getDocs(query(collection(db, 'reward_settings'), where('parent_id', '==', parentId)))
        ]);

        const taskStarMap = new Map<string, number>();
        tasksSnap.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          taskStarMap.set(docSnap.id, Number(data.points ?? data.star_value ?? 0));
        });

        const logs = logsSnap.docs.map((docSnap) => docSnap.data() as { date: string; status: string; task_id: string });
        setMonthlyEarnedStars(computeMonthlyStars(logs, taskStarMap, now));

        const rewardSettingDoc = rewardSettingsByFamilySnap.docs[0] || rewardSettingsByParentSnap.docs[0];
        if (rewardSettingDoc) {
          const raw = rewardSettingDoc.data() as any;
          const savedRate = Number(raw.star_to_currency_rate);
          setConversionRate(Number.isFinite(savedRate) ? Math.max(0, savedRate) : 1);
        }
      } finally {
        setLoadingSummary(false);
      }
    };

    void loadSummary();
  }, [parentId, profile.id, tasks]);

  const monthlySpentStars = useMemo(() => {
    const now = new Date();
    return redemptions
      .filter((redemption) => {
        const ts = new Date(redemption.requested_at);
        return ts.getFullYear() === now.getFullYear() && ts.getMonth() === now.getMonth();
      })
      .reduce((sum, redemption) => sum + Number(redemption.stars_spent || 0), 0);
  }, [redemptions]);

  const monthlyPayoutEstimate = useMemo(() => Number((monthlyEarnedStars * conversionRate).toFixed(2)), [conversionRate, monthlyEarnedStars]);
  const availableStars = Number(profile.total_stars || 0);
  const cashStarsValue = cashStars === '' ? 0 : Number(cashStars);
  const cashEstimate = Number((cashStarsValue * conversionRate).toFixed(2));
  const unlockedBadges = useMemo(() => badges.filter((badge) => badge.unlocked).length, [badges]);
  const nextBadge = useMemo(() => badges.find((badge) => !badge.unlocked) || null, [badges]);
  const openedGift = useMemo(
    () => visibleEntries.find((entry) => entry.id === openingGiftId) || null,
    [openingGiftId, visibleEntries]
  );
  const timelineGroups = useMemo(() => {
    const groups = new Map<string, RewardLedgerEntry[]>();
    visibleEntries
      .filter((entry) => entry.surprise_state !== 'hidden')
      .forEach((entry) => {
        const dateKey = new Date(entry.created_at).toISOString().slice(0, 10);
        groups.set(dateKey, [...(groups.get(dateKey) || []), entry]);
      });

    return Array.from(groups.entries()).map(([date, items]) => ({ date, items }));
  }, [visibleEntries]);

  const requestCashRedemption = async () => {
    if (!cashStarsValue || cashStarsValue <= 0) {
      setCashMessage({ type: 'error', text: 'Choose how many stars to redeem for cash.' });
      return;
    }

    if (cashStarsValue > availableStars) {
      setCashMessage({ type: 'error', text: `You only have ${availableStars} stars available.` });
      return;
    }

    const now = new Date().toISOString();
    const cashReward: RewardItem = {
      id: `cash_${profile.id}_${Date.now()}`,
      parent_id: parentId,
      family_id: parentId,
      child_id: profile.id,
      name: 'Cash payout',
      description: `${cashStarsValue} stars at ${conversionRate} cash value per star = ${cashEstimate}`,
      star_cost: cashStarsValue,
      icon: '💰',
      category: 'cash',
      is_available: true,
      created_at: now,
      updated_at: now
    };

    setCashRequesting(true);
    try {
      await requestRedemption(cashReward.id, cashReward, availableStars);
      setCashMessage({ type: 'success', text: 'Cash request sent for parent approval.' });
      setCashStars('');
      setTimeout(() => setCashMessage(null), 3000);
    } catch (error) {
      setCashMessage({ type: 'error', text: error instanceof Error ? error.message : 'Could not send cash request.' });
    } finally {
      setCashRequesting(false);
    }
  };

  const openSurpriseGift = async (entry: RewardLedgerEntry) => {
    await revealEntry(entry.id);
    setOpeningGiftId(entry.id);
  };

  const openScratchReward = async (cardId: string) => {
    const revealed = await revealScratchCard(cardId);
    if (revealed) {
      setOpenedScratch(revealed);
    }
  };

  const getTimelineTypeLabel = (entry: RewardLedgerEntry) => {
    if (entry.type === 'task_completed') return 'Task';
    if (entry.type === 'manual_award') return 'Gift';
    if (entry.type === 'scratch_reward') return 'Scratch';
    if (entry.type === 'redemption') return 'Redeemed';
    if (entry.type === 'bonus') return 'Bonus';
    return 'Update';
  };

  return (
    <div className="mt-6 space-y-5 pb-20">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Stars & Rewards</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>Earn stars, request cash, or spend stars on rewards.</p>

        {loadingSummary ? <p className={clsx('mt-3 text-sm', mutedTextClass)}>Loading progress summary...</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Total Stars</p><p className="mt-1 text-2xl font-black">{profile.total_stars || 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Monthly Stars</p><p className="mt-1 text-2xl font-black">{monthlyEarnedStars}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Cash Estimate</p><p className="mt-1 text-2xl font-black">{monthlyPayoutEstimate}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Stars Spent</p><p className="mt-1 text-2xl font-black">{monthlySpentStars}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Streak / Shields</p><p className="mt-1 text-2xl font-black">{profile.streak_count || 0} / {profile.streak_shields || 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Pending Rewards</p><p className="mt-1 text-2xl font-black">{pendingRewards}</p></div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-200">Level Progress</p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
              <p className="text-lg font-bold">{level.levelName}</p>
              <p className="text-sm text-cyan-100/90">{level.nextLevelName ? `${level.starsToNext} stars to ${level.nextLevelName}` : 'Top level unlocked'}</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10 p-[2px]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#818cf8,#f472b6)] transition-all" style={{ width: `${level.progressPct}%` }} /></div>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-200">Badges</p>
            <p className="mt-1 text-lg font-bold">{unlockedBadges} / {badges.length} unlocked</p>
            <p className="text-sm text-amber-100/90">{nextBadge ? `Next: ${nextBadge.label}` : 'All badges unlocked'}</p>
          </div>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Redeem Stars</h3>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setRedemptionMode('cash')}
            className={clsx('rounded-lg px-3 py-2 text-sm font-black transition', redemptionMode === 'cash' ? 'bg-emerald-400 text-slate-950' : mutedTextClass)}
          >
            Cash Request
          </button>
          <button
            type="button"
            onClick={() => setRedemptionMode('rewards')}
            className={clsx('rounded-lg px-3 py-2 text-sm font-black transition', redemptionMode === 'rewards' ? 'bg-cyan-400 text-slate-950' : mutedTextClass)}
          >
            Reward Items
          </button>
        </div>

        {redemptionMode === 'cash' ? (
          <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Available Stars</p><p className="mt-1 text-lg font-black">{availableStars}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Cash Rate</p><p className="mt-1 text-lg font-black">1 star = {conversionRate}</p></div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Cash Estimate</p><p className="mt-1 text-lg font-black">{cashEstimate}</p></div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="number"
                min="1"
                max={availableStars}
                value={cashStars as any}
                onChange={(event) => setCashStars(event.target.value === '' ? '' : Number(event.target.value))}
                placeholder="Stars to redeem as cash"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => void requestCashRedemption()}
                disabled={cashRequesting || availableStars <= 0}
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {cashRequesting ? 'Sending...' : 'Request Cash'}
              </button>
            </div>

            {cashMessage ? (
              <p className={clsx('mt-3 rounded-lg px-3 py-2 text-sm font-bold', cashMessage.type === 'success' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200')}>
                {cashMessage.text}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <RewardMarketplace
              rewards={rewards}
              childProfile={profile}
              onRedeemReward={async (rewardId, reward) => {
                await requestRedemption(rewardId, reward, profile.total_stars || 0);
              }}
              loading={rewardsLoading}
            />
          </div>
        )}
      </div>

      {surpriseEntries.length > 0 ? (
        <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-display font-bold">Surprise Gifts</h3>
              <p className={clsx('mt-1 text-sm', mutedTextClass)}>Parent sent something special. Open it when you are ready.</p>
            </div>
            <p className="rounded-full border border-pink-300/30 bg-pink-400/10 px-3 py-1 text-sm font-black text-pink-200">
              {surpriseEntries.length} unopened
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {surpriseEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => void openSurpriseGift(entry)}
                className="rounded-2xl border border-pink-300/25 bg-pink-500/10 px-4 py-4 text-left transition hover:bg-pink-500/15"
              >
                <p className="text-4xl">🎁</p>
                <p className="mt-2 text-lg font-black">Surprise gift</p>
                <p className={clsx('mt-1 text-sm', mutedTextClass)}>Tap to reveal your stars and message.</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {availableCards.length > 0 || scratchLoading ? (
        <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-display font-bold">Scratch Rewards</h3>
              <p className={clsx('mt-1 text-sm', mutedTextClass)}>Scratch a card to reveal the prize parent picked for you.</p>
            </div>
            <p className="rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-1 text-sm font-black text-violet-200">
              {availableCards.length} ready
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {scratchLoading ? (
              <p className={mutedTextClass}>Loading scratch rewards...</p>
            ) : (
              availableCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => void openScratchReward(card.id)}
                  className="rounded-2xl border border-violet-300/25 bg-violet-500/10 px-4 py-4 text-left transition hover:bg-violet-500/15"
                >
                  <p className="text-4xl">🎟️</p>
                  <p className="mt-2 text-lg font-black">{card.title}</p>
                  <p className={clsx('mt-1 text-sm', mutedTextClass)}>{card.reason}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-2xl font-display font-bold">Badges</h3>
            <p className={clsx('mt-1 text-sm', mutedTextClass)}>Small milestones that track consistency, routines, and learning habits.</p>
          </div>
          <p className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 text-sm font-black text-amber-200">
            {unlockedBadges} / {badges.length} unlocked
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {badges.map((badge) => (
            <div key={badge.id} className={clsx('rounded-xl border px-3 py-3', badge.unlocked ? 'border-emerald-300/35 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xl">{badge.icon}</p>
                  <p className="mt-1 font-bold">{badge.label}</p>
                </div>
                <p className={clsx('text-xs font-black', badge.unlocked ? 'text-emerald-300' : mutedTextClass)}>{badge.unlocked ? 'Unlocked' : badge.valueLabel}</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10 p-[2px]">
                <div className={clsx('h-full rounded-full transition-all', badge.unlocked ? 'bg-emerald-300' : 'bg-amber-300')} style={{ width: `${badge.progressPct}%` }} />
              </div>
              <p className={clsx('mt-2 text-xs', mutedTextClass)}>{badge.unlocked ? badge.valueLabel : badge.hint}</p>
            </div>
          ))}
        </div>

      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-2xl font-display font-bold">Reward Timeline</h3>
            <p className={clsx('mt-1 text-sm', mutedTextClass)}>Track stars earned, gifts received, and rewards redeemed by date.</p>
          </div>
          <p className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-sm font-black text-cyan-200">
            {visibleEntries.length} entries
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {ledgerLoading ? (
            <p className={mutedTextClass}>Loading reward timeline...</p>
          ) : timelineGroups.length === 0 ? (
            <p className={mutedTextClass}>No reward timeline yet. Complete tasks or open gifts to start tracking.</p>
          ) : (
            timelineGroups.slice(0, 8).map((group) => (
              <div key={group.date} className="relative pl-5">
                <div className="absolute left-[5px] top-7 bottom-0 w-px bg-white/10" />
                <div className="mb-2 flex items-center gap-2">
                  <span className="relative z-10 h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_0_4px_rgba(34,211,238,0.12)]" />
                  <p className="text-sm font-black">{new Date(group.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <div className="space-y-2">
                  {group.items.map((entry) => {
                    const isPositive = entry.stars_delta >= 0;
                    return (
                      <div key={entry.id} className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={clsx('rounded-full px-2 py-0.5 text-[11px] font-black uppercase', isPositive ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200')}>
                                {getTimelineTypeLabel(entry)}
                              </span>
                              <span className={clsx('text-xs', mutedTextClass)}>
                                {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="mt-1 font-bold">{entry.title}</p>
                            <p className={clsx('mt-1 text-xs', mutedTextClass)}>{entry.reason}</p>
                          </div>
                          <p className={clsx('shrink-0 text-right text-lg font-black', isPositive ? 'text-emerald-300' : 'text-amber-300')}>
                            {isPositive ? '+' : ''}{entry.stars_delta}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {openedGift ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-[1.5rem] border border-pink-300/30 bg-slate-950 p-6 text-center shadow-2xl">
            <p className="text-5xl">🎁</p>
            <h3 className="mt-3 text-2xl font-display font-black">Surprise unlocked</h3>
            <p className="mt-2 text-3xl font-black text-emerald-300">+{openedGift.stars_delta} stars</p>
            <p className={clsx('mt-3 text-sm', mutedTextClass)}>{openedGift.reason}</p>
            <button
              type="button"
              onClick={() => setOpeningGiftId(null)}
              className="mt-5 rounded-xl bg-pink-400 px-5 py-3 text-sm font-black text-slate-950"
            >
              Yay
            </button>
          </div>
        </div>
      ) : null}

      {openedScratch ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 px-4">
          <div className="w-full max-w-md rounded-[1.5rem] border border-violet-300/30 bg-slate-950 p-6 text-center shadow-2xl">
            <p className="text-5xl">🎟️</p>
            <h3 className="mt-3 text-2xl font-display font-black">Scratch reward</h3>
            <p className="mt-2 text-3xl font-black text-violet-200">{openedScratch.prize_label}</p>
            <p className={clsx('mt-3 text-sm', mutedTextClass)}>{openedScratch.reason}</p>
            <button
              type="button"
              onClick={() => setOpenedScratch(null)}
              className="mt-5 rounded-xl bg-violet-400 px-5 py-3 text-sm font-black text-slate-950"
            >
              Nice
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
