import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Flame,
  Home,
  MessageSquare,
  Moon,
  Orbit,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Sun,
  Upload,
  UserRound
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import {
  useDiaryEntries,
  useChildMood,
  useChildProfile,
  useChildProofs,
  useQuestActions,
  useTodaysTasks
} from '../../hooks/useData';
import type { MoodLog, Task } from '../../types/schema';

export type ChildTab = 'home' | 'quests' | 'diary' | 'profile';

export const moodOptions: Array<{
  icon: string;
  label: string;
  value: MoodLog['mood'];
  message: string;
}> = [
  {
    icon: '🥺',
    label: 'Need a hug',
    value: 'sad',
    message: 'Big breath. We can take today one tiny quest at a time.'
  },
  {
    icon: '🙂',
    label: 'Okay-ish',
    value: 'neutral',
    message: 'Steady mode is still strong mode. Let us build a calm streak.'
  },
  {
    icon: '😄',
    label: 'Ready',
    value: 'happy',
    message: 'Thanks for sharing. You are ready to shine today.'
  },
  {
    icon: '🤩',
    label: 'Super mode',
    value: 'excited',
    message: 'Energy unlocked. This feels like a star-collecting kind of day.'
  }
];

export interface ChildLayoutContextValue {
  activeTab: ChildTab;
  childName: string;
  currentMood: (typeof moodOptions)[number] | null;
  entries: ReturnType<typeof useDiaryEntries>['entries'];
  handleDiarySubmit: () => Promise<void>;
  handleMoodSelect: (value: MoodLog['mood']) => Promise<void>;
  handleQuestComplete: (task: Task) => Promise<void>;
  isDark: boolean;
  latestProofs: ReturnType<typeof useChildProofs>['proofs'];
  lowContrastTextClass: string;
  moodLog: ReturnType<typeof useChildMood>['moodLog'];
  moodSaving: boolean;
  mutedTextClass: string;
  notice: string;
  openProofPicker: (task: Task) => void;
  panelClass: string;
  profile: NonNullable<ReturnType<typeof useChildProfile>['profile']>;
  proofQueueCount: number;
  questSaving: boolean;
  remainingTasks: number;
  renderQuestCard: (item: { task: Task; log?: { status: string } }, compact?: boolean) => ReactNode;
  setDiaryDraft: React.Dispatch<React.SetStateAction<string>>;
  diaryDraft: string;
  diarySaving: boolean;
  uploading: boolean;
  softTextClass: string;
  accentCaptionClass: string;
  tasks: ReturnType<typeof useTodaysTasks>['tasks'];
  progressPercent: number;
  levelProgress: number;
}

export const useChildLayout = () => useOutletContext<ChildLayoutContextValue>();

function LoadingScreen() {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-bg">
      <div className="animate-pulse flex flex-col items-center">
        <Star className="h-12 w-12 text-accent mb-4 animate-spin-slow" />
        <p className="text-lg font-medium text-textMuted">Loading your adventure...</p>
      </div>
    </div>
  );
}

