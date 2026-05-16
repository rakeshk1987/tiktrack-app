import { useRef, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import {
  Flame,
  Home,
  CalendarDays,
  Gift,
  MessageSquare,
  Moon,
  Orbit,
  PiggyBank,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Sun,
  Upload,
  UserRound,
  Mail
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  useDiaryEntries,
  useChildMood,
  useChildProfile,
  useChildProofs,
  useQuestActions,
  useTodaysTasks,
  useUpcomingEvents,
  useMessages,
  useChildReminders
} from '../../hooks/useData';
import { getExamPlannerStats } from '../../hooks/useCoreLogic';
import type { MoodLog, Task } from '../../types/schema';
import InboxPanel from '../../components/child/InboxPanel';
import { useChallenges } from '../../hooks/useChallenges';
import { useRewards } from '../../hooks/useRedemptions';

export type ChildTab = 'home' | 'quests' | 'planner' | 'diary' | 'rewards' | 'money-pot' | 'profile';

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
  handleDiarySubmitForDate: (dateKey: string, content: string) => Promise<void>;
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
  uploadProgress: number;
  retryProofUpload: () => Promise<string | null>;
  hasPendingProofRetry: boolean;
  softTextClass: string;
  accentCaptionClass: string;
  tasks: ReturnType<typeof useTodaysTasks>['tasks'];
  progressPercent: number;
  levelProgress: number;
  events: ReturnType<typeof useUpcomingEvents>['events'];
  reminders: ReturnType<typeof useChildReminders>['reminders'];
  parentId: string;
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

function MissingProfileScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg px-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
        <Star className="mx-auto mb-4 h-10 w-10 text-accent" />
        <h1 className="text-2xl font-display font-bold text-textMain">Profile setup is still syncing</h1>
        <p className="mt-3 text-sm leading-6 text-textMuted">
          Ask your parent to open Family Hub and confirm this child profile was saved.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-textMain transition hover:bg-bgSoft"
        >
          Retry sync
        </button>
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
  const { events, loading: eventsLoading } = useUpcomingEvents(childId);
  const { reminders } = useChildReminders(childId);
  const { moodLog, saving: moodSaving, saveMood } = useChildMood(childId);
  const { entries, saving: diarySaving, addEntry } = useDiaryEntries(childId);
  const { proofs, uploading, uploadProgress, uploadProof, retryUpload, hasPendingRetry } = useChildProofs(childId);
  const { completeTask, markTaskPendingProof, saving: questSaving } = useQuestActions(childId);
  const { messages, sendMessage } = useMessages(childId, 'child');
  const parentId = profile?.family_id || profile?.parent_id || '';
  const { activeChallenges, incrementScore: incrementChallengeScore } = useChallenges(parentId);
  const { rewards } = useRewards(parentId);

  const [notice, setNotice] = useState('');
  const [diaryDraft, setDiaryDraft] = useState('');
  const [pendingProofTask, setPendingProofTask] = useState<Task | null>(null);
  const [questCelebration, setQuestCelebration] = useState<{ title: string; stars: number } | null>(null);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [todaySpecialTheme, setTodaySpecialTheme] = useState<'birthday' | 'festival' | 'celebration' | 'custom' | null>(null);
  const [rewardsAlert, setRewardsAlert] = useState(false);
  const [moneyPotAlert, setMoneyPotAlert] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const examStats = getExamPlannerStats(events, tasks);
  const path = location.pathname;
  const activeTab: ChildTab = path.endsWith('/quests')
    ? 'quests'
    : path.endsWith('/planner')
      ? 'planner'
    : path.endsWith('/diary')
      ? 'diary'
      : path.endsWith('/rewards')
        ? 'rewards'
      : path.endsWith('/money-pot')
        ? 'money-pot'
      : path.endsWith('/profile')
        ? 'profile'
        : 'home';
  const tabStorageKey = `tiktrack_child_${childId}_last_tab`;

  useEffect(() => {
    if (!childId || path !== '/child') {
      return;
    }

    try {
      const saved = localStorage.getItem(tabStorageKey);
      if (saved && (['home', 'quests', 'planner', 'diary', 'rewards', 'money-pot', 'profile'] as string[]).includes(saved)) {
        void navigate(saved === 'home' ? '/child' : `/child/${saved}`);
      }
    } catch {}
  }, [childId, navigate, path, tabStorageKey]);

  useEffect(() => {
    if (!childId) {
      return;
    }

    try {
      localStorage.setItem(tabStorageKey, activeTab);
    } catch {}
  }, [activeTab, childId, tabStorageKey]);

  useEffect(() => {
    if (!childId) {
      return;
    }

    const key = `tiktrack_child_${childId}_diary_draft`;
    try {
      const saved = localStorage.getItem(key);
      if (saved && !diaryDraft) setDiaryDraft(saved);
    } catch {}

    const handle = setInterval(() => {
      try {
        if (diaryDraft?.trim()) localStorage.setItem(key, diaryDraft);
      } catch {}
    }, 1500);
    return () => clearInterval(handle);
  }, [childId, diaryDraft]);

  useEffect(() => {
    if (!childId || !profile) return;
    const todayMd = new Date().toISOString().slice(5, 10);
    const birthdayMd = (profile.date_of_birth || '').slice(5, 10);

    const q = query(collection(db, 'special_dates'), where('child_id', '==', childId));
    const unsub = onSnapshot(q, (snap) => {
      const todaySpecial = snap.docs
        .map((d) => d.data() as { date?: string; theme?: 'birthday' | 'festival' | 'celebration' | 'custom' })
        .find((item) => (item.date || '').slice(5, 10) === todayMd);

      if (birthdayMd === todayMd) {
        setTodaySpecialTheme('birthday');
      } else if (todaySpecial?.theme) {
        setTodaySpecialTheme(todaySpecial.theme);
      } else if (todaySpecial) {
        setTodaySpecialTheme('custom');
      } else {
        setTodaySpecialTheme(null);
      }
    });

    return () => unsub();
  }, [childId, profile]);

  useEffect(() => {
    if (!childId || !profile) return;

    const seenRewardsKey = `tiktrack_child_${childId}_rewards_seen_count`;
    const seenStarsKey = `tiktrack_child_${childId}_rewards_seen_stars`;
    const currentRewardsCount = rewards.length;
    const currentStars = Number(profile.total_stars || 0);

    const storedRewards = localStorage.getItem(seenRewardsKey);
    const storedStars = localStorage.getItem(seenStarsKey);

    if (storedRewards == null || storedStars == null) {
      localStorage.setItem(seenRewardsKey, String(currentRewardsCount));
      localStorage.setItem(seenStarsKey, String(currentStars));
      setRewardsAlert(false);
      return;
    }

    const seenRewardsCount = Number(storedRewards || 0);
    const seenStars = Number(storedStars || 0);

    const hasNewReward = currentRewardsCount > seenRewardsCount;
    const hasNewStars = currentStars > seenStars;
    setRewardsAlert(hasNewReward || hasNewStars);

    if (activeTab === 'rewards') {
      localStorage.setItem(seenRewardsKey, String(currentRewardsCount));
      localStorage.setItem(seenStarsKey, String(currentStars));
      setRewardsAlert(false);
    }
  }, [activeTab, childId, profile, rewards]);

  useEffect(() => {
    if (!childId || !profile) return;
    const weeklyGoal = Number(profile.money_weekly_goal || 0);
    if (weeklyGoal <= 0) {
      setMoneyPotAlert(false);
      return;
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekKey = `${weekStart.toISOString().slice(0, 10)}_${weekEnd.toISOString().slice(0, 10)}`;
    const seenKey = `tiktrack_child_${childId}_money_pot_goal_seen_${weekKey}`;

    const q = query(collection(db, 'money_pot_entries'), where('child_id', '==', childId));
    const unsub = onSnapshot(q, (snap) => {
      const weeklySaved = snap.docs
        .map((d) => d.data() as { date?: string; amount?: number })
        .filter((entry) => {
          const date = new Date(`${entry.date || ''}T00:00:00`);
          return !Number.isNaN(date.getTime()) && date >= weekStart && date <= weekEnd;
        })
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

      const goalReached = weeklySaved >= weeklyGoal;
      const seen = localStorage.getItem(seenKey) === '1';

      if (activeTab === 'money-pot') {
        if (goalReached) localStorage.setItem(seenKey, '1');
        setMoneyPotAlert(false);
        return;
      }

      setMoneyPotAlert(goalReached && !seen);
    });

    return () => unsub();
  }, [activeTab, childId, profile]);

  if (profileLoading || tasksLoading || eventsLoading) {
    return <LoadingScreen />;
  }

  if (!profile) {
    return <MissingProfileScreen />;
  }

  const isDark = theme === 'dark';
  const childName = profile.pet_name || profile.name || 'Explorer';
  
  const isMoodNegative = moodLog?.mood === 'sad' || moodLog?.mood === 'angry';
  const isMoodPositive = moodLog?.mood === 'happy' || moodLog?.mood === 'excited';
  
  let adaptiveTasks = isMoodNegative 
    ? tasks.filter(t => t.task.priority !== 'low' || t.log?.status === 'completed') 
    : tasks;

  // Emotional Adaptation: Add a bonus if they feel great!
  if (isMoodPositive && adaptiveTasks.length > 0 && !adaptiveTasks.some(t => t.task.id === 'bonus_quest_happy')) {
    adaptiveTasks = [...adaptiveTasks, {
      task: {
        id: 'bonus_quest_happy',
        title: 'Happy Bonus: Dance for 1 minute!',
        category: 'Creative',
        priority: 'low',
        energy_level: 'high',
        difficulty_level: 1,
        star_value: 3,
        requires_proof: false
      }
    }];
  }

  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const isStruggling = (Number(profile.consistency_score) || 0) < 40;
  const isMaster = (Number(profile.streak_count) || 0) >= 21;

  if (isStruggling) {
    // Difficulty Scaling: Decrease difficulty, boost rewards slightly to encourage
    adaptiveTasks = adaptiveTasks.map(t => ({
      ...t, 
      task: { ...t.task, difficulty_level: Math.max(1, (t.task.difficulty_level || 1) - 1), star_value: (t.task.star_value || 1) + 1 }
    }));
  } else if (isMaster) {
    // Difficulty Scaling: Increase difficulty subtly
    adaptiveTasks = adaptiveTasks.map(t => ({
      ...t, 
      task: { ...t.task, difficulty_level: Math.min(5, (t.task.difficulty_level || 1) + 1) }
    }));
  }

  // Priority Adjustment: Strip creatives if high-priority tasks pending in evening
  if (timeOfDay === 'evening') {
    const hasPendingHighPriority = adaptiveTasks.some(t => t.task.priority === 'high' && t.log?.status !== 'completed');
    if (hasPendingHighPriority) {
       adaptiveTasks = adaptiveTasks.filter(t => t.task.priority !== 'low' || t.log?.status === 'completed');
    }
  }

  const completedCount = adaptiveTasks.filter((item) => item.log?.status === 'completed').length;
  const earnedToday = tasks
    .filter((item) => item.log?.status === 'completed')
    .reduce((sum, item) => sum + Number(item.task.star_value || 0), 0);
  const progressPercent = adaptiveTasks.length ? Math.round((completedCount / adaptiveTasks.length) * 100) : 0;
  const levelProgress = Math.min(100, 20 + progressPercent);
  const currentMood = moodOptions.find((option) => option.value === moodLog?.mood) || null;
  const proofQueueCount = proofs.filter((proof) => proof.approval_status === 'pending').length;
  const latestProofs = proofs.slice(0, 3);
  const remainingTasks = Math.max(adaptiveTasks.length - completedCount, 0);

  const greetingMessage = timeOfDay === 'morning' ? `Good morning, ${childName}!` 
    : timeOfDay === 'afternoon' ? `Good afternoon, ${childName}!` 
    : `Good evening, ${childName}!`;
  const missedTaskAlert = timeOfDay === 'evening' && remainingTasks > 0;

  const themeSkins: Record<'birthday' | 'festival' | 'celebration' | 'custom' | 'default', {
    shellClass: string;
    backdropBase: string;
    backdropGlow: string;
    heroClass: string;
    subPanelClass: string;
    buttonClass: string;
    navShellClass: string;
    panelClass: string;
    accentCaptionClass: string;
  }> = {
    default: {
      shellClass: 'bg-[#090d1a] text-white',
      backdropBase: 'bg-[radial-gradient(circle_at_top,#1a2242_0%,#0d1328_48%,#080c18_100%)]',
      backdropGlow: 'bg-[radial-gradient(circle_at_18%_14%,rgba(59,130,246,0.12),transparent_26%),radial-gradient(circle_at_78%_20%,rgba(139,92,246,0.12),transparent_24%)]',
      heroClass: 'border-white/10 bg-[linear-gradient(160deg,rgba(21,28,52,0.96),rgba(20,25,46,0.95))] text-white',
      subPanelClass: 'border-white/10 bg-[#151b33]/88 text-white',
      buttonClass: 'border-white/15 bg-white/5 text-white hover:bg-white/10',
      navShellClass: 'border-white/10 bg-[linear-gradient(180deg,rgba(14,19,38,0.96),rgba(12,16,31,0.96))]',
      panelClass: 'border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] text-white',
      accentCaptionClass: 'text-sky-300/90'
    },
    birthday: {
      shellClass: 'bg-[#120917] text-white',
      backdropBase: 'bg-[radial-gradient(circle_at_top,#4a1d5f_0%,#1f1030_46%,#10081d_100%)]',
      backdropGlow: 'bg-[radial-gradient(circle_at_14%_16%,rgba(244,114,182,0.2),transparent_30%),radial-gradient(circle_at_84%_22%,rgba(251,191,36,0.18),transparent_30%)]',
      heroClass: 'border-pink-300/20 bg-[linear-gradient(160deg,rgba(94,28,84,0.82),rgba(50,20,62,0.86))] text-white',
      subPanelClass: 'border-pink-300/20 bg-[#341539]/85 text-white',
      buttonClass: 'border-pink-300/25 bg-white/10 text-white hover:bg-white/16',
      navShellClass: 'border-pink-300/20 bg-[linear-gradient(180deg,rgba(46,20,57,0.94),rgba(29,13,39,0.95))]',
      panelClass: 'border-pink-300/20 bg-[linear-gradient(180deg,rgba(57,26,68,0.9),rgba(34,16,45,0.93))] text-white',
      accentCaptionClass: 'text-amber-200'
    },
    festival: {
      shellClass: 'bg-[#15120a] text-white',
      backdropBase: 'bg-[radial-gradient(circle_at_top,#5b3a08_0%,#2a1906_52%,#120b05_100%)]',
      backdropGlow: 'bg-[radial-gradient(circle_at_16%_18%,rgba(251,191,36,0.22),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(249,115,22,0.18),transparent_28%)]',
      heroClass: 'border-amber-300/25 bg-[linear-gradient(160deg,rgba(94,58,12,0.85),rgba(62,36,10,0.88))] text-white',
      subPanelClass: 'border-amber-300/20 bg-[#3b270d]/86 text-white',
      buttonClass: 'border-amber-300/25 bg-white/10 text-white hover:bg-white/16',
      navShellClass: 'border-amber-300/20 bg-[linear-gradient(180deg,rgba(56,35,11,0.94),rgba(34,22,8,0.95))]',
      panelClass: 'border-amber-300/20 bg-[linear-gradient(180deg,rgba(68,43,14,0.9),rgba(43,27,9,0.92))] text-white',
      accentCaptionClass: 'text-amber-200'
    },
    celebration: {
      shellClass: 'bg-[#07131a] text-white',
      backdropBase: 'bg-[radial-gradient(circle_at_top,#0c3748_0%,#0a1e2b_50%,#07131a_100%)]',
      backdropGlow: 'bg-[radial-gradient(circle_at_16%_14%,rgba(45,212,191,0.2),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(56,189,248,0.2),transparent_28%)]',
      heroClass: 'border-cyan-300/20 bg-[linear-gradient(160deg,rgba(14,70,88,0.84),rgba(10,49,64,0.88))] text-white',
      subPanelClass: 'border-cyan-300/20 bg-[#103748]/86 text-white',
      buttonClass: 'border-cyan-300/25 bg-white/10 text-white hover:bg-white/16',
      navShellClass: 'border-cyan-300/20 bg-[linear-gradient(180deg,rgba(9,53,69,0.94),rgba(7,37,50,0.95))]',
      panelClass: 'border-cyan-300/20 bg-[linear-gradient(180deg,rgba(13,62,79,0.9),rgba(9,41,54,0.93))] text-white',
      accentCaptionClass: 'text-cyan-200'
    },
    custom: {
      shellClass: 'bg-[#100c1f] text-white',
      backdropBase: 'bg-[radial-gradient(circle_at_top,#2e1b52_0%,#181031_50%,#100c1f_100%)]',
      backdropGlow: 'bg-[radial-gradient(circle_at_16%_14%,rgba(99,102,241,0.2),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.18),transparent_28%)]',
      heroClass: 'border-violet-300/20 bg-[linear-gradient(160deg,rgba(45,30,88,0.85),rgba(28,20,62,0.89))] text-white',
      subPanelClass: 'border-violet-300/20 bg-[#241b46]/87 text-white',
      buttonClass: 'border-violet-300/25 bg-white/10 text-white hover:bg-white/16',
      navShellClass: 'border-violet-300/20 bg-[linear-gradient(180deg,rgba(33,24,67,0.95),rgba(22,17,45,0.95))]',
      panelClass: 'border-violet-300/20 bg-[linear-gradient(180deg,rgba(38,28,80,0.9),rgba(26,19,54,0.93))] text-white',
      accentCaptionClass: 'text-violet-200'
    }
  };
  const activeSkin = themeSkins[todaySpecialTheme || 'default'];
  const shellClass = activeSkin.shellClass;
  const backdropBase = activeSkin.backdropBase;
  const backdropGlow = activeSkin.backdropGlow;
  const heroClass = activeSkin.heroClass;
  const subPanelClass = activeSkin.subPanelClass;
  const buttonClass = activeSkin.buttonClass;
  const navShellClass = activeSkin.navShellClass;
  const panelClass = activeSkin.panelClass;
  const softTextClass = 'text-white/88';
  const mutedTextClass = 'text-white/72';
  const lowContrastTextClass = 'text-white/55';
  const accentCaptionClass = activeSkin.accentCaptionClass;
  const childTabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'quests', label: 'Quests', icon: MessageSquare },
    { id: 'planner', label: 'Planner', icon: CalendarDays },
    { id: 'diary', label: 'Diary', icon: ScrollText },
    { id: 'rewards', label: 'Rewards', icon: Gift },
    { id: 'money-pot', label: 'Money Pot', icon: PiggyBank },
    { id: 'profile', label: 'Profile', icon: Orbit }
  ] as const;

  const goToTab = (tab: ChildTab) => {
    const nextPath = tab === 'home' ? '/child' : `/child/${tab}`;
    try {
      localStorage.setItem(tabStorageKey, tab);
    } catch {}
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
      if (parentId) {
        const selectedMood = moodOptions.find((option) => option.value === value);
        await sendMessage(
          childId,
          parentId,
          `${childName} shared today's mood: ${selectedMood?.icon || ''} ${selectedMood?.label || value}.`,
          'child',
          childId
        );
      }
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
      try {
        localStorage.removeItem(`tiktrack_child_${childId}_diary_draft`);
      } catch {}
      setNotice('Diary note saved.');
    } catch (error) {
      console.error('Diary save failed:', error);
      setNotice('Diary note could not be saved right now.');
    }
  };

  const handleDiarySubmitForDate = async (dateKey: string, content: string) => {
    try {
      await addEntry(content, dateKey);
      setNotice(`Diary saved for ${new Date(dateKey).toLocaleDateString()}.`);
    } catch (error) {
      console.error('Diary save failed:', error);
      setNotice('Diary note could not be saved right now.');
    }
  };

  const handleQuestComplete = async (task: Task) => {
    try {
      await completeTask(task);
      setNotice(`Quest complete. ${task.star_value} stars added.`);
      setQuestCelebration({ title: task.title, stars: Number(task.star_value || 0) });
      setTimeout(() => setQuestCelebration(null), 1600);
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
      await markTaskPendingProof(pendingProofTask);
      setNotice(`Proof uploaded for ${pendingProofTask.title}. Waiting for parent approval.`);
    } catch (error) {
      console.error('Proof upload failed:', error);
      setNotice('Proof upload failed. You can retry from the upload banner.');
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
          'group rounded-[2rem] border p-5 shadow-[0_20px_60px_rgba(6,8,30,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(56,189,248,0.24)]',
          compact ? 'p-4' : 'p-5',
          isCompleted
            ? 'border-emerald-300/25 bg-[linear-gradient(135deg,rgba(20,83,45,0.45),rgba(17,24,39,0.88))]'
            : 'border-white/12 bg-[linear-gradient(135deg,rgba(27,33,61,0.96),rgba(19,24,44,0.94))]'
        )}
        style={{ position: 'relative' }}
      >
        <div className="absolute inset-0 rounded-[2rem] opacity-100 transition-opacity duration-300 group-hover:opacity-100" style={{ background: cardGlow }} />
        <div className="pointer-events-none absolute -inset-px rounded-[2rem] border border-cyan-300/0 transition-colors duration-300 group-hover:border-cyan-300/35" />
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
                  <span className="rounded-xl bg-white/8 px-3 py-1.5 font-bold text-white/72">
                    {item.task.category}
                  </span>
                </div>
              </div>
              {item.task.requires_proof ? (
                <button onClick={() => openProofPicker(item.task)} disabled={uploading || questSaving} className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#ffd95e,#ffb347)] px-5 py-3 text-base font-black text-slate-900 shadow-[0_10px_25px_rgba(251,191,36,0.28)] transition hover:brightness-105 disabled:opacity-60">
                  <Upload size={16} /> Upload Proof
                </button>
              ) : (
                <button onClick={() => void handleQuestComplete(item.task)} disabled={isCompleted || questSaving} className={clsx('rounded-2xl px-5 py-3 text-base font-black transition disabled:opacity-60', isCompleted ? 'bg-emerald-400/20 text-emerald-100' : 'bg-[linear-gradient(135deg,#d9ffd2,#ffe5cf)] text-slate-900 shadow-[0_10px_25px_rgba(250,204,21,0.14)] hover:brightness-105')}>
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
    handleDiarySubmitForDate,
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
    reminders,
    renderQuestCard,
    setDiaryDraft,
    softTextClass,
    tasks: adaptiveTasks,
    uploading,
    uploadProgress,
    retryProofUpload: retryUpload,
    hasPendingProofRetry: hasPendingRetry,
    events,
    parentId
  };

  return (
    <div className={clsx('min-h-screen overflow-x-hidden pb-24 lg:pb-12 relative', shellClass)}>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleProofFile(event)} />
      <div className={clsx('absolute inset-0', backdropBase)} />
      <div className={clsx('absolute inset-0 opacity-80', backdropGlow)} />
      
      {isInboxOpen && (
        <InboxPanel childId={childId} parentId={parentId} isDark={isDark} onClose={() => setIsInboxOpen(false)} />
      )}

      <div className="mx-auto max-w-[1680px] px-3 pb-10 pt-4 relative z-10 sm:px-5 lg:px-8 lg:pt-6">
        <div className={clsx('sticky top-3 z-30 mb-4 hidden gap-3 rounded-[1.35rem] border px-3 py-2 shadow-[0_16px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl md:flex md:flex-col xl:flex-row xl:items-center xl:justify-between', navShellClass)}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/8 text-sky-300">
              <UserRound size={17} />
            </div>
            <div>
              <p className={clsx('text-[10px] font-black uppercase tracking-[0.2em]', lowContrastTextClass)}>Explorer</p>
              <p className="text-sm font-black">{childName}</p>
            </div>
            <button onClick={handleLogout} className={clsx('rounded-2xl border px-4 py-2 text-sm font-bold shadow-sm transition', buttonClass)}>Logout</button>
            <button onClick={toggleTheme} className={clsx('inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold shadow-sm transition', buttonClass)}>
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              {theme === 'light' ? 'Dark sky' : 'Light sky'}
            </button>
          </div>

          <div className="flex rounded-[1.15rem] p-1">
            {childTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => goToTab(tab.id)} className={clsx('relative flex min-w-[92px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition', active ? 'bg-white/12 text-sky-200 shadow-sm' : lowContrastTextClass)}>
                  {tab.id === 'rewards' && rewardsAlert ? (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                  ) : null}
                  {tab.id === 'money-pot' && moneyPotAlert ? (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
                  ) : null}
                  <Icon size={17} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            <button onClick={() => setIsInboxOpen(true)} className={clsx('relative flex min-w-[92px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition', lowContrastTextClass)}>
              {messages.filter(m => !m.is_read).length > 0 && (
                <span className="absolute right-3 top-2 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
              <Mail size={17} />
              <span>Inbox</span>
            </button>
          </div>
        </div>

        {activeTab === 'home' && (
        <div className={clsx('rounded-[1.75rem] border p-4 shadow-[0_22px_70px_rgba(6,8,30,0.32)] backdrop-blur-xl sm:p-5 lg:p-6', heroClass)}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className={clsx('text-[11px] uppercase tracking-[0.14em] font-black', accentCaptionClass)}>Today is your quest day</p>
              <h1 className="mt-2 text-[2rem] sm:text-[2.3rem] xl:text-[2.75rem] font-display font-extrabold leading-[1.08]">{greetingMessage} <span className="inline-block align-middle">😊</span></h1>
              {remainingTasks === 0 && adaptiveTasks.length > 0 ? (
                <div className="mt-4 inline-flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-600 shadow-lg shadow-emerald-500/20 dark:text-emerald-400">
                  <span className="text-xl animate-bounce">🌟</span> Perfect day! You finished every quest.
                </div>
              ) : missedTaskAlert ? (
                <p className={clsx('mt-3 max-w-3xl rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-bold leading-6 text-rose-500')}>Some quests are still open. Try finishing one before bedtime.</p>
              ) : (
                <p className={clsx('mt-3 max-w-3xl text-sm leading-6', softTextClass)}>Pick a small win, collect stars, and keep your adventure moving.</p>
              )}
            </div>
            <div className="hidden h-16 w-16 place-items-center rounded-[1.4rem] border border-white/15 bg-white/8 text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:grid xl:h-20 xl:w-20">
              <Sparkles size={28} />
            </div>
          </div>

          {examStats.nearestExam && examStats.daysRemaining <= 14 && (
            <div className={clsx(
              'mt-6 rounded-2xl border px-5 py-4 flex items-center justify-between shadow-xl animate-in fade-in slide-in-from-top-4 duration-700 relative z-20',
              isDark
                ? examStats.daysRemaining <= 3
                  ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
                  : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
                : examStats.daysRemaining <= 3
                  ? 'border-rose-300 bg-rose-50 text-rose-900'
                  : 'border-amber-300 bg-amber-50 text-amber-900'
            )}>
              <div className="flex items-center gap-4">
                <div className={clsx('grid h-12 w-12 place-items-center rounded-xl', examStats.daysRemaining <= 3 ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20')}>
                  <ScrollText size={22} />
                </div>
                <div>
                  <p className={clsx('font-black text-lg', isDark ? 'text-white' : 'text-slate-900')}>{examStats.nearestExam.title} Challenge</p>
                  <p className={clsx('text-sm', isDark ? 'opacity-80 text-white/90' : 'text-slate-700')}>
                    {examStats.daysRemaining === 0 ? "Today is the big day! Good luck!" : examStats.daysRemaining === 1 ? "Exam is tomorrow! Light day mode active." : `${examStats.daysRemaining} days remaining for your challenge.`}
                  </p>
                </div>
              </div>
              <div className={clsx('text-right hidden sm:block', isDark ? 'text-white' : 'text-slate-900')}>
                <p className="text-2xl font-black">{examStats.daysRemaining}d</p>
                <p className={clsx('text-[10px] uppercase tracking-widest font-bold', isDark ? 'opacity-60' : 'text-slate-600')}>Countdown</p>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3 md:hidden">
            <button onClick={handleLogout} className={clsx('rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm transition', buttonClass)}>Logout</button>
            <button onClick={toggleTheme} className={clsx('inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm transition', buttonClass)}>
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              {theme === 'light' ? 'Dark sky' : 'Light sky'}
            </button>
            <div className="ml-auto rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm font-bold text-white/80">Profile: {childName}</div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.2rem] border border-white/12 bg-white/[0.04] px-4 py-3.5 text-white shadow-[0_10px_24px_rgba(2,6,23,0.25)]">
              <div className="flex items-center justify-center gap-2 text-sky-300"><Star className="fill-current" size={18} /><span className="text-[1.65rem] font-black">{profile.total_stars ?? 0}</span></div>
              <p className="mt-1 text-center text-[11px] font-black uppercase tracking-[0.14em]">Stars</p>
              <p className="mt-1 text-center text-[11px] font-semibold text-white/75">
                {earnedToday > 0 ? `${earnedToday} earned today` : 'No stars earned today'}
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/12 bg-white/[0.04] px-4 py-3.5 text-white shadow-[0_10px_24px_rgba(2,6,23,0.25)]">
              <div className="flex items-center justify-center gap-2 text-sky-300"><Flame className="fill-current" size={18} /><span className="text-[1.65rem] font-black">{profile.streak_count ?? 0}</span></div>
              <p className="mt-1 text-center text-[11px] font-black uppercase tracking-[0.14em]">Streak</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/12 bg-white/[0.04] px-4 py-3.5 text-white shadow-[0_10px_24px_rgba(2,6,23,0.25)]">
              <div className="flex items-center justify-center gap-2 text-sky-300"><Shield className="fill-current" size={18} /><span className="text-[1.65rem] font-black">{profile.streak_shields ?? 0}</span></div>
              <p className="mt-1 text-center text-[11px] font-black uppercase tracking-[0.14em]">Shields</p>
            </div>
          </div>

          {activeChallenges.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="ml-1 text-[11px] font-black uppercase tracking-[0.14em] text-sky-300">Active Challenges</h3>
              {activeChallenges.filter(ch => ch.child_id === childId).map((ch) => (
                <div key={ch.id} className="rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-5 py-4 shadow-[0_10px_24px_rgba(2,6,23,0.25)]">
                  <p className="text-base font-bold">{ch.title}</p>
                  {ch.description && <p className={clsx('mt-1 text-sm leading-6', mutedTextClass)}>{ch.description}</p>}
                  <div className="mt-3 flex items-center gap-4">
                    <div className="flex-1">
                      <p className={clsx('text-xs font-bold', mutedTextClass)}>You: {ch.child_score}/{ch.target_score}</p>
                      <div className={clsx('h-3 rounded-full mt-1', isDark ? 'bg-white/10' : 'bg-indigo-100')}>
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#ec4899,#f472b6)] transition-all" style={{ width: `${Math.min(100, (ch.child_score / ch.target_score) * 100)}%` }} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className={clsx('text-xs font-bold', mutedTextClass)}>Parent: {ch.parent_score}/{ch.target_score}</p>
                      <div className={clsx('h-3 rounded-full mt-1', isDark ? 'bg-white/10' : 'bg-indigo-100')}>
                        <div className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#6366f1)] transition-all" style={{ width: `${Math.min(100, (ch.parent_score / ch.target_score) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => void incrementChallengeScore(ch.id, 'child')} className="mt-3 rounded-xl bg-[linear-gradient(135deg,#ec4899,#8b5cf6)] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white shadow-md transition hover:brightness-110">+1 My Score</button>
                </div>
              ))}
            </div>
          )}

          <div className={clsx('mt-5 rounded-[1.35rem] border p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]', subPanelClass)}>
            <div className={clsx('flex flex-wrap items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.14em]', softTextClass)}>
              <span>Adventure Meter</span>
              <div className="flex items-center gap-3"><span className={isDark ? 'text-amber-200' : 'text-amber-500'}>{'★'.repeat(Math.max(1, Math.min(5, Math.ceil(progressPercent / 20) || 1)))}</span><span>{progressPercent}%</span></div>
            </div>
            <div className="mt-4 h-4 rounded-full bg-white/10 p-1">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#5ee7ff_0%,#7c83ff_55%,#ff7bc0_100%)] transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>
        )}

        {uploading && (
          <div className={clsx('mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_10px_25px_rgba(14,165,233,0.12)]', isDark ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100' : 'border-cyan-200 bg-cyan-50 text-cyan-700')}>
            <p>Uploading proof... {uploadProgress}%</p>
            <div className={clsx('mt-2 h-2 rounded-full', isDark ? 'bg-white/10' : 'bg-cyan-100')}>
              <div className="h-2 rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa)] transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}

        {!uploading && hasPendingRetry ? (
          <div className={clsx('mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_10px_25px_rgba(251,191,36,0.18)]', isDark ? 'border-amber-300/25 bg-amber-400/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-700')}>
            <p>Proof upload interrupted. Retry when ready.</p>
            <button onClick={() => void retryUpload()} className="mt-2 rounded-xl bg-amber-400/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em]">
              Retry Upload
            </button>
          </div>
        ) : null}

        {questCelebration ? (
          <div className={clsx('mt-4 rounded-2xl border px-4 py-3 text-sm font-black shadow-[0_12px_30px_rgba(16,185,129,0.2)] animate-pulse', isDark ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
            Quest complete: {questCelebration.title} • +{questCelebration.stars} stars
          </div>
        ) : null}

        {notice && <div className={clsx('mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_10px_25px_rgba(14,165,233,0.12)]', isDark ? 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100' : 'border-cyan-200 bg-cyan-50 text-cyan-700')}>{notice}</div>}

        <Outlet context={contextValue} />

        <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg md:hidden">
          <div className={clsx('flex gap-1 overflow-x-auto rounded-[1.6rem] border px-2 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl', navShellClass)}>
            {childTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => goToTab(tab.id)} className={clsx('relative min-w-[72px] shrink-0 flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5', active ? (isDark ? 'bg-white/10 text-cyan-300' : 'bg-white text-cyan-600') : lowContrastTextClass)}>
                  {tab.id === 'rewards' && rewardsAlert ? (
                    <span className="absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                  ) : null}
                  {tab.id === 'money-pot' && moneyPotAlert ? (
                    <span className="absolute right-2 top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
                  ) : null}
                  <Icon size={20} />
                  <span className="text-[11px] font-black">{tab.label}</span>
                </button>
              );
            })}
            <button onClick={() => setIsInboxOpen(true)} className={clsx('relative min-w-[72px] shrink-0 flex flex-col items-center gap-1 rounded-2xl px-2 py-1.5', lowContrastTextClass)}>
              {messages.filter(m => !m.is_read).length > 0 && (
                <span className="absolute right-3 top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
              <Mail size={20} />
              <span className="text-[11px] font-black">Inbox</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
