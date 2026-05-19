import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import RewardMarketplace from '../../components/RewardMarketplace';
import { db } from '../../config/firebase';
import { useRedemptions, useRewards } from '../../hooks/useRedemptions';
import { useChildLayout } from './ChildLayout';
import { computeMonthlyStars, computeRewardLedger, getChildBadges, getLevelProgress } from '../../utils/childProgression';
import type { RewardItem } from '../../types/schema';

export default function ChildRewards() {
  const { panelClass, mutedTextClass, profile, tasks } = useChildLayout();
  const parentId = profile.family_id || profile.parent_id || '';
  const { rewards, loading: rewardsLoading } = useRewards(parentId);
  const { redemptions, loading: redemptionsLoading, requestRedemption } = useRedemptions(profile.id, parentId);

  const [monthlyEarnedStars, setMonthlyEarnedStars] = useState(0);
  const [conversionRate, setConversionRate] = useState(1);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [redemptionMode, setRedemptionMode] = useState<'cash' | 'rewards'>('cash');
  const [cashStars, setCashStars] = useState<number | ''>('');
  const [cashRequesting, setCashRequesting] = useState(false);
  const [cashMessage, setCashMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const level = useMemo(() => getLevelProgress(Number(profile.total_stars || 0)), [profile.total_stars]);
  const rewardLedger = useMemo(() => computeRewardLedger(redemptions), [redemptions]);
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

  return (
    <div className="mt-6 space-y-5 pb-20">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Stars & Rewards</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>Track stars, streaks, badges, and reward requests.</p>

        {loadingSummary ? <p className={clsx('mt-3 text-sm', mutedTextClass)}>Loading progress summary...</p> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Total Stars</p><p className="mt-1 text-2xl font-black">{profile.total_stars || 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Monthly Stars</p><p className="mt-1 text-2xl font-black">{monthlyEarnedStars}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Streak / Shields</p><p className="mt-1 text-2xl font-black">{profile.streak_count || 0} / {profile.streak_shields || 0}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Pending Rewards</p><p className="mt-1 text-2xl font-black">{pendingRewards}</p></div>
        </div>

        <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-200">Level Progress</p>
          <p className="mt-1 text-lg font-bold">{level.levelName}</p>
          <p className="text-sm text-cyan-100/90">{level.nextLevelName ? `${level.starsToNext} stars to ${level.nextLevelName}` : 'Top level unlocked. Keep shining.'}</p>
          <div className="mt-2 h-2 rounded-full bg-white/10 p-[2px]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#818cf8,#f472b6)] transition-all" style={{ width: `${level.progressPct}%` }} /></div>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Badges</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {badges.map((badge) => (
            <div key={badge.id} className={clsx('rounded-xl border px-3 py-3', badge.unlocked ? 'border-emerald-300/35 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]')}>
              <p className="font-bold">{badge.label}</p>
              <p className={clsx('text-xs', mutedTextClass)}>{badge.unlocked ? 'Unlocked' : badge.hint}</p>
            </div>
          ))}
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

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Monthly Summary</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Cash Rate</p><p className="mt-1 text-lg font-black">1 star = {conversionRate}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Stars Spent</p><p className="mt-1 text-lg font-black">{monthlySpentStars}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Cash Estimate</p><p className="mt-1 text-lg font-black">{monthlyPayoutEstimate}</p></div>
        </div>

        <div className="mt-4 space-y-2">
          {redemptionsLoading ? (
            <p className={mutedTextClass}>Loading reward ledger...</p>
          ) : rewardLedger.length === 0 ? (
            <p className={mutedTextClass}>No reward history yet.</p>
          ) : (
            rewardLedger.slice(0, 12).map((entry) => (
              <div key={entry.id} className="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold">{entry.label}</p>
                  <p className={clsx('text-xs', mutedTextClass)}>{new Date(entry.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-black">-{entry.stars} stars</p>
                  <p className={clsx('text-xs uppercase', entry.status === 'completed' ? 'text-emerald-300' : entry.status === 'rejected' ? 'text-rose-300' : 'text-amber-300')}>{entry.status}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
