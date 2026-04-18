import { BadgeCheck, Smile } from 'lucide-react';
import clsx from 'clsx';
import { moodOptions, useChildLayout } from './ChildLayout';

export default function ChildDashboard() {
  const {
    accentCaptionClass,
    childName,
    currentMood,
    handleMoodSelect,
    isDark,
    levelProgress,
    moodLog,
    moodSaving,
    mutedTextClass,
    panelClass,
    profile,
    remainingTasks,
    renderQuestCard,
    tasks
  } = useChildLayout();

  const activeTasks = tasks.filter((task) => task.log?.status !== 'completed');

  return (
    <>
      <div className={clsx('mt-8 rounded-[2rem] border p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-6', panelClass)}>
        <h2 className="mb-4 flex items-center gap-2 text-2xl font-display font-bold">
          <Smile size={22} className="text-pink-300" />
          How are you feeling right now?
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {moodOptions.map((option) => {
            const selected = option.value === moodLog?.mood;
            const selectedBackground = option.value === 'sad'
              ? 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08)), linear-gradient(135deg, rgba(217,70,239,0.28), rgba(139,92,246,0.2))'
              : option.value === 'neutral'
                ? 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08)), linear-gradient(135deg, rgba(14,165,233,0.24), rgba(99,102,241,0.18))'
                : option.value === 'happy'
                  ? 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08)), linear-gradient(135deg, rgba(16,185,129,0.25), rgba(20,184,166,0.18))'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08)), linear-gradient(135deg, rgba(251,191,36,0.28), rgba(236,72,153,0.16))';

            return (
              <button
                key={option.label}
                className={clsx(
                  'rounded-[1.4rem] border px-4 py-4 text-left transition-all',
                  selected
                    ? 'border-white/35 shadow-[0_18px_35px_rgba(0,0,0,0.18)]'
                    : isDark
                      ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                      : 'border-indigo-200/70 bg-white/75 hover:border-indigo-300 hover:bg-white',
                  moodSaving && 'opacity-70'
                )}
                onClick={() => void handleMoodSelect(option.value)}
                style={selected ? { background: selectedBackground } : undefined}
              >
                <span className="flex items-center gap-3 text-lg font-bold">
                  <span className="text-3xl leading-none">{option.icon}</span>
                  <span>{option.label}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className={clsx('mt-4 text-lg', mutedTextClass)}>
          {currentMood ? currentMood.message.replace('Thanks for sharing.', `Thanks for sharing, ${childName}.`) : `Pick a mood, ${childName}. Your dashboard will cheer you on.`}
        </p>
      </div>

      <div className="mt-9">
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="text-3xl font-display font-bold">Today's Quests</h2>
          <span className={clsx('rounded-full border px-4 py-2 text-sm font-bold shadow-sm', isDark ? 'border-white/15 bg-white/7 text-white/84' : 'border-indigo-200/70 bg-white/75 text-slate-700')}>
            {remainingTasks} left
          </span>
        </div>
        <div className="space-y-4">{(activeTasks.length > 0 ? activeTasks : tasks.slice(0, 2)).slice(0, 2).map((item) => renderQuestCard(item, true))}</div>
      </div>

      <div className={clsx('mt-8 rounded-[2rem] border p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-6', panelClass)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[linear-gradient(135deg,#ffd86b,#ff9c6a)] text-slate-900 shadow-lg animate-pulse">
              <BadgeCheck size={30} />
            </div>
            <div>
              <p className={clsx('text-sm uppercase tracking-[0.2em]', accentCaptionClass)}>Level</p>
              <h3 className="text-3xl font-display font-bold">Junior Explorer</h3>
              <p className={clsx('mt-1 text-lg', mutedTextClass)}>{Math.max(0, 2 - Math.min(2, profile.total_stars ?? 0))} stars to level up!</p>
            </div>
          </div>
          <div className="min-w-[220px] flex-1">
            <div className={clsx('mb-2 flex items-center justify-between text-sm', mutedTextClass)}>
              <span>Explorer growth</span>
              <span>{levelProgress}%</span>
            </div>
            <div className="h-4 rounded-full bg-white/10 p-1">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#ffd95e,#8be9fd,#c084fc)]" style={{ width: `${levelProgress}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className="text-sm font-bold text-amber-400">Early Bird</p>
            <p className={clsx('mt-1 text-sm', mutedTextClass)}>Earned for showing up and starting strong.</p>
          </div>
          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className="text-sm font-bold text-fuchsia-400">Brain Champ</p>
            <p className={clsx('mt-1 text-sm', mutedTextClass)}>Academic quests help you level this up.</p>
          </div>
          <div className={clsx('rounded-[1.3rem] border px-4 py-4', isDark ? 'border-white/10 bg-white/6' : 'border-indigo-200/70 bg-white/80')}>
            <p className="text-sm font-bold text-emerald-500">Book Worm</p>
            <p className={clsx('mt-1 text-sm', mutedTextClass)}>Reading quests keep your streak glowing.</p>
          </div>
        </div>
      </div>
    </>
  );
}
