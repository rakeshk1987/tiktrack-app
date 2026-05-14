import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import RewardMarketplace from '../../components/RewardMarketplace';
import { db } from '../../config/firebase';
import { useRedemptions, useRewards } from '../../hooks/useRedemptions';
import { useChildLayout } from './ChildLayout';
import { computeMonthlyStars, computeRewardLedger, getChildBadges, getLevelProgress } from '../../utils/childProgression';

export default function ChildRewards() {
  const { panelClass, mutedTextClass, profile, tasks } = useChildLayout();
  const parentId = profile.family_id || profile.parent_id || '';
  const { rewards, loading: rewardsLoading } = useRewards(parentId);
  const { redemptions, loading: redemptionsLoading, requestRedemption } = useRedemptions(profile.id, parentId);

  const [monthlyEarnedStars, setMonthlyEarnedStars] = useState(0);
  const [conversionRate, setConversionRate] = useState(1);
  const [loadingSummary, setLoadingSummary] = useState(true);

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

        const [tasksSnap, logsSnap, rewardSettingsSnap] = await Promise.all([
          getDocs(query(collection(db, 'tasks'), where('child_id', '==', profile.id))),
          getDocs(query(collection(db, 'task_logs'), where('child_id', '==', profile.id), where('status', '==', 'completed'), where('date', '>=', from), where('date', '<=', to))),
          getDocs(query(collection(db, 'reward_settings'), where('parent_id', '==', parentId)))
        ]);

        const taskStarMap = new Map<string, number>();
        tasksSnap.docs.forEach((docSnap) => {
          const data = docSnap.data() as any;
          taskStarMap.set(docSnap.id, Number(data.points ?? data.star_value ?? 0));
        });

        const logs = logsSnap.docs.map((docSnap) => docSnap.data() as { date: string; status: string; task_id: string });
        setMonthlyEarnedStars(computeMonthlyStars(logs, taskStarMap, now));

        if (!rewardSettingsSnap.empty) {
          const raw = rewardSettingsSnap.docs[0].data() as any;
          setConversionRate(Math.max(1, Number(raw.star_to_currency_rate || 1)));
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

  const monthlyPayoutEstimate = useMemo(() => Math.floor(monthlyEarnedStars / conversionRate), [conversionRate, monthlyEarnedStars]);

  return (
    <div className="mt-6 space-y-5 pb-20">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Rewards & Progress</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>Track stars, streaks, badges, and your monthly reward wallet.</p>

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

      <RewardMarketplace
        rewards={rewards}
        childProfile={profile}
        onRedeemReward={async (rewardId, reward) => {
          await requestRedemption(rewardId, reward, profile.total_stars || 0);
        }}
        loading={rewardsLoading}
      />

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Reward Wallet</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Conversion</p><p className="mt-1 text-lg font-black">{conversionRate} stars = 1 coin</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Monthly Spent</p><p className="mt-1 text-lg font-black">{monthlySpentStars}</p></div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Payout Estimate</p><p className="mt-1 text-lg font-black">{monthlyPayoutEstimate} coins</p></div>
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
