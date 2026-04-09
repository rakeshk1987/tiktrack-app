import clsx from 'clsx';
import { useChildLayout } from './ChildLayout';

export default function ChildQuests() {
  const { isDark, mutedTextClass, proofQueueCount, renderQuestCard, tasks } = useChildLayout();

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-display font-bold">Quest board</h2>
          <p className={mutedTextClass}>Complete easy wins, upload proof where needed, and keep your streak alive.</p>
        </div>
        <div className={clsx('rounded-2xl border px-4 py-3 text-sm font-bold', isDark ? 'border-white/12 bg-white/8 text-white/80' : 'border-indigo-200/70 bg-white/80 text-slate-700')}>
          {proofQueueCount} proof{proofQueueCount === 1 ? '' : 's'} waiting
        </div>
      </div>
      <div className="space-y-4">{tasks.map((item) => renderQuestCard(item))}</div>
    </div>
  );
}