export default function ChildLayout() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const childId = user?.id || '';
  const { profile, loading: profileLoading } = useChildProfile(childId);
  const { tasks, loading: tasksLoading } = useTodaysTasks(childId);
  const { moodLog, saving: moodSaving, saveMood } = useChildMood(childId);
  const { entries, saving: diarySaving, addEntry } = useDiaryEntries(childId);
  const { proofs, uploading, uploadProof } = useChildProofs(childId);
  const { completeTask, saving: questSaving } = useQuestActions(childId);

  const [notice, setNotice] = useState('');
  const [diaryDraft, setDiaryDraft] = useState('');
  const [pendingProofTask, setPendingProofTask] = useState<Task | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (profileLoading || tasksLoading || !profile) {
    return <LoadingScreen />;
  }

  const path = location.pathname;
  const activeTab: ChildTab = path.endsWith('/quests')
    ? 'quests'
    : path.endsWith('/diary')
      ? 'diary'
      : path.endsWith('/profile')
        ? 'profile'
        : 'home';

  const isDark = theme === 'dark';
  const childName = profile.name || 'Athmika';
  const completedCount = tasks.filter((item) => item.log?.status === 'completed').length;
  const progressPercent = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const levelProgress = Math.min(100, 20 + progressPercent);
  const currentMood = moodOptions.find((option) => option.value === moodLog?.mood) || null;
  const proofQueueCount = proofs.filter((proof) => proof.approval_status === 'pending').length;
  const latestProofs = proofs.slice(0, 3);
  const remainingTasks = Math.max(tasks.length - completedCount, 0);

  const shellClass = isDark ? 'bg-[#100f24] text-white' : 'bg-[#f5f8ff] text-slate-900';
  const backdropBase = isDark
    ? 'bg-[radial-gradient(circle_at_top,#3b2a7a_0%,#151433_45%,#0a0b18_100%)]'
    : 'bg-[radial-gradient(circle_at_top,#d7d9ff_0%,#f9f4ff_48%,#eef8ff_100%)]';
  const backdropGlow = isDark
    ? 'bg-[radial-gradient(circle_at_20%_15%,rgba(236,72,153,0.22),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(96,165,250,0.20),transparent_24%),radial-gradient(circle_at_50%_70%,rgba(251,191,36,0.12),transparent_26%)]'
    : 'bg-[radial-gradient(circle_at_20%_15%,rgba(244,114,182,0.18),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,0.16),transparent_24%),radial-gradient(circle_at_50%_70%,rgba(250,204,21,0.12),transparent_26%)]';
  const heroClass = isDark
    ? 'border-white/15 bg-[linear-gradient(135deg,rgba(28,30,74,0.96),rgba(27,79,151,0.85)_48%,rgba(244,114,182,0.62)_100%)] text-white'
    : 'border-indigo-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(216,238,255,0.95)_44%,rgba(255,222,242,0.88)_100%)] text-slate-900';
  const subPanelClass = isDark
    ? 'border-white/15 bg-[#2b2058]/55 text-white'
    : 'border-indigo-200/70 bg-white/70 text-slate-900';
  const buttonClass = isDark
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/18'
    : 'border-slate-300/70 bg-white/85 text-slate-800 hover:bg-white';
  const navShellClass = isDark
    ? 'border-white/12 bg-[linear-gradient(180deg,rgba(32,28,58,0.95),rgba(23,20,44,0.92))]'
    : 'border-indigo-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,244,255,0.92))]';
  const panelClass = isDark
    ? 'border-white/12 bg-[linear-gradient(180deg,rgba(34,27,69,0.95),rgba(27,23,54,0.92))] text-white'
    : 'border-indigo-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(241,245,255,0.92))] text-slate-900';
  const softTextClass = isDark ? 'text-white/88' : 'text-slate-700';
  const mutedTextClass = isDark ? 'text-white/72' : 'text-slate-600';
  const lowContrastTextClass = isDark ? 'text-white/55' : 'text-slate-500';
  const accentCaptionClass = isDark ? 'text-amber-200/90' : 'text-fuchsia-600';

  const goToTab = (tab: ChildTab) => {
    const nextPath = tab === 'home' ? '/child' : `/child/${tab}`;
    void navigate(nextPath);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Child logout failed:', error);
      setNotice('Could not logout right now. Please retry.');
    }
  };

  const handleMoodSelect = async (value: MoodLog['mood']) => {
    try {
      await saveMood(value);
      setNotice('Mood saved for today.');
    } catch (error) {
      console.error('Mood save failed:', error);
      setNotice('Mood could not be saved right now.');
    }
  };

  const handleDiarySubmit = async () => {
    try {
      await addEntry(diaryDraft);
      setDiaryDraft('');
      setNotice('Diary note saved.');
    } catch (error) {
      console.error('Diary save failed:', error);
      setNotice('Diary note could not be saved right now.');
    }
  };

  const handleQuestComplete = async (task: Task) => {
    try {
      await completeTask(task);
      setNotice(`Quest complete. ${task.star_value} stars added.`);
    } catch (error) {
      console.error('Quest completion failed:', error);
      setNotice('Quest could not be completed right now.');
    }
  };

  const openProofPicker = (task: Task) => {
    setPendingProofTask(task);
    fileInputRef.current?.click();
  };

  const handleProofFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !pendingProofTask) return;

    try {
      await uploadProof(pendingProofTask, file);
      await completeTask(pendingProofTask);
      setNotice(`Proof uploaded for ${pendingProofTask.title}. Parent review is next.`);
    } catch (error) {
      console.error('Proof upload failed:', error);
      setNotice('Proof upload failed. Please try again.');
    } finally {
      event.target.value = '';
      setPendingProofTask(null);
    }
  };

  const renderQuestCard = (item: { task: Task; log?: { status: string } }, compact = false) => {
    const isAcademic = item.task.category === 'Academic';
    const isCompleted = item.log?.status === 'completed';
    const cardGlow = isAcademic
      ? 'linear-gradient(135deg, rgba(59,130,246,0.16), rgba(99,102,241,0.1), rgba(0,0,0,0))'
      : 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(132,204,22,0.08), rgba(0,0,0,0))';

    return (
      <div
        key={item.task.id}
        className={clsx(
          'rounded-[2rem] border p-5 shadow-[0_20px_60px_rgba(6,8,30,0.28)] transition-all hover:-translate-y-0.5',
          compact ? 'p-4' : 'p-5',
          isCompleted
            ? isDark
              ? 'border-emerald-300/25 bg-[linear-gradient(135deg,rgba(20,83,45,0.45),rgba(17,24,39,0.88))]'
              : 'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(220,252,231,0.9),rgba(239,246,255,0.95))]'
            : isDark
              ? 'border-white/12 bg-[linear-gradient(135deg,rgba(34,27,69,0.96),rgba(21,19,46,0.92))]'
              : 'border-indigo-200/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(243,244,255,0.94))]'
        )}
        style={{ position: 'relative' }}
      >
        <div className="absolute inset-0 rounded-[2rem] opacity-100" style={{ background: cardGlow }} />
        <div className="relative flex items-start gap-4">
          <div className={clsx('grid h-14 w-14 place-items-center rounded-2xl border', isAcademic ? 'border-sky-300/25 bg-sky-500/10 text-sky-300' : 'border-emerald-300/25 bg-emerald-500/10 text-emerald-300')}>
            {isAcademic ? <MessageSquare size={24} /> : <Star size={22} className="fill-current" />}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold">{item.task.title}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-xl bg-amber-300/18 px-3 py-1.5 font-bold text-amber-100">
                    <Star size={12} className="fill-current" /> {item.task.star_value} stars
                  </span>
                  <span className={clsx('rounded-xl px-3 py-1.5 font-bold', item.task.energy_level === 'high' ? 'bg-orange-300/18 text-orange-100' : 'bg-emerald-300/18 text-emerald-100')}>
                    {item.task.energy_level === 'high' ? 'Focus quest' : 'Light quest'}
                  </span>
                  <span className={clsx('rounded-xl px-3 py-1.5 font-bold', isDark ? 'bg-white/8 text-white/72' : 'bg-slate-100 text-slate-600')}>
                    {item.task.category}
                  </span>
                </div>
              </div>
              {item.task.requires_proof ? (
                <button
                  onClick={() => openProofPicker(item.task)}
                  disabled={uploading || questSaving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ffd95e,#ffb347)] px-5 py-3 text-base font-black text-slate-900 shadow-[0_10px_25px_rgba(251,191,36,0.28)] transition hover:brightness-105 disabled:opacity-60"
                >
                  <Upload size={16} /> Upload Proof
                </button>
              ) : (
                <button
                  onClick={() => void handleQuestComplete(item.task)}
                  disabled={isCompleted || questSaving}
                  className={clsx('rounded-2xl px-5 py-3 text-base font-black transition disabled:opacity-60', isCompleted ? 'bg-emerald-400/20 text-emerald-100' : 'bg-[linear-gradient(135deg,#d9ffd2,#ffe5cf)] text-slate-900 shadow-[0_10px_25px_rgba(250,204,21,0.14)] hover:brightness-105')}
                >
                  {isCompleted ? 'Quest Complete' : 'Complete Quest'}
                </button>
              )}
            </div>
            <div className="mt-5">
              <div className={clsx('mb-2 flex items-center justify-between text-sm', mutedTextClass)}>
                <span>{isCompleted ? 'Quest finished' : item.task.requires_proof ? 'Waiting for proof' : 'Quest progress'}</span>
                <span>{isCompleted ? '1 / 1' : item.task.requires_proof ? '1 / 2' : '0 / 1'}</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 p-0.5">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#53d8fb,#7f8cff,#ff84c7)]" style={{ width: `${isCompleted ? 100 : item.task.requires_proof ? 55 : 25}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const contextValue: ChildLayoutContextValue = {
    accentCaptionClass,
    activeTab,
    childName,
    currentMood,
    diaryDraft,
    diarySaving,
    entries,
    handleDiarySubmit,
    handleMoodSelect,
    handleQuestComplete,
    isDark,
    latestProofs,
    levelProgress,
    lowContrastTextClass,
    moodLog,
    moodSaving,
    mutedTextClass,
    notice,
    openProofPicker,
    panelClass,
    profile,
    progressPercent,
    proofQueueCount,
    questSaving,
    remainingTasks,
    renderQuestCard,
    setDiaryDraft,
    softTextClass,
    tasks,
    uploading
  };

  return (
    <div className={clsx('min-h-screen overflow-x-hidden pb-28 relative', shellClass)}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleProofFile(event)} />
      <div className={clsx('absolute inset-0', backdropBase)} />
      <div className={clsx('absolute inset-0 opacity-80', backdropGlow)} />
      <div className="pointer-events-none absolute inset-0">
        <div className={clsx('absolute inset-x-0 top-0 h-72', isDark ? 'bg-[linear-gradient(180deg,rgba(147,51,234,0.18),transparent)]' : 'bg-[linear-gradient(180deg,rgba(129,140,248,0.15),transparent)]')} />
        {Array.from({ length: 28 }).map((_, index) => (
          <span key={index} className={clsx('absolute rounded-full animate-pulse', isDark ? 'bg-white/80' : 'bg-indigo-300/80')} style={{ top: `${6 + ((index * 13) % 54)}%`, left: `${3 + ((index * 17) % 92)}%`, width: `${index % 3 === 0 ? 3 : 2}px`, height: `${index % 3 === 0 ? 3 : 2}px`, opacity: 0.45 + (index % 4) * 0.1, animationDelay: `${index * 120}ms` }} />
        ))}
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 relative z-10 sm:px-6">
        <div className={clsx('rounded-[2rem] border p-6 shadow-[0_24px_80px_rgba(6,8,30,0.45)] backdrop-blur-xl sm:p-8', heroClass)}>
          <div className="mb-6 hidden gap-4 rounded-[1.5rem] border border-black/10 bg-black/20 px-4 py-3 md:flex md:flex-col xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3">
                <div className={clsx('grid h-11 w-11 place-items-center rounded-2xl border', isDark ? 'border-white/15 bg-white/10 text-cyan-200' : 'border-slate-300/60 bg-slate-900 text-cyan-300')}>
                  <UserRound size={18} />
                </div>
                <div>
                  <p className={clsx('text-xs font-black uppercase tracking-[0.2em]', lowContrastTextClass)}>Profile</p>
                  <p className="text-base font-bold">{childName}</p>
                </div>
              </div>
              <button onClick={handleLogout} className={clsx('rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm transition', buttonClass)}>Logout</button>
              <button onClick={toggleTheme} className={clsx('inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm transition', buttonClass)}>
                {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                {theme === 'light' ? 'Dark sky' : 'Light sky'}
              </button>
            </div>

            <div className={clsx('grid grid-cols-4 rounded-[1.35rem] border px-2 py-2 shadow-sm', navShellClass)}>
              {[
                { id: 'home', label: 'Home', icon: Home },
                { id: 'quests', label: 'Quests', icon:MessageSquare },
                { id: 'diary', label: 'Diary', icon: ScrollText },
                { id: 'profile', label: 'Profile', icon: Orbit }
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => goToTab(tab.id as ChildTab)} className={clsx('flex min-w-[92px] flex-col items-center gap-1 rounded-xl px-4 py-2 text-sm font-bold transition', active ? (isDark ? 'text-cyan-300 bg-white/6' : 'text-cyan-600 bg-slate-900/5') : lowContrastTextClass)}>
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={clsx('text-sm uppercase tracking-[0.24em] font-black', accentCaptionClass)}>Today is your quest day</p>
              <h1 className="text-4xl font-display font-extrabold leading-tight mt-3 sm:text-6xl">Hi {childName}! <span className="inline-block align-middle">😊</span></h1>
              <p className={clsx('text-lg mt-3 max-w-2xl', softTextClass)}>You are building strong habits, one tiny win at a time.</p>
            </div>
            <div className={clsx('grid h-16 w-16 place-items-center rounded-[1.4rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:h-20 sm:w-20', isDark ? 'border-white/25 bg-white/12 text-white/95' : 'border-indigo-200/70 bg-white/75 text-indigo-700')}>
              <Sparkles size={30} />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 md:hidden">
            <button onClick={handleLogout} className={clsx('rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm transition', buttonClass)}>Logout</button>
            <button onClick={toggleTheme} className={clsx('inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm transition', buttonClass)}>
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              {theme === 'light' ? 'Dark sky' : 'Light sky'}
            </button>
            <div className={clsx('ml-auto rounded-2xl border px-4 py-3 text-sm font-bold', isDark ? 'border-white/15 bg-black/15 text-white/80' : 'border-indigo-200/70 bg-white/75 text-slate-700')}>Profile: {childName}</div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.6rem] border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,222,189,0.88))] px-5 py-4 text-slate-900 shadow-[0_12px_30px_rgba(10,10,30,0.18)]"><div className="flex items-center justify-center gap-2 text-amber-500"><Star className="fill-current" size={20} /><span className="text-4xl font-black">{profile.total_stars ?? 0}</span></div><p className="mt-2 text-center text-sm font-black uppercase tracking-[0.2em]">Stars</p></div>
            <div className="rounded-[1.6rem] border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,240,189,0.88))] px-5 py-4 text-slate-900 shadow-[0_12px_30px_rgba(10,10,30,0.18)]"><div className="flex items-center justify-center gap-2 text-orange-500"><Flame className="fill-current" size={20} /><span className="text-4xl font-black">{profile.streak_count ?? 0}</span></div><p className="mt-2 text-center text-sm font-black uppercase tracking-[0.2em]">Streak</p></div>
            <div className="rounded-[1.6rem] border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(226,239,255,0.9))] px-5 py-4 text-slate-900 shadow-[0_12px_30px_rgba(10,10,30,0.18)]"><div className="flex items-center justify-center gap-2 text-sky-600"><Shield className="fill-current" size={20} /><span className="text-4xl font-black">{profile.streak_shields ?? 0}</span></div><p className="mt-2 text-center text-sm font-black uppercase tracking-[0.2em]">Shields</p></div>
          </div>

          <div className={clsx('mt-6 rounded-[1.5rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]', subPanelClass)}>
            <div className={clsx('flex flex-wrap items-center justify-between gap-3 text-sm font-black uppercase tracking-[0.18em]', softTextClass)}><span>Adventure Meter</span><div className="flex items-center gap-3"><span className={isDark ? 'text-amber-200' : 'text-amber-500'}>{'★'.repeat(Math.max(1, Math.min(5, Math.ceil(progressPercent / 20) || 1)))}</span><span>{progressPercent}%</span></div></div>
            <div className="mt-4 h-4 rounded-full bg-white/10 p-1"><div className="h-full rounded-full bg-[linear-gradient(90deg,#5ee7ff_0%,#7c83ff_55%,#ff7bc0_100%)] transition-all" style={{ width: `${progressPercent}%` }} /></div>
          </div>
        </div>

        {notice && <div className={clsx('mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_10px_25px_rgba(14,165,233,0.12)]', isDark ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100' : 'border-cyan-200 bg-cyan-50 text-cyan-700')}>{notice}</div>}

        <Outlet context={contextValue} />

        <div className="mx-auto mt-8 max-w-3xl md:hidden">
          <div className={clsx('grid grid-cols-4 rounded-[2rem] border px-3 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)]', navShellClass)}>
            {[
              { id: 'home', label: 'Home', icon: Home },
              { id: 'quests', label: 'Quests', icon: MessageSquare },
              { id: 'diary', label: 'Diary', icon: ScrollText },
              { id: 'profile', label: 'Profile', icon: Orbit }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => goToTab(tab.id as ChildTab)} className={clsx('flex flex-col items-center gap-2', active ? (isDark ? 'text-cyan-300' : 'text-cyan-600') : lowContrastTextClass)}>
                  <Icon size={22} />
                  <span className="text-sm font-bold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
