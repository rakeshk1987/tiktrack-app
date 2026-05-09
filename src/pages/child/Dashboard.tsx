import { BadgeCheck, Compass, Smile, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { moodOptions, useChildLayout } from './ChildLayout';
import { RealTimeProvider } from '../../contexts/RealTimeContext';
import RealTimeNotifications from '../../components/RealTimeNotifications';
import RecommendationsPanel from '../../components/RecommendationsPanel';
import { generateChildDashboardRecommendations } from '../../utils/childRecommendations';

function ChildDashboard() {
  const {
    childName,
    handleMoodSelect,
    isDark,
    levelProgress,
    moodLog,
    moodSaving,
    profile,
    remainingTasks,
    renderQuestCard,
    tasks
  } = useChildLayout();

  const activeTasks = tasks.filter((task) => task.log?.status !== 'completed');
  const totalStars = Number(profile.total_stars || 0);
  const nextUnlockAt = Math.ceil((totalStars + 1) / 10) * 10;
  const starsToUnlock = Math.max(0, nextUnlockAt - totalStars);
  const checkpoints = [0, 25, 50, 75, 100];
  const recommendations = generateChildDashboardRecommendations(
    tasks.map((item) => item.task),
    profile,
    [],
    null,
    moodLog?.mood
  );

  return (
    <>
      <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-5 sm:p-6 text-white shadow-[0_14px_34px_rgba(2,6,23,0.32)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-sky-500/20 text-sky-300 border border-sky-300/25">
              <BadgeCheck size={30} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-sky-300">Level</p>
              <h3 className="text-[1.75rem] sm:text-[1.9rem] font-display font-bold leading-tight">Junior Explorer</h3>
              <p className="mt-1 text-sm leading-6 text-white/70">
                {Math.max(0, 2 - Math.min(2, profile.total_stars ?? 0))} stars to level up!
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] font-bold text-sky-200">
            <span className="inline-flex items-center gap-2"><Compass size={14} /> Quest Path</span>
          </div>
          <div className="min-w-[220px] flex-1">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-white/70">
              <span>Map progress</span>
              <span>{levelProgress}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 p-0.5">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#a78bfa,#f472b6)]" style={{ width: `${levelProgress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              {checkpoints.map((cp) => {
                const reached = levelProgress >= cp;
                return (
                  <span
                    key={cp}
                    className={clsx(
                      'h-2.5 w-2.5 rounded-full border',
                      reached
                        ? 'border-cyan-200 bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]'
                        : 'border-white/35 bg-white/15'
                    )}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300">Next Unlock</p>
            <p className="mt-1 text-sm leading-6 font-semibold text-white/75">
              {starsToUnlock === 0 ? 'Unlocked now' : `${starsToUnlock} stars to reach ${nextUnlockAt}`}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300">Early Bird</p>
            <p className="mt-1 text-sm leading-6 text-white/72">Earned for showing up and starting strong.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300">Brain Champ</p>
            <p className="mt-1 text-sm leading-6 text-white/72">Academic quests help you level this up.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300">Book Worm</p>
            <p className="mt-1 text-sm leading-6 text-white/72">Reading quests keep your streak glowing.</p>
          </div>
        </div>
      </div>

      {!moodLog ? (
        <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-5 sm:p-6 text-white shadow-[0_14px_34px_rgba(2,6,23,0.32)]">
          <h2 className="mb-4 flex items-center gap-2 text-[1.25rem] font-display font-bold leading-tight">
            <Smile size={20} className="text-sky-300" />
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
                    'rounded-xl border px-4 py-3.5 text-left transition-all',
                    selected
                      ? 'border-white/35 shadow-[0_18px_35px_rgba(0,0,0,0.18)]'
                      : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10',
                    moodSaving && 'opacity-70'
                  )}
                  onClick={() => void handleMoodSelect(option.value)}
                  style={selected ? { background: selectedBackground } : undefined}
                >
                  <span className="flex items-center gap-3 text-base font-bold">
                    <span className="text-3xl leading-none">{option.icon}</span>
                    <span>{option.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-sm leading-6 text-white/72">{`Pick a mood, ${childName}. Your dashboard will cheer you on.`}</p>
        </div>
      ) : null}

      <div className="mt-5">
        <RecommendationsPanel recommendations={recommendations} />
      </div>

      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between px-1">
          <h2 className="inline-flex items-center gap-2 text-[1.35rem] font-display font-bold leading-tight">
            <Sparkles size={20} className={isDark ? 'text-cyan-300' : 'text-indigo-500'} />
            Today's Quests
          </h2>
          <span className={clsx('rounded-full border px-4 py-2 text-sm font-bold shadow-sm', isDark ? 'border-white/15 bg-white/7 text-white/84' : 'border-indigo-200/70 bg-white/75 text-slate-700')}>
            {remainingTasks} left
          </span>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">{(activeTasks.length > 0 ? activeTasks : tasks.slice(0, 2)).slice(0, 2).map((item) => renderQuestCard(item, true))}</div>
      </div>

    </>
  );
}

// Wrapper component with real-time functionality
function ChildDashboardWithRealTime() {
  return (
    <RealTimeProvider userId={useChildLayout().profile.id} userRole="child_user">
      <RealTimeNotifications />
      <ChildDashboard />
    </RealTimeProvider>
  );
}

export { ChildDashboardWithRealTime };
export default ChildDashboardWithRealTime;
