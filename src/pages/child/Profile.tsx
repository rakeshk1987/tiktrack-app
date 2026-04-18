import clsx from 'clsx';
import { useChildLayout } from './ChildLayout';

export default function ChildProfile() {
  const { accentCaptionClass, isDark, latestProofs, mutedTextClass, panelClass, profile } = useChildLayout();
  const childName = profile.name || 'Athmika';

  return (
    <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className={clsx('rounded-[2rem] border p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]', panelClass)}>
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

      <div className={clsx('rounded-[2rem] border p-5 shadow-[0_20px_50px_rgba(0,0,0,0.18)]', panelClass)}>
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
    </div>
  );
}
