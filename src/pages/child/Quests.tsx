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
      <div className="space-y-8">
        {tasks.filter(t => t.task.priority === 'high' && !t.task.id.includes('bonus_')).length > 0 && (
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-rose-400 mb-3 ml-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Priority Quests
            </h3>
            <div className="space-y-4">
              {tasks.filter(t => t.task.priority === 'high' && !t.task.id.includes('bonus_')).map((item) => renderQuestCard(item))}
            </div>
          </div>
        )}

        {tasks.filter(t => t.task.priority !== 'high' && !t.task.id.includes('bonus_')).length > 0 && (
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-sky-400 mb-3 ml-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500"></span> Standard Quests
            </h3>
            <div className="space-y-4">
              {tasks.filter(t => t.task.priority !== 'high' && !t.task.id.includes('bonus_')).map((item) => renderQuestCard(item))}
            </div>
          </div>
        )}

        {tasks.filter(t => t.task.id.includes('bonus_')).length > 0 && (
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400 mb-3 ml-2 flex items-center gap-2">
              <span className="text-lg">✨</span> Bonus Quests
            </h3>
            <div className="space-y-4">
              {tasks.filter(t => t.task.id.includes('bonus_')).map((item) => renderQuestCard(item))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
