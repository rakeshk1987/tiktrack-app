import clsx from 'clsx';
import { useChildLayout } from './ChildLayout';
import RewardMarketplace from '../../components/RewardMarketplace';
import { useRedemptions, useRewards } from '../../hooks/useRedemptions';

export default function ChildProfile() {
  const { accentCaptionClass, isDark, latestProofs, mutedTextClass, panelClass, profile } = useChildLayout();
  const childName = profile.name || 'Explorer';
  const parentId = profile.family_id || profile.parent_id || '';
  const { rewards, loading: rewardsLoading } = useRewards(parentId);
  const { redemptions, loading: redemptionsLoading, requestRedemption } = useRedemptions(profile.id, parentId);

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_1fr]">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Explorer profile</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', accentCaptionClass)}>Name</p>
            <p className="mt-2 text-xl font-bold">{childName}</p>
          </div>
          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', accentCaptionClass)}>Birthday</p>
            <p className="mt-2 text-xl font-bold">{new Date(profile.date_of_birth || '').toLocaleDateString()}</p>
          </div>
          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', accentCaptionClass)}>Height</p>
            <p className="mt-2 text-xl font-bold">{profile.height_cm ?? 0} cm</p>
          </div>
          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', accentCaptionClass)}>Weight</p>
            <p className="mt-2 text-xl font-bold">{profile.weight_kg ?? 0} kg</p>
          </div>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Proof gallery</h3>
        <div className="mt-4 space-y-3">
          {latestProofs.length === 0 ? (
            <div className={clsx('rounded-[1.3rem] border px-4 py-4 text-sm', isDark ? 'border-white/10 bg-white/6 text-white/72' : 'border-indigo-200/70 bg-white/80 text-slate-600')}>
              No proofs uploaded yet. Your quest snapshots will appear here.
            </div>
          ) : (
            latestProofs.map((proof) => (
              <div key={proof.id} className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{proof.task_title || 'Quest proof'}</p>
                    <p className={clsx('text-sm', mutedTextClass)}>{new Date(proof.timestamp).toLocaleString()}</p>
                  </div>
                  <span className={clsx('rounded-full px-3 py-1 text-xs font-black uppercase', proof.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : proof.approval_status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700')}>
                    {proof.approval_status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="xl:col-span-2 space-y-5">
        <RewardMarketplace
          rewards={rewards}
          childProfile={profile}
          onRedeemReward={async (rewardId, reward) => {
            await requestRedemption(rewardId, reward, profile.total_stars || 0);
          }}
          loading={rewardsLoading}
        />
        <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
          <h3 className="text-2xl font-display font-bold">Reward requests</h3>
          <div className="mt-4 space-y-3">
            {redemptionsLoading ? (
              <p className={mutedTextClass}>Loading reward requests...</p>
            ) : redemptions.length === 0 ? (
              <p className={mutedTextClass}>No reward requests yet.</p>
            ) : (
              redemptions.map((redemption) => (
                <div key={redemption.id} className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
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
    </div>
  );
}
