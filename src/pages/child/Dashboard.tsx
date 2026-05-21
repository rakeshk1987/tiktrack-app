import { BadgeCheck, Compass, Gift, Mail, Smile, Sparkles, Star, Upload } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { moodOptions, useChildLayout } from './ChildLayout';
import { RealTimeProvider } from '../../contexts/RealTimeContext';
import RealTimeNotifications from '../../components/RealTimeNotifications';
import RecommendationsPanel from '../../components/RecommendationsPanel';
import { generateChildDashboardRecommendations } from '../../utils/childRecommendations';
import { useRewardLedger } from '../../hooks/useRewardLedger';
import { useScratchRewards } from '../../hooks/useScratchRewards';
import { useMessages } from '../../hooks/useData';

function ChildDashboard() {
  const {
    avatarEmoji,
    childName,
    handleQuestComplete,
    handleMoodSelect,
    isDark,
    levelProgress,
    moodLog,
    moodSaving,
    openProofPicker,
    parentId,
    profile,
    questSaving,
    remainingTasks,
    renderQuestCard,
    tasks
  } = useChildLayout();

  const activeTasks = tasks.filter((task) => task.log?.status !== 'completed');
  const completedTasks = tasks.filter((task) => task.log?.status === 'completed');
  const nextQuest = activeTasks[0] || null;
  const totalStars = Number(profile.total_stars || 0);
  const nextUnlockAt = Math.ceil((totalStars + 1) / 10) * 10;
  const starsToUnlock = Math.max(0, nextUnlockAt - totalStars);
  const checkpoints = [0, 25, 50, 75, 100];
  const { surpriseEntries } = useRewardLedger(profile.id, parentId);
  const { availableCards } = useScratchRewards(profile.id, parentId);
  const { messages } = useMessages(profile.id, 'child');
  const latestParentMessage = messages.find((message) => message.sender_role !== 'child') || null;
  const recommendations = generateChildDashboardRecommendations(
    tasks.map((item) => item.task),
    profile,
    [],
    null,
    moodLog?.mood
  );
  const currentMood = moodOptions.find((option) => option.value === moodLog?.mood) || null;
  const moodSupportText = currentMood?.value === 'sad'
    ? 'Tiny quest mode is on. Pick the easiest win first.'
    : currentMood?.value === 'neutral'
      ? 'Steady mode is perfect for one calm quest.'
      : currentMood?.value === 'excited'
        ? 'Super mode unlocked. Try a focus quest and collect those stars.'
        : currentMood?.value === 'happy'
          ? 'Ready energy detected. Start with the next quest.'
          : `Pick a mood, ${childName}. Your dashboard will cheer you on.`;
  const rewardGoal = starsToUnlock === 0
    ? 'A new unlock is ready.'
    : `${starsToUnlock} stars to the next unlock.`;

  return (
    <>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <div className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(18,24,44,0.98),rgba(13,17,34,0.96))] p-5 sm:p-6 text-white shadow-[0_18px_45px_rgba(2,6,23,0.34)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-300">Next Quest</p>
              <h2 className="mt-2 text-3xl font-display font-black leading-tight">
                {nextQuest ? nextQuest.task.title : `All clear, ${childName}!`}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                {nextQuest
                  ? `${nextQuest.task.star_value} stars waiting. ${nextQuest.task.requires_proof ? 'Upload proof when it is done.' : 'Tap complete when you finish it.'}`
                  : 'No active quests right now. Check rewards or write a diary win.'}
              </p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
              <Sparkles size={28} />
            </div>
          </div>

          <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
            {nextQuest ? (
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-xl bg-amber-300/18 px-3 py-1.5 font-bold text-amber-100">
                      <Star size={12} className="fill-current" /> {nextQuest.task.star_value} stars
                    </span>
                    <span className="rounded-xl bg-emerald-300/18 px-3 py-1.5 font-bold text-emerald-100">
                      {nextQuest.task.energy_level === 'high' ? 'Focus quest' : 'Light quest'}
                    </span>
                    <span className="rounded-xl bg-white/8 px-3 py-1.5 font-bold text-white/72">
                      {nextQuest.task.category || 'Quest'}
                    </span>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-white/10 p-0.5">
                    <div className="h-full w-[24%] rounded-full bg-[linear-gradient(90deg,#53d8fb,#7f8cff,#ff84c7)]" />
                  </div>
                </div>
                {nextQuest.task.requires_proof ? (
                  <button
                    type="button"
                    onClick={() => openProofPicker(nextQuest.task)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ffd95e,#ffb347)] px-5 py-3 text-base font-black text-slate-900 shadow-[0_10px_25px_rgba(251,191,36,0.28)] transition hover:brightness-105"
                  >
                    <Upload size={16} /> Upload Proof
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleQuestComplete(nextQuest.task)}
                    disabled={questSaving}
                    className="rounded-2xl bg-[linear-gradient(135deg,#d9ffd2,#ffe5cf)] px-6 py-3 text-base font-black text-slate-900 shadow-[0_10px_25px_rgba(250,204,21,0.14)] transition hover:brightness-105 disabled:opacity-60"
                  >
                    Complete Quest
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Link to="/child/rewards" className="rounded-2xl border border-violet-300/25 bg-violet-500/10 px-4 py-4 font-black text-violet-100">
                  Open Rewards
                </Link>
                <Link to="/child/diary" className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-4 font-black text-cyan-100">
                  Write a Win
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {(surpriseEntries.length > 0 || availableCards.length > 0) ? (
            <Link to="/child/rewards" className="block rounded-[1.5rem] border border-pink-300/25 bg-[linear-gradient(135deg,rgba(236,72,153,0.24),rgba(124,58,237,0.18))] p-5 text-white shadow-[0_18px_45px_rgba(2,6,23,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-pink-200">Reward waiting</p>
                  <h3 className="mt-1 text-xl font-display font-black">
                    {surpriseEntries.length > 0 ? 'Surprise gift to open' : 'Scratch card ready'}
                  </h3>
                  <p className="mt-2 text-sm text-white/72">Open Rewards to reveal it.</p>
                </div>
                <Gift size={32} className="text-pink-200" />
              </div>
            </Link>
          ) : (
            <div className="rounded-[1.5rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-5 text-white">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-300">Reward goal</p>
              <h3 className="mt-1 text-xl font-display font-black">{rewardGoal}</h3>
              <p className="mt-2 text-sm text-white/70">Finish quests to unlock more rewards.</p>
            </div>
          )}

          {latestParentMessage ? (
            <div className="rounded-[1.5rem] border border-cyan-300/20 bg-cyan-500/10 p-5 text-white">
              <div className="flex items-start gap-3">
                <Mail className="mt-1 text-cyan-200" size={22} />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-200">Parent message</p>
                  <p className="mt-1 line-clamp-3 text-sm leading-6 text-white/78">{latestParentMessage.content}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-5 sm:p-6 text-white shadow-[0_14px_34px_rgba(2,6,23,0.32)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-sky-500/20 text-sky-300 border border-sky-300/25">
              <span className="text-3xl">{avatarEmoji || <BadgeCheck size={30} />}</span>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-sky-300">Level</p>
              <h3 className="text-[1.75rem] sm:text-[1.9rem] font-display font-bold leading-tight">{childName}, Junior Explorer</h3>
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

      <div className="mt-5 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-5 sm:p-6 text-white shadow-[0_14px_34px_rgba(2,6,23,0.32)]">
        <h2 className="mb-4 flex items-center gap-2 text-[1.25rem] font-display font-bold leading-tight">
          <Smile size={20} className="text-sky-300" />
          How are you feeling right now?
        </h2>
        {!moodLog ? (
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
        ) : (
          <div className="rounded-2xl border border-sky-300/20 bg-sky-500/10 px-4 py-4">
            <p className="text-lg font-black">{currentMood?.icon} {currentMood?.label}</p>
            <p className="mt-1 text-sm leading-6 text-white/75">{moodSupportText}</p>
          </div>
        )}
        <p className="mt-4 text-sm leading-6 text-white/72">{moodSupportText}</p>
      </div>

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
        <div className="grid gap-4 xl:grid-cols-2">{(activeTasks.length > 0 ? activeTasks : tasks.slice(0, 4)).slice(0, 4).map((item) => renderQuestCard(item, true))}</div>
        {activeTasks.length === 0 && completedTasks.length > 0 ? (
          <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
            Today's quests are done. Nice work.
          </p>
        ) : null}
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
