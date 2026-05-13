import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { collection, getDocs, query, where } from 'firebase/firestore';
import RewardMarketplace from '../../components/RewardMarketplace';
import { db } from '../../config/firebase';
import { useRedemptions, useRewards } from '../../hooks/useRedemptions';
import { useChildLayout } from './ChildLayout';

export default function ChildRewards() {
  const { panelClass, mutedTextClass, profile } = useChildLayout();
  const parentId = profile.family_id || profile.parent_id || '';
  const { rewards, loading: rewardsLoading } = useRewards(parentId);
  const { redemptions, loading: redemptionsLoading, requestRedemption } = useRedemptions(profile.id, parentId);
  const [monthlyEarnedStars, setMonthlyEarnedStars] = useState(0);

  const monthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), []);
  const monthEnd = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59), []);
  const monthlyRequested = useMemo(() => {
    return redemptions
      .filter((redemption) => {
        const ts = new Date(redemption.requested_at);
        return ts >= monthStart && ts <= monthEnd;
      })
      .reduce((sum, redemption) => sum + Number(redemption.stars_spent || 0), 0);
  }, [redemptions, monthEnd, monthStart]);

  useEffect(() => {
    const loadMonthlyEarned = async () => {
      const from = new Date(monthStart).toISOString().slice(0, 10);
      const to = new Date(monthEnd).toISOString().slice(0, 10);

      const [tasksSnap, logsSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), where('child_id', '==', profile.id))),
        getDocs(
          query(
            collection(db, 'task_logs'),
            where('child_id', '==', profile.id),
            where('status', '==', 'completed'),
            where('date', '>=', from),
            where('date', '<=', to)
          )
        )
      ]);

      const taskStars = new Map<string, number>();
      tasksSnap.docs.forEach((docSnap) => {
        const data = docSnap.data() as any;
        taskStars.set(docSnap.id, Number(data.points ?? data.star_value ?? 0));
      });

      const earned = logsSnap.docs.reduce((sum, logSnap) => {
        const taskId = (logSnap.data() as any).task_id;
        return sum + Number(taskStars.get(taskId) || 0);
      }, 0);

      setMonthlyEarnedStars(earned);
    };

    void loadMonthlyEarned();
  }, [monthEnd, monthStart, profile.id]);

  return (
    <div className="mt-6 space-y-5">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Rewards</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>See monthly reward summary, request rewards, and track transactions.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Current Stars</p>
            <p className="mt-1 text-xl font-black">{profile.total_stars || 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Earned This Month</p>
            <p className="mt-1 text-xl font-black">{monthlyEarnedStars}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Requested This Month</p>
            <p className="mt-1 text-xl font-black">{monthlyRequested}</p>
          </div>
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
        <h3 className="text-2xl font-display font-bold">Reward Transaction Summary</h3>
        <div className="mt-4 space-y-3">
          {redemptionsLoading ? (
            <p className={mutedTextClass}>Loading reward requests...</p>
          ) : redemptions.length === 0 ? (
            <p className={mutedTextClass}>No reward requests yet.</p>
          ) : (
            redemptions
              .slice()
              .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
              .map((redemption) => (
                <div key={redemption.id} className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{redemption.reward_item.icon} {redemption.reward_item.name}</p>
                      <p className={clsx('text-sm', mutedTextClass)}>{redemption.stars_spent} stars • {new Date(redemption.requested_at).toLocaleDateString()}</p>
                    </div>
                    <span className={clsx('rounded-full px-3 py-1 text-xs font-black uppercase', redemption.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : redemption.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>
                      {redemption.status}
                    </span>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
