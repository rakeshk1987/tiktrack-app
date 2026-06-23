import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Circle,
  Gift,
  Home,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sun,
  TrendingUp,
  Users2,
  X
} from 'lucide-react';
import clsx from 'clsx';
import GrowthChart from '../../components/insights/GrowthChart';
import AcademicHeatmap from '../../components/insights/AcademicHeatmap';
import { createOrReuseChildAccount } from '../../utils/childAccountAuth';
import { computeLevelFromStars, evaluateBadges, applyTaskCompletionToProfile } from '../../hooks/useCoreLogic';
import { useMessages } from '../../hooks/useData';
import { useChallenges } from '../../hooks/useChallenges';
import { signOut } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { activeFirebaseEnv, auth, db, isUsingFirebaseEmulators } from '../../config/firebase';
import { RealTimeProvider } from '../../contexts/RealTimeContext';
import RealTimeNotifications from '../../components/RealTimeNotifications';
import RoutineConfigurationUI from '../../components/RoutineConfigurationUI';
import TaskSchedulerUI from '../../components/TaskSchedulerUI';
import ReminderManagement from '../../components/ReminderManagement';
import RewardManagement from '../../components/RewardManagement';
import RedemptionHistory from '../../components/RedemptionHistory';
import { useRoutineConfiguration } from '../../hooks/useRoutineConfiguration';
import { useTaskScheduler } from '../../hooks/useTaskScheduler';
import { getDefaultReminders, useReminders } from '../../hooks/useReminders';
import { getDefaultRewards, useRedemptions, useRewards } from '../../hooks/useRedemptions';
import { createRewardLedgerEntry, getRewardLedgerMonthSummary, useRewardLedger } from '../../hooks/useRewardLedger';
import { awardScratchRewardForTrigger, useScratchRewards } from '../../hooks/useScratchRewards';
import { useApprovals } from '../../hooks/useApprovals';
import type { ChildProfile, Event as AppEvent, ExamResult, Reminder, RewardItem } from '../../types/schema';
import { ParentPlannerV2Page } from '../../features/planner';
import { usePlannerPrograms } from '../../features/planner/hooks/usePlannerPrograms';
import { mapPlannerProgram, upsertPlannerProgram } from '../../features/planner/services/planner.firestore';
import { useSickMode } from '../../hooks/useSickMode';
import { RoutineManagement } from '../../components/parent/RoutineManagement';
import { ApprovalsManagement } from '../../components/parent/ApprovalsManagement';
import type { PlannerActivityModule, PlannerProgram, PlannerSubject } from '../../features/planner/types/planner.types';
import { usePlannerTimetable } from '../../features/planner/hooks/usePlannerTimetable';
import { usePlannerSubjects } from '../../features/planner/hooks/usePlannerSubjects';
import { usePlannerChallenges } from '../../features/planner/hooks/usePlannerChallenges';
import { calculateCashReward, DEFAULT_STAR_PAYOUT_PERCENTAGES, fetchCashRewardSettings, normalizeRewardSettings } from '../../utils/rewards';

type ActivityDetailKind = 'task' | 'exam' | 'event';

function subjectMatchesStoredValue(subject: PlannerSubject, value?: string | null): boolean {
  return Boolean(value && (value === subject.id || value === subject.name));
}

function splitStoredList(value?: string | null): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const ACTIVITY_FILTER_PALETTE = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#f59e0b',
  '#fb7185',
  '#22d3ee',
  '#f472b6',
  '#84cc16'
];

const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

interface ChildAccount {
  id: string;
  name?: string;
  email?: string;
}

interface PendingProof {
  id: string;
  child_id?: string;
  task_id?: string;
  task_title?: string;
  image_url?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  timestamp?: string;
}

interface ChildSubmission {
  id: string;
  child_id?: string;
  title?: string;
  type?: string;
  date?: string;
  description?: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

const toInputDateTimeLocal = (value: string | null | undefined): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const toInputDate = (value: string | null | undefined): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
};

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHILD_AVATARS = ['🦊', '🐯', '🦁', '🐼', '🧠', '🚀', '🌟', '🐬'];
const NUDGE_TEMPLATES = [
  'You have got this. Pick one small win and start there.',
  'I am proud of you. Finish one quest and take a tiny break.',
  'Drink some water, breathe, and then try the next task.',
  'Start with the easiest thing on your list. Momentum counts.',
  'Take a 5-minute reset, then come back strong.'
];
const CHILD_COMMUNICATION_STYLES: Array<{ id: NonNullable<ChildProfile['communication_style']>; label: string }> = [
  { id: 'cheerful', label: 'Cheerful' },
  { id: 'calm', label: 'Calm' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'short', label: 'Short' }
];

interface ChildEditForm {
  name: string;
  petName: string;
  avatarEmoji: string;
  interests: string;
  profileMotto: string;
  communicationStyle: NonNullable<ChildProfile['communication_style']>;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
}

interface FirestoreBackupDocument {
  collection: string;
  id: string;
  data: Record<string, unknown>;
}

interface FirestoreBackupPayload {
  app: 'TikTrack';
  schemaVersion: 1;
  familyId: string;
  exportedAt: string;
  exportedBy: string;
  documents: FirestoreBackupDocument[];
}

const FAMILY_BACKUP_COLLECTIONS = [
  'achievements',
  'approvals',
  'challenges',
  'diary_entries',
  'events',
  'exam_results',
  'exams',
  'growth_logs',
  'messages',
  'money_pot_entries',
  'money_pot_targets',
  'mood_logs',
  'planner_subjects',
  'programs',
  'proof_logs',
  'realtime_messages',
  'redemptions',
  'reminder_logs',
  'reminders',
  'reward_items',
  'reward_ledger',
  'reward_settings',
  'routine_configurations',
  'routine_logs',
  'routines',
  'school_timetables',
  'scratch_reward_templates',
  'scratch_rewards',
  'settlements',
  'sick_periods',
  'special_dates',
  'task_logs',
  'tasks',
  'telegram_link_codes',
  'telegram_settings'
];

const BACKUP_QUERY_FIELDS = ['family_id', 'parent_id', 'child_id'];

function activityItemTitle(kind: ActivityDetailKind, item: any): string {
  if (kind === 'exam') return String(item.subject || item.title || 'Exam');
  return String(item.title || 'Untitled');
}

function activityItemDate(kind: ActivityDetailKind, item: any): string | null {
  if (kind === 'task') return item.due_date || item.end_date || item.created_at || null;
  if (kind === 'exam') return item.exam_date || item.date || item.created_at || null;
  return item.date || item.start_at || item.created_at || null;
}

function activityRecurrenceLabel(item: any): string {
  const type = item.recurrence_type || 'none';
  if (type === 'daily') return 'Repeats daily';
  if (type === 'weekly') {
    const days = Array.isArray(item.recurrence_days) ? item.recurrence_days : [];
    return days.length ? `Repeats weekly on ${days.map((day: number) => WEEKDAY_NAMES[day] || '').filter(Boolean).join(', ')}` : 'Repeats weekly';
  }
  if (type === 'monthly') return 'Repeats monthly';
  return 'One time';
}

function activityNextDate(kind: ActivityDetailKind, item: any, from = new Date()): Date | null {
  const rawDate = activityItemDate(kind, item);
  if (!rawDate) return null;
  const base = new Date(rawDate);
  if (isNaN(base.getTime())) return null;
  const recurrence = item.recurrence_type || 'none';
  if (recurrence === 'none') return base.getTime() >= from.getTime() ? base : null;

  const candidate = new Date(base);
  const endLimit = item.expires_at || null;
  const until = endLimit ? new Date(endLimit) : null;

  for (let i = 0; i < 370; i += 1) {
    if (candidate.getTime() >= from.getTime()) {
      if (until && candidate.getTime() > until.getTime()) return null;
      return candidate;
    }
    if (recurrence === 'daily') {
      candidate.setDate(candidate.getDate() + 1);
    } else if (recurrence === 'weekly') {
      const days = Array.isArray(item.recurrence_days) && item.recurrence_days.length ? item.recurrence_days : [base.getDay()];
      const next = new Date(candidate);
      next.setDate(next.getDate() + 1);
      while (!days.includes(next.getDay()) && next.getTime() <= from.getTime() + 366 * 86400000) {
        next.setDate(next.getDate() + 1);
      }
      candidate.setTime(next.getTime());
    } else if (recurrence === 'monthly') {
      candidate.setMonth(candidate.getMonth() + 1);
    } else {
      return null;
    }
  }
  return null;
}

function activityExpiryStatus(kind: ActivityDetailKind, item: any): string {
  if (item.status === 'expired') return 'Expired';
  if (item.expires_at && new Date(item.expires_at).getTime() < Date.now()) return 'Expired';
  return activityNextDate(kind, item) ? 'Active' : 'Expired';
}

function taskWindowState(task: any, now = new Date()): 'past' | 'future' | 'active' {
  const availableFrom = task.available_from || task.due_date || null;
  const expiresAt = task.expires_at || task.end_date || null;
  const startTime = availableFrom ? new Date(availableFrom).getTime() : null;
  const endTime = expiresAt ? new Date(expiresAt).getTime() : null;
  const nowTime = now.getTime();

  if (task.status === 'completed' || task.status === 'expired' || task.status === 'failed') return 'past';
  if (endTime && endTime < nowTime) return 'past';
  if (startTime && startTime > nowTime) return 'future';
  return 'active';
}

function createTelegramLinkCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function normalizeBackupValue(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { __type: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof Date) {
    return { __type: 'date', iso: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(normalizeBackupValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, normalizeBackupValue(nested)]));
  }
  return value;
}

function restoreBackupValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(restoreBackupValue);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.__type === 'timestamp' && typeof record.seconds === 'number') {
      return new Timestamp(record.seconds, typeof record.nanoseconds === 'number' ? record.nanoseconds : 0);
    }
    if (record.__type === 'date' && typeof record.iso === 'string') {
      return new Date(record.iso);
    }
    return Object.fromEntries(Object.entries(record).map(([key, nested]) => [key, restoreBackupValue(nested)]));
  }
  return value;
}

function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ParentDashboardContent() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const setSuccess = useCallback((msg: string) => addToast(msg, 'success'), [addToast]);
  const setInfo = useCallback((msg: string) => addToast(msg, 'info'), [addToast]);

  const [isModaling, setIsModaling] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [cUser, setCUser] = useState('');
  const [cName, setCName] = useState('');
  const [cPass, setCPass] = useState('');
  const [cDob, setCDob] = useState('');
  const [cHeight, setCHeight] = useState('');
  const [cWeight, setCWeight] = useState('');
  const [childRegistering, setChildRegistering] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [examLoading, setExamLoading] = useState(false);
  const [growthLoading2, setGrowthLoading2] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);
  const [rewardLoading, setRewardLoading] = useState(false);
  const [error, setError] = useState(''); // keep for inline form field errors only
  const [children, setChildren] = useState<ChildAccount[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(true);
  const [pendingProofs, setPendingProofs] = useState<PendingProof[]>([]);
  const [proofReviewComment, setProofReviewComment] = useState('');
  const [pendingChildTasks, setPendingChildTasks] = useState<ChildSubmission[]>([]);
  const [pendingChildEvents, setPendingChildEvents] = useState<ChildSubmission[]>([]);
  const [pendingAchievements, setPendingAchievements] = useState<ChildSubmission[]>([]);
  const [tasks, setTasks] = useState<Array<any>>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tPoints, setTPoints] = useState<number | ''>('');
  const [tPerformanceStars, setTPerformanceStars] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [tDue, setTDue] = useState('');
  const [tRecurrenceType, setTRecurrenceType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [tRecurrenceDays, setTRecurrenceDays] = useState<number[]>([]);
  const [tMandatory, setTMandatory] = useState(false);
  const [tNotifyParentOnMiss, setTNotifyParentOnMiss] = useState(true);
  const [tNotifyChildOnMiss, setTNotifyChildOnMiss] = useState(true);
  const [tReduceStarsOnMiss, setTReduceStarsOnMiss] = useState(false);
  const [tStarPenalty, setTStarPenalty] = useState<number | ''>('');
  const [tChild, setTChild] = useState('');
  const [tActivityId, setTActivityId] = useState('');
  const [tEndDate, setTEndDate] = useState('');
  const [tSubjectId, setTSubjectId] = useState('');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [exams, setExams] = useState<Array<any>>([]);
  const [examsLoading, setExamsLoading] = useState(true);
  const [eChild, setEChild] = useState('');
  const [eSubjects, setESubjects] = useState<string[]>([]);
  const [eSubjectIds, setESubjectIds] = useState<string[]>([]);
  const [eRecurrenceType, setERecurrenceType] = useState<'none' | 'daily' | 'weekly'>('none');
  const [eRecurrenceDays, setERecurrenceDays] = useState<number[]>([]);
  const [eType, setEType] = useState<'weekly_test' | 'unit_test' | 'midterm' | 'final' | 'practice' | 'other'>('weekly_test');
  const [eMarks, setEMarks] = useState<number | ''>('');
  const [eTotal, setETotal] = useState<number | ''>('');
  const [eDate, setEDate] = useState('');
  const [eActivityId, setEActivityId] = useState('');
  const [eSyllabusScope, setESyllabusScope] = useState('');
  const [ePoints, setEPoints] = useState<number | ''>('');
  const [showExamModal, setShowExamModal] = useState(false);
  const [editExamId, setEditExamId] = useState<string | null>(null);
  const [filterChild, setFilterChild] = useState<string>('');
  const [examFilterMonth, setExamFilterMonth] = useState(() => String(new Date().getMonth()));
  const [examFilterYear, setExamFilterYear] = useState(() => String(new Date().getFullYear()));
  const [growthLogs, setGrowthLogs] = useState<Array<any>>([]);
  const [growthLoading, setGrowthLoading] = useState(true);
  const [gChild, setGChild] = useState('');
  const [gHeight, setGHeight] = useState<number | ''>('');
  const [gWeight, setGWeight] = useState<number | ''>('');
  const [gDate, setGDate] = useState('');
  const [editGrowthId, setEditGrowthId] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<any>>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [evChild, setEvChild] = useState('');
  const [evActivityId, setEvActivityId] = useState('');
  const [evTitle, setEvTitle] = useState('');
  const [evType, setEvType] = useState('event');
  const [evDate, setEvDate] = useState('');
  const [evReminderDays, setEvReminderDays] = useState<number | ''>('');
  const [evDesc, setEvDesc] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<Array<any>>([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);
  const [rStarRate, setRStarRate] = useState<number | ''>('');
  const [rCurrencySymbol, setRCurrencySymbol] = useState('₹');
  const [rPayoutPercentages, setRPayoutPercentages] = useState<Record<1 | 2 | 3 | 4 | 5, number>>({ ...DEFAULT_STAR_PAYOUT_PERCENTAGES });
  const [rWeeklyBonus, setRWeeklyBonus] = useState(false);
  const [editRewardId, setEditRewardId] = useState<string | null>(null);
  const [awardChildId, setAwardChildId] = useState('');
  const [awardStars, setAwardStars] = useState<number | ''>('');
  const [awardReason, setAwardReason] = useState('');
  const [awardSurprise, setAwardSurprise] = useState(true);
  const [awardSaving, setAwardSaving] = useState(false);
  const [settleChildId, setSettleChildId] = useState('');
  const [settleSaving, setSettleSaving] = useState(false);
  const [scratchChildId, setScratchChildId] = useState('');
  const [scratchTitle, setScratchTitle] = useState('Scratch surprise');
  const [scratchRevealType, setScratchRevealType] = useState<'scratch' | 'wheel'>('scratch');
  const [scratchPrizeType, setScratchPrizeType] = useState<'stars' | 'cash' | 'book' | 'toy' | 'treat' | 'custom'>('cash');
  const [scratchStars, setScratchStars] = useState<number | ''>(10);
  const [scratchPrizeLabel, setScratchPrizeLabel] = useState('₹10');
  const [scratchWheelSegments, setScratchWheelSegments] = useState<string[]>(['₹5', '₹10', 'Treat', 'Book', 'Bonus stars', 'Try again']);
  const [scratchReason, setScratchReason] = useState('');
  const [scratchSaving, setScratchSaving] = useState(false);
  const [scratchTemplateChildId, setScratchTemplateChildId] = useState('');
  const [scratchTemplateTitle, setScratchTemplateTitle] = useState('Task completion scratch');
  const [scratchTemplateTrigger, setScratchTemplateTrigger] = useState<'task_completion' | 'random_task' | 'streak' | 'perfect_exam'>('task_completion');
  const [scratchTemplateRevealType, setScratchTemplateRevealType] = useState<'scratch' | 'wheel'>('scratch');
  const [scratchTemplatePrizeType, setScratchTemplatePrizeType] = useState<'stars' | 'cash' | 'book' | 'toy' | 'treat' | 'custom'>('cash');
  const [scratchTemplateStars, setScratchTemplateStars] = useState<number | ''>(10);
  const [scratchTemplatePrizeLabel, setScratchTemplatePrizeLabel] = useState('₹10');
  const [scratchTemplateWheelSegments, setScratchTemplateWheelSegments] = useState<string[]>(['₹5', '₹10', 'Treat', 'Book', 'Bonus stars', 'Try again']);
  const [scratchTemplateSaving, setScratchTemplateSaving] = useState(false);

  const { initiateSickPeriod, getActiveSickPeriod } = useSickMode(user?.id || '');
  const [isSickModalOpen, setIsSickModalOpen] = useState(false);
  const [sickTargetChild, setSickTargetChild] = useState('');
  const [sickStartDate, setSickStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [sickEndDate, setSickEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [sickReason, setSickReason] = useState('');
  const [isNudgeModalOpen, setIsNudgeModalOpen] = useState(false);
  const [nudgeChildId, setNudgeChildId] = useState('');
  const [nudgeMessage, setNudgeMessage] = useState('');

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'family' | 'tasks' | 'approvals' | 'events' | 'rewards' | 'exams' | 'challenges' | 'automation' | 'communication' | 'settings' | 'planner' | 'routines'
  >('dashboard');
  const plannerTabIds = ['planner', 'family', 'tasks', 'exams', 'challenges', 'events', 'automation'] as const;
  const topLevelActiveTab: 'dashboard' | 'planner' | 'routines' | 'approvals' | 'rewards' | 'communication' | 'settings' = plannerTabIds.includes(activeTab as (typeof plannerTabIds)[number])
    ? 'planner'
    : (activeTab as 'dashboard' | 'routines' | 'approvals' | 'rewards' | 'communication' | 'settings');
  const [coParentCode, setCoParentCode] = useState('');
  const [telegramLinkCode, setTelegramLinkCode] = useState('');
  const [telegramLinkExpiresAt, setTelegramLinkExpiresAt] = useState('');
  const [telegramLinkGenerating, setTelegramLinkGenerating] = useState(false);
  const [telegramBotUsername, setTelegramBotUsername] = useState('');
  const [telegramSettingsSaving, setTelegramSettingsSaving] = useState(false);
  const [inboxMessage, setInboxMessage] = useState('');
  const [inboxSubject, setInboxSubject] = useState('');
  const [inboxChildId, setInboxChildId] = useState('');
  const [settingsTab, setSettingsTab] = useState<'manage_child' | 'rewards' | 'growth' | 'telegram' | 'coparenting' | 'backup_restore'>('manage_child');
  const [backupWorking, setBackupWorking] = useState(false);
  const [restoreWorking, setRestoreWorking] = useState(false);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childEditForm, setChildEditForm] = useState<ChildEditForm>({
    name: '',
    petName: '',
    avatarEmoji: CHILD_AVATARS[0],
    interests: '',
    profileMotto: '',
    communicationStyle: 'cheerful',
    dateOfBirth: '',
    heightCm: '',
    weightKg: ''
  });
  const [childEditSaving, setChildEditSaving] = useState(false);

  const [chTitle, setChTitle] = useState('');
  const [chChild, setChChild] = useState('');
  const [chActivityId, setChActivityId] = useState('');
  const [chTarget, setChTarget] = useState<number | ''>('');
  const [chDesc, setChDesc] = useState('');
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [automationChildId, setAutomationChildId] = useState('');
  const [activityChildId, setActivityChildId] = useState('');
  const [activityName, setActivityName] = useState('');
  const [activityStartDate, setActivityStartDate] = useState('');
  const [activityEndDate, setActivityEndDate] = useState('');
  const [activityModules, setActivityModules] = useState<PlannerActivityModule[]>(['tasks', 'exams', 'subjects']);
  const [activityTaskPoints, setActivityTaskPoints] = useState<number | ''>('');
  const [activityExamPoints, setActivityExamPoints] = useState<number | ''>('');
  const [activityChallengePoints, setActivityChallengePoints] = useState<number | ''>('');
  const [activityEventPoints, setActivityEventPoints] = useState<number | ''>('');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<PlannerProgram | null>(null);
  const [selectedActivityDetail, setSelectedActivityDetail] = useState<{ kind: ActivityDetailKind; item: any } | null>(null);
  const [activityModalTab, setActivityModalTab] = useState<PlannerActivityModule>('tasks');
  const [allPlannerPrograms, setAllPlannerPrograms] = useState<PlannerProgram[]>([]);
  const [showArchivedActivities, setShowArchivedActivities] = useState(false);
  const [taskActivityFilter, setTaskActivityFilter] = useState('all');
  const [examActivityFilter, setExamActivityFilter] = useState('all');
  const [eventActivityFilter, setEventActivityFilter] = useState('all');
  const [challengeActivityFilter, setChallengeActivityFilter] = useState('all');

  const parentTabs = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: Home },
    { id: 'planner', label: 'Planner', shortLabel: 'Plan', icon: CalendarDays },
    { id: 'routines', label: 'Routines', shortLabel: 'Routine', icon: Activity },
    { id: 'rewards', label: 'Rewards', shortLabel: 'Rewards', icon: Gift },
    { id: 'approvals', label: 'Approvals', shortLabel: 'Review', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings }
  ] as const;

  const plannerWorkspaceTabs = [
    { id: 'planner', label: 'Main Planner', shortLabel: 'Calendar' },
    { id: 'family', label: 'Kid Activities', shortLabel: 'Activities' },
    { id: 'tasks', label: 'Tasks / Duties', shortLabel: 'Tasks' },
    { id: 'exams', label: 'Exams / Tests', shortLabel: 'Exams' },
    { id: 'challenges', label: 'Challenges', shortLabel: 'Challenges' },
    { id: 'events', label: 'Events', shortLabel: 'Events' },
    { id: 'automation', label: 'Automation', shortLabel: 'Auto' }
  ] as const;

  const familyId = user?.linked_family_id || user?.id || '';
  const belongsToFamily = (row: any) => {
    if (!row) return false;
    return (
      row.family_id === familyId ||
      row.parent_id === familyId ||
      row.parent_id === user?.id ||
      (row.child_id && children.some((child) => child.id === row.child_id))
    );
  };
  const { messages: inboxMessages, sendMessage, markAsRead } = useMessages(familyId, 'parent');
  const { approvals: topLevelApprovals } = useApprovals(familyId);
  
  const unreadMessagesCount = useMemo(() => inboxMessages.filter(m => m.sender_role === 'child' && !m.is_read).length, [inboxMessages]);
  const pendingApprovalCount = useMemo(() => {
    const groupedPending = new Set<string>();
    topLevelApprovals
      .filter((approval) => approval.status === 'pending')
      .forEach((approval) => {
        const submittedDate = new Date(approval.created_at).toISOString().slice(0, 10);
        groupedPending.add([
          approval.child_id,
          approval.type,
          approval.reference_id || approval.title,
          submittedDate,
        ].join('|'));
      });

    return groupedPending.size;
  }, [topLevelApprovals]);

  const openParentChat = useCallback(() => {
    const latestUnread = inboxMessages
      .filter((message) => message.sender_role === 'child' && !message.is_read)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    const fallbackChildId = inboxChildId || latestUnread?.child_id || children[0]?.id || '';
    if (fallbackChildId) {
      setInboxChildId(fallbackChildId);
    }
    setActiveTab('communication');
  }, [children, inboxChildId, inboxMessages]);

  const openNudgeModal = useCallback(() => {
    setNudgeChildId((prev) => prev || children[0]?.id || '');
    setNudgeMessage((prev) => prev || 'You have got this. Pick one small win and start there.');
    setIsNudgeModalOpen(true);
  }, [children]);

  useEffect(() => {
    if (activeTab === 'communication' && inboxChildId) {
      const unread = inboxMessages.filter(m => (m.child_id === inboxChildId || m.parent_id === inboxChildId) && m.sender_role === 'child' && !m.is_read);
      unread.forEach(m => {
        void markAsRead(m.id);
      });
    }
  }, [activeTab, inboxChildId, inboxMessages, markAsRead]);
  const selectedThread = inboxMessages
    .filter((m) => !inboxChildId || m.child_id === inboxChildId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const { activeChallenges, completedChallenges, createChallenge, incrementScore, deleteChallenge } = useChallenges(familyId);
  const selectedActivityChildId = activityChildId || children[0]?.id || '';
  const { programs: activityPrograms, archivedPrograms: archivedActivityPrograms, loading: activityProgramsLoading, refresh: refreshActivityPrograms } = usePlannerPrograms(selectedActivityChildId);
  const { timetable: selectedChildTimetable } = usePlannerTimetable(selectedActivityChildId, false);
  const { challenges: activityChallenges, incrementScore: incrementActivityChallengeScore, createChallenge: createActivityChallenge } = usePlannerChallenges(selectedActivityChildId, selectedActivity?.id);
  const { subjects: activitySubjects, addSubject: addActivitySubject, removeSubject: removeActivitySubject, updateSubject: updateActivitySubject } = usePlannerSubjects(selectedActivityChildId, selectedActivity?.id);
  const { programs: examPrograms } = usePlannerPrograms(eChild);
  const { programs: taskPrograms } = usePlannerPrograms(tChild);
  const { programs: eventPrograms } = usePlannerPrograms(evChild);
  const { programs: chPrograms } = usePlannerPrograms(chChild);
  const { subjects: examSubjects } = usePlannerSubjects(eChild, eActivityId);
  const { subjects: taskSubjects } = usePlannerSubjects(tChild, tActivityId);
  const [newSubName, setNewSubName] = useState('');
  const [newSubTeacher, setNewSubTeacher] = useState('');
  const [newSubInExam, setNewSubInExam] = useState(true);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);

  const renderWheelSegmentEditor = (
    segments: string[],
    setSegments: Dispatch<SetStateAction<string[]>>
  ) => (
    <div className="rounded-2xl border p-3 sm:col-span-2 xl:col-span-full" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Wheel options</p>
        <button
          type="button"
          onClick={() => setSegments((current) => [...current, ''])}
          disabled={segments.length >= 12}
          className="rounded-lg border px-3 py-1 text-xs font-bold disabled:opacity-40"
          style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
        >
          + Option
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {segments.map((segment, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={segment}
              onChange={(event) => setSegments((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
              placeholder={`Option ${index + 1}`}
              className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
            />
            <button
              type="button"
              onClick={() => setSegments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              disabled={segments.length <= 2}
              className="rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-40"
              style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const getScratchTriggerLabel = (trigger?: string) => {
    switch (trigger) {
      case 'random_task':
        return 'random task';
      case 'streak':
        return '7-day streak';
      case 'perfect_exam':
        return '100% exam';
      case 'manual':
        return 'manual';
      case 'task_completion':
      default:
        return 'task completion';
    }
  };

  useEffect(() => {
    if (settingsTab === 'rewards') {
      setSettingsTab('manage_child');
    }
  }, [settingsTab]);

  useEffect(() => {
    if (!user) {
      setChildren([]);
      setChildrenLoading(false);
      return;
    }

    const childQuery = query(
      collection(db, 'users'),
      where('parent_id', '==', familyId),
      where('role', '==', 'child_user')
    );

    const unsubscribe = onSnapshot(
      childQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => {
          const data = d.data() as { name?: string; email?: string };
          return { id: d.id, name: data.name, email: data.email };
        });
        setChildren(mapped);
        setChildrenLoading(false);
      },
      (err) => {
        console.error('Failed to fetch child accounts:', err);
        setChildrenLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, familyId]);

  useEffect(() => {
    if (!user || children.length === 0) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    children.forEach((child) => {
      void (async () => {
        try {
          const profileRef = doc(db, 'child_profile', child.id);
          const existingProfile = await getDoc(profileRef);
          if (existingProfile.exists()) {
            return;
          }

          await setDoc(profileRef, {
            id: child.id,
            user_id: child.id,
            parent_id: familyId,
            family_id: familyId,
            name: child.name || (child.email || '').split('@')[0] || 'Explorer',
            date_of_birth: new Date('2015-01-01').toISOString(),
            height_cm: 120,
            weight_kg: 25,
            streak_count: 0,
            streak_shields: 0,
            consistency_score: 0,
            total_stars: 0,
            is_sick_mode: false,
            last_streak_eval: today
          }, { merge: true });
          console.info('Backfilled missing child_profile for child:', child.id);
        } catch (error) {
          console.warn('Failed to backfill child_profile for child:', child.id, error);
        }
      })();
    });
  }, [user, children, familyId]);

  useEffect(() => {
    if (!familyId) {
      setAllPlannerPrograms([]);
      return;
    }

    const programsQuery = query(collection(db, 'programs'), where('family_id', '==', familyId), limit(500));
    const unsubscribe = onSnapshot(
      programsQuery,
      (snapshot) => {
        const now = new Date();
        const rows = snapshot.docs
          .map((docRow) => mapPlannerProgram(docRow.id, docRow.data() as Record<string, unknown>))
          .filter((program) => {
            if (!program.isActive) return false;
            if (!program.endDate) return true;
            const end = new Date(program.endDate);
            end.setHours(23, 59, 59, 999);
            return end >= now;
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setAllPlannerPrograms(rows);
      },
      (error) => {
        console.warn('Failed to fetch planner activities:', error);
        setAllPlannerPrograms([]);
      }
    );

    return () => unsubscribe();
  }, [familyId]);

  // Derived pending proofs visible to this parent (initialized before analytics reads it)
  const visiblePendingProofs = pendingProofs.filter((proof) => children.some((child) => child.id === proof.child_id));
  const featuredProof = visiblePendingProofs[0];

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('parent_id', '==', familyId),
      limit(500)
    );
    const unsub = onSnapshot(
      tasksQuery,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        setTasks(mapped);
        setTasksLoading(false);
      },
      (err) => {
        console.error('Failed to fetch tasks:', err);
        setTasksLoading(false);
      }
    );

    return () => unsub();
  }, [user, children, familyId]);

  useEffect(() => {
    if (!user || children.length === 0 || tChild || editTaskId) return;
    const defaultChildId = automationChildId || children[0]?.id || '';
    if (defaultChildId) {
      setTChild(defaultChildId);
    }
  }, [user, children, tChild, editTaskId, automationChildId]);

  const clearTaskForm = () => {
    setTChild('');
    setTActivityId('');
    setTSubjectId('');
    setTTitle('');
    setTDesc('');
    setTPoints('');
    setTPerformanceStars(5);
    setTDue('');
    setTEndDate('');
    setTRecurrenceType('none');
    setTRecurrenceDays([]);
    setTMandatory(false);
    setTNotifyParentOnMiss(true);
    setTNotifyChildOnMiss(true);
    setTReduceStarsOnMiss(false);
    setTStarPenalty('');
    setEditTaskId(null);
    setShowTaskModal(false);
  };

  const startEditTask = (task: any) => {
    setEditTaskId(task.id);
    setTChild(task.child_id || '');
    setTActivityId(task.linked_program_id || '');
    setTSubjectId(task.subject_id || '');
    setTTitle(task.title || '');
    setTDesc(task.description || '');
    setTPoints(task.points ?? task.star_value ?? '');
    setTPerformanceStars((Number(task.performance_stars || task.rating_stars || 5) as 1 | 2 | 3 | 4 | 5));
    setTDue(task.due_date ? toInputDateTimeLocal(task.due_date) : '');
    setTEndDate(task.end_date ? toInputDateTimeLocal(task.end_date) : '');
    setTRecurrenceType((task.recurrence_type as 'none' | 'daily' | 'weekly') || 'none');
    setTRecurrenceDays(Array.isArray(task.recurrence_days) ? task.recurrence_days : []);
    setTMandatory(Boolean(task.is_mandatory));
    setTNotifyParentOnMiss(task.missed_action?.notify_parent ?? true);
    setTNotifyChildOnMiss(task.missed_action?.notify_child ?? true);
    setTReduceStarsOnMiss(Boolean(task.missed_action?.reduce_stars));
    setTStarPenalty(task.missed_action?.star_penalty ?? '');
    setShowTaskModal(true);
  };

  const cancelTaskEdit = () => {
    clearTaskForm();
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || taskLoading) return;
    setError('');
    setSuccess('');
    setInfo('');
    setTaskLoading(true);

    try {
      const selectedChild = children.find((child) => child.id === tChild);
      if (!selectedChild) {
        setError('Select a child before creating the task.');
        return;
      }

      if (tActivityId && !tSubjectId) {
        setError('Subject is mandatory when an activity is selected.');
        setTaskLoading(false);
        return;
      }

      const selectedTaskSubject = tSubjectId === 'general'
        ? null
        : taskSubjects.find((subject) => subjectMatchesStoredValue(subject, tSubjectId));
      if (tActivityId && tSubjectId !== 'general' && !selectedTaskSubject) {
        setError('Select a subject that belongs to the selected activity.');
        setTaskLoading(false);
        return;
      }

      const starValue = Number(tPoints) || 1;
      if (tMandatory && !tEndDate) {
        setError('Mandatory timed tasks need a Complete Before date and time.');
        setTaskLoading(false);
        return;
      }

      const taskPayload = {
        title: tTitle,
        description: tDesc,
        points: starValue,
        star_value: starValue,
        base_cash_value: starValue,
        performance_stars: tPerformanceStars,
        category: 'General',
        priority: 'medium',
        energy_level: 'medium',
        difficulty_level: 1,
        requires_proof: false,
        status: 'pending',
        child_id: tChild,
        child_name: selectedChild.name || selectedChild.email || '',
        available_from: tDue ? new Date(tDue).toISOString() : null,
        due_date: tDue ? new Date(tDue).toISOString() : null,
        expires_at: tEndDate ? new Date(tEndDate).toISOString() : null,
        end_date: tEndDate ? new Date(tEndDate).toISOString() : null,
        is_mandatory: tMandatory,
        missed_action: {
          notify_parent: tNotifyParentOnMiss,
          notify_child: tNotifyChildOnMiss,
          reduce_stars: tReduceStarsOnMiss,
          star_penalty: tReduceStarsOnMiss ? Number(tStarPenalty || starValue) : 0,
          create_parent_approval: true,
        },
        recurrence_type: tRecurrenceType,
        recurrence_days: tRecurrenceType === 'weekly' ? tRecurrenceDays : [],
        linked_program_id: tActivityId || null,
        subject_id: tSubjectId === 'general' ? 'general' : selectedTaskSubject?.id || null,
        parent_id: familyId,
        family_id: familyId
      };

      if (editTaskId) {
        await withOperationTimeout(
          updateDoc(doc(db, 'tasks', editTaskId), {
            ...taskPayload,
            updated_at: new Date().toISOString()
          }),
          'update-task'
        );
        setSuccess('Task updated.');
      } else {
        await withOperationTimeout(
          addDoc(collection(db, 'tasks'), {
            ...taskPayload,
            created_at: new Date().toISOString()
          }),
          'create-task'
        );
        setSuccess('Task created and assigned to the child.');
        try {
          await sendMessage(tChild, familyId, `A new task was assigned to you: ${tTitle}.`, 'parent', familyId, 'New Task');
        } catch (msgErr) {
          console.warn('Failed to send task notification:', msgErr);
        }
      }

      clearTaskForm();
    } catch (err) {
      console.error('Failed to create task:', err);
      setError(String((err as Error)?.message || '').includes('timeout') ? 'Task save is taking too long. Please try again.' : 'Could not create task.');
    } finally {
      setTaskLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setSelectedActivityDetail((current) => current?.kind === 'task' && current.item?.id === taskId ? null : current);
      setSuccess('Task deleted.');
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Could not delete task.');
    }
  };

  const handleCompleteMappedTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to mark this task as completed?\n\nThis will keep past occurrences but remove future ones from the calendar.')) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed',
        expires_at: new Date().toISOString()
      });
      setSuccess('Task marked as completed.');
    } catch (err: any) {
      setError(err.message || 'Could not complete task.');
    }
  };

  const handleParentResetChildPassword = async (child: ChildAccount) => {
    try {
      await updateDoc(doc(db, 'users', child.id), {
        password_reset_requested_by_parent_at: new Date().toISOString(),
        password_reset_status: 'requested'
      });

      await addDoc(collection(db, 'messages'), {
        child_id: child.id,
        parent_id: familyId,
        subject: 'Password reset',
        content: 'Your parent initiated a password reset request. Please use the Profile page to update your password after re-login.',
        sender_role: 'parent',
        sender_id: familyId,
        is_read: false,
        timestamp: new Date().toISOString()
      });

      setSuccess(`Password reset request sent for ${child.name || child.email || 'child'}.`);
    } catch (err) {
      console.error('Failed to create child password reset request:', err);
      setError('Could not trigger password reset request.');
    }
  };

  const updateChildEditForm = <K extends keyof ChildEditForm>(field: K, value: ChildEditForm[K]) => {
    setChildEditForm((current) => ({ ...current, [field]: value }));
  };

  const startEditChildProfile = (child: ChildAccount, profile?: any) => {
    setEditingChildId(child.id);
    setChildEditForm({
      name: profile?.name || child.name || '',
      petName: profile?.pet_name || '',
      avatarEmoji: profile?.avatar_emoji || CHILD_AVATARS[0],
      interests: Array.isArray(profile?.interests) ? profile.interests.join(', ') : '',
      profileMotto: profile?.profile_motto || '',
      communicationStyle: profile?.communication_style || 'cheerful',
      dateOfBirth: toInputDate(profile?.date_of_birth),
      heightCm: profile?.height_cm ? String(profile.height_cm) : '',
      weightKg: profile?.weight_kg ? String(profile.weight_kg) : ''
    });
  };

  const cancelEditChildProfile = () => {
    setEditingChildId(null);
    setChildEditForm({
      name: '',
      petName: '',
      avatarEmoji: CHILD_AVATARS[0],
      interests: '',
      profileMotto: '',
      communicationStyle: 'cheerful',
      dateOfBirth: '',
      heightCm: '',
      weightKg: ''
    });
  };

  const handleSaveChildProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingChildId) return;

    const name = childEditForm.name.trim();
    if (!name) {
      setError('Child name is required.');
      return;
    }

    const height = childEditForm.heightCm ? Number(childEditForm.heightCm) : null;
    const weight = childEditForm.weightKg ? Number(childEditForm.weightKg) : null;
    if ((height !== null && height <= 0) || (weight !== null && weight <= 0)) {
      setError('Height and weight must be positive numbers.');
      return;
    }

    const interests = childEditForm.interests
      .split(',')
      .map((interest) => interest.trim())
      .filter(Boolean)
      .slice(0, 8);

    setChildEditSaving(true);
    setError('');

    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'users', editingChildId), {
        name,
        updated_at: now
      }, { merge: true });

      const profilePayload: Record<string, any> = {
        id: editingChildId,
        user_id: editingChildId,
        parent_id: familyId,
        family_id: familyId,
        name,
        pet_name: childEditForm.petName.trim() || null,
        avatar_emoji: childEditForm.avatarEmoji,
        interests,
        profile_motto: childEditForm.profileMotto.trim().slice(0, 90) || null,
        communication_style: childEditForm.communicationStyle,
        updated_at: now
      };

      if (childEditForm.dateOfBirth) {
        profilePayload.date_of_birth = new Date(childEditForm.dateOfBirth).toISOString();
      }
      if (height !== null) {
        profilePayload.height_cm = height;
      }
      if (weight !== null) {
        profilePayload.weight_kg = weight;
      }

      await setDoc(doc(db, 'child_profile', editingChildId), profilePayload, { merge: true });
      setSuccess('Child profile updated.');
      cancelEditChildProfile();
    } catch (err) {
      console.error('Failed to update child profile:', err);
      setError('Could not update child profile.');
    } finally {
      setChildEditSaving(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setExams([]);
      setExamsLoading(false);
      return;
    }

    setExamsLoading(true);
    const examsQuery = query(
      collection(db, 'exams'),
      where('family_id', '==', familyId),
      limit(500)
    );

    const unsub = onSnapshot(
      examsQuery,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => new Date(b.exam_date || b.created_at || 0).getTime() - new Date(a.exam_date || a.created_at || 0).getTime());
        setExams(mapped);
        setExamsLoading(false);
      },
      (err) => {
        console.error('Failed to fetch exams:', err);
        setExamsLoading(false);
      }
    );

    return () => unsub();
  }, [user, familyId]);

  useEffect(() => {
    if (!user) {
      setGrowthLogs([]);
      setGrowthLoading(false);
      return;
    }

    setGrowthLoading(true);
    const gql = query(
      collection(db, 'growth_logs'),
      where('family_id', '==', familyId),
      limit(500)
    );

    const unsub = onSnapshot(
      gql,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
        setGrowthLogs(mapped);
        setGrowthLoading(false);
      },
      (err) => {
        console.error('Failed to fetch growth logs:', err);
        setGrowthLoading(false);
      }
    );

    return () => unsub();
  }, [user, familyId]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      setEventsLoading(false);
      return;
    }

    setEventsLoading(true);
    const evq = query(collection(db, 'events'), where('family_id', '==', familyId), limit(800));

    const unsub = onSnapshot(
      evq,
      (snap) => {
        const mapped = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((event) => belongsToFamily(event))
          .sort((a, b) => new Date(b.start_at || b.date || b.created_at || 0).getTime() - new Date(a.start_at || a.date || a.created_at || 0).getTime());
        setEvents(mapped);
        setEventsLoading(false);
      },
      (err) => {
        console.error('Failed to fetch events:', err);
        setEventsLoading(false);
      }
    );

    return () => unsub();
  }, [user, familyId]);

  useEffect(() => {
    if (!user || !familyId) {
      setRewards([]);
      setRewardsLoading(false);
      return;
    }

    setRewardsLoading(true);
    const snapshots: Record<string, any[]> = { family: [], parent: [], legacyFamilyParent: [] };
    const publishRewards = () => {
      const merged = new Map<string, any>();
      [...snapshots.family, ...snapshots.parent, ...snapshots.legacyFamilyParent].forEach((reward) => merged.set(reward.id, reward));
      const mapped = Array.from(merged.values()).sort((a, b) => {
        const bTime = new Date(b.updated_at || b.created_at || 0).getTime();
        const aTime = new Date(a.updated_at || a.created_at || 0).getTime();
        return bTime - aTime;
      });
      setRewards(mapped);
      setRewardsLoading(false);
    };

    const handleError = (err: unknown) => {
      console.error('Failed to fetch reward settings:', err);
      setRewardsLoading(false);
    };

    const unsubscribers = [
      onSnapshot(
        query(collection(db, 'reward_settings'), where('family_id', '==', familyId)),
        (snap) => {
          snapshots.family = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          publishRewards();
        },
        handleError
      ),
      onSnapshot(
        query(collection(db, 'reward_settings'), where('parent_id', '==', user.id)),
        (snap) => {
          snapshots.parent = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          publishRewards();
        },
        handleError
      )
    ];

    if (user.id !== familyId) {
      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'reward_settings'), where('parent_id', '==', familyId)),
          (snap) => {
            snapshots.legacyFamilyParent = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
            publishRewards();
          },
          handleError
        )
      );
    }

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, familyId]);

  useEffect(() => {
    if (!user || !familyId) {
      setTelegramBotUsername('');
      return;
    }

    let cancelled = false;
    getDoc(doc(db, 'telegram_settings', familyId))
      .then((snap) => {
        if (cancelled || !snap.exists()) return;
        const data = snap.data() as any;
        setTelegramBotUsername(String(data.bot_username || ''));
      })
      .catch((err) => {
        console.warn('Failed to load Telegram settings:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [user, familyId]);

  useEffect(() => {
    if (!user) {
      setPendingProofs([]);
      return;
    }

    const proofQuery = query(
      collection(db, 'proof_logs'),
      where('approval_status', '==', 'pending'),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      proofQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PendingProof, 'id'>) }));
        setPendingProofs(mapped);
      },
      (err) => {
        console.error('Failed to fetch pending proofs:', err);
      }
    );

    return () => unsubscribe();
  }, [user, familyId, children]);

  useEffect(() => {
    if (!user) {
      setPendingChildTasks([]);
      return;
    }

    const tasksQuery = query(collection(db, 'tasks'), where('parent_id', '==', familyId), limit(100));
    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const mapped = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((item) => item.created_by === 'child' && item.approval_status === 'pending');
      setPendingChildTasks(mapped);
    });

    return () => unsubscribe();
  }, [user, familyId, children]);

  useEffect(() => {
    if (!user) {
      setPendingChildEvents([]);
      return;
    }

    const eventsQuery = query(collection(db, 'events'), where('family_id', '==', familyId), limit(100));
    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const mapped = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((item) => item.created_by === 'child' && item.approval_status === 'pending');
      setPendingChildEvents(mapped);
    });

    return () => unsubscribe();
  }, [user, familyId, children]);

  useEffect(() => {
    if (!user) {
      setPendingAchievements([]);
      return;
    }

    const achievementsQuery = query(collection(db, 'achievements'), where('parent_id', '==', familyId), limit(100));
    const unsubscribe = onSnapshot(achievementsQuery, (snapshot) => {
      const mapped = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((item) => item.approval_status === 'pending');
      setPendingAchievements(mapped);
    });

    return () => unsubscribe();
  }, [user, familyId]);

  const formatChildCreationError = (code?: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
      case 'auth/email-exists':
        return 'That username already exists. Use the same password to link it, or choose another username.';
      case 'auth/email-not-found':
      case 'auth/invalid-password':
      case 'auth/invalid-login-credentials':
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'This username already exists, but the password does not match.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/network-request-failed':
        return isUsingFirebaseEmulators
          ? 'Firebase emulators are still starting or temporarily unreachable. Wait a few seconds and retry. If it persists, restart with npm run local.'
          : 'Network error while contacting Firebase. Please try again.';
      case 'auth/operation-not-allowed':
      case 'auth/admin-restricted-operation':
        return 'Firebase Email/Password sign-in is not enabled for this project.';
      default:
        return `Failed to create child account${code ? ` (${code})` : ''}. Please try again.`;
    }
  };

  const withOperationTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs = 12000): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label}-timeout`)), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  };

  const resetChildModalForm = () => {
    setIsModaling(false);
    setCUser('');
    setCName('');
    setCPass('');
    setCDob('');
    setCHeight('');
    setCWeight('');
  };

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSuccess('');
    setChildRegistering(true);
    let childUid = '';
    let dummyEmail = '';

    const childProfilePayload = {
      id: '',
      user_id: '',
      parent_id: familyId,
      family_id: familyId,
      name: cName,
      date_of_birth: new Date(cDob).toISOString(),
      height_cm: Number(cHeight),
      weight_kg: Number(cWeight),
      streak_count: 0,
      streak_shields: 0,
      consistency_score: 0,
      total_stars: 0,
      is_sick_mode: false,
      last_streak_eval: new Date().toISOString().slice(0, 10)
    };

    try {
      // Backfill parent profile fields required by Firestore rules in older production accounts.
      await withOperationTimeout(
        setDoc(doc(db, 'users', user.id), {
          id: user.id,
          email: user.email,
          role: 'parent_admin',
          linked_family_id: familyId || user.id,
          updated_at: new Date().toISOString()
        }, { merge: true }),
        'ensure-parent-profile'
      );

      const cleanUser = cUser.trim().toLowerCase().split('@')[0];
      dummyEmail = `${cleanUser}@tiktrack.family`;
      const authResult = await withOperationTimeout(
        createOrReuseChildAccount(dummyEmail, cPass),
        'create-child-auth'
      );
      childUid = authResult.uid;

      if (authResult.wasExisting) {
        const existingUserDoc = await withOperationTimeout(
          getDoc(doc(db, 'users', childUid)),
          'check-existing-child-user-doc'
        );
        const existingUser = existingUserDoc.exists() ? existingUserDoc.data() : null;
        const existingFamilyId = existingUser?.linked_family_id || existingUser?.parent_id;

        if (existingFamilyId !== familyId) {
          throw new Error('child-username-already-used');
        }
      }

      await withOperationTimeout(
        setDoc(doc(db, 'users', childUid), {
          id: childUid,
          email: dummyEmail,
          name: cName,
          role: 'child_user',
          parent_id: familyId,
          linked_family_id: familyId,
          updated_at: new Date().toISOString()
        }, { merge: true }),
        'create-child-user-doc'
      );

      await withOperationTimeout(
        setDoc(doc(db, 'child_profile', childUid), {
          ...childProfilePayload,
          id: childUid,
          user_id: childUid
        }, { merge: true }),
        'create-child-profile-doc'
      );

      resetChildModalForm();
      setSuccess(
        authResult.wasExisting
          ? 'Existing child account is linked to your Family Hub. Previous activity is still attached to this username.'
          : 'Child account is ready and linked to your Family Hub.'
      );
    } catch (err: any) {
      console.error('Child account creation failed:', err);
      const message = String(err?.message || '');
      if (childUid && !message.includes('child-username-already-used')) {
        try {
          const userDocSnap = await getDoc(doc(db, 'users', childUid));
          if (userDocSnap.exists()) {
            setDoc(doc(db, 'child_profile', childUid), {
              ...childProfilePayload,
              id: childUid,
              user_id: childUid
            }, { merge: true }).catch((profileRepairError) => {
              console.warn('Background child profile repair failed:', profileRepairError);
            });

            resetChildModalForm();
            setSuccess('Child account is ready and linked to your Family Hub.');
            return;
          }
        } catch (reconcileError) {
          console.warn('Child registration reconciliation failed:', reconcileError);
        }
      }

      if (message.includes('timeout')) {
        setError('Child registration is taking too long. Please try again in a moment.');
      } else if (message.includes('child-username-already-used')) {
        setError('That child username is already linked to another Family Hub. Choose a different username.');
      } else {
        setError(formatChildCreationError(err?.code));
      }
    } finally {
      setChildRegistering(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Parent logout failed:', err);
      setError('Logout failed. Please try again.');
    }
  };

  const handleProofDecision = async (proofId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'proof_logs', proofId), {
        approval_status: status,
        review_comment: proofReviewComment.trim() || null,
        reviewed_at: new Date().toISOString()
      });

      // Read proof record to identify child and task
      const proofSnap = await getDoc(doc(db, 'proof_logs', proofId));
      const proofData = proofSnap.exists() ? (proofSnap.data() as any) : null;
      const childId = proofData?.child_id;
      const taskId = proofData?.task_id;
      const today = new Date().toISOString().slice(0, 10);
      const logId = childId && taskId ? `${childId}_${taskId}_${today}` : '';

      if (status === 'approved') {
        // Mark task completion only at approval time for proof-based tasks.
        if (childId && taskId) {
          await setDoc(doc(db, 'task_logs', logId), {
            id: logId,
            child_id: childId,
            task_id: taskId,
            date: today,
            status: 'completed'
          }, { merge: true });

          try {
            await updateDoc(doc(db, 'tasks', taskId), {
              status: 'completed',
              completed_at: new Date().toISOString()
            });
          } catch (taskUpdateErr) {
            console.warn('Task update after proof approval skipped:', taskUpdateErr);
          }

          // Determine star value from cached tasks and apply exactly once at approval.
          const task = tasks.find((t: any) => t.id === taskId) as any;
          const starValue = Number(task?.points ?? task?.star_value ?? 0);
          try {
            const profileRef = doc(db, 'child_profile', childId);
            const profileSnap = await getDoc(profileRef);
            const existing = profileSnap.exists() ? (profileSnap.data() as any) : {};
            const { updatedProfile } = applyTaskCompletionToProfile(
              existing || {},
              starValue,
              true,
              today
            );
            const earnedStars = Math.max(0, Number(updatedProfile.total_stars || 0) - Number(existing.total_stars || 0));
            const badgeText = `${task?.title || ''} ${task?.description || ''} ${task?.category || ''}`.toLowerCase();
            const isReadingTask = /\b(read|reading|book|comic)\b/.test(badgeText);
            const isStudyTask = /\b(study|homework|math|science|english|practice|exam)\b/.test(badgeText);
            await updateDoc(profileRef, {
              total_stars: updatedProfile.total_stars,
              streak_count: updatedProfile.streak_count,
              consistency_score: updatedProfile.consistency_score,
              streak_shields: updatedProfile.streak_shields,
              last_task_date: updatedProfile.last_task_date,
              reading_completed_count: (Number(existing.reading_completed_count) || 0) + (isReadingTask ? 1 : 0),
              study_completed_count: (Number(existing.study_completed_count) || 0) + (isStudyTask ? 1 : 0)
            });
            if (earnedStars > 0) {
              await createRewardLedgerEntry({
                child_id: childId,
                parent_id: task?.parent_id || familyId,
                family_id: task?.family_id || familyId,
                type: 'task_completed',
                stars_delta: earnedStars,
                title: task?.title || 'Task completed',
                reason: `Proof approved for "${task?.title || 'Task'}"`,
                source_id: taskId,
                source_type: 'task',
                visible_to_child: true,
              });
              await awardScratchRewardForTrigger({
                childId,
                parentId: task?.parent_id || familyId,
                familyId: task?.family_id || familyId,
                sourceId: taskId,
                sourceType: 'task',
                reason: `Proof approved for "${task?.title || 'Task'}"`,
                streakCount: Number(updatedProfile.streak_count || 0),
              });
            }
          } catch (innerErr) {
            console.error('Failed to update child profile after proof approval:', innerErr);
          }
        }

        setSuccess('Proof approved. Completion and stars are now reflected for the child.');
        if (childId && familyId) {
          await sendMessage(childId, familyId, `Proof approved${proofReviewComment.trim() ? `: ${proofReviewComment.trim()}` : '.'}`, 'parent', familyId, 'Proof review');
        }
      } else {
        if (childId && taskId) {
          await setDoc(doc(db, 'task_logs', logId), {
            id: logId,
            child_id: childId,
            task_id: taskId,
            date: today,
            status: 'failed'
          }, { merge: true });
        }
        setInfo('Proof rejected and removed from the pending queue.');
        if (childId && familyId) {
          await sendMessage(childId, familyId, `Proof rejected${proofReviewComment.trim() ? `: ${proofReviewComment.trim()}` : '. Please retry and upload again.'}`, 'parent', familyId, 'Proof review');
        }
      }
      setProofReviewComment('');
    } catch (err) {
      console.error('Failed to update proof status:', err);
      setError('Could not update proof approval. Please try again.');
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (eMarks !== '' && Number(eMarks) < 0) { alert('Marks scored cannot be negative.'); return; }
    if (eTotal !== '' && Number(eTotal) < 0) { alert('Total marks cannot be negative.'); return; }
    if (eMarks !== '' && eTotal !== '' && Number(eMarks) > Number(eTotal)) { alert('Marks scored cannot be greater than total marks.'); return; }
    if (ePoints !== '' && Number(ePoints) < 0) { alert('Max stars cannot be negative.'); return; }

    setError('');
    setExamLoading(true);

    try {
      const selectedExamSubjectRows = eSubjectIds
        .filter((subjectId) => subjectId !== 'custom')
        .map((subjectId) => examSubjects.find((subject) => subjectMatchesStoredValue(subject, subjectId)))
        .filter((subject): subject is PlannerSubject => Boolean(subject));
      const knownSubjectNames = new Set(examSubjects.map((subject) => subject.name));
      const customExamSubjects = eSubjectIds.includes('custom')
        ? eSubjects.map((subject) => subject.trim()).filter((subject) => subject && !knownSubjectNames.has(subject))
        : [];
      const normalizedExamSubjects = [
        ...selectedExamSubjectRows.map((subject) => subject.name),
        ...customExamSubjects
      ];
      const normalizedExamSubjectIds = eSubjectIds.includes('custom')
        ? ''
        : selectedExamSubjectRows.map((subject) => subject.id).join(',');

      if (eActivityId && selectedExamSubjectRows.length !== eSubjectIds.filter((subjectId) => subjectId !== 'custom').length) {
        setError('Select subjects that belong to the selected activity.');
        return;
      }

      if (normalizedExamSubjects.length === 0) {
        setError('Select at least one subject for the exam.');
        return;
      }

      const examDateIso = eDate ? new Date(eDate).toISOString() : new Date().toISOString();
      const hasResult = eMarks !== '' && eTotal !== '';
      const datePassed = new Date(examDateIso).getTime() < Date.now();
      const computedStatus: 'scheduled' | 'completed_pending_result' | 'result_published' =
        hasResult ? 'result_published' : (datePassed ? 'completed_pending_result' : 'scheduled');
      const reminderPlan = ['7d', '3d', '1d', 'same_day'];

      const syncExamCountdownReminders = async (examId: string, childId: string | null, examTitle: string, examDate: string, status: string) => {
        if (!childId) return;
        const offsetByPlan: Record<string, number> = { '7d': 7, '3d': 3, '1d': 1, same_day: 0 };
        for (const planItem of reminderPlan) {
          const offset = offsetByPlan[planItem] ?? 0;
          const reminderId = `exam_${examId}_${planItem}`;
          await setDoc(doc(db, 'reminders', reminderId), {
            child_id: childId,
            parent_id: familyId,
            type: 'exam_countdown',
            title: `Exam Reminder: ${examTitle}`,
            message: offset === 0 ? `${examTitle} is today. You can do this!` : `${examTitle} in ${offset} day${offset === 1 ? '' : 's'}. Start preparation.`,
            schedule_time: '07:00',
            is_enabled: status === 'scheduled',
            frequency: 'daily',
            days_of_week: [0, 1, 2, 3, 4, 5, 6],
            linked_exam_id: examId,
            target_date: examDate,
            offset_days: offset,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          }, { merge: true });
        }
      };

      if (editExamId) {
        const examScorePct = hasResult && Number(eTotal) > 0 ? (Number(eMarks) / Number(eTotal)) * 100 : 0;
        const examPerformanceStars = examScorePct >= 90 ? 5 : examScorePct >= 75 ? 4 : examScorePct >= 50 ? 3 : examScorePct >= 35 ? 2 : 1;
        const examRewardSettings = await fetchCashRewardSettings(familyId, user?.id);
        const newPointsEarned = hasResult && ePoints !== ''
          ? calculateCashReward(Number(ePoints), examPerformanceStars, examRewardSettings).amount
          : null;

        // Fetch old exam to compute points delta
        const examSnap = await getDoc(doc(db, 'exams', editExamId));
        const oldData = examSnap.exists() ? examSnap.data() : null;
        const oldPointsEarned = oldData?.points_earned || 0;
        const pointsDelta = (newPointsEarned || 0) - oldPointsEarned;

        await updateDoc(doc(db, 'exams', editExamId), {
          child_id: eChild || null,
          subject: normalizedExamSubjects.join(', '),
          subject_id: normalizedExamSubjectIds,
          exam_type: eType,
          marks_scored: hasResult ? Number(eMarks) : null,
          total_marks: hasResult ? Number(eTotal) : null,
          points_allocated: ePoints !== '' ? Number(ePoints) : null,
          points_earned: newPointsEarned,
          exam_date: examDateIso,
          status: computedStatus,
          syllabus_scope: eSyllabusScope || '',
          result_published_at: hasResult ? new Date().toISOString() : null,
          reminder_plan: reminderPlan,
          linked_program_id: eActivityId || null,
          recurrence_type: eRecurrenceType,
          recurrence_days: eRecurrenceType === 'weekly' ? eRecurrenceDays : [],
          updated_at: new Date().toISOString()
        });
        await syncExamCountdownReminders(editExamId, eChild || null, normalizedExamSubjects.join(', ') || 'Exam', examDateIso, computedStatus);

        if (hasResult && eChild && Number(eTotal) > 0 && Number(eMarks) === Number(eTotal)) {
          await awardScratchRewardForTrigger({
            childId: eChild,
            parentId: user.id,
            familyId,
            sourceId: editExamId,
            sourceType: 'exam',
            reason: `Perfect exam score: ${normalizedExamSubjects.join(', ') || 'Exam'}`,
            trigger: 'perfect_exam',
          });
        }

        if (pointsDelta !== 0 && (eChild || oldData?.child_id)) {
          const profileRef = doc(db, 'child_profile', eChild || oldData?.child_id);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const currentStars = profileSnap.data().total_stars || 0;
            await updateDoc(profileRef, {
              total_stars: Math.max(0, currentStars + pointsDelta)
            });
          }
        }
        
        setSuccess('Exam updated.');
      } else {
        const examScorePct = hasResult && Number(eTotal) > 0 ? (Number(eMarks) / Number(eTotal)) * 100 : 0;
        const examPerformanceStars = examScorePct >= 90 ? 5 : examScorePct >= 75 ? 4 : examScorePct >= 50 ? 3 : examScorePct >= 35 ? 2 : 1;
        const examRewardSettings = await fetchCashRewardSettings(familyId, user?.id);
        const newPointsEarned = hasResult && ePoints !== ''
          ? calculateCashReward(Number(ePoints), examPerformanceStars, examRewardSettings).amount
          : null;

        const createdRef = await addDoc(collection(db, 'exams'), {
          child_id: eChild || null,
          subject: normalizedExamSubjects.join(', '),
          subject_id: normalizedExamSubjectIds,
          exam_type: eType,
          marks_scored: hasResult ? Number(eMarks) : null,
          total_marks: hasResult ? Number(eTotal) : null,
          points_allocated: ePoints !== '' ? Number(ePoints) : null,
          points_earned: newPointsEarned,
          exam_date: examDateIso,
          status: computedStatus,
          syllabus_scope: eSyllabusScope || '',
          result_published_at: hasResult ? new Date().toISOString() : null,
          reminder_plan: ['7d', '3d', '1d', 'same_day'],
          linked_program_id: eActivityId || null,
          recurrence_type: eRecurrenceType,
          recurrence_days: eRecurrenceType === 'weekly' ? eRecurrenceDays : [],
          parent_id: familyId,
          family_id: familyId,
          created_at: new Date().toISOString()
        });
        await syncExamCountdownReminders(createdRef.id, eChild || null, normalizedExamSubjects.join(', ') || 'Exam', examDateIso, computedStatus);

        if (hasResult && eChild && Number(eTotal) > 0 && Number(eMarks) === Number(eTotal)) {
          await awardScratchRewardForTrigger({
            childId: eChild,
            parentId: user.id,
            familyId,
            sourceId: createdRef.id,
            sourceType: 'exam',
            reason: `Perfect exam score: ${normalizedExamSubjects.join(', ') || 'Exam'}`,
            trigger: 'perfect_exam',
          });
        }
        
        if (newPointsEarned && newPointsEarned > 0 && eChild) {
          const profileRef = doc(db, 'child_profile', eChild);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const currentStars = profileSnap.data().total_stars || 0;
            await updateDoc(profileRef, {
              total_stars: currentStars + newPointsEarned
            });
          }
        }
        
        setSuccess('Exam result recorded.');
      }

      setEChild('');
      setEActivityId('');
      setESubjects([]);
      setESubjectIds([]);
      setERecurrenceType('none');
      setERecurrenceDays([]);
      setEType('weekly_test');
      setEMarks('');
      setETotal('');
      setEDate('');
      setESyllabusScope('');
      setEPoints('');
      setEditExamId(null);
    } catch (err) {
      console.error('Failed to create exam:', err);
      setError('Could not save exam result.');
    } finally {
      setExamLoading(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) return;
    try {
      await deleteDoc(doc(db, 'exams', examId));
      setSuccess('Exam removed.');
    } catch (err) {
      console.error('Failed to delete exam:', err);
      setError('Could not delete exam.');
    }
  };

  const startEditExam = (ex: any) => {
    const storedSubjectNames = splitStoredList(ex.subject);
    const storedSubjectIds = splitStoredList(ex.subject_id);
    const knownSubjectTokens = new Set(
      examSubjects.flatMap((subject) => [subject.id, subject.name])
    );
    const hasCustomSubjects = storedSubjectNames.some((subjectName) => !knownSubjectTokens.has(subjectName));
    setEditExamId(ex.id);
    setEChild(ex.child_id || '');
    setEActivityId(ex.linked_program_id || '');
    setESubjects(storedSubjectNames);
    setESubjectIds(storedSubjectIds.length ? storedSubjectIds : [
      ...storedSubjectNames,
      ...(hasCustomSubjects ? ['custom'] : [])
    ]);
    setERecurrenceType(ex.recurrence_type || 'none');
    setERecurrenceDays(ex.recurrence_days || []);
    setEType((ex.exam_type as 'weekly_test' | 'unit_test' | 'midterm' | 'final' | 'practice' | 'other') || 'weekly_test');
    setEMarks(ex.marks_scored ?? '');
    setETotal(ex.total_marks ?? '');
    setEDate(ex.exam_date ? toInputDateTimeLocal(ex.exam_date) : '');
    setESyllabusScope(ex.syllabus_scope || '');
    setEPoints(ex.points_allocated ?? '');
  };

  const cancelEdit = () => {
    setEditExamId(null);
    setEChild('');
    setEActivityId('');
    setESubjects([]);
    setESubjectIds([]);
    setERecurrenceType('none');
    setERecurrenceDays([]);
    setEType('weekly_test');
    setEMarks('');
    setETotal('');
    setEDate('');
    setESyllabusScope('');
    setEPoints('');
  };

  const handleCreateGrowth = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user) return;
    setError('');
    setGrowthLoading2(true);

    try {
      if (editGrowthId) {
        await updateDoc(doc(db, 'growth_logs', editGrowthId), {
          child_id: gChild || null,
          height_cm: gHeight || 0,
          weight_kg: gWeight || 0,
          date: gDate ? new Date(gDate).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        setSuccess('Growth log updated.');
      } else {
        await addDoc(collection(db, 'growth_logs'), {
          child_id: gChild || null,
          height_cm: gHeight || 0,
          weight_kg: gWeight || 0,
          date: gDate ? new Date(gDate).toISOString() : new Date().toISOString(),
          parent_id: familyId,
          family_id: familyId,
          created_at: new Date().toISOString()
        });
        setSuccess('Growth log saved.');
      }

      if (gChild) {
        await setDoc(doc(db, 'child_profile', gChild), {
          height_cm: gHeight || 0,
          weight_kg: gWeight || 0,
          updated_at: new Date().toISOString()
        }, { merge: true });
      }

      setGChild('');
      setGHeight('');
      setGWeight('');
      setGDate('');
      setEditGrowthId(null);
    } catch (err) {
      console.error('Failed to save growth log:', err);
      setError('Could not save growth log.');
    } finally {
      setGrowthLoading2(false);
    }
  };

  const handleDeleteGrowth = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this growth record?')) return;
    try {
      await deleteDoc(doc(db, 'growth_logs', id));
      setSuccess('Growth log deleted.');
    } catch (err) {
      console.error('Failed to delete growth log:', err);
      setError('Could not delete growth log.');
    }
  };

  const startEditGrowth = (g: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditGrowthId(g.id);
    setGChild(g.child_id || '');
    setGHeight(g.height_cm ?? '');
    setGWeight(g.weight_kg ?? '');
    setGDate(g.date ? new Date(g.date).toISOString().slice(0,10) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || eventLoading) return;
    setError('');
    setSuccess('');
    setInfo('');
    setEventLoading(true);

    try {
      const eventDateIso = evDate ? new Date(evDate).toISOString() : new Date().toISOString();
      const eventEndDateIso = evDate 
        ? new Date(new Date(evDate).getTime() + 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();

      if (editEventId) {
        await withOperationTimeout(
          updateDoc(doc(db, 'events', editEventId), {
            child_id: evChild || null,
            title: evTitle,
            type: evType,
            date: eventDateIso,
            start_at: eventDateIso,
            end_at: eventEndDateIso,
            reminder_days_before: evReminderDays || 0,
            linked_program_id: evActivityId || null,
            updated_at: new Date().toISOString()
          }),
          'update-event'
        );
        setSuccess('Event updated.');
      } else {
        await withOperationTimeout(
          addDoc(collection(db, 'events'), {
            child_id: evChild || null,
            title: evTitle,
            type: evType,
            date: eventDateIso,
            start_at: eventDateIso,
            end_at: eventEndDateIso,
            reminder_days_before: evReminderDays || 0,
            linked_program_id: evActivityId || null,
            parent_id: familyId,
            family_id: familyId,
            created_at: new Date().toISOString()
          }),
          'create-event'
        );
        setSuccess('Event created.');
      }

      setEvChild('');
      setEvActivityId('');
      setEvTitle('');
      setEvType('event');
      setEvDate('');
      setEvReminderDays('');
      setEditEventId(null);
    } catch (err) {
      console.error('Failed to save event:', err);
      setError(String((err as Error)?.message || '').includes('timeout') ? 'Event save is taking too long. Please try again.' : 'Could not save event.');
    } finally {
      setEventLoading(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'events', id));
      setSuccess('Event deleted.');
    } catch (err) {
      console.error('Failed to delete event:', err);
      setError('Could not delete event.');
    }
  };

  const startEditEvent = (ev: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditEventId(ev.id);
    setEvChild(ev.child_id || '');
    setEvActivityId(ev.linked_program_id || '');
    setEvTitle(ev.title || '');
    setEvType(ev.type || 'event');
    const rawDate = ev.start_at || ev.date || ev.created_at;
    setEvDate(rawDate ? toInputDateTimeLocal(rawDate) : '');
    setEvReminderDays(ev.reminder_days_before ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditEvent = () => {
    setEditEventId(null);
    setEvChild('');
    setEvActivityId('');
    setEvTitle('');
    setEvType('event');
    setEvDate('');
    setEvReminderDays('');
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setRewardLoading(true);

    try {
      const payload = {
        parent_id: user.id,
        family_id: familyId,
        star_to_currency_rate: Number(rStarRate) || 0,
        point_to_cash_rate: Number(rStarRate) || 0,
        currency_symbol: rCurrencySymbol.trim() || '₹',
        star_payout_percentages: rPayoutPercentages,
        weekly_bonus_enabled: Boolean(rWeeklyBonus),
        updated_at: new Date().toISOString()
      };

      if (editRewardId) {
        await updateDoc(doc(db, 'reward_settings', editRewardId), payload);
        setSuccess('Reward setting updated.');
      } else {
        await addDoc(collection(db, 'reward_settings'), { ...payload, created_at: new Date().toISOString() });
        setSuccess('Reward setting saved.');
      }

      setRStarRate('');
      setRCurrencySymbol('₹');
      setRPayoutPercentages({ ...DEFAULT_STAR_PAYOUT_PERCENTAGES });
      setRWeeklyBonus(false);
      setEditRewardId(null);
    } catch (err) {
      console.error('Failed to save reward setting:', err);
      setError('Could not save reward setting.');
    } finally {
      setRewardLoading(false);
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this reward?')) return;
    try {
      await deleteDoc(doc(db, 'reward_settings', id));
      setSuccess('Reward setting deleted.');
    } catch (err) {
      console.error('Failed to delete reward setting:', err);
      setError('Could not delete reward setting.');
    }
  };

  const startEditReward = (r: any) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setEditRewardId(r.id);
    const normalized = normalizeRewardSettings(r);
    setRStarRate(normalized.point_to_cash_rate ?? '');
    setRCurrencySymbol(normalized.currency_symbol);
    setRPayoutPercentages(normalized.star_payout_percentages);
    setRWeeklyBonus(Boolean(r.weekly_bonus_enabled));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditReward = () => {
    setEditRewardId(null);
    setRStarRate('');
    setRCurrencySymbol('₹');
    setRPayoutPercentages({ ...DEFAULT_STAR_PAYOUT_PERCENTAGES });
    setRWeeklyBonus(false);
  };

  const handleAwardStars = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !awardChildId) {
      setError('Choose a child before awarding stars.');
      return;
    }

    const stars = Number(awardStars);
    if (!Number.isFinite(stars) || stars <= 0) {
      setError('Enter a positive number of stars.');
      return;
    }

    if (!awardReason.trim()) {
      setError('Add the reason for this award.');
      return;
    }

    setAwardSaving(true);
    setError('');
    try {
      const profileRef = doc(db, 'child_profile', awardChildId);
      const profileSnap = await getDoc(profileRef);
      const currentStars = profileSnap.exists() ? Number(profileSnap.data().total_stars || 0) : 0;
      const childName = children.find((child) => child.id === awardChildId)?.name || 'your child';
      const reason = awardReason.trim();

      await updateDoc(profileRef, {
        total_stars: currentStars + stars,
      });

      await createRewardLedgerEntry({
        child_id: awardChildId,
        parent_id: user.id,
        family_id: familyId,
        type: 'manual_award',
        stars_delta: stars,
        title: `Parent awarded ${stars} stars`,
        reason,
        source_type: 'parent_award',
        visible_to_child: true,
        surprise_state: awardSurprise ? 'hidden' : 'none',
      });

      await sendMessage(
        awardChildId,
        familyId,
        awardSurprise
          ? 'You received a surprise gift from parent. Open it in Rewards.'
          : `Parent awarded ${stars} stars for ${reason}.`,
        'parent',
        familyId,
        awardSurprise ? 'Surprise gift' : 'Stars awarded'
      );

      setSuccess(`Awarded ${stars} stars to ${childName}.`);
      setAwardStars('');
      setAwardReason('');
      setAwardSurprise(true);
    } catch (err) {
      console.error('Failed to award stars:', err);
      setError('Could not award stars. Please try again.');
    } finally {
      setAwardSaving(false);
    }
  };

  const handleSettleRewardBalance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !settleChildId) {
      setError('Choose a child before settling rewards.');
      return;
    }

    const child = children.find((item) => item.id === settleChildId);
    const childProfile = childProfiles.find((item) => item.id === settleChildId);
    const currentBalance = Number(childProfile?.total_stars || 0);
    const rewardSettings = rewards[0] ? normalizeRewardSettings(rewards[0]) : null;
    const cashRate = Number(rewardSettings?.point_to_cash_rate || 0);
    const cashBalance = currentBalance * cashRate;
    if (currentBalance <= 0) {
      setError('This child has no reward balance to settle.');
      return;
    }

    if (!window.confirm(`Mark ${currentBalance} stars (${rewardSettings?.currency_symbol || '₹'}${cashBalance}) as paid and reset ${child?.name || 'this child'}'s reward balance to zero?`)) {
      return;
    }

    setSettleSaving(true);
    setError('');
    try {
      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const profileRef = doc(db, 'child_profile', settleChildId);

      await updateDoc(profileRef, {
        total_stars: 0,
      });

      await addDoc(collection(db, 'settlements'), {
        family_id: familyId,
        child_id: settleChildId,
        period_start: today,
        period_end: today,
        total_points: currentBalance,
        total_money: cashBalance,
        status: 'paid',
        created_at: now,
        paid_at: now,
      });

      await createRewardLedgerEntry({
        child_id: settleChildId,
        parent_id: user.id,
        family_id: familyId,
        type: 'adjustment',
        stars_delta: -currentBalance,
        title: 'Reward balance settled',
        reason: `Parent marked ${currentBalance} stars (${rewardSettings?.currency_symbol || '₹'}${cashBalance}) as paid and reset the reward balance.`,
        source_type: 'system',
        visible_to_child: true,
      });

      await sendMessage(
        settleChildId,
        familyId,
        `Your reward balance of ${currentBalance} stars (${rewardSettings?.currency_symbol || '₹'}${cashBalance}) was paid and reset to zero.`,
        'parent',
        familyId,
        'Reward paid'
      );

      setSuccess(`Settled ${rewardSettings?.currency_symbol || '₹'}${cashBalance} for ${child?.name || 'child'} and reset balance to zero.`);
      setSettleChildId('');
    } catch (err) {
      console.error('Failed to settle reward balance:', err);
      setError('Could not settle reward balance.');
    } finally {
      setSettleSaving(false);
    }
  };

  const normalizeWheelSegments = (segments: string[]) => (
    segments
      .map((segment) => segment.trim())
      .filter(Boolean)
      .slice(0, 12)
  );

  const handleSendScratchReward = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !scratchChildId) {
      setError('Choose a child for the scratch reward.');
      return;
    }

    const stars = Number(scratchStars);
    if (scratchRevealType !== 'wheel' && (scratchPrizeType === 'stars' || scratchPrizeType === 'cash') && (!Number.isFinite(stars) || stars <= 0)) {
      setError(`Enter the ${scratchPrizeType === 'cash' ? 'cash' : 'star'} value for this surprise reward.`);
      return;
    }

    const wheelSegments = scratchRevealType === 'wheel' ? normalizeWheelSegments(scratchWheelSegments) : [];
    if (scratchRevealType === 'wheel' && wheelSegments.length < 2) {
      setError('Add at least two spin wheel options.');
      return;
    }

    const prizeLabel = scratchRevealType === 'wheel'
      ? `Spin wheel: ${wheelSegments.join(' / ')}`
      : scratchPrizeType === 'stars'
      ? `${stars} stars`
      : scratchPrizeType === 'cash'
        ? `${rCurrencySymbol || '₹'}${stars}`
      : scratchPrizeLabel.trim();

    if (!prizeLabel) {
      setError('Add the surprise reward prize.');
      return;
    }

    setScratchSaving(true);
    setError('');
    try {
      await createScratchCard({
        child_id: scratchChildId,
        parent_id: user.id,
        family_id: familyId,
        title: scratchTitle.trim() || (scratchRevealType === 'wheel' ? 'Spin surprise' : 'Scratch surprise'),
        reveal_type: scratchRevealType,
        prize_type: scratchRevealType === 'wheel' ? 'custom' : scratchPrizeType,
        prize_label: prizeLabel,
        stars_value: scratchRevealType === 'wheel' ? 0 : (scratchPrizeType === 'stars' || scratchPrizeType === 'cash' ? stars : 0),
        cash_value: scratchRevealType === 'wheel' ? 0 : (scratchPrizeType === 'cash' ? stars : 0),
        wheel_segments: scratchRevealType === 'wheel' ? wheelSegments : undefined,
        reason: scratchReason.trim() || 'Completed something special',
      });

      await sendMessage(
        scratchChildId,
        user.id,
        scratchRevealType === 'wheel' ? 'You received a spin wheel reward. Open it in Rewards.' : 'You received a scratch reward. Open it in Rewards.',
        'parent',
        user.id,
        scratchRevealType === 'wheel' ? 'Spin wheel reward' : 'Scratch reward'
      );

      setSuccess(scratchRevealType === 'wheel' ? 'Wheel reward sent.' : 'Scratch reward sent.');
      setScratchReason('');
      setScratchPrizeLabel(scratchPrizeType === 'stars' ? `${stars} stars` : scratchPrizeType === 'cash' ? `${rCurrencySymbol || '₹'}${stars}` : '');
    } catch (err) {
      console.error('Failed to send scratch reward:', err);
      setError('Could not send scratch reward.');
    } finally {
      setScratchSaving(false);
    }
  };

  const handleSaveScratchTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const stars = Number(scratchTemplateStars);
    if (scratchTemplateRevealType !== 'wheel' && (scratchTemplatePrizeType === 'stars' || scratchTemplatePrizeType === 'cash') && (!Number.isFinite(stars) || stars <= 0)) {
      setError(`Enter the ${scratchTemplatePrizeType === 'cash' ? 'cash' : 'star'} value for this surprise template.`);
      return;
    }

    const wheelSegments = scratchTemplateRevealType === 'wheel' ? normalizeWheelSegments(scratchTemplateWheelSegments) : [];
    if (scratchTemplateRevealType === 'wheel' && wheelSegments.length < 2) {
      setError('Add at least two spin wheel template options.');
      return;
    }

    const prizeLabel = scratchTemplateRevealType === 'wheel'
      ? `Spin wheel: ${wheelSegments.join(' / ')}`
      : scratchTemplatePrizeType === 'stars'
      ? `${stars} stars`
      : scratchTemplatePrizeType === 'cash'
        ? `${rCurrencySymbol || '₹'}${stars}`
      : scratchTemplatePrizeLabel.trim();

    if (!prizeLabel) {
      setError('Add the surprise template prize.');
      return;
    }

    setScratchTemplateSaving(true);
    setError('');
    try {
      await createScratchTemplate({
        parent_id: user.id,
        family_id: familyId,
        child_id: scratchTemplateChildId || '',
        title: scratchTemplateTitle.trim() || `${getScratchTriggerLabel(scratchTemplateTrigger)} ${scratchTemplateRevealType === 'wheel' ? 'spin' : 'scratch'}`,
        reveal_type: scratchTemplateRevealType,
        prize_type: scratchTemplateRevealType === 'wheel' ? 'custom' : scratchTemplatePrizeType,
        prize_label: prizeLabel,
        stars_value: scratchTemplateRevealType === 'wheel' ? 0 : (scratchTemplatePrizeType === 'stars' || scratchTemplatePrizeType === 'cash' ? stars : 0),
        cash_value: scratchTemplateRevealType === 'wheel' ? 0 : (scratchTemplatePrizeType === 'cash' ? stars : 0),
        wheel_segments: scratchTemplateRevealType === 'wheel' ? wheelSegments : undefined,
        trigger: scratchTemplateTrigger,
        is_active: true,
      });
      setSuccess(`Surprise template saved for ${getScratchTriggerLabel(scratchTemplateTrigger)}.`);
    } catch (err) {
      console.error('Failed to save scratch template:', err);
      setError('Could not save scratch template.');
    } finally {
      setScratchTemplateSaving(false);
    }
  };

  // Analytics state
  const [childProfiles, setChildProfiles] = useState<Array<any>>([]);
  const [enrichedChildProfiles, setEnrichedChildProfiles] = useState<Array<any>>([]);
  const [weeklyStarsTrend, setWeeklyStarsTrend] = useState<number[]>([]);
  const [selectedTrendChild, setSelectedTrendChild] = useState<string>('');
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [tasksCompletedCount, setTasksCompletedCount] = useState(0);
  const [avgConsistency, setAvgConsistency] = useState(0);
  const [avgBmi, setAvgBmi] = useState(0);
  const [pendingProofCount, setPendingProofCount] = useState(0);
  const [upcomingEventsCount, setUpcomingEventsCount] = useState(0);
  const [examsCount, setExamsCount] = useState(0);
  const getEventDateValue = (event: any) => event.start_at || event.date || event.created_at || null;
  const getExamDateValue = (exam: any) => exam.exam_date || exam.date || exam.created_at || null;
  const isExamInMonth = (exam: any, month: number, year: number) => {
    const dateValue = getExamDateValue(exam);
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    return date.getMonth() === month && date.getFullYear() === year;
  };
  const calculateBmi = (heightCm?: number, weightKg?: number) => {
    const h = Number(heightCm) || 0;
    const w = Number(weightKg) || 0;
    if (h <= 0 || w <= 0) return null;
    return Number((w / ((h / 100) * (h / 100))).toFixed(1));
  };
  const selectedAutomationChildId = automationChildId || children[0]?.id || '';
  const selectedAutomationProfile = (childProfiles.find((profile) => profile.id === selectedAutomationChildId) || null) as ChildProfile | null;
  const selectedAutomationName = children.find((child) => child.id === selectedAutomationChildId)?.name || 'Child';
  const selectedChildEvents = events.filter((event) => !event.child_id || event.child_id === selectedAutomationChildId) as AppEvent[];
  const selectedChildExams = exams
    .filter((exam) => !exam.child_id || exam.child_id === selectedAutomationChildId)
    .map((exam) => ({
      id: exam.id,
      child_id: exam.child_id || selectedAutomationChildId,
      subject: exam.subject,
      marks_scored: Number(exam.marks_scored) || 0,
      total_marks: Number(exam.total_marks) || 0,
      exam_date: exam.exam_date || exam.date || new Date().toISOString()
    })) as ExamResult[];
  const upcomingExamEvents = selectedChildEvents.filter((event) => {
    const eventDate = getEventDateValue(event);
    const eventKind = event.type || (event as any).category;
    return eventKind === 'exam' && eventDate && new Date(eventDate) >= new Date(new Date().toDateString());
  });
  const {
    routine,
    loading: routineLoading,
    createRoutine,
    updateRoutine
  } = useRoutineConfiguration(familyId, selectedAutomationChildId);
  const {
    scheduledTasks,
    loading: schedulerLoading,
    error: schedulerError,
    generateTodaysTasks,
    generateExamTasks
  } = useTaskScheduler(
    selectedAutomationChildId,
    familyId,
    routine,
    selectedAutomationProfile,
    selectedChildExams,
    selectedChildEvents
  );
  const {
    reminders,
    loading: remindersLoading,
    createReminder,
    updateReminder,
    deleteReminder,
    requestPermission,
    notificationPermission
  } = useReminders(selectedAutomationChildId, familyId);
  const {
    rewards: rewardItems,
    loading: rewardItemsLoading,
    createReward,
    updateReward,
    deleteReward
  } = useRewards(familyId);
  const {
    redemptions,
    loading: redemptionsLoading,
    updateRedemptionStatus
  } = useRedemptions(selectedAutomationChildId, familyId);
  const {
    entries: selectedRewardLedger,
    loading: selectedRewardLedgerLoading
  } = useRewardLedger(selectedAutomationChildId, familyId);
  const selectedRewardMonthSummary = useMemo(
    () => getRewardLedgerMonthSummary(selectedRewardLedger),
    [selectedRewardLedger]
  );
  const {
    templates: scratchTemplates,
    templatesLoading: scratchTemplatesLoading,
    createScratchCard,
    createScratchTemplate,
    updateScratchTemplate
  } = useScratchRewards(scratchChildId || selectedAutomationChildId, familyId);

  useEffect(() => {
    if (!automationChildId && children[0]?.id) {
      setAutomationChildId(children[0].id);
    }
  }, [automationChildId, children]);

  useEffect(() => {
    if (!activityChildId && children[0]?.id) {
      setActivityChildId(children[0].id);
    }
  }, [activityChildId, children]);

  useEffect(() => {
    if (!user) {
      setChildProfiles([]);
      return;
    }

    const cpq = query(collection(db, 'child_profile'), where('parent_id', '==', familyId));
    const unsub = onSnapshot(
      cpq,
      (snap) => {
        const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setChildProfiles(mapped);
      },
      (err) => console.error('Failed to fetch child profiles for analytics:', err)
    );

    return () => unsub();
  }, [user, familyId]);

  // Subscribe to completed task logs to compute completed tasks and stars
  useEffect(() => {
    if (!user) {
      setTasksCompletedCount(0);
      setEnrichedChildProfiles(childProfiles);
      return;
    }

    const logQuery = query(
      collection(db, 'task_logs'),
      where('parent_id', '==', familyId),
      limit(500)
    );
    const unsub = onSnapshot(
      logQuery,
      (snap) => {
        const visibleCompleted = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((d) => d.status === 'completed');

        setTasksCompletedCount(visibleCompleted.length);

        // map task id -> star/points from tasks list
        const taskMap = new Map<string, number>(tasks.map((t: any) => [t.id, Number(t.points ?? t.star_value ?? 0)]));

        const starsByChild: Record<string, number> = {};
        visibleCompleted.forEach((entry) => {
          const star = Number(taskMap.get(entry.task_id) || 0);
          if (!entry.child_id) return;
          starsByChild[entry.child_id] = (starsByChild[entry.child_id] || 0) + star;
        });

        const enriched = childProfiles.map((cp) => {
          const recent = starsByChild[cp.id] || 0;
          const existing = Number(cp.total_stars) || 0;
          const combined = existing + recent;
          return {
            ...cp,
            recentStars: recent,
            computedTotalStars: combined,
            levelInfo: computeLevelFromStars(combined),
            badges: evaluateBadges({ total_stars: combined, streak_count: cp.streak_count, consistency_score: cp.consistency_score })
          };
        });

        setEnrichedChildProfiles(enriched);

        // compute weekly stars trend (last 7 days, inclusive today)
        const days = Array.from({ length: 7 }).map(() => 0);
        const dayKeys = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - (6 - i));
          return d.toDateString();
        });

        const completedForTrend = selectedTrendChild ? visibleCompleted.filter((entry) => entry.child_id === selectedTrendChild) : visibleCompleted;

        completedForTrend.forEach((entry) => {
          const ts = entry.timestamp || entry.created_at || entry.time || entry.date;
          const pd = ts ? new Date(ts) : new Date();
          const key = pd.toDateString();
          const idx = dayKeys.indexOf(key);
          const star = Number(taskMap.get(entry.task_id) || 0);
          if (idx >= 0) days[idx] += star;
        });

        setWeeklyStarsTrend(days);

      },
      (err) => console.error('Failed to subscribe to completed task logs for analytics:', err)
    );

    return () => unsub();
  }, [user, children, tasks, childProfiles]);

  useEffect(() => {
    // aggregate simple analytics from existing subscriptions
    setTotalTasksCount(tasks.length);
    setPendingProofCount(visiblePendingProofs.length);
    const currentMonth = new Date();
    setExamsCount(exams.filter((exam) => isExamInMonth(exam, currentMonth.getMonth(), currentMonth.getFullYear())).length);

    const today = new Date();
    const upcoming = events.filter((ev) => {
      try {
        const eventDate = getEventDateValue(ev);
        return eventDate && new Date(eventDate) >= new Date(today.toDateString());
      } catch {
        return false;
      }
    }).length;
    setUpcomingEventsCount(upcoming);

    // consistency average
    if (childProfiles.length === 0) {
      setAvgConsistency(0);
      setAvgBmi(0);
    } else {
      const totalConsistency = childProfiles.reduce((s, p) => s + (Number(p.consistency_score) || 0), 0);
      setAvgConsistency(Math.round(totalConsistency / childProfiles.length));

      const totalBmi = childProfiles.reduce((s, p) => {
        const h = Number(p.height_cm) || 0;
        const w = Number(p.weight_kg) || 0;
        if (h > 0 && w > 0) {
          const bmi = w / ((h / 100) * (h / 100));
          return s + bmi;
        }
        return s;
      }, 0);
      const countWithBmi = childProfiles.filter((p) => (Number(p.height_cm) || 0) > 0 && (Number(p.weight_kg) || 0) > 0).length;
      setAvgBmi(countWithBmi > 0 ? Number((totalBmi / countWithBmi).toFixed(1)) : 0);
    }
  }, [tasks, visiblePendingProofs, exams, events, childProfiles]);

  const cancelEditGrowth = () => {
    setEditGrowthId(null);
    setGChild('');
    setGHeight('');
    setGWeight('');
    setGDate('');
  };

  const cardBase = 'rounded-3xl border p-5 shadow-[var(--card-shadow)]';
  const hasChildren = children.length > 0;
  const getChildName = (childId?: string) => children.find((c) => c.id === childId)?.name || 'Child';
  const currentExamSnapshotDate = new Date();
  const latestExams = exams
    .filter((exam) => isExamInMonth(exam, currentExamSnapshotDate.getMonth(), currentExamSnapshotDate.getFullYear()))
    .slice()
    .sort((a, b) => new Date(b.exam_date || 0).getTime() - new Date(a.exam_date || 0).getTime())
    .slice(0, 3);
  const upcomingEventsPreview = events
    .filter((ev) => {
      const eventDate = getEventDateValue(ev);
      return eventDate && new Date(eventDate) >= new Date(new Date().toDateString());
    })
    .sort((a, b) => new Date(getEventDateValue(a) || 0).getTime() - new Date(getEventDateValue(b) || 0).getTime())
    .slice(0, 3);
  const latestGrowthLogs = [...growthLogs]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 3);
  const dashboardChildId = selectedAutomationChildId || children[0]?.id || '';
  const dashboardChild = children.find((child) => child.id === dashboardChildId) || children[0];
  const dashboardProfile = (childProfiles.find((profile) => profile.id === dashboardChildId) || null) as ChildProfile | null;
  const dashboardChildName = dashboardChild?.name || dashboardProfile?.name || 'your child';
  const dashboardTasks = tasks.filter((task) => !dashboardChildId || task.child_id === dashboardChildId);
  const activeDashboardTasks = dashboardTasks.filter((task) => task.status !== 'completed' && task.status !== 'expired' && task.status !== 'failed');
  const completedDashboardTasks = dashboardTasks.filter((task) => task.status === 'completed');
  const dashboardChallenges = activeChallenges.filter((challenge) => !dashboardChildId || challenge.child_id === dashboardChildId);
  const dashboardStars = Number(dashboardProfile?.total_stars || 0);
  const dashboardPendingApprovals = topLevelApprovals.filter((approval) => approval.status === 'pending' && (!dashboardChildId || approval.child_id === dashboardChildId));
  const dashboardPendingProofs = visiblePendingProofs.filter((proof) => !dashboardChildId || proof.child_id === dashboardChildId);
  const dashboardNeedsAttention = dashboardPendingApprovals.length + dashboardPendingProofs.length;
  const dashboardStatusText = !hasChildren
    ? 'Add a child to begin.'
    : dashboardNeedsAttention > 0
      ? `${dashboardNeedsAttention} item${dashboardNeedsAttention === 1 ? '' : 's'} need your review.`
      : activeDashboardTasks.length > 0
        ? `${dashboardChildName} has ${activeDashboardTasks.length} active task${activeDashboardTasks.length === 1 ? '' : 's'} today.`
        : `${dashboardChildName} is all clear right now.`;
  const dashboardRecentActivity = [
    ...completedDashboardTasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      meta: `${Number(task.points ?? task.star_value ?? 0)} stars earned`,
      date: task.completed_at || task.updated_at || task.created_at,
      tone: 'emerald' as const,
    })),
    ...topLevelApprovals
      .filter((approval) => !dashboardChildId || approval.child_id === dashboardChildId)
      .map((approval) => ({
        id: `approval-${approval.id}`,
        title: approval.title,
        meta: `${approval.type} ${approval.status}`,
        date: approval.reviewed_at || approval.created_at,
        tone: approval.status === 'pending' ? 'amber' as const : 'cyan' as const,
      })),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 5);

  const saveRoutineConfiguration = async (updates: Parameters<typeof updateRoutine>[0]) => {
    if (!routine?.id) {
      await createRoutine({
        parent_id: familyId,
        child_id: selectedAutomationChildId,
        school_days_routine: updates.school_days_routine || routine?.school_days_routine || [],
        vacation_routine: updates.vacation_routine || routine?.vacation_routine || [],
        academic_mode_start: updates.academic_mode_start || routine?.academic_mode_start || '06-01',
        academic_mode_end: updates.academic_mode_end || routine?.academic_mode_end || '03-31',
        current_mode: updates.current_mode || routine?.current_mode || 'academic'
      });
      setSuccess('Routine created.');
      return;
    }

    await updateRoutine(updates);
    setSuccess('Routine updated.');
  };

  const handleChildSubmissionDecision = async (
    collectionName: 'tasks' | 'events' | 'achievements',
    submissionId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      const updates: any = {
        approval_status: status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || familyId
      };

      if (status === 'approved' && collectionName === 'events') {
        const itemSnap = await getDoc(doc(db, collectionName, submissionId));
        if (itemSnap.exists()) {
          const itemData = itemSnap.data();
          if (itemData.points_allocated && itemData.points_allocated > 0 && itemData.child_id && !itemData.attendance_approved) {
            updates.attendance_approved = true;
            const rewardSettings = await fetchCashRewardSettings(familyId, user?.id);
            const eventCashReward = calculateCashReward(itemData.points_allocated, Number(itemData.performance_stars || 5), rewardSettings);
            const profileRef = doc(db, 'child_profile', itemData.child_id);
            const profileSnap = await getDoc(profileRef);
            if (profileSnap.exists()) {
              const currentStars = profileSnap.data().total_stars || 0;
              await updateDoc(profileRef, {
                total_stars: currentStars + eventCashReward.amount
              });
            }
          }
        }
      }

      await updateDoc(doc(db, collectionName, submissionId), updates);
      setSuccess(`Submission ${status}.`);
    } catch (err) {
      console.error('Failed to update child submission:', err);
      setError('Could not update child submission.');
    }
  };

  const createReminderForSelectedChild = async (reminder: Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>) => {
    await createReminder({
      ...reminder,
      child_id: selectedAutomationChildId,
      parent_id: familyId
    });
    setSuccess('Reminder saved.');
  };

  const seedDefaultReminders = async () => {
    if (!selectedAutomationChildId) return;
    for (const reminder of getDefaultReminders(selectedAutomationChildId, familyId)) {
      await createReminder(reminder);
    }
    setSuccess(`Default reminders added for ${selectedAutomationName}.`);
  };

  const createRewardForFamily = async (reward: Omit<RewardItem, 'id' | 'created_at' | 'updated_at'>) => {
    await createReward({
      ...reward,
      parent_id: user?.id || familyId,
      family_id: familyId
    });
    setSuccess('Reward saved.');
  };

  const seedDefaultRewards = async () => {
    for (const reward of getDefaultRewards(familyId)) {
      await createReward({
        ...reward,
        parent_id: user?.id || familyId,
        family_id: familyId
      });
    }
    setSuccess('Default reward marketplace added.');
  };

  const activityFilterOptions = useMemo(() => {
    const byId = new Map<string, { id: string; label: string; color: string }>();
    allPlannerPrograms.forEach((program, index) => {
      byId.set(program.id, {
        id: program.id,
        label: program.name || 'Activity',
        color: program.color || ACTIVITY_FILTER_PALETTE[index % ACTIVITY_FILTER_PALETTE.length]
      });
    });

    [...tasks, ...exams, ...events, ...activeChallenges, ...completedChallenges].forEach((item: any) => {
      const activityId = item?.linked_program_id;
      if (activityId && !byId.has(activityId)) {
        byId.set(activityId, {
          id: activityId,
          label: String(activityId),
          color: ACTIVITY_FILTER_PALETTE[byId.size % ACTIVITY_FILTER_PALETTE.length]
        });
      }
    });

    return Array.from(byId.values());
  }, [activeChallenges, allPlannerPrograms, completedChallenges, events, exams, tasks]);

  const matchesActivityFilter = (item: any, activityId: string) => (
    activityId === 'all' || item?.linked_program_id === activityId
  );

  const renderActivityFilter = (
    value: string,
    onChange: (activityId: string) => void,
    allCount: number
  ) => {
    const selectedLabel = value === 'all'
      ? 'All'
      : activityFilterOptions.find((activity) => activity.id === value)?.label || 'Selected activity';

    return (
      <div className="mt-4 rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Activities</p>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{selectedLabel}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onChange('all')}
            className={clsx(
              'relative flex min-h-[38px] shrink-0 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 pr-5 text-left text-xs font-bold transition',
              value === 'all' ? 'border-cyan-300/60 bg-cyan-400/15 text-cyan-900 dark:text-cyan-100' : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65 dark:hover:bg-white/[0.06]'
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" aria-hidden="true" />
            <span>All</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-white/10 dark:text-white/70">{allCount}</span>
            <span className="absolute right-0 top-0 h-full w-1 bg-cyan-400" aria-hidden="true" />
          </button>
          {activityFilterOptions.map((activity) => (
            <button
              key={activity.id}
              type="button"
              onClick={() => onChange(activity.id)}
              className={clsx(
                'relative flex min-h-[38px] max-w-[240px] shrink-0 items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 pr-5 text-left text-xs font-bold transition',
                value === activity.id ? 'border-slate-300 bg-white text-slate-900 shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-white' : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-white/65 dark:hover:bg-white/[0.06]'
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_12px_currentColor]"
                style={{ backgroundColor: activity.color, color: activity.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate">{activity.label}</span>
              <span
                className={clsx('absolute right-0 top-0 h-full w-1 transition-opacity', value === activity.id ? 'opacity-100' : 'opacity-45')}
                style={{ background: `linear-gradient(180deg, ${activity.color}, ${activity.color}88)` }}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  const filteredTasks = tasks.filter((task) => matchesActivityFilter(task, taskActivityFilter));
  const filteredExams = exams.filter((exam) => matchesActivityFilter(exam, examActivityFilter));
  const filteredEvents = events.filter((event) => matchesActivityFilter(event, eventActivityFilter));
  const filteredActiveChallenges = activeChallenges.filter((challenge) => matchesActivityFilter(challenge, challengeActivityFilter));
  const filteredCompletedChallenges = completedChallenges.filter((challenge) => matchesActivityFilter(challenge, challengeActivityFilter));
  const selectedExamMonth = Number(examFilterMonth);
  const selectedExamYear = Number(examFilterYear);
  const examYearOptions = Array.from(new Set([
    new Date().getFullYear(),
    ...exams
      .map((exam) => {
        const dateValue = getExamDateValue(exam);
        const date = dateValue ? new Date(dateValue) : null;
        return date && !Number.isNaN(date.getTime()) ? date.getFullYear() : null;
      })
      .filter((year): year is number => year !== null)
  ])).sort((a, b) => b - a);
  const examPeriodCount = (filterChild ? exams.filter((exam) => exam.child_id === filterChild) : exams)
    .filter((exam) => isExamInMonth(exam, selectedExamMonth, selectedExamYear)).length;

  const automatedTasks = tasks.filter((task) => task.is_generated === true);
  const manualTasks = tasks.filter((task) => task.is_generated !== true);
  const selectedActivityTasks = selectedActivity
    ? tasks.filter((task) => task.child_id === selectedActivity.childId && task.linked_program_id === selectedActivity.id)
    : [];
  const selectedActivityExams = selectedActivity
    ? exams.filter((exam) => exam.child_id === selectedActivity.childId && exam.linked_program_id === selectedActivity.id)
    : [];
  const selectedActivityEvents = selectedActivity
    ? events.filter((event) => event.child_id === selectedActivity.childId && event.linked_program_id === selectedActivity.id)
    : [];

  const mappableTasks = selectedActivity
    ? tasks.filter((task) => task.child_id === selectedActivity.childId && !task.linked_program_id)
    : [];
  const mappableExams = selectedActivity
    ? exams.filter((exam) => exam.child_id === selectedActivity.childId && !exam.linked_program_id)
    : [];

  const visibleExams = (filterChild ? filteredExams.filter((x) => x.child_id === filterChild) : filteredExams)
    .filter((exam) => isExamInMonth(exam, selectedExamMonth, selectedExamYear));
  const upcomingExamSchedules = visibleExams.filter((ex) => (ex.status || 'scheduled') === 'scheduled');
  const pendingExamResults = visibleExams.filter((ex) => (ex.status || 'scheduled') === 'completed_pending_result');
  const publishedExamResults = visibleExams.filter((ex) => (ex.status || 'scheduled') === 'result_published');

  const linkTaskToActivity = async (taskId: string) => {
    if (!selectedActivity) return;
    await updateDoc(doc(db, 'tasks', taskId), {
      linked_program_id: selectedActivity.id,
      updated_at: new Date().toISOString()
    });
    setSuccess('Task mapped to activity.');
  };

  const linkExamToActivity = async (examId: string) => {
    if (!selectedActivity) return;
    await updateDoc(doc(db, 'exams', examId), {
      linked_program_id: selectedActivity.id,
      updated_at: new Date().toISOString()
    });
    setSuccess('Exam mapped to activity.');
  };

  const clearActivityForm = () => {
    setActivityName('');
    setActivityStartDate('');
    setActivityEndDate('');
    setActivityModules(['tasks']);
    setActivityTaskPoints('');
    setActivityExamPoints('');
    setActivityChallengePoints('');
    setActivityEventPoints('');
    setEditingActivityId(null);
  };

  const toggleActivityModule = (moduleId: PlannerActivityModule) => {
    setActivityModules((prev) => {
      const hasModule = prev.includes(moduleId);
      const next = hasModule ? prev.filter((item) => item !== moduleId) : [...prev, moduleId];
      return next.length ? next : ['tasks'];
    });
  };

  const startEditActivity = (program: PlannerProgram) => {
    setEditingActivityId(program.id);
    setActivityName(program.name || '');
    setActivityStartDate(program.startDate ? new Date(program.startDate).toISOString().slice(0, 10) : '');
    setActivityEndDate(program.endDate ? new Date(program.endDate).toISOString().slice(0, 10) : '');
    setActivityModules(program.modules && program.modules.length ? program.modules : ['tasks']);
    setActivityTaskPoints(program.pointsConfig?.taskPoints ?? '');
    setActivityExamPoints(program.pointsConfig?.examPoints ?? '');
    setActivityChallengePoints(program.pointsConfig?.challengePoints ?? '');
    setActivityEventPoints(program.pointsConfig?.eventPoints ?? '');
    setIsActivityModalOpen(true);
  };

  const handleSaveActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedActivityChildId || !activityName.trim()) return;
    try {
      const pointsModules: PlannerActivityModule[] = ['tasks', 'exams', 'challenges', 'events'];
      const hasAnyPoints = activityModules.some(m => pointsModules.includes(m));
      await upsertPlannerProgram(
        selectedActivityChildId,
        familyId,
        {
          name: activityName.trim(),
          category: activityName.trim().toLowerCase() === 'school' ? 'school' : 'custom',
          modules: activityModules,
          isDefault: activityName.trim().toLowerCase() === 'school',
          startDate: activityStartDate || null,
          endDate: activityEndDate || null,
          pointsConfig: hasAnyPoints ? {
            taskPoints: activityTaskPoints !== '' ? Number(activityTaskPoints) : null,
            examPoints: activityExamPoints !== '' ? Number(activityExamPoints) : null,
            challengePoints: activityChallengePoints !== '' ? Number(activityChallengePoints) : null,
            eventPoints: activityEventPoints !== '' ? Number(activityEventPoints) : null,
          } : null
        },
        editingActivityId || undefined
      );
      await refreshActivityPrograms();
      clearActivityForm();
      setSuccess('Activity saved.');
      setIsActivityModalOpen(false);
    } catch (err: any) {
      console.error('Failed to save activity:', err);
      setError(err.message || 'Could not save activity.');
    }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this activity?')) return;
    try {
      await deleteDoc(doc(db, 'programs', id));
      await refreshActivityPrograms();
      setSuccess('Activity deleted.');
    } catch (err: any) {
      setError(err.message || 'Could not delete activity.');
    }
  };

  const handleCompleteActivity = async (program: PlannerProgram) => {
    if (!window.confirm('Are you sure you want to mark this activity as completed?\n\nThis will move it to the archive, keeping past tasks but deleting any tasks scheduled in the future.')) return;
    try {
      await updateDoc(doc(db, 'programs', program.id), {
        is_active: false,
        end_date: new Date().toISOString()
      });

      // Delete future tasks
      const now = new Date();
      const futureTasks = tasks.filter(t => t.linked_program_id === program.id && new Date(t.due_date || t.available_from || t.created_at) > now);
      for (const t of futureTasks) {
        await deleteDoc(doc(db, 'tasks', t.id));
      }

      // Delete future exams
      const futureExams = exams.filter(e => e.linked_program_id === program.id && e.exam_date && new Date(e.exam_date) > now);
      for (const e of futureExams) {
        await deleteDoc(doc(db, 'exams', e.id));
      }

      // Delete future events
      const futureEvents = events.filter(ev => ev.linked_program_id === program.id && ev.date && new Date(ev.date) > now);
      for (const ev of futureEvents) {
        await deleteDoc(doc(db, 'events', ev.id));
      }

      await refreshActivityPrograms();
      setSuccess('Activity completed and archived.');
      if (selectedActivity?.id === program.id) {
        setSelectedActivity(null);
      }
    } catch (err: any) {
      setError(err.message || 'Could not complete activity.');
    }
  };

  const handleUnarchiveActivity = async (program: PlannerProgram) => {
    if (!window.confirm('Are you sure you want to unarchive this activity?')) return;
    try {
      await updateDoc(doc(db, 'programs', program.id), {
        is_active: true,
        end_date: null
      });
      await refreshActivityPrograms();
      setSuccess('Activity unarchived.');
    } catch (err: any) {
      setError(err.message || 'Could not unarchive activity.');
    }
  };

  const handleGenerateTelegramLinkCode = async () => {
    if (!user || !familyId || telegramLinkGenerating) return;
    setTelegramLinkGenerating(true);
    setError('');
    try {
      const code = createTelegramLinkCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await setDoc(doc(db, 'telegram_link_codes', code), {
        family_id: familyId,
        parent_id: user.id,
        created_by: user.id,
        created_at: new Date().toISOString(),
        expires_at: Timestamp.fromDate(expiresAt),
        used: false
      });
      setTelegramLinkCode(code);
      setTelegramLinkExpiresAt(expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setSuccess('Telegram link code created.');
    } catch (err: any) {
      setError(err?.message || 'Could not create Telegram link code.');
    } finally {
      setTelegramLinkGenerating(false);
    }
  };

  const handleSaveTelegramSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !familyId || telegramSettingsSaving) return;
    setTelegramSettingsSaving(true);
    setError('');
    try {
      const normalizedUsername = telegramBotUsername.trim().replace(/^@/, '');
      await setDoc(doc(db, 'telegram_settings', familyId), {
        family_id: familyId,
        parent_id: user.id,
        bot_username: normalizedUsername,
        updated_at: new Date().toISOString()
      }, { merge: true });
      setTelegramBotUsername(normalizedUsername);
      setSuccess('Telegram settings saved.');
    } catch (err: any) {
      setError(err?.message || 'Could not save Telegram settings.');
    } finally {
      setTelegramSettingsSaving(false);
    }
  };

  const buildFamilyBackup = async (): Promise<FirestoreBackupPayload> => {
    if (!user || !familyId) {
      throw new Error('Sign in as a parent before creating a backup.');
    }

    const byPath = new Map<string, FirestoreBackupDocument>();
    const addDocument = (collectionName: string, id: string, data: Record<string, unknown>) => {
      byPath.set(`${collectionName}/${id}`, {
        collection: collectionName,
        id,
        data: normalizeBackupValue(data) as Record<string, unknown>
      });
    };

    const parentUser = await getDoc(doc(db, 'users', familyId));
    if (parentUser.exists()) {
      addDocument('users', parentUser.id, parentUser.data() as Record<string, unknown>);
    }

    for (const child of children) {
      const [childUser, childProfile] = await Promise.all([
        getDoc(doc(db, 'users', child.id)),
        getDoc(doc(db, 'child_profile', child.id))
      ]);
      if (childUser.exists()) {
        addDocument('users', childUser.id, childUser.data() as Record<string, unknown>);
      }
      if (childProfile.exists()) {
        addDocument('child_profile', childProfile.id, childProfile.data() as Record<string, unknown>);
      }
    }

    for (const collectionName of FAMILY_BACKUP_COLLECTIONS) {
      for (const field of BACKUP_QUERY_FIELDS) {
        const values = field === 'child_id' ? children.map((child) => child.id) : [familyId];
        for (const value of values) {
          try {
            const snapshot = await getDocs(query(collection(db, collectionName), where(field, '==', value)));
            snapshot.docs.forEach((row) => addDocument(collectionName, row.id, row.data() as Record<string, unknown>));
          } catch (err) {
            console.warn(`Backup skipped ${collectionName}.${field}`, err);
          }
        }
      }
    }

    return {
      app: 'TikTrack',
      schemaVersion: 1,
      familyId,
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
      documents: Array.from(byPath.values()).sort((a, b) => `${a.collection}/${a.id}`.localeCompare(`${b.collection}/${b.id}`))
    };
  };

  const handleDownloadBackup = async () => {
    if (backupWorking) return;
    setBackupWorking(true);
    setError('');
    try {
      const backup = await buildFamilyBackup();
      const dateKey = new Date().toISOString().slice(0, 10);
      downloadJsonFile(`tiktrack-backup-${familyId}-${dateKey}.json`, backup);
      setSuccess(`Backup created with ${backup.documents.length} documents.`);
    } catch (err: any) {
      console.error('Backup failed:', err);
      setError(err?.message || 'Could not create backup.');
    } finally {
      setBackupWorking(false);
    }
  };

  const validateRestorePayload = (payload: FirestoreBackupPayload) => {
    if (!payload || payload.app !== 'TikTrack' || payload.schemaVersion !== 1 || !Array.isArray(payload.documents)) {
      throw new Error('This does not look like a TikTrack backup file.');
    }
    if (payload.familyId !== familyId) {
      throw new Error('This backup belongs to a different family account.');
    }
    const allowedChildIds = new Set(children.map((child) => child.id));
    for (const item of payload.documents) {
      if (!item.collection || !item.id || !item.data || typeof item.data !== 'object') {
        throw new Error('Backup contains an invalid document entry.');
      }
      const data = item.data as Record<string, unknown>;
      if (typeof data.family_id === 'string' && data.family_id !== familyId) {
        throw new Error(`Backup contains data for another family in ${item.collection}/${item.id}.`);
      }
      if (typeof data.parent_id === 'string' && data.parent_id !== familyId && data.parent_id !== user?.id) {
        throw new Error(`Backup contains data for another parent in ${item.collection}/${item.id}.`);
      }
      if (typeof data.child_id === 'string' && !allowedChildIds.has(data.child_id)) {
        throw new Error(`Backup contains an unknown child in ${item.collection}/${item.id}.`);
      }
    }
  };

  const restoreFamilyBackup = async (payload: FirestoreBackupPayload) => {
    validateRestorePayload(payload);
    const chunks: FirestoreBackupDocument[][] = [];
    for (let index = 0; index < payload.documents.length; index += 400) {
      chunks.push(payload.documents.slice(index, index + 400));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        batch.set(doc(db, item.collection, item.id), restoreBackupValue(item.data) as Record<string, unknown>);
      });
      await batch.commit();
    }
  };

  const handleRestoreBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || restoreWorking) return;

    const confirmed = window.confirm('Restore will overwrite matching TikTrack documents from this backup. Create a fresh backup first, then continue only if you trust this file.');
    if (!confirmed) return;

    setRestoreFileName(file.name);
    setRestoreWorking(true);
    setError('');
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as FirestoreBackupPayload;
      await restoreFamilyBackup(payload);
      setSuccess(`Restore completed from ${file.name}.`);
    } catch (err: any) {
      console.error('Restore failed:', err);
      setError(err?.message || 'Could not restore backup.');
    } finally {
      setRestoreWorking(false);
    }
  };

  const handleSendNudge = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!nudgeChildId || !nudgeMessage.trim()) {
      setError('Select a child and choose a nudge message.');
      return;
    }

    try {
      await sendMessage(nudgeChildId, familyId, nudgeMessage.trim(), 'parent', familyId, 'Quick nudge');
      setInboxChildId(nudgeChildId);
      setInboxMessage('');
      setInboxSubject('');
      setIsNudgeModalOpen(false);
      setSuccess('Nudge sent.');
    } catch (err: any) {
      console.error('Failed to send nudge:', err);
      setError(err?.message || 'Could not send nudge.');
    }
  };

  const renderRewardsPage = () => {
    const activeSettings = rewards[0] ? normalizeRewardSettings(rewards[0]) : null;
    const rewardRate = Number(activeSettings?.point_to_cash_rate || rStarRate || 0);
    const rewardCurrency = activeSettings?.currency_symbol || rCurrencySymbol || '₹';
    const walletStars = Number(selectedAutomationProfile?.total_stars || 0);
    const walletCash = walletStars * rewardRate;
    const monthEarnedCash = selectedRewardMonthSummary.earned * rewardRate;
    const monthSpentCash = selectedRewardMonthSummary.spent * rewardRate;
    const monthNetCash = selectedRewardMonthSummary.net * rewardRate;
    const settleStars = settleChildId ? Number(childProfiles.find((child) => child.id === settleChildId)?.total_stars || 0) : 0;
    const settleCash = settleStars * rewardRate;
    const pendingRedemptions = redemptions.filter((item) => item.status === 'pending').length;
    const approvedRedemptions = redemptions.filter((item) => item.status === 'approved').length;
    const cashText = (value: number) => `${rewardCurrency}${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black" style={{ color: 'var(--text-main)' }}>Reward Wallet</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Stars, cash value, shop rewards, approvals, bonus gifts, and payouts.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Rate {rewardRate ? `1 star = ${cashText(rewardRate)}` : 'not set'}</span>
            <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700">{rewardItems.length} shop items</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">{pendingRedemptions} pending</span>
          </div>
        </div>

        <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Wallet Overview</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{selectedRewardMonthSummary.label}</p>
            </div>
            <select value={selectedAutomationChildId} onChange={(event) => setAutomationChildId(event.target.value)} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}>
              {children.map((child) => (
                <option key={child.id} value={child.id}>{child.name || child.email}</option>
              ))}
            </select>
          </div>

          {selectedRewardLedgerLoading ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading wallet...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.10)' }}>
                <p className="text-xs font-bold uppercase text-emerald-500">Earned</p>
                <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{selectedRewardMonthSummary.earned} stars</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cashText(monthEarnedCash)}</p>
              </div>
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.10)' }}>
                <p className="text-xs font-bold uppercase text-rose-500">Paid / Spent</p>
                <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{selectedRewardMonthSummary.spent} stars</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cashText(monthSpentCash)}</p>
              </div>
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(34,211,238,0.35)', background: 'rgba(34,211,238,0.10)' }}>
                <p className="text-xs font-bold uppercase text-cyan-500">Net Month</p>
                <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{selectedRewardMonthSummary.net} stars</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cashText(monthNetCash)}</p>
              </div>
              <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Current Balance</p>
                <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{walletStars} stars</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{cashText(walletCash)}</p>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Conversion Rate</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{activeSettings ? `Current: 1 star = ${cashText(rewardRate)}` : 'Set a star-to-cash rate'}</p>
              </div>
              <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>{rewards.length} saved</span>
            </div>

            <form onSubmit={handleSaveReward} className="grid grid-cols-1 gap-3">
              <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
                <input required value={rCurrencySymbol} onChange={(ev) => setRCurrencySymbol(ev.target.value)} placeholder="Currency" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                <input required value={rStarRate as any} onChange={(ev) => setRStarRate(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Cash value for 1 star" type="number" min="0" step="0.01" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {([5, 4, 3, 2, 1] as const).map((star) => (
                  <label key={star} className="rounded-xl border p-2 text-xs font-bold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>
                    {star} star %
                    <input value={rPayoutPercentages[star]} onChange={(event) => setRPayoutPercentages((current) => ({ ...current, [star]: Number(event.target.value) || 0 }))} type="number" min="0" max="100" className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={rWeeklyBonus} onChange={(ev) => setRWeeklyBonus(ev.target.checked)} className="h-4 w-4" />
                  <span style={{ color: 'var(--text-muted)' }}>Weekly bonus</span>
                </label>
                <div className="flex gap-2">
                  <button disabled={rewardLoading} type="submit" className="rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{rewardLoading ? 'Saving...' : (editRewardId ? 'Save Changes' : 'Save Rate')}</button>
                  <button type="button" onClick={editRewardId ? cancelEditReward : () => { setRStarRate(''); setRWeeklyBonus(false); }} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--border-main)' }}>{editRewardId ? 'Cancel' : 'Clear'}</button>
                </div>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Settlement</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Pay out the selected child and reset their star balance.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{cashText(settleCash)}</span>
            </div>
            <form onSubmit={handleSettleRewardBalance} className="grid grid-cols-1 gap-3">
              <select value={settleChildId} onChange={(event) => setSettleChildId(event.target.value)} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}>
                <option value="">Select child</option>
                {children.map((child) => (
                  <option key={child.id} value={child.id}>{child.name || child.email}</option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Stars to reset</p>
                  <p className="mt-1 text-xl font-black" style={{ color: 'var(--text-main)' }}>{settleStars}</p>
                </div>
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                  <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Cash payout</p>
                  <p className="mt-1 text-xl font-black" style={{ color: 'var(--text-main)' }}>{cashText(settleCash)}</p>
                </div>
              </div>
              <button disabled={settleSaving || !settleChildId || settleStars <= 0} type="submit" className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {settleSaving ? 'Settling...' : 'Mark Paid & Reset'}
              </button>
            </form>
          </section>
        </div>

        <section className="space-y-4 rounded-3xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Reward Shop</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Child-requestable catalogue items.</p>
            </div>
            <button type="button" onClick={() => void seedDefaultRewards()} disabled={rewardItemsLoading} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add Starter Catalogue</button>
          </div>
          <RewardManagement rewards={rewardItems} onCreateReward={createRewardForFamily} onUpdateReward={updateReward} onDeleteReward={deleteReward} loading={rewardItemsLoading} />
        </section>

        <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Reward Requests</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{pendingRedemptions} pending, {approvedRedemptions} approved</p>
            </div>
            <select value={selectedAutomationChildId} onChange={(event) => setAutomationChildId(event.target.value)} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}>
              <option value="">Select child</option>
              {children.map((child) => (
                <option key={child.id} value={child.id}>{child.name || child.email}</option>
              ))}
            </select>
          </div>
          <RedemptionHistory redemptions={redemptions} onUpdateStatus={updateRedemptionStatus} loading={redemptionsLoading} />
        </section>

        <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
          <div className="mb-4">
            <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Bonus Rewards</h3>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Manual stars, scratch cards, and spin wheels.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <form onSubmit={handleAwardStars} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
              <h4 className="mb-3 font-bold" style={{ color: 'var(--text-main)' }}>Award Stars</h4>
              <div className="grid grid-cols-1 gap-3">
                <select value={awardChildId} onChange={(event) => setAwardChildId(event.target.value)} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                  <option value="">Select child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.name || child.email}</option>
                  ))}
                </select>
                <div className="grid gap-3 sm:grid-cols-[0.5fr_1fr]">
                  <input value={awardStars as any} onChange={(event) => setAwardStars(event.target.value === '' ? '' : Number(event.target.value))} placeholder="Stars" type="number" min="1" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                  <input value={awardReason} onChange={(event) => setAwardReason(event.target.value)} placeholder="Reason" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={awardSurprise} onChange={(event) => setAwardSurprise(event.target.checked)} className="h-4 w-4" />
                  <span style={{ color: 'var(--text-muted)' }}>Surprise reveal</span>
                </label>
                <button disabled={awardSaving} type="submit" className="rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{awardSaving ? 'Sending...' : 'Award Stars'}</button>
              </div>
            </form>

            <form onSubmit={handleSaveScratchTemplate} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="font-bold" style={{ color: 'var(--text-main)' }}>Auto Reward Template</h4>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">{getScratchTriggerLabel(scratchTemplateTrigger)}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select value={scratchTemplateChildId} onChange={(event) => setScratchTemplateChildId(event.target.value)} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                  <option value="">All children</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.name || child.email}</option>
                  ))}
                </select>
                <input value={scratchTemplateTitle} onChange={(event) => setScratchTemplateTitle(event.target.value)} placeholder="Template title" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                <select value={scratchTemplateTrigger} onChange={(event) => setScratchTemplateTrigger(event.target.value as typeof scratchTemplateTrigger)} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                  <option value="task_completion">Every completed task</option>
                  <option value="random_task">Random completed task</option>
                  <option value="streak">7-day streak milestone</option>
                  <option value="perfect_exam">100% exam result</option>
                </select>
                <select value={scratchTemplateRevealType} onChange={(event) => setScratchTemplateRevealType(event.target.value as 'scratch' | 'wheel')} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                  <option value="scratch">Scratch Card</option>
                  <option value="wheel">Spin Wheel</option>
                </select>
                {scratchTemplateRevealType === 'scratch' ? (
                  <>
                    <select value={scratchTemplatePrizeType} onChange={(event) => {
                      const nextType = event.target.value as typeof scratchTemplatePrizeType;
                      setScratchTemplatePrizeType(nextType);
                      setScratchTemplatePrizeLabel(nextType === 'book' ? 'Book' : nextType === 'toy' ? 'Toy' : nextType === 'treat' ? 'Treat' : nextType === 'cash' ? `${rCurrencySymbol || '₹'}${scratchTemplateStars || 10}` : nextType === 'stars' ? `${scratchTemplateStars || 10} stars` : '');
                    }} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                      <option value="cash">Cash</option>
                      <option value="stars">Stars</option>
                      <option value="book">Book</option>
                      <option value="toy">Toy</option>
                      <option value="treat">Treat</option>
                      <option value="custom">Custom</option>
                    </select>
                    {scratchTemplatePrizeType === 'stars' || scratchTemplatePrizeType === 'cash' ? (
                      <input value={scratchTemplateStars as any} onChange={(event) => {
                        const value = event.target.value === '' ? '' : Number(event.target.value);
                        setScratchTemplateStars(value);
                        setScratchTemplatePrizeLabel(value === '' ? '' : scratchTemplatePrizeType === 'cash' ? `${rCurrencySymbol || '₹'}${value}` : `${value} stars`);
                      }} placeholder={scratchTemplatePrizeType === 'cash' ? 'Cash' : 'Stars'} type="number" min="1" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                    ) : (
                      <input value={scratchTemplatePrizeLabel} onChange={(event) => setScratchTemplatePrizeLabel(event.target.value)} placeholder="Prize label" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                    )}
                  </>
                ) : (
                  renderWheelSegmentEditor(scratchTemplateWheelSegments, setScratchTemplateWheelSegments)
                )}
                <button disabled={scratchTemplateSaving} type="submit" className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{scratchTemplateSaving ? 'Saving...' : 'Save Template'}</button>
              </div>
            </form>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
              <h4 className="mb-3 font-bold" style={{ color: 'var(--text-main)' }}>Saved Templates</h4>
              <div className="grid gap-2">
                {scratchTemplatesLoading ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading templates...</p>
                ) : scratchTemplates.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No templates saved.</p>
                ) : (
                  scratchTemplates.map((template) => (
                    <div key={template.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <div className="min-w-0">
                        <p className="truncate font-bold" style={{ color: 'var(--text-main)' }}>{template.title}</p>
                        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{template.child_id ? (children.find((child) => child.id === template.child_id)?.name || 'Selected child') : 'All children'} • {getScratchTriggerLabel(template.trigger)} • {template.reveal_type === 'wheel' ? `${template.wheel_segments?.length || 0} wheel options` : template.prize_label}</p>
                      </div>
                      <button type="button" onClick={() => void updateScratchTemplate(template.id, { is_active: !template.is_active })} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${template.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{template.is_active ? 'Active' : 'Paused'}</button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form onSubmit={handleSendScratchReward} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
              <h4 className="mb-3 font-bold" style={{ color: 'var(--text-main)' }}>Send One-Time Surprise</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select value={scratchChildId} onChange={(event) => setScratchChildId(event.target.value)} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                  <option value="">Select child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>{child.name || child.email}</option>
                  ))}
                </select>
                <input value={scratchTitle} onChange={(event) => setScratchTitle(event.target.value)} placeholder="Reward title" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                <select value={scratchRevealType} onChange={(event) => setScratchRevealType(event.target.value as 'scratch' | 'wheel')} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                  <option value="scratch">Scratch Card</option>
                  <option value="wheel">Spin Wheel</option>
                </select>
                {scratchRevealType === 'scratch' ? (
                  <>
                    <select value={scratchPrizeType} onChange={(event) => {
                      const nextType = event.target.value as typeof scratchPrizeType;
                      setScratchPrizeType(nextType);
                      setScratchPrizeLabel(nextType === 'book' ? 'Book' : nextType === 'toy' ? 'Toy' : nextType === 'treat' ? 'Treat' : nextType === 'cash' ? `${rCurrencySymbol || '₹'}${scratchStars || 10}` : nextType === 'stars' ? `${scratchStars || 10} stars` : '');
                    }} className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                      <option value="cash">Cash</option>
                      <option value="stars">Stars</option>
                      <option value="book">Book</option>
                      <option value="toy">Toy</option>
                      <option value="treat">Treat</option>
                      <option value="custom">Custom</option>
                    </select>
                    {scratchPrizeType === 'stars' || scratchPrizeType === 'cash' ? (
                      <input value={scratchStars as any} onChange={(event) => {
                        const value = event.target.value === '' ? '' : Number(event.target.value);
                        setScratchStars(value);
                        setScratchPrizeLabel(value === '' ? '' : scratchPrizeType === 'cash' ? `${rCurrencySymbol || '₹'}${value}` : `${value} stars`);
                      }} placeholder={scratchPrizeType === 'cash' ? 'Cash' : 'Stars'} type="number" min="1" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                    ) : (
                      <input value={scratchPrizeLabel} onChange={(event) => setScratchPrizeLabel(event.target.value)} placeholder="Prize label" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                    )}
                  </>
                ) : (
                  renderWheelSegmentEditor(scratchWheelSegments, setScratchWheelSegments)
                )}
                <input value={scratchReason} onChange={(event) => setScratchReason(event.target.value)} placeholder="Reason" className="rounded-xl py-2.5 px-3 border sm:col-span-2" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                <button disabled={scratchSaving} type="submit" className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2">{scratchSaving ? 'Sending...' : scratchRevealType === 'wheel' ? 'Send Wheel' : 'Send Scratch'}</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden px-2 py-3 sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1680px] rounded-[1.25rem] border bg-[var(--surface)]/95 p-2 backdrop-blur-md sm:rounded-[2rem] sm:p-4 lg:p-5" style={{ borderColor: 'var(--border-main)' }}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[92px_1fr]">
          <aside
            className="hidden rounded-[1.6rem] p-3 text-white sm:p-4 lg:block"
            style={{ background: 'linear-gradient(165deg, var(--bg-hero-a), var(--bg-hero-b))' }}
          >
            <div className="flex h-full flex-col items-center justify-between gap-3">
              <div className="flex flex-col items-center gap-3">
                <button title="Dashboard" aria-label="Dashboard" className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl transition', activeTab === 'dashboard' ? 'bg-white/30 shadow-lg' : 'bg-white/18 hover:bg-white/28')} onClick={() => setActiveTab('dashboard')}>
                  <Home size={20} />
                </button>
                <button title="Family Chat" aria-label="Family Chat" className={clsx('relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition', activeTab === 'communication' ? 'bg-white/30 shadow-lg' : 'bg-white/18 hover:bg-white/28')} onClick={openParentChat}>
                  <Mail size={18} />
                  {unreadMessagesCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-rose-300">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </button>
                <button title="Approvals" aria-label="Approvals" className={clsx('relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition', activeTab === 'approvals' ? 'bg-white/30 shadow-lg' : 'bg-white/18 hover:bg-white/28')} onClick={() => setActiveTab('approvals')}>
                  <ShieldCheck size={18} />
                  {pendingApprovalCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950 ring-2 ring-amber-100">
                      {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                    </span>
                  )}
                </button>
                <button title="Planner" aria-label="Planner" className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl transition', topLevelActiveTab === 'planner' ? 'bg-white/30 shadow-lg' : 'bg-white/18 hover:bg-white/28')} onClick={() => setActiveTab('planner')}>
                  <CalendarDays size={18} />
                </button>
                <button title="Rewards" aria-label="Rewards" className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl transition', activeTab === 'rewards' ? 'bg-white/30 shadow-lg' : 'bg-white/18 hover:bg-white/28')} onClick={() => setActiveTab('rewards')}>
                  <Gift size={18} />
                </button>
                <button title="Send Nudge" aria-label="Send Nudge" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/18 transition hover:bg-white/28" onClick={openNudgeModal}>
                  <MessageCircle size={18} />
                </button>
              </div>

              <div className="flex flex-col items-center gap-3">
                <button title="Settings" aria-label="Settings" className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-xl transition', activeTab === 'settings' ? 'bg-white/30 shadow-lg' : 'bg-white/18 hover:bg-white/28')} onClick={() => setActiveTab('settings')}>
                  <Settings size={18} />
                </button>
                <button title="Toggle theme" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/18 transition hover:bg-white/28" onClick={toggleTheme} aria-label="toggle-theme">
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button title="Logout" aria-label="Logout" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-500/40 transition hover:bg-rose-500/60" onClick={handleLogout}>
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </aside>

          <main className="min-w-0 rounded-[1.1rem] bg-[var(--surface-soft)] p-3 sm:rounded-[1.5rem] sm:p-4" style={{ border: '1px solid var(--border-main)' }}>
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="font-display text-[1.65rem] font-extrabold leading-tight sm:text-2xl" style={{ color: 'var(--text-main)' }}>
                  Parent Control Panel
                </h1>
                <p className="truncate text-sm" style={{ color: 'var(--text-muted)' }}>
                  Welcome, {user?.email || 'Parent'}
                </p>
                <p className="text-xs font-bold mt-1 inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {isUsingFirebaseEmulators ? 'LOCAL EMULATOR' : `${activeFirebaseEnv.toUpperCase()} DB`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={openParentChat}
                  aria-label={`Open family chat${unreadMessagesCount ? `, ${unreadMessagesCount} unread` : ''}`}
                  className={clsx(
                    'relative grid h-10 w-10 place-items-center rounded-xl border text-sm font-bold transition',
                    activeTab === 'communication'
                      ? 'border-cyan-300 bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                      : 'hover:bg-slate-100 dark:hover:bg-white/10'
                  )}
                  style={activeTab === 'communication' ? {} : { color: 'var(--text-main)', borderColor: 'var(--border-main)', background: 'var(--surface)' }}
                >
                  <MessageCircle size={18} />
                  {unreadMessagesCount > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-none text-white ring-2 ring-white dark:ring-slate-900">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  ) : null}
                </button>
                <button onClick={toggleTheme} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-semibold sm:h-auto sm:w-auto sm:px-3 sm:py-2" style={{ color: 'var(--text-main)', borderColor: 'var(--border-main)', background: 'var(--surface)' }} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                  <span className="sm:hidden">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</span>
                  <span className="hidden sm:inline">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 sm:inline-flex sm:rounded-full">
                {parentTabs.map((tab) => {
                  const TabIcon = tab.icon;
                  return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id === 'planner' ? 'planner' : tab.id)}
                    className={clsx(
                      'min-w-0 rounded-xl px-2 py-2 text-xs font-bold transition sm:rounded-full sm:px-4 sm:text-sm',
                      topLevelActiveTab === tab.id
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
                    )}
                  >
                    <span className="inline-flex max-w-full items-center justify-center gap-1.5">
                      <TabIcon size={15} className="shrink-0" />
                      <span className="truncate sm:hidden">{tab.shortLabel}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                      {tab.id === 'approvals' && pendingApprovalCount > 0 ? (
                        <span className="grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black leading-none text-white">
                          {pendingApprovalCount > 99 ? '99+' : pendingApprovalCount}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  );
                })}
              </div>
            </div>

            {topLevelActiveTab === 'planner' ? (
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 sm:inline-flex sm:rounded-full">
                  {plannerWorkspaceTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'min-w-0 rounded-xl px-2 py-2 text-xs font-bold transition sm:rounded-full sm:px-4 sm:text-sm',
                        activeTab === tab.id
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
                      )}
                    >
                      <span className="sm:hidden">{tab.shortLabel}</span>
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {error && <div className="rounded-xl px-3 py-2 text-sm font-semibold bg-red-100 text-red-700 mb-4">{error}</div>}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5">
              <div className={activeTab === 'dashboard' ? 'xl:col-span-12 space-y-5' : 'hidden'}>
                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
                  <div className={`${cardBase} overflow-hidden bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Today</p>
                        <h2 className="mt-1 text-2xl font-display font-black" style={{ color: 'var(--text-main)' }}>
                          {hasChildren ? `${dashboardChildName}'s day at a glance` : 'Start your family hub'}
                        </h2>
                        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--text-muted)' }}>{dashboardStatusText}</p>
                      </div>
                      <select
                        value={dashboardChildId}
                        onChange={(event) => setAutomationChildId(event.target.value)}
                        className="rounded-xl border px-3 py-2 text-sm font-semibold"
                        style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                      >
                        {children.map((child) => (
                          <option key={child.id} value={child.id}>{child.name || child.email}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.10)' }}>
                        <p className="text-xs font-black uppercase text-emerald-300">Completed</p>
                        <p className="mt-2 text-3xl font-black" style={{ color: 'var(--text-main)' }}>{completedDashboardTasks.length}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>tasks finished</p>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(34,211,238,0.35)', background: 'rgba(34,211,238,0.10)' }}>
                        <p className="text-xs font-black uppercase text-cyan-300">Active</p>
                        <p className="mt-2 text-3xl font-black" style={{ color: 'var(--text-main)' }}>{activeDashboardTasks.length}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>open tasks</p>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: dashboardNeedsAttention > 0 ? 'rgba(245,158,11,0.45)' : 'rgba(34,197,94,0.35)', background: dashboardNeedsAttention > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.10)' }}>
                        <p className={clsx('text-xs font-black uppercase', dashboardNeedsAttention > 0 ? 'text-amber-300' : 'text-emerald-300')}>Needs Review</p>
                        <p className="mt-2 text-3xl font-black" style={{ color: 'var(--text-main)' }}>{dashboardNeedsAttention}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>approvals and proofs</p>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: 'rgba(168,85,247,0.38)', background: 'rgba(168,85,247,0.12)' }}>
                        <p className="text-xs font-black uppercase text-violet-300">Stars</p>
                        <p className="mt-2 text-3xl font-black" style={{ color: 'var(--text-main)' }}>{dashboardStars}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>available now</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <button type="button" onClick={() => setActiveTab('approvals')} className="rounded-xl border px-4 py-3 text-left text-sm font-bold transition hover:bg-slate-100 dark:hover:bg-white/10" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>
                        Review approvals
                        <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{pendingApprovalCount} waiting</span>
                      </button>
                      <button type="button" onClick={() => setActiveTab('tasks')} className="rounded-xl border px-4 py-3 text-left text-sm font-bold transition hover:bg-slate-100 dark:hover:bg-white/10" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>
                        Add or edit task
                        <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>{totalTasksCount} total tasks</span>
                      </button>
                      <button type="button" onClick={() => setActiveTab('rewards')} className="rounded-xl border px-4 py-3 text-left text-sm font-bold transition hover:bg-slate-100 dark:hover:bg-white/10" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>
                        Award stars
                        <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Gift or scratch reward</span>
                      </button>
                      <button type="button" onClick={openNudgeModal} className="rounded-xl border px-4 py-3 text-left text-sm font-bold transition hover:bg-slate-100 dark:hover:bg-white/10" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>
                        Send nudge
                        <span className="mt-1 block text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Quick encouragement</span>
                      </button>
                    </div>
                  </div>

                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Parent Attention</h2>
                      <span className={clsx('rounded-full px-3 py-1 text-xs font-black', dashboardNeedsAttention > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700')}>
                        {dashboardNeedsAttention > 0 ? `${dashboardNeedsAttention} to review` : 'Clear'}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {dashboardPendingApprovals.slice(0, 3).map((approval) => (
                        <div key={approval.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                          <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{approval.title}</p>
                          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{approval.type} • {approval.points} stars</p>
                        </div>
                      ))}
                      {dashboardPendingProofs.slice(0, 2).map((proof) => (
                        <div key={proof.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                          <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{proof.task_title || 'Proof waiting'}</p>
                          <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Proof submitted by {getChildName(proof.child_id)}</p>
                        </div>
                      ))}
                      {dashboardNeedsAttention === 0 ? (
                        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
                          <p className="font-bold text-emerald-300">No parent action needed</p>
                          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>You can add a task, send a nudge, or award a surprise from here.</p>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setActiveTab('approvals')} className="w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950">
                          Open review queue
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Active Tasks</h2>
                      <button type="button" onClick={() => setActiveTab('tasks')} className="rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Manage tasks</button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {activeDashboardTasks.length === 0 ? (
                        <p className="rounded-2xl border border-dashed p-5 text-sm" style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>No active tasks for {dashboardChildName}.</p>
                      ) : activeDashboardTasks.slice(0, 6).map((task) => (
                        <div key={task.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold" style={{ color: 'var(--text-main)' }}>{task.title}</p>
                              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{task.category || 'Task'} • {Number(task.points ?? task.star_value ?? 0)} stars {task.due_date ? `• due ${new Date(task.due_date).toLocaleDateString()}` : ''}</p>
                            </div>
                            <span className={clsx('rounded-full px-2 py-1 text-[11px] font-black uppercase', task.priority === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700')}>
                              {task.priority || 'live'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Rewards Pulse</h2>
                      <button type="button" onClick={() => setActiveTab('rewards')} className="rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Open rewards</button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border p-3" style={{ borderColor: 'rgba(168,85,247,0.35)', background: 'rgba(168,85,247,0.10)' }}>
                        <p className="text-xs font-bold uppercase text-violet-300">Stars</p>
                        <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{dashboardStars}</p>
                      </div>
                      <div className="rounded-2xl border p-3" style={{ borderColor: 'rgba(34,211,238,0.35)', background: 'rgba(34,211,238,0.10)' }}>
                        <p className="text-xs font-bold uppercase text-cyan-300">Catalogue</p>
                        <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{rewardItems.length}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <button type="button" onClick={() => setActiveTab('rewards')} className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-black text-white">
                        Send surprise or scratch reward
                      </button>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Use rewards when something deserves recognition beyond regular tasks.</p>
                    </div>
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Weekly Stars</h2>
                      <select value={selectedTrendChild} onChange={(e) => setSelectedTrendChild(e.target.value)} className="rounded-xl border px-2 py-1 text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">All Children</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || (c.email || '').replace('@tiktrack.family','')}</option>))}
                      </select>
                    </div>
                    <div className="mt-4 h-44 rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <div className="flex h-full items-end gap-2">
                        {weeklyStarsTrend.every((value) => value === 0) ? (
                          <div className="grid flex-1 place-items-center text-center text-sm" style={{ color: 'var(--text-muted)' }}>Complete tasks for a few days to see the weekly trend.</div>
                        ) : (
                          (() => {
                            const max = Math.max(...weeklyStarsTrend, 1);
                            return weeklyStarsTrend.map((val, idx) => (
                              <div key={idx} className="flex flex-1 flex-col items-center justify-end">
                                <div className="w-full rounded-t-lg bg-emerald-400" style={{ height: `${Math.max(8, Math.round((val / max) * 100))}%` }} />
                                <span className="mt-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>{val}</span>
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Recent Activity</h2>
                    <div className="mt-4 space-y-2">
                      {dashboardRecentActivity.length === 0 ? (
                        <p className="rounded-2xl border border-dashed p-5 text-sm" style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>No recent activity yet.</p>
                      ) : dashboardRecentActivity.map((item) => (
                        <div key={item.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{item.title}</p>
                              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{item.meta}</p>
                            </div>
                            <span className={clsx('h-2.5 w-2.5 rounded-full', item.tone === 'emerald' ? 'bg-emerald-400' : item.tone === 'amber' ? 'bg-amber-400' : 'bg-cyan-400')} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

                <div className={activeTab === 'planner' ? 'xl:col-span-12' : 'hidden'}>
                  <ParentPlannerV2Page childId={selectedActivityChildId} familyId={familyId} />
                </div>

                <div className="hidden">
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Growth & Health</h2>
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{growthLogs.length}</span>
                  </div>

                  <div className="space-y-3">
                    <form onSubmit={handleCreateGrowth} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select value={gChild} onChange={(ev) => setGChild(ev.target.value)} className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">-- Child --</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                      </select>
                      <input required value={gHeight as any} onChange={(ev) => setGHeight(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Height (cm)" type="number" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <input required value={gWeight as any} onChange={(ev) => setGWeight(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Weight (kg)" type="number" step="0.1" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />

                      <input required value={gDate} onChange={(ev) => setGDate(ev.target.value)} type="date" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      <div className="col-span-1 sm:col-span-2 flex gap-2">
                        <button disabled={growthLoading2} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{growthLoading2 ? 'Saving...' : (editGrowthId ? 'Save Changes' : '+ Save Growth')}</button>
                        {editGrowthId ? (
                          <button type="button" onClick={cancelEditGrowth} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                        ) : (
                          <button type="button" onClick={() => { setGChild(''); setGHeight(''); setGWeight(''); setGDate(''); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                        )}
                      </div>
                    </form>

                    <div>
                      {growthLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading growth logs...</p>
                      ) : (filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs).length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No growth logs yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {(filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs).map((g) => (
                            <div key={g.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                              <div>
                                <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{children.find((c) => c.id === g.child_id)?.name || 'Child'}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Height: {g.height_cm} cm • Weight: {g.weight_kg} kg</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>BMI: {calculateBmi(g.height_cm, g.weight_kg) ?? 'N/A'} (kg/m²)</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{g.date ? new Date(g.date).toLocaleDateString() : '—'}</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => startEditGrowth(g)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                <button onClick={() => handleDeleteGrowth(g.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
	                    </div>
	                  </div>
	                </div>
	              </div>

                <div className={activeTab === 'events' ? 'xl:col-span-12' : 'hidden'}>
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Events Planner</h2>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{filteredEvents.length}</span>
                        <button onClick={() => { setEvChild(''); setEvTitle(''); setEvType('event'); setEvDate(''); setEvReminderDays(''); setEditEventId(null); setShowEventModal(true); }} className="py-2 px-4 rounded-xl text-sm font-bold text-white shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>+ Add Event</button>
                      </div>
                    </div>
                    {renderActivityFilter(eventActivityFilter, setEventActivityFilter, events.length)}

                    {showEventModal && (
                      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
                        <div className="bg-[var(--surface)] w-full max-w-2xl rounded-2xl shadow-2xl p-4 sm:p-6 border max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto" style={{ borderColor: 'var(--border-main)' }}>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{editEventId ? 'Edit Event' : 'Create Event'}</h3>
                            <button onClick={() => setShowEventModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
                          </div>
                          <form onSubmit={(e) => { handleCreateEvent(e); setShowEventModal(false); }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <select value={evChild} onChange={(ev) => { setEvChild(ev.target.value); setEvActivityId(''); }} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="">-- Child (optional) --</option>
                              {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                            </select>
                            <select value={evActivityId} onChange={(ev) => setEvActivityId(ev.target.value)} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="">-- Activity (Optional) --</option>
                              {eventPrograms.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                            </select>
                            
                            <input required value={evTitle} onChange={(ev) => setEvTitle(ev.target.value)} placeholder="Title" className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <select value={evType} onChange={(ev) => setEvType(ev.target.value)} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="event">Event</option>
                              <option value="appointment">Appointment</option>
                              <option value="exam">Exam</option>
                              <option value="reminder">Reminder</option>
                            </select>

                            <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
                              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Date & Time</label>
                              <input required value={evDate} onChange={(ev) => setEvDate(ev.target.value)} type="datetime-local" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            </div>
                            
                            <input value={evReminderDays as any} onChange={(ev) => setEvReminderDays(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Remind days before" type="number" className="col-span-1 sm:col-span-2 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            
                            <div className="col-span-1 sm:col-span-2 flex flex-col gap-3 mt-4 sm:flex-row">
                              <button disabled={eventLoading} type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{eventLoading ? 'Saving...' : (editEventId ? 'Save Changes' : 'Create Event')}</button>
                              <button type="button" onClick={() => setShowEventModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6 mt-6">
                      {eventsLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading events...</p>
                      ) : filteredEvents.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{eventActivityFilter === 'all' ? 'No events planned yet.' : 'No events for this activity.'}</p>
                      ) : (
                        (() => {
                          const todayStart = new Date();
                          todayStart.setHours(0, 0, 0, 0);
                          const todayEnd = new Date(todayStart.getTime() + 86400000);

                          const evToday: any[] = [];
                          const evFuture: any[] = [];
                          const evPast: any[] = [];

                          filteredEvents.forEach((ev) => {
                            const dateVal = getEventDateValue(ev) as string;
                            const dTime = dateVal ? new Date(dateVal).getTime() : 0;
                            
                            if (!dateVal) {
                              evToday.push(ev);
                            } else if (dTime < todayStart.getTime()) {
                              evPast.push(ev);
                            } else if (dTime >= todayEnd.getTime()) {
                              evFuture.push(ev);
                            } else {
                              evToday.push(ev);
                            }
                          });

                          const renderEventList = (title: string, list: any[], emptyMsg: string) => (
                            <div>
                              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                {title} <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{list.length}</span>
                              </h3>
                              {list.length === 0 ? (
                                <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>{emptyMsg}</p>
                              ) : (
                                <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                                  {list.map((ev) => (
                                    <div key={ev.id} className="rounded-xl p-4 border flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow bg-[var(--surface-soft)]" style={{ borderColor: 'var(--border-main)' }}>
                                      <div>
                                        <div className="flex justify-between items-start mb-1">
                                          <p className="font-bold text-base" style={{ color: 'var(--text-main)' }}>{ev.title}</p>
                                          <span className="font-bold text-cyan-600 text-xs bg-cyan-100 px-2 py-0.5 rounded-full">{(ev.type || 'event').toUpperCase()}</span>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 text-xs font-semibold mt-3" style={{ color: 'var(--text-muted)' }}>
                                          <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">👥 {ev.child_id ? getChildName(ev.child_id) : 'Family'}</span>
                                          {getEventDateValue(ev) && <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">📅 {new Date(getEventDateValue(ev) as string).toLocaleDateString()} {new Date(getEventDateValue(ev) as string).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                          {ev.reminder_days_before ? <span className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded">🔔 Remind {ev.reminder_days_before}d before</span> : null}
                                        </div>
                                      </div>
                                      <div className="flex gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-main)' }}>
                                        <button onClick={() => { startEditEvent(ev); setShowEventModal(true); }} className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">Edit</button>
                                        <button onClick={() => handleDeleteEvent(ev.id)} className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors">Delete</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );

                          return (
                            <div className="space-y-8 mt-4">
                              {renderEventList('Today / Active', evToday, 'No events today.')}
                              {renderEventList('Future Events', evFuture, 'No future events scheduled.')}
                              {renderEventList('Past / Completed', evPast, 'No past events.')}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>
              </div>

                <div className={activeTab === 'rewards' ? 'xl:col-span-12' : 'hidden'}>
                  {renderRewardsPage()}
                  {false && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Rewards Setup</h2>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                          Configure how stars convert to cash, what reward items children can request, and how requests are settled.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">Cash rules: {rewards.length}</span>
                        <span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700">Catalogue items: {rewardItems.length}</span>
                      </div>
                    </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Cash Rules</h3>
                          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                            Children can request cash by redeeming stars. You approve it, then manually settle the payout.
                          </p>
                        </div>
                        {rewards[0] ? (
                          <div className="rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Current rate: </span>
                            <span style={{ color: 'var(--text-main)' }}>1 point = {normalizeRewardSettings(rewards[0]).currency_symbol}{normalizeRewardSettings(rewards[0]).point_to_cash_rate}</span>
                          </div>
                        ) : null}
                      </div>

                      <form onSubmit={handleSaveReward} className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_1fr_auto] lg:items-center">
                          <input required value={rCurrencySymbol} onChange={(ev) => setRCurrencySymbol(ev.target.value)} placeholder="₹" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                          <input required value={rStarRate as any} onChange={(ev) => setRStarRate(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Cash value per point, e.g. 1" type="number" min="0" step="0.01" className="rounded-xl py-2.5 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={rWeeklyBonus} onChange={(ev) => setRWeeklyBonus(ev.target.checked)} className="h-4 w-4" />
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Weekly bonus</span>
                        </label>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                          {([5, 4, 3, 2, 1] as const).map((star) => (
                            <label key={star} className="rounded-xl border p-2 text-xs font-bold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>
                              {star}★ payout %
                              <input
                                value={rPayoutPercentages[star]}
                                onChange={(event) => setRPayoutPercentages((current) => ({ ...current, [star]: Number(event.target.value) || 0 }))}
                                type="number"
                                min="0"
                                max="100"
                                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                                style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                              />
                            </label>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button disabled={rewardLoading} type="submit" className="rounded-xl px-4 py-2.5 text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{rewardLoading ? 'Saving...' : (editRewardId ? 'Save Changes' : '+ Save Rule')}</button>
                          {editRewardId ? (
                            <button type="button" onClick={cancelEditReward} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                          ) : (
                            <button type="button" onClick={() => { setRStarRate(''); setRWeeklyBonus(false); }} className="rounded-xl border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                          )}
                        </div>
                      </form>

	                  <div className="mt-4">
	                    {rewardsLoading ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading cash rules...</p>
                        ) : rewards.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No cash rule saved yet. Add a cash value per point to enable cash requests.</p>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2">
                            {rewards.map((r) => (
                              <div key={r.id} className="rounded-xl p-3 border flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                                <div>
                                  <p className="font-semibold" style={{ color: 'var(--text-main)' }}>1 point = {normalizeRewardSettings(r).currency_symbol}{normalizeRewardSettings(r).point_to_cash_rate}</p>
                                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Weekly bonus: {r.weekly_bonus_enabled ? 'enabled' : 'disabled'}</p>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => startEditReward(r)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                  <button onClick={() => handleDeleteReward(r.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                                </div>
                              </div>
                            ))}
                          </div>
	                    )}
	                  </div>
                    </div>

                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Reward Month So Far</h3>
                          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                            Earned, spent, and current balance for the selected child.
                          </p>
                        </div>
                        <select value={selectedAutomationChildId} onChange={(event) => setAutomationChildId(event.target.value)} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}>
                          {children.map((child) => (
                            <option key={child.id} value={child.id}>{child.name || child.email}</option>
                          ))}
                        </select>
                      </div>

                      {selectedRewardLedgerLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading reward month...</p>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.10)' }}>
                            <p className="text-xs font-bold uppercase text-emerald-500">{selectedRewardMonthSummary.label} Earned</p>
                            <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{rCurrencySymbol || '₹'}{selectedRewardMonthSummary.earned}</p>
                          </div>
                          <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(244,63,94,0.35)', background: 'rgba(244,63,94,0.10)' }}>
                            <p className="text-xs font-bold uppercase text-rose-500">Spent / Paid</p>
                            <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{rCurrencySymbol || '₹'}{selectedRewardMonthSummary.spent}</p>
                          </div>
                          <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'rgba(34,211,238,0.35)', background: 'rgba(34,211,238,0.10)' }}>
                            <p className="text-xs font-bold uppercase text-cyan-500">Net This Month</p>
                            <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{rCurrencySymbol || '₹'}{selectedRewardMonthSummary.net}</p>
                          </div>
                          <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                            <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Current Balance</p>
                            <p className="mt-1 text-2xl font-black" style={{ color: 'var(--text-main)' }}>{rCurrencySymbol || '₹'}{Number(selectedAutomationProfile?.total_stars || 0)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Award Stars</h3>
                          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                            Give stars for thoughtful choices, kindness, sacrifice, savings, or anything that deserves a parent gift.
                          </p>
                        </div>
                        <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-700">
                          Surprise gift ready
                        </span>
                      </div>

                      <form onSubmit={handleAwardStars} className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_0.6fr_1.5fr_auto] xl:items-center">
                        <select
                          value={awardChildId}
                          onChange={(event) => setAwardChildId(event.target.value)}
                          className="rounded-xl py-2.5 px-3 border"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        >
                          <option value="">Select child</option>
                          {children.map((child) => (
                            <option key={child.id} value={child.id}>{child.name || child.email}</option>
                          ))}
                        </select>
                        <input
                          value={awardStars as any}
                          onChange={(event) => setAwardStars(event.target.value === '' ? '' : Number(event.target.value))}
                          placeholder="Stars"
                          type="number"
                          min="1"
                          className="rounded-xl py-2.5 px-3 border"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        />
                        <input
                          value={awardReason}
                          onChange={(event) => setAwardReason(event.target.value)}
                          placeholder="Reason, e.g. saved 1000 by skipping a dress"
                          className="rounded-xl py-2.5 px-3 border"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        />
                        <button disabled={awardSaving} type="submit" className="rounded-xl bg-pink-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                          {awardSaving ? 'Sending...' : 'Award'}
                        </button>
                        <label className="inline-flex items-center gap-2 text-sm xl:col-span-4">
                          <input type="checkbox" checked={awardSurprise} onChange={(event) => setAwardSurprise(event.target.checked)} className="h-4 w-4" />
                          <span style={{ color: 'var(--text-muted)' }}>Send as surprise gift for child to open</span>
                        </label>
                      </form>
                    </div>

                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Settle Reward Balance</h3>
                          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                            Mark the current reward balance as paid, create a paid settlement record, and reset the child balance to zero.
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          Paid reset
                        </span>
                      </div>

                      <form onSubmit={handleSettleRewardBalance} className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_auto] xl:items-center">
                        <select
                          value={settleChildId}
                          onChange={(event) => setSettleChildId(event.target.value)}
                          className="rounded-xl py-2.5 px-3 border"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        >
                          <option value="">Select child</option>
                          {children.map((child) => (
                            <option key={child.id} value={child.id}>{child.name || child.email}</option>
                          ))}
                        </select>
                        <div className="rounded-xl border px-4 py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}>
                          Balance: {settleChildId ? Number(childProfiles.find((child) => child.id === settleChildId)?.total_stars || 0) : 0}
                        </div>
                        <button disabled={settleSaving || !settleChildId} type="submit" className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                          {settleSaving ? 'Settling...' : 'Mark Paid & Reset'}
                        </button>
                      </form>
                    </div>

                    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <div className="mb-4">
                        <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Scratch Rewards</h3>
                        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                          Send a scratch card with a parent-decided prize like stars, a book, a toy, a treat, or a custom surprise.
                        </p>
                      </div>

                      <form onSubmit={handleSaveScratchTemplate} className="mb-5 rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-bold" style={{ color: 'var(--text-main)' }}>Auto Award Template</h4>
                          <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-700">{getScratchTriggerLabel(scratchTemplateTrigger)}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-6 xl:items-center">
                          <select
                            value={scratchTemplateChildId}
                            onChange={(event) => setScratchTemplateChildId(event.target.value)}
                            className="rounded-xl py-2.5 px-3 border"
                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                          >
                            <option value="">All children</option>
                            {children.map((child) => (
                              <option key={child.id} value={child.id}>{child.name || child.email}</option>
                            ))}
                          </select>
                          <input
                            value={scratchTemplateTitle}
                            onChange={(event) => setScratchTemplateTitle(event.target.value)}
                            placeholder="Template title"
                            className="rounded-xl py-2.5 px-3 border"
                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                          />
                          <select
                            value={scratchTemplateTrigger}
                            onChange={(event) => setScratchTemplateTrigger(event.target.value as typeof scratchTemplateTrigger)}
                            className="rounded-xl py-2.5 px-3 border"
                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                          >
                            <option value="task_completion">Every completed task</option>
                            <option value="random_task">Random completed task</option>
                            <option value="streak">7-day streak milestone</option>
                            <option value="perfect_exam">100% exam result</option>
                          </select>
                          <select
                            value={scratchTemplateRevealType}
                            onChange={(event) => setScratchTemplateRevealType(event.target.value as 'scratch' | 'wheel')}
                            className="rounded-xl py-2.5 px-3 border"
                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                          >
                            <option value="scratch">Scratch Card</option>
                            <option value="wheel">Spin Wheel</option>
                          </select>
                          <select
                            value={scratchTemplatePrizeType}
                            onChange={(event) => {
                              const nextType = event.target.value as typeof scratchTemplatePrizeType;
                              setScratchTemplatePrizeType(nextType);
                              setScratchTemplatePrizeLabel(nextType === 'book' ? 'Book' : nextType === 'toy' ? 'Toy' : nextType === 'treat' ? 'Treat' : nextType === 'cash' ? `${rCurrencySymbol || '₹'}${scratchTemplateStars || 10}` : nextType === 'stars' ? `${scratchTemplateStars || 10} stars` : '');
                            }}
                            className="rounded-xl py-2.5 px-3 border"
                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                          >
                            <option value="cash">Cash</option>
                            <option value="stars">Stars</option>
                            <option value="book">Book</option>
                            <option value="toy">Toy</option>
                            <option value="treat">Treat</option>
                            <option value="custom">Custom</option>
                          </select>
                          {scratchTemplatePrizeType === 'stars' || scratchTemplatePrizeType === 'cash' ? (
                            <input
                              value={scratchTemplateStars as any}
                              onChange={(event) => {
                                const value = event.target.value === '' ? '' : Number(event.target.value);
                                setScratchTemplateStars(value);
                                setScratchTemplatePrizeLabel(value === '' ? '' : scratchTemplatePrizeType === 'cash' ? `${rCurrencySymbol || '₹'}${value}` : `${value} stars`);
                              }}
                              placeholder={scratchTemplatePrizeType === 'cash' ? 'Cash' : 'Stars'}
                              type="number"
                              min="1"
                              className="rounded-xl py-2.5 px-3 border"
                              style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                            />
                          ) : (
                            <input
                              value={scratchTemplatePrizeLabel}
                              onChange={(event) => setScratchTemplatePrizeLabel(event.target.value)}
                              placeholder="Prize label"
                              className="rounded-xl py-2.5 px-3 border"
                              style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                            />
                          )}
                          <button disabled={scratchTemplateSaving} type="submit" className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                            {scratchTemplateSaving ? 'Saving...' : 'Save Template'}
                          </button>
                        </div>
                      </form>

                      <div className="mb-5 grid gap-2 md:grid-cols-2">
                        {scratchTemplatesLoading ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading scratch templates...</p>
                        ) : scratchTemplates.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No scratch templates yet. Save one to auto-award cards after task completion.</p>
                        ) : (
                          scratchTemplates.map((template) => (
                            <div key={template.id} className="rounded-xl border p-3 flex items-center justify-between gap-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                              <div>
                                <p className="font-bold" style={{ color: 'var(--text-main)' }}>{template.title}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {template.child_id ? (children.find((child) => child.id === template.child_id)?.name || 'Selected child') : 'All children'} • {getScratchTriggerLabel(template.trigger)} • {template.prize_label}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void updateScratchTemplate(template.id, { is_active: !template.is_active })}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${template.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                              >
                                {template.is_active ? 'Active' : 'Paused'}
                              </button>
                            </div>
                          ))
                        )}
                      </div>

                      <form onSubmit={handleSendScratchReward} className="grid grid-cols-1 gap-3 xl:grid-cols-6 xl:items-center">
                        <select
                          value={scratchChildId}
                          onChange={(event) => setScratchChildId(event.target.value)}
                          className="rounded-xl py-2.5 px-3 border"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        >
                          <option value="">Select child</option>
                          {children.map((child) => (
                            <option key={child.id} value={child.id}>{child.name || child.email}</option>
                          ))}
                        </select>
                        <input
                          value={scratchTitle}
                          onChange={(event) => setScratchTitle(event.target.value)}
                          placeholder="Scratch title"
                          className="rounded-xl py-2.5 px-3 border"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        />
                        <select
                          value={scratchRevealType}
                          onChange={(event) => setScratchRevealType(event.target.value as 'scratch' | 'wheel')}
                          className="rounded-xl py-2.5 px-3 border"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        >
                          <option value="scratch">Scratch Card</option>
                          <option value="wheel">Spin Wheel</option>
                        </select>
                        <select
                          value={scratchPrizeType}
                          onChange={(event) => {
                            const nextType = event.target.value as typeof scratchPrizeType;
                            setScratchPrizeType(nextType);
                            setScratchPrizeLabel(nextType === 'book' ? 'Book' : nextType === 'toy' ? 'Toy' : nextType === 'treat' ? 'Treat' : nextType === 'cash' ? `${rCurrencySymbol || '₹'}${scratchStars || 10}` : nextType === 'stars' ? `${scratchStars || 10} stars` : '');
                          }}
                          className="rounded-xl py-2.5 px-3 border"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        >
                          <option value="cash">Cash</option>
                          <option value="stars">Stars</option>
                          <option value="book">Book</option>
                          <option value="toy">Toy</option>
                          <option value="treat">Treat</option>
                          <option value="custom">Custom</option>
                        </select>
                        {scratchPrizeType === 'stars' || scratchPrizeType === 'cash' ? (
                          <input
                            value={scratchStars as any}
                            onChange={(event) => {
                              const value = event.target.value === '' ? '' : Number(event.target.value);
                              setScratchStars(value);
                              setScratchPrizeLabel(value === '' ? '' : scratchPrizeType === 'cash' ? `${rCurrencySymbol || '₹'}${value}` : `${value} stars`);
                            }}
                            placeholder={scratchPrizeType === 'cash' ? 'Cash' : 'Stars'}
                            type="number"
                            min="1"
                            className="rounded-xl py-2.5 px-3 border"
                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                          />
                        ) : (
                          <input
                            value={scratchPrizeLabel}
                            onChange={(event) => setScratchPrizeLabel(event.target.value)}
                            placeholder="Prize label"
                            className="rounded-xl py-2.5 px-3 border"
                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                          />
                        )}
                        <button disabled={scratchSaving} type="submit" className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                          {scratchSaving ? 'Sending...' : 'Send Scratch'}
                        </button>
                        <input
                          value={scratchReason}
                          onChange={(event) => setScratchReason(event.target.value)}
                          placeholder="Reason, e.g. completed a difficult task"
                          className="rounded-xl py-2.5 px-3 border xl:col-span-5"
                          style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                        />
                      </form>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Reward Catalogue</h3>
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Set the cash cost for screen time, treats, items, experiences, privileges, and learning rewards.</p>
                        </div>
                        <button type="button" onClick={() => void seedDefaultRewards()} disabled={rewardItemsLoading} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                          Add Starter Catalogue
                        </button>
                      </div>
                      <RewardManagement
                        rewards={rewardItems}
                        onCreateReward={createRewardForFamily}
                        onUpdateReward={updateReward}
                        onDeleteReward={deleteReward}
                        loading={rewardItemsLoading}
                      />
                    </div>

                    <div className="space-y-4">
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Redemption Approvals</h2>
                            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Review reward requests for the selected child.</p>
                          </div>
                          <select value={selectedAutomationChildId} onChange={(event) => setAutomationChildId(event.target.value)} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <option value="">Select child</option>
                            {children.map((child) => (
                              <option key={child.id} value={child.id}>{child.name || child.email}</option>
                            ))}
                          </select>
                        </div>
                        <RedemptionHistory redemptions={redemptions} onUpdateStatus={updateRedemptionStatus} loading={redemptionsLoading} />
                      </div>
                    </div>
	              </div>
		                </div>
                  )}
                </div>

                <div className={activeTab === 'tasks' ? 'xl:col-span-12' : 'hidden'}>
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Manage Tasks</h2>
                        <div className="flex gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-cyan-100 text-cyan-800">Active: {filteredTasks.filter(t => taskWindowState(t) === 'active').length}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">Future: {filteredTasks.filter(t => taskWindowState(t) === 'future').length}</span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">Past: {filteredTasks.filter(t => taskWindowState(t) === 'past').length}</span>
                        </div>
                      </div>
                      <button onClick={() => { clearTaskForm(); setShowTaskModal(true); }} className="py-2 px-4 rounded-xl text-sm font-bold text-white shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>+ Create Task</button>
                    </div>
                    {renderActivityFilter(taskActivityFilter, setTaskActivityFilter, tasks.length)}

                    {showTaskModal && (
                      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
                        <div className="bg-[var(--surface)] w-full max-w-2xl rounded-2xl shadow-2xl p-4 sm:p-6 border overflow-y-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]" style={{ borderColor: 'var(--border-main)' }}>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{editTaskId ? 'Edit Task' : 'Create Task'}</h3>
                            <button onClick={() => setShowTaskModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
                          </div>
                          <form onSubmit={handleCreateTask} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <select required value={tChild} onChange={(e) => { setTChild(e.target.value); setTActivityId(''); setTSubjectId(''); }} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="">-- Select Child --</option>
                              {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                            </select>
                            <input required value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Task Title" className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            
                            <select value={tActivityId} onChange={(e) => { setTActivityId(e.target.value); setTSubjectId(''); }} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="">-- Select Program (Optional) --</option>
                              {taskPrograms.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                            </select>
                            
                            {tActivityId && (
                              <select required value={taskSubjects.find((subject) => subjectMatchesStoredValue(subject, tSubjectId))?.id || tSubjectId} onChange={(e) => setTSubjectId(e.target.value)} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                                <option value="">-- Select Subject (Required) --</option>
                                {taskSubjects.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                                <option value="general">General Activity</option>
                              </select>
                            )}

                            <input value={tPoints as any} onChange={(e) => setTPoints(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Base cash value" type="number" min="0" step="0.01" className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <select value={tPerformanceStars} onChange={(e) => setTPerformanceStars(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value={5}>5 stars - full amount</option>
                              <option value={4}>4 stars - strong effort</option>
                              <option value={3}>3 stars - half reward</option>
                              <option value={2}>2 stars - partial reward</option>
                              <option value={1}>1 star - token reward</option>
                            </select>
                            <select value={tRecurrenceType} onChange={(e) => setTRecurrenceType(e.target.value as 'none' | 'daily' | 'weekly')} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="none">One-time</option>
                              <option value="daily">Daily quest</option>
                              <option value="weekly">Weekly quest</option>
                            </select>

                            <div className="col-span-1 flex flex-col gap-1">
                              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Available From</label>
                              <input value={tDue} onChange={(e) => setTDue(e.target.value)} type="datetime-local" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            </div>
                            <div className="col-span-1 flex flex-col gap-1">
                              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Complete Before</label>
                              <input value={tEndDate} onChange={(e) => setTEndDate(e.target.value)} type="datetime-local" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            </div>

                            <div className="col-span-1 sm:col-span-2 rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                              <label className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                                <input type="checkbox" checked={tMandatory} onChange={(e) => setTMandatory(e.target.checked)} />
                                Mandatory timed task
                              </label>
                              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Use for online classes, tuition homework, or tasks that must be completed before the expiry time.</p>
                              {tMandatory ? (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <input type="checkbox" checked={tNotifyParentOnMiss} onChange={(e) => setTNotifyParentOnMiss(e.target.checked)} />
                                    Notify parent if missed
                                  </label>
                                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <input type="checkbox" checked={tNotifyChildOnMiss} onChange={(e) => setTNotifyChildOnMiss(e.target.checked)} />
                                    Remind child if missed
                                  </label>
                                  <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <input type="checkbox" checked={tReduceStarsOnMiss} onChange={(e) => setTReduceStarsOnMiss(e.target.checked)} />
                                    Reduce stars if missed
                                  </label>
                                  {tReduceStarsOnMiss ? (
                                    <input value={tStarPenalty as any} onChange={(e) => setTStarPenalty(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Penalty stars" type="number" min="0" className="rounded-xl py-2 px-3 border text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }} />
                                  ) : null}
                                </div>
                              ) : null}
                            </div>

                            {tRecurrenceType === 'weekly' ? (
                              <div className="col-span-1 sm:col-span-2 flex flex-wrap gap-2 rounded-xl py-2 px-2 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => setTRecurrenceDays((prev) => prev.includes(dayIndex) ? prev.filter((x) => x !== dayIndex) : [...prev, dayIndex])}
                                    className={clsx('px-2 py-1 rounded-lg text-xs font-semibold border', tRecurrenceDays.includes(dayIndex) ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-white text-slate-600 border-slate-200')}
                                  >
                                    {day}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <textarea value={tDesc} onChange={(e) => setTDesc(e.target.value)} placeholder="Short description" rows={3} className="col-span-1 sm:col-span-2 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            
                            <div className="col-span-1 sm:col-span-2 flex flex-col gap-3 mt-2 sm:flex-row">
                              <button disabled={taskLoading} type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{taskLoading ? 'Saving...' : (editTaskId ? 'Save Changes' : 'Create Task')}</button>
                              <button type="button" onClick={() => setShowTaskModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6 mt-6">
                      {tasksLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading tasks...</p>
                      ) : filteredTasks.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{taskActivityFilter === 'all' ? 'No tasks yet. Create one above.' : 'No tasks for this activity.'}</p>
                      ) : (
                        (() => {
                          const todayStart = new Date();
                          todayStart.setHours(0, 0, 0, 0);
                          const todayEnd = new Date(todayStart.getTime() + 86400000);

                          const tToday: any[] = [];
                          const tFuture: any[] = [];
                          const tPast: any[] = [];

                          filteredTasks.forEach((t) => {
                            const state = taskWindowState(t);
                            if (state === 'past') {
                              tPast.push(t);
                            } else if (state === 'future') {
                              tFuture.push(t);
                            } else {
                              tToday.push(t);
                            }
                          });

                          const renderTaskList = (title: string, list: any[], emptyMsg: string) => (
                            <div>
                              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                {title} <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{list.length}</span>
                              </h3>
                              {list.length === 0 ? (
                                <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>{emptyMsg}</p>
                              ) : (
                                <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                                  {list.map((t) => (
                                    <div key={t.id} className={clsx("rounded-xl p-4 border flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow relative overflow-hidden", t.created_by === 'automation' ? "bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800" : "bg-[var(--surface-soft)] border-[var(--border-main)]")}>
                                      {t.created_by === 'automation' && <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">AUTO</div>}
                                      <div>
                                        <div className="flex justify-between items-start mb-1">
                                          <p className="font-bold text-base" style={{ color: 'var(--text-main)' }}>{t.title}</p>
                                          <span className="font-bold text-emerald-600 text-sm bg-emerald-100 px-2 rounded-full">{t.points ?? t.star_value} stars</span>
                                        </div>
                                        <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                                        
                                        <div className="flex flex-wrap gap-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                                          <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">👤 {getChildName(t.child_id)}</span>
                                          {(t.available_from || t.due_date) && <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">▶ {new Date(t.available_from || t.due_date).toLocaleDateString()} {new Date(t.available_from || t.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                          {(t.expires_at || t.end_date) && <span className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded">⏳ before {new Date(t.expires_at || t.end_date).toLocaleDateString()} {new Date(t.expires_at || t.end_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                          {t.is_mandatory && <span className="flex items-center gap-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2 py-1 rounded">Mandatory</span>}
                                          {t.subject_id && <span className="flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded">📚 {t.subject_id}</span>}
                                        </div>
                                      </div>
                                      <div className="flex gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-main)' }}>
                                        <button onClick={() => startEditTask(t)} className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">Edit</button>
                                        <button onClick={() => handleDeleteTask(t.id)} className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors">Delete</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );

                          return (
                            <div className="space-y-8">
                              {renderTaskList('Today / Current Tasks', tToday, 'No tasks for today.')}
                              {renderTaskList('Future Tasks', tFuture, 'No future tasks scheduled.')}
                              {renderTaskList('Past / Completed', tPast, 'No past tasks.')}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </div>

                <div className={activeTab === 'routines' ? 'xl:col-span-12 space-y-4' : 'hidden'}>
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <RoutineManagement familyId={familyId} childrenProfiles={childProfiles} />
                  </div>
                </div>

                <div className={activeTab === 'automation' ? 'xl:col-span-12 space-y-4' : 'hidden'}>
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Automation Center</h2>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Routine, smart task generation, and reminders for one selected child.</p>
                      </div>
                      <select value={selectedAutomationChildId} onChange={(event) => setAutomationChildId(event.target.value)} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">Select child</option>
                        {children.map((child) => (
                          <option key={child.id} value={child.id}>{child.name || child.email}</option>
                        ))}
                      </select>
                    </div>
                    {schedulerError && <div className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-700">{schedulerError}</div>}
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Selected Child</p>
                        <p className="mt-1 font-bold" style={{ color: 'var(--text-main)' }}>{selectedAutomationChildId ? selectedAutomationName : 'None'}</p>
                      </div>
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Generated Tasks</p>
                        <p className="mt-1 font-bold" style={{ color: 'var(--text-main)' }}>{scheduledTasks.length}</p>
                      </div>
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Notifications</p>
                        <button type="button" onClick={() => void requestPermission()} className="mt-1 text-sm font-bold text-cyan-600">
                          {notificationPermission === 'granted' ? 'Enabled' : 'Enable browser alerts'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <RoutineConfigurationUI routine={routine} onUpdate={saveRoutineConfiguration} loading={routineLoading} />
                  <TaskSchedulerUI
                    routine={routine}
                    upcomingExams={upcomingExamEvents}
                    onGenerateTodaysTasks={generateTodaysTasks}
                    onGenerateExamTasks={generateExamTasks}
                    onOpenTasks={() => setActiveTab('tasks')}
                    loading={schedulerLoading}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void seedDefaultReminders()} disabled={!selectedAutomationChildId || remindersLoading} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                      Add Default Reminders
                    </button>
                  </div>
                  <ReminderManagement
                    reminders={reminders}
                    onCreate={createReminderForSelectedChild}
                    onUpdate={updateReminder}
                    onDelete={deleteReminder}
                    loading={remindersLoading}
                  />
                </div>

                <div className={activeTab === 'approvals' ? 'xl:col-span-12' : 'hidden'}>
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <ApprovalsManagement familyId={familyId} childrenProfiles={childProfiles} starCashRate={Number(rewards[0]?.star_to_currency_rate || 0)} />
                  </div>
                </div>

              <section className={clsx(
                'space-y-4',
                ['family', 'exams', 'challenges', 'communication', 'settings'].includes(activeTab) && 'xl:col-span-12',
                !['family', 'exams', 'challenges', 'communication', 'settings'].includes(activeTab) && 'hidden'
              )}>
                {activeTab === 'dashboard' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <h2 className="text-lg font-bold mb-3 inline-flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                      <Users2 size={18} /> Child Accounts
                    </h2>
                    {childrenLoading ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading child accounts...</p>
                    ) : children.length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No child accounts yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {children.map((child) => {
                          const meta = enrichedChildProfiles.find((p) => p.id === child.id) as any;
                          return (
                            <div key={child.id} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                              <div>
                                <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{child.name || 'Child'}</p>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{(child.email || '').replace('@tiktrack.family', '')}</p>
                                {meta ? (
                                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Level {meta.levelInfo?.level} • {meta.computedTotalStars}★</p>
                                ) : null}
                              </div>
                              <Circle size={14} className="text-emerald-500 fill-current" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'dashboard' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>Quick Metrics</h2>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                        <BarChart3 className="mx-auto text-white" size={16} />
                        <p className="text-white text-xs mt-1">Profiles</p>
                        <p className="text-white font-extrabold">{children.length}</p>
                      </div>
                      <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #14b8a6)' }}>
                        <TrendingUp className="mx-auto text-white" size={16} />
                        <p className="text-white text-xs mt-1">Status</p>
                        <p className="text-white font-extrabold">{hasChildren ? 'Live' : 'Empty'}</p>
                      </div>
                      <div className="rounded-xl p-3 text-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                        <ShieldCheck className="mx-auto text-white" size={16} />
                        <p className="text-white text-xs mt-1">Proofs</p>
                        <p className="text-white font-extrabold">{tasksCompletedCount}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'dashboard' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--text-main)' }}>Family Snapshot</h2>
                    <div className="space-y-3">
                      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Recent Exams</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{examsCount}</span>
                        </div>
                        {latestExams.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No exam results recorded yet.</p>
                        ) : latestExams.map((ex) => (
                          <div key={ex.id} className="py-2 border-t first:border-t-0" style={{ borderColor: 'var(--border-main)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{ex.subject} • {getChildName(ex.child_id)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ex.marks_scored}/{ex.total_marks} • {ex.exam_date ? new Date(ex.exam_date).toLocaleDateString() : 'No date'}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Active Challenges</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{activeChallenges.length}</span>
                        </div>
                        {activeChallenges.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{completedChallenges.length > 0 ? `${completedChallenges.length} completed challenge${completedChallenges.length === 1 ? '' : 's'}.` : 'No active challenges.'}</p>
                        ) : activeChallenges.slice(0, 3).map((ch) => (
                          <div key={ch.id} className="py-2 border-t first:border-t-0" style={{ borderColor: 'var(--border-main)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{ch.title}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Parent {ch.parent_score} vs Child {ch.child_score} • Target {ch.target_score}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Upcoming Events</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{upcomingEventsCount}</span>
                        </div>
                        {upcomingEventsPreview.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming events.</p>
                        ) : upcomingEventsPreview.map((ev) => (
                          <div key={ev.id} className="py-2 border-t first:border-t-0" style={{ borderColor: 'var(--border-main)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{ev.title}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{ev.child_id ? getChildName(ev.child_id) : 'Family'} • {getEventDateValue(ev) ? new Date(getEventDateValue(ev) as string).toLocaleDateString() : 'No date'}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="font-semibold" style={{ color: 'var(--text-main)' }}>Growth Updates</p>
                          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{growthLogs.length}</span>
                        </div>
                        {latestGrowthLogs.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No growth logs yet.</p>
                        ) : latestGrowthLogs.map((g) => (
                          <div key={g.id} className="py-2 border-t first:border-t-0" style={{ borderColor: 'var(--border-main)' }}>
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{getChildName(g.child_id)}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.height_cm} cm • {g.weight_kg} kg • {g.date ? new Date(g.date).toLocaleDateString() : 'No date'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'exams' && (
                  <>
                    <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Exams</h2>
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={filterChild} onChange={(ev) => setFilterChild(ev.target.value)} className="rounded-xl py-1 px-3 text-sm border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <option value="">All Children</option>
                            {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                          </select>
                          <select value={examFilterMonth} onChange={(ev) => setExamFilterMonth(ev.target.value)} className="rounded-xl py-1 px-3 text-sm border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            {MONTH_OPTIONS.map((month, index) => (
                              <option key={month} value={String(index)}>{month}</option>
                            ))}
                          </select>
                          <select value={examFilterYear} onChange={(ev) => setExamFilterYear(ev.target.value)} className="rounded-xl py-1 px-3 text-sm border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            {examYearOptions.map((year) => (
                              <option key={year} value={String(year)}>{year}</option>
                            ))}
                          </select>
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{visibleExams.length}</span>
                          <button onClick={() => { setEChild(''); setEActivityId(''); setESubjects([]); setESubjectIds([]); setERecurrenceType('none'); setERecurrenceDays([]); setEMarks(''); setETotal(''); setEDate(''); setESyllabusScope(''); setEPoints(''); setEditExamId(null); setShowExamModal(true); }} className="py-2 px-4 rounded-xl text-sm font-bold text-white shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>+ Add Exam</button>
                        </div>
                      </div>
                      {renderActivityFilter(examActivityFilter, setExamActivityFilter, examPeriodCount)}

                      {showExamModal && createPortal((
                        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
                          <div className="bg-[var(--surface)] w-full max-w-2xl rounded-2xl shadow-2xl p-4 sm:p-6 border max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto" style={{ borderColor: 'var(--border-main)' }}>
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{editExamId ? 'Edit Exam' : 'Create Exam'}</h3>
                              <button onClick={() => setShowExamModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
                            </div>
                            <form onSubmit={(e) => { handleCreateExam(e); setShowExamModal(false); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <select value={eChild} onChange={(ev) => { setEChild(ev.target.value); setEActivityId(''); setESubjects([]); setESubjectIds([]); }} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                                <option value="">-- Select Child --</option>
                                {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                              </select>
                              <select required value={eActivityId} onChange={(ev) => { setEActivityId(ev.target.value); setESubjects([]); setESubjectIds([]); }} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                                <option value="">-- Activity / Program --</option>
                                {examPrograms.filter(p => (p.modules || []).includes('exams')).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                              </select>
                              <div className="col-span-1 md:col-span-2 flex flex-col gap-2">
                                <label className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Subjects</label>
                                {!eActivityId ? (
                                  <p className="text-xs text-slate-500">Please select an Activity / Program first.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {examSubjects.filter(s => s.includeInExams).map(s => {
                                      const isSelected = eSubjectIds.some((subjectId) => subjectMatchesStoredValue(s, subjectId));
                                      return (
                                        <button
                                          key={s.id}
                                          type="button"
                                          onClick={() => {
                                            if (isSelected) {
                                              setESubjectIds(prev => prev.filter(id => !subjectMatchesStoredValue(s, id)));
                                              setESubjects(prev => prev.filter(name => name !== s.name));
                                            } else {
                                              setESubjectIds(prev => [...prev, s.id]);
                                              setESubjects(prev => [...prev, s.name]);
                                            }
                                          }}
                                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${isSelected ? 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900 dark:text-cyan-100 dark:border-cyan-700' : 'bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-main)] hover:bg-[var(--surface-hover)]'}`}
                                        >
                                          {s.name}
                                        </button>
                                      );
                                    })}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (eSubjectIds.includes('custom')) {
                                          setESubjectIds(prev => prev.filter(id => id !== 'custom'));
                                        } else {
                                          setESubjectIds(prev => [...prev, 'custom']);
                                        }
                                      }}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${eSubjectIds.includes('custom') ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-700' : 'bg-[var(--surface-soft)] text-[var(--text-muted)] border-[var(--border-main)] hover:bg-[var(--surface-hover)]'}`}
                                    >
                                      Custom Subject
                                    </button>
                                  </div>
                                )}

                                {eSubjectIds.includes('custom') && (
                                  <input 
                                    required 
                                    value={eSubjects.filter(s => !examSubjects.find(es => es.name === s)).join(', ')} 
                                    onChange={(ev) => {
                                      const nonCustom = eSubjects.filter(s => examSubjects.find(es => es.name === s));
                                      const customValue = ev.target.value;
                                      setESubjects(customValue ? [...nonCustom, customValue] : nonCustom);
                                    }} 
                                    placeholder="Enter Custom Subject Name" 
                                    className="rounded-xl py-2 px-3 border mt-2" 
                                    style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} 
                                  />
                                )}
                              </div>
                              <select value={eType} onChange={(ev) => setEType(ev.target.value as 'weekly_test' | 'unit_test' | 'midterm' | 'final' | 'practice' | 'other')} className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                                <option value="weekly_test">Weekly Test</option>
                                <option value="unit_test">Unit Test</option>
                                <option value="midterm">Midterm</option>
                                <option value="final">Final</option>
                                <option value="practice">Practice</option>
                                <option value="other">Other</option>
                              </select>
                              
                              <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Exam Date</label>
                                  <input required value={eDate} onChange={(ev) => setEDate(ev.target.value)} type="datetime-local" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Recurrence</label>
                                  <select 
                                    value={eRecurrenceType} 
                                    onChange={(ev) => setERecurrenceType(ev.target.value as any)} 
                                    className="rounded-xl py-2 px-3 border h-[38px]" 
                                    style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                  >
                                    <option value="none">One Time</option>
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                  </select>
                                </div>
                              </div>

                              {eRecurrenceType === 'weekly' && (
                                <div className="col-span-1 md:col-span-2 flex flex-wrap gap-2 p-3 rounded-xl border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                                    <button
                                      key={day}
                                      type="button"
                                      onClick={() => setERecurrenceDays((prev) => prev.includes(dayIndex) ? prev.filter((x) => x !== dayIndex) : [...prev, dayIndex])}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors`}
                                      style={eRecurrenceDays.includes(dayIndex) ? { background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))', color: 'white' } : { background: 'var(--surface)', color: 'var(--text-muted)' }}
                                    >
                                      {day}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <input value={eSyllabusScope} onChange={(ev) => setESyllabusScope(ev.target.value)} placeholder="Syllabus scope (optional)" className="md:col-span-2 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                              
                              <div className="col-span-1 md:col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <input value={eMarks as any} onChange={(ev) => setEMarks(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Marks scored" type="number" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                                <input value={eTotal as any} onChange={(ev) => setETotal(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Total marks" type="number" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                                <input value={ePoints as any} onChange={(ev) => setEPoints(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Max stars" type="number" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                              </div>

                              <div className="md:col-span-2 flex flex-col gap-3 mt-4 sm:flex-row">
                                <button disabled={examLoading} type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{examLoading ? 'Saving...' : (editExamId ? 'Save Changes' : 'Save Exam')}</button>
                                <button type="button" onClick={() => setShowExamModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Cancel</button>
                              </div>
                            </form>
                          </div>
                        </div>
                      ), document.body)}

                      <div className="space-y-6">
                        {examsLoading ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading exams...</p>
                        ) : visibleExams.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No exam results recorded yet.</p>
                        ) : (
                          (() => {
                            const todayStart = new Date();
                            todayStart.setHours(0, 0, 0, 0);
                            const todayEnd = new Date(todayStart.getTime() + 86400000);

                            const exToday: any[] = [];
                            const exFuture: any[] = [];
                            const exPast: any[] = [];

                            visibleExams.forEach((ex) => {
                              const dTime = ex.exam_date ? new Date(ex.exam_date).getTime() : 0;
                              const hasPublishedResult =
                                ex.status === 'completed' ||
                                ex.status === 'published' ||
                                ex.status === 'result_published' ||
                                (ex.marks_scored !== undefined && ex.marks_scored !== null && ex.total_marks !== undefined && ex.total_marks !== null);

                              if (hasPublishedResult) {
                                exPast.push(ex);
                              } else if (!ex.exam_date) {
                                exToday.push(ex);
                              } else if (dTime < todayStart.getTime()) {
                                exPast.push(ex);
                              } else if (dTime >= todayEnd.getTime()) {
                                exFuture.push(ex);
                              } else {
                                exToday.push(ex);
                              }
                            });

                            const renderExamList = (title: string, list: any[], emptyMsg: string) => (
                              <div>
                                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                  {title} <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{list.length}</span>
                                </h3>
                                {list.length === 0 ? (
                                  <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>{emptyMsg}</p>
                                ) : (
                                  <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                                    {list.map((ex) => (
                                      <div key={ex.id} className="rounded-xl p-4 border flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow bg-[var(--surface-soft)]" style={{ borderColor: 'var(--border-main)' }}>
                                        <div>
                                          <div className="flex justify-between items-start mb-1">
                                            <p className="font-bold text-base" style={{ color: 'var(--text-main)' }}>{ex.subject}</p>
                                            <span className="font-bold text-indigo-600 text-xs bg-indigo-100 px-2 py-0.5 rounded-full">{(ex.exam_type || 'exam').replace('_', ' ').toUpperCase()}</span>
                                          </div>
                                          <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>{ex.syllabus_scope || 'No syllabus specified'}</p>
                                          
                                          <div className="flex flex-wrap gap-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">👤 {getChildName(ex.child_id)}</span>
                                            {ex.exam_date && <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">📅 {new Date(ex.exam_date).toLocaleDateString()} {new Date(ex.exam_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                            {ex.marks_scored !== undefined && ex.marks_scored !== null && <span className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded">✅ Scored: {ex.marks_scored}/{ex.total_marks}</span>}
                                          </div>
                                        </div>
                                        <div className="flex gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-main)' }}>
                                          <button onClick={() => { startEditExam(ex); setShowExamModal(true); }} className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">{ex.marks_scored === undefined || ex.marks_scored === null ? 'Add Marks / Edit' : 'Edit'}</button>
                                          <button onClick={() => handleDeleteExam(ex.id)} className="flex-1 py-1.5 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors">Delete</button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );

                            return (
                              <div className="space-y-8 mt-4">
                                {renderExamList('Today / Active', exToday, 'No exams today.')}
                                {renderExamList('Future Exams', exFuture, 'No future exams scheduled.')}
                                {renderExamList('Past / Completed', exPast, 'No past exams.')}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <GrowthChart logs={filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs} isDark={theme === 'dark'} />
                      <AcademicHeatmap exams={visibleExams} isDark={theme === 'dark'} />
                    </div>
                  </>
                )}

                {activeTab === 'family' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <h2 className="text-lg font-bold" style={{ color: 'var(--text-main)' }}>Kid Activities</h2>
                      <select value={selectedActivityChildId} onChange={(e) => setActivityChildId(e.target.value)} className="w-full rounded-xl py-2 px-3 border text-sm sm:w-auto" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">Select child</option>
                        {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                      </select>
                    </div>
                    <p className="mb-3 text-sm" style={{ color: 'var(--text-muted)' }}>Create root activities (School, Extra Curricular, etc.) and choose which branches appear on the child side.</p>
                    <div className="mb-4 flex flex-col sm:flex-row gap-3">
                      <button type="button" onClick={() => { clearActivityForm(); setIsActivityModalOpen(true); }} className="w-full py-2 px-4 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition sm:w-auto" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                        + Create New Activity
                      </button>
                      <div className="flex bg-[var(--surface-soft)] border rounded-xl p-1 w-full sm:w-auto" style={{ borderColor: 'var(--border-main)' }}>
                        <button type="button" onClick={() => setShowArchivedActivities(false)} className={`flex-1 py-1.5 px-4 rounded-lg text-sm font-bold transition-colors ${!showArchivedActivities ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Active</button>
                        <button type="button" onClick={() => setShowArchivedActivities(true)} className={`flex-1 py-1.5 px-4 rounded-lg text-sm font-bold transition-colors ${showArchivedActivities ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Archived</button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {activityProgramsLoading ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading activities...</p>
                      ) : (showArchivedActivities ? archivedActivityPrograms : activityPrograms).length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No {showArchivedActivities ? 'archived' : 'active'} activities yet for this child.</p>
                      ) : (
                        (showArchivedActivities ? archivedActivityPrograms : activityPrograms).map((program) => (
                          <div key={program.id} className={`rounded-2xl border p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${showArchivedActivities ? 'opacity-70 grayscale-[30%]' : ''}`} style={{ borderColor: 'var(--border-main)', background: 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(6,182,212,0.1))' }}>
                            <div className="min-w-0">
                              <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{program.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{children.find((child) => child.id === program.childId)?.name || 'Child'} • Modules: {(program.modules || ['tasks']).join(', ')}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                              {!showArchivedActivities && <button type="button" onClick={() => { setSelectedActivity(program); setActivityModalTab((program.modules?.[0] || 'tasks') as PlannerActivityModule); setEditingSubId(null); setNewSubName(''); setNewSubTeacher(''); setNewSubInExam(true); }} className="py-2 px-3 rounded-lg text-sm font-semibold bg-cyan-100 text-cyan-800">Open</button>}
                              {!showArchivedActivities && (program.modules || []).includes('subjects') && <button type="button" onClick={() => { setSelectedActivity(program); setActivityModalTab('subjects'); setEditingSubId(null); setNewSubName(''); setNewSubTeacher(''); setNewSubInExam(true); }} className="py-2 px-3 rounded-lg text-sm font-semibold bg-indigo-100 text-indigo-700">Subjects</button>}
                              {!showArchivedActivities && <button type="button" onClick={() => startEditActivity(program)} className="py-2 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>}
                              {!showArchivedActivities && <button type="button" onClick={() => void handleCompleteActivity(program)} className="py-2 px-3 rounded-lg text-sm font-semibold bg-emerald-100 text-emerald-700">Complete</button>}
                              {showArchivedActivities && <button type="button" onClick={() => void handleUnarchiveActivity(program)} className="py-2 px-3 rounded-lg text-sm font-semibold bg-indigo-100 text-indigo-700">Unarchive</button>}
                              {showArchivedActivities && <button type="button" onClick={() => { setSelectedActivity(program); setActivityModalTab((program.modules?.[0] || 'tasks') as PlannerActivityModule); setEditingSubId(null); setNewSubName(''); setNewSubTeacher(''); setNewSubInExam(true); }} className="py-2 px-3 rounded-lg text-sm font-semibold bg-cyan-100 text-cyan-800">View</button>}
                              <button type="button" onClick={() => handleDeleteActivity(program.id)} className="col-span-2 sm:col-span-1 py-2 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'communication' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>Family Chat</h2>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!inboxChildId || !inboxMessage.trim() || !user) return;
                      await sendMessage(inboxChildId, familyId, inboxMessage.trim(), 'parent', familyId, inboxSubject);
                      setInboxMessage('');
                      setInboxSubject('');
                      setSuccess('Message sent successfully!');
                      setTimeout(() => setSuccess(''), 3000);
                    }} className="space-y-4">
                      <select required value={inboxChildId} onChange={(e) => setInboxChildId(e.target.value)} className="w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                        <option value="">Select Child...</option>
                        {children.map(c => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
                      </select>
                      <input
                        value={inboxSubject}
                        onChange={(e) => setInboxSubject(e.target.value)}
                        placeholder="Subject (optional)"
                        className="w-full rounded-xl py-3 px-4 border focus:outline-none"
                        style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                      />
                      <div className="rounded-xl border p-3 h-64 overflow-y-auto" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                        {inboxChildId && selectedThread.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet with this child.</p>
                        ) : null}
                        {!inboxChildId ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Select a child to view conversation.</p>
                        ) : null}
                        {selectedThread.map((msg) => {
                          const isParentSender = (msg.sender_role || 'parent') === 'parent';
                          return (
                            <div key={msg.id} className={`mb-2 flex ${isParentSender ? 'justify-end' : 'justify-start'}`}>
                              <div
                                className={`max-w-[80%] rounded-2xl px-3 py-2 ${isParentSender ? 'bg-sky-500 text-white' : ''}`}
                                style={isParentSender ? {} : { background: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border-main)' }}
                              >
                                {msg.subject ? <p className="text-[11px] font-bold uppercase tracking-wide opacity-80 mb-1">{msg.subject}</p> : null}
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                <p className={`text-[10px] mt-1 ${isParentSender ? 'text-white/80' : ''}`} style={isParentSender ? {} : { color: 'var(--text-muted)' }}>
                                  {new Date(msg.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <textarea
                        required
                        value={inboxMessage}
                        onChange={(e) => setInboxMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full rounded-xl py-3 px-4 border focus:outline-none min-h-[100px]"
                        style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                      />
                      <button type="submit" className="w-full py-3 rounded-xl text-sm font-bold text-white bg-sky-500 hover:bg-sky-600 transition">
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-4">
                    <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                      <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-main)' }}>Settings</h2>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        <button onClick={() => setSettingsTab('manage_child')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'manage_child' ? 'white' : 'var(--text-main)', background: settingsTab === 'manage_child' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Manage Child
                        </button>
                        <button onClick={() => setSettingsTab('growth')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'growth' ? 'white' : 'var(--text-main)', background: settingsTab === 'growth' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Growth
                        </button>
                        <button onClick={() => setSettingsTab('telegram')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'telegram' ? 'white' : 'var(--text-main)', background: settingsTab === 'telegram' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Telegram
                        </button>
                        <button onClick={() => setSettingsTab('coparenting')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'coparenting' ? 'white' : 'var(--text-main)', background: settingsTab === 'coparenting' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Co-Parenting
                        </button>
                        <button onClick={() => setSettingsTab('backup_restore')} className="w-full py-2 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--border-main)', color: settingsTab === 'backup_restore' ? 'white' : 'var(--text-main)', background: settingsTab === 'backup_restore' ? 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' : 'var(--surface-soft)' }}>
                          Backup Restore
                        </button>
                      </div>
                    </div>

                    {settingsTab === 'manage_child' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <h3 className="inline-flex items-center gap-2 text-base font-bold" style={{ color: 'var(--text-main)' }}>
                            <Users2 size={18} /> Manage Child
                          </h3>
                          <button onClick={() => setIsModaling(true)} className="inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                            <Plus size={16} /> Add Child
                          </button>
                        </div>
                        {childrenLoading ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading child accounts...</p>
                        ) : children.length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No child accounts yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {children.map((child) => {
                              const meta = enrichedChildProfiles.find((p) => p.id === child.id) as any;
                              const isEditingThisChild = editingChildId === child.id;
                              return (
                                <div key={child.id} className="rounded-2xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border text-2xl" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                                        {meta?.avatar_emoji || CHILD_AVATARS[0]}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="flex flex-wrap items-center gap-2 font-semibold" style={{ color: 'var(--text-main)' }}>
                                          {child.name || 'Child'}
                                          {meta?.pet_name ? <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-700">Call me {meta.pet_name}</span> : null}
                                          {getActiveSickPeriod(child.id) && <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-yellow-700">Sick 🤒</span>}
                                        </p>
                                        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{(child.email || '').replace('@tiktrack.family', '')}</p>
                                        {meta ? <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Level {meta.levelInfo?.level} • {meta.computedTotalStars}★ • {meta.consistency_score || 0}% consistency</p> : null}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                      <button
                                        type="button"
                                        onClick={() => isEditingThisChild ? cancelEditChildProfile() : startEditChildProfile(child, meta)}
                                        className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white"
                                      >
                                        {isEditingThisChild ? 'Close Edit' : 'Edit Profile'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSickTargetChild(child.id);
                                          setIsSickModalOpen(true);
                                        }}
                                        className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-bold text-white"
                                      >
                                        Mark Sick
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleParentResetChildPassword(child)}
                                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white"
                                      >
                                        Reset Password
                                      </button>
                                      <Circle size={14} className="text-emerald-500 fill-current" />
                                    </div>
                                  </div>

                                  {isEditingThisChild ? (
                                    <form onSubmit={handleSaveChildProfile} className="mt-4 rounded-2xl border p-3 sm:p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                        <div className="lg:col-span-2">
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Full Name</label>
                                          <input
                                            required
                                            value={childEditForm.name}
                                            onChange={(event) => updateChildEditForm('name', event.target.value)}
                                            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nickname</label>
                                          <input
                                            value={childEditForm.petName}
                                            onChange={(event) => updateChildEditForm('petName', event.target.value)}
                                            placeholder="Used in greetings"
                                            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                          />
                                        </div>
                                        <div className="lg:col-span-3">
                                          <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Avatar</p>
                                          <div className="flex flex-wrap gap-2">
                                            {CHILD_AVATARS.map((emoji) => (
                                              <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => updateChildEditForm('avatarEmoji', emoji)}
                                                className={clsx('grid h-11 w-11 place-items-center rounded-xl border text-xl transition', childEditForm.avatarEmoji === emoji ? 'border-cyan-300 bg-cyan-500/15' : 'hover:bg-slate-100 dark:hover:bg-white/10')}
                                                style={childEditForm.avatarEmoji === emoji ? {} : { borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}
                                                aria-label={`Choose avatar ${emoji}`}
                                              >
                                                {emoji}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                                          <input
                                            type="date"
                                            value={childEditForm.dateOfBirth}
                                            onChange={(event) => updateChildEditForm('dateOfBirth', event.target.value)}
                                            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Height (cm)</label>
                                          <input
                                            type="number"
                                            min="30"
                                            max="250"
                                            value={childEditForm.heightCm}
                                            onChange={(event) => updateChildEditForm('heightCm', event.target.value)}
                                            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Weight (kg)</label>
                                          <input
                                            type="number"
                                            min="5"
                                            max="200"
                                            step="0.1"
                                            value={childEditForm.weightKg}
                                            onChange={(event) => updateChildEditForm('weightKg', event.target.value)}
                                            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                          />
                                        </div>
                                        <div>
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Greeting Style</label>
                                          <select
                                            value={childEditForm.communicationStyle}
                                            onChange={(event) => updateChildEditForm('communicationStyle', event.target.value as ChildEditForm['communicationStyle'])}
                                            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                          >
                                            {CHILD_COMMUNICATION_STYLES.map((style) => (
                                              <option key={style.id} value={style.id}>{style.label}</option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="lg:col-span-2">
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Interests</label>
                                          <input
                                            value={childEditForm.interests}
                                            onChange={(event) => updateChildEditForm('interests', event.target.value)}
                                            placeholder="gardening, chess, animals"
                                            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                          />
                                        </div>
                                        <div className="lg:col-span-3">
                                          <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Profile Motto</label>
                                          <input
                                            maxLength={90}
                                            value={childEditForm.profileMotto}
                                            onChange={(event) => updateChildEditForm('profileMotto', event.target.value)}
                                            placeholder="A short line that appears in the profile"
                                            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                            style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                                          />
                                        </div>
                                      </div>
                                      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                        <button
                                          type="button"
                                          onClick={cancelEditChildProfile}
                                          className="rounded-xl border px-4 py-2.5 text-sm font-bold"
                                          style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="submit"
                                          disabled={childEditSaving}
                                          className="rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
                                          style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}
                                        >
                                          {childEditSaving ? 'Saving...' : 'Save Profile'}
                                        </button>
                                      </div>
                                    </form>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {settingsTab === 'rewards' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>Rewards Configuration</h3>
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{rewards.length}</span>
                        </div>
                        <div className="space-y-4">
                          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <h4 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Cash Value Rules</h4>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Saved conversion from stars to real money.</p>
                              </div>
                              {rewards[0] ? (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                                  1 point = {normalizeRewardSettings(rewards[0]).currency_symbol}{normalizeRewardSettings(rewards[0]).point_to_cash_rate}
                                </span>
                              ) : null}
                            </div>
                            {rewardsLoading ? (
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading cash rules...</p>
                            ) : rewards.length === 0 ? (
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No cash value saved yet.</p>
                            ) : (
                              <div className="grid gap-2 md:grid-cols-2">
                                {rewards.map((rewardRule) => (
                                  <div key={rewardRule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                                    <div>
                                      <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>1 point = {normalizeRewardSettings(rewardRule).currency_symbol}{normalizeRewardSettings(rewardRule).point_to_cash_rate}</p>
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Weekly bonus: {rewardRule.weekly_bonus_enabled ? 'enabled' : 'disabled'}</p>
                                    </div>
                                    <button type="button" onClick={() => startEditReward(rewardRule)} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700">
                                      Edit
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <form onSubmit={handleSaveReward} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                            <input required value={rCurrencySymbol} onChange={(ev) => setRCurrencySymbol(ev.target.value)} placeholder="₹" className="rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <input required value={rStarRate as any} onChange={(ev) => setRStarRate(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Cash value per point" type="number" min="0" step="0.01" className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <label className="col-span-1 sm:col-span-1 inline-flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={rWeeklyBonus} onChange={(ev) => setRWeeklyBonus(ev.target.checked)} className="h-4 w-4" />
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Weekly bonus</span>
                            </label>
                            <div className="col-span-1 sm:col-span-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                              {([5, 4, 3, 2, 1] as const).map((star) => (
                                <label key={star} className="rounded-xl border p-2 text-xs font-bold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-muted)' }}>
                                  {star}★ %
                                  <input
                                    value={rPayoutPercentages[star]}
                                    onChange={(event) => setRPayoutPercentages((current) => ({ ...current, [star]: Number(event.target.value) || 0 }))}
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                                    style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                                  />
                                </label>
                              ))}
                            </div>
                            <div className="col-span-1 sm:col-span-3 flex gap-2">
                              <button disabled={rewardLoading} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{rewardLoading ? 'Saving...' : (editRewardId ? 'Save Changes' : '+ Save Setting')}</button>
                              {editRewardId ? (
                                <button type="button" onClick={cancelEditReward} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                              ) : (
                                <button type="button" onClick={() => { setRStarRate(''); setRWeeklyBonus(false); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                              )}
                            </div>
                          </form>
                          <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                            <div className="mb-3">
                              <h4 className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>Award Stars</h4>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Give stars directly for kindness, good choices, or anything outside activities.</p>
                            </div>
                            <form onSubmit={handleAwardStars} className="grid grid-cols-1 gap-2 xl:grid-cols-[1fr_120px_1.5fr_auto] xl:items-center">
                              <select
                                value={awardChildId}
                                onChange={(event) => setAwardChildId(event.target.value)}
                                className="rounded-xl py-2 px-3 border"
                                style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                              >
                                <option value="">Select child</option>
                                {children.map((child) => (
                                  <option key={child.id} value={child.id}>{child.name || child.email}</option>
                                ))}
                              </select>
                              <input
                                value={awardStars as any}
                                onChange={(event) => setAwardStars(event.target.value === '' ? '' : Number(event.target.value))}
                                placeholder="Stars"
                                type="number"
                                min="1"
                                className="rounded-xl py-2 px-3 border"
                                style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                              />
                              <input
                                value={awardReason}
                                onChange={(event) => setAwardReason(event.target.value)}
                                placeholder="Reason"
                                className="rounded-xl py-2 px-3 border"
                                style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                              />
                              <button disabled={awardSaving} type="submit" className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                                {awardSaving ? 'Awarding...' : 'Award'}
                              </button>
                              <label className="inline-flex items-center gap-2 text-sm xl:col-span-4">
                                <input type="checkbox" checked={awardSurprise} onChange={(event) => setAwardSurprise(event.target.checked)} className="h-4 w-4" />
                                <span style={{ color: 'var(--text-muted)' }}>Send as surprise gift for child to open</span>
                              </label>
                            </form>
                          </div>
                          <RewardManagement rewards={rewardItems} onCreateReward={createRewardForFamily} onUpdateReward={updateReward} onDeleteReward={deleteReward} loading={rewardItemsLoading} />
                        </div>
                      </div>
                    )}

                    {settingsTab === 'growth' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-bold" style={{ color: 'var(--text-main)' }}>Growth & Health</h3>
                          <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{growthLogs.length}</span>
                        </div>
                        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                          BMI formula: weight (kg) / (height (m) × height (m)). Height and weight come from each growth log entry.
                        </p>
                        <div className="space-y-3">
                          <form onSubmit={handleCreateGrowth} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select value={gChild} onChange={(ev) => setGChild(ev.target.value)} className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="">-- Child --</option>
                              {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                            </select>
                            <input required value={gHeight as any} onChange={(ev) => setGHeight(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Height (cm)" type="number" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <input required value={gWeight as any} onChange={(ev) => setGWeight(ev.target.value === '' ? '' : Number(ev.target.value))} placeholder="Weight (kg)" type="number" step="0.1" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <input required value={gDate} onChange={(ev) => setGDate(ev.target.value)} type="date" className="col-span-1 sm:col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <div className="col-span-1 sm:col-span-2 flex gap-2">
                              <button disabled={growthLoading2} type="submit" className="py-2 px-4 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{growthLoading2 ? 'Saving...' : (editGrowthId ? 'Save Changes' : '+ Save Growth')}</button>
                              {editGrowthId ? (
                                <button type="button" onClick={cancelEditGrowth} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Cancel</button>
                              ) : (
                                <button type="button" onClick={() => { setGChild(''); setGHeight(''); setGWeight(''); setGDate(''); }} className="py-2 px-4 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border-main)' }}>Clear</button>
                              )}
                            </div>
                          </form>
                          <div>
                            {growthLoading ? (
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading growth logs...</p>
                            ) : (filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs).length === 0 ? (
                              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No growth logs yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {(filterChild ? growthLogs.filter((x) => x.child_id === filterChild) : growthLogs).map((g) => (
                                  <div key={g.id} className="rounded-xl p-3 border flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                                    <div>
                                      <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{children.find((c) => c.id === g.child_id)?.name || 'Child'}</p>
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Height: {g.height_cm} cm • Weight: {g.weight_kg} kg</p>
                                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>BMI: {calculateBmi(g.height_cm, g.weight_kg) ?? 'N/A'} (kg/m²)</p>
                                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{g.date ? new Date(g.date).toLocaleDateString() : '—'}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => startEditGrowth(g)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-amber-100 text-amber-700">Edit</button>
                                      <button onClick={() => handleDeleteGrowth(g.id)} className="py-1.5 px-3 rounded-lg text-sm font-semibold bg-rose-100 text-rose-700">Delete</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {settingsTab === 'telegram' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-main)' }}>Telegram Bot</h3>
                        <div className="space-y-4">
                          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <p className="text-sm font-bold mb-1">Create a dedicated TikTrack bot</p>
                            <p className="text-xs opacity-70">Use BotFather in Telegram to create a new bot. Store the bot token as Environment Variables in Vercel, not in this browser UI.</p>
                            <div className="mt-3 rounded-lg bg-black/10 p-3 font-mono text-xs dark:bg-black/30">
                              TELEGRAM_BOT_TOKEN="BOT_TOKEN" TELEGRAM_WEBHOOK_SECRET="LONG_RANDOM_SECRET"
                            </div>
                          </div>

                          <form onSubmit={handleSaveTelegramSettings} className="rounded-xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                            <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Bot username</label>
                            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                              <input
                                value={telegramBotUsername}
                                onChange={(event) => setTelegramBotUsername(event.target.value)}
                                placeholder="tiktrack_parent_bot"
                                className="rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none"
                                style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                              />
                              <button type="submit" disabled={telegramSettingsSaving} className="rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                                {telegramSettingsSaving ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                            {telegramBotUsername ? (
                              <a
                                href={`https://t.me/${telegramBotUsername.replace(/^@/, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex rounded-xl border px-3 py-2 text-sm font-bold"
                                style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                              >
                                Open @{telegramBotUsername.replace(/^@/, '')}
                              </a>
                            ) : null}
                          </form>

                          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-bold mb-1">Link your Telegram account</p>
                                <p className="text-xs opacity-70">Generate a short-lived code, then send it to the bot as /link CODE.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleGenerateTelegramLinkCode()}
                                disabled={telegramLinkGenerating}
                                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                              >
                                {telegramLinkGenerating ? 'Generating...' : 'Generate Code'}
                              </button>
                            </div>
                            {telegramLinkCode ? (
                              <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface)' }}>
                                <p className="text-xs font-bold uppercase tracking-wide opacity-60">Send this to Telegram</p>
                                <div className="mt-2 rounded-lg bg-black/10 p-3 text-center font-mono text-lg font-black tracking-wider dark:bg-black/30">
                                  /link {telegramLinkCode}
                                </div>
                                <p className="mt-2 text-xs opacity-70">Expires at {telegramLinkExpiresAt || 'soon'}.</p>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )}

                    {settingsTab === 'coparenting' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-main)' }}>Co-Parenting</h3>
                        <div className="space-y-4">
                          <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <p className="text-sm font-bold mb-1">Your Family Link Code</p>
                            <p className="text-xs opacity-70 mb-2">Share this code with your co-parent so they can link to your family account.</p>
                            <div className="bg-black/10 dark:bg-black/30 p-2 rounded-lg font-mono text-center select-all">{user?.id}</div>
                          </div>
                          <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!coParentCode.trim() || !user) return;
                            try {
                              await updateDoc(doc(db, 'users', user.id), { linked_family_id: coParentCode.trim() });
                              setSuccess('Successfully linked to family account! Please refresh the page to sync.');
                            } catch (err) {
                              setError('Failed to link family account.');
                            }
                          }} className="p-4 rounded-xl border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-main)' }}>Join a Family Account</p>
                            <p className="text-xs opacity-70 mb-3" style={{ color: 'var(--text-main)' }}>Enter your co-parent's Family Link Code here.</p>
                            <input
                              required
                              value={coParentCode}
                              onChange={(e) => setCoParentCode(e.target.value)}
                              placeholder="Enter Family Code"
                              className="w-full rounded-xl py-3 px-4 border focus:outline-none mb-3"
                              style={{ borderColor: 'var(--border-main)', background: 'var(--surface)', color: 'var(--text-main)' }}
                            />
                            <button type="submit" className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition">
                              Link Account
                            </button>
                          </form>
                        </div>
                      </div>
                    )}

                    {settingsTab === 'backup_restore' && (
                      <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                        <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-main)' }}>Backup & Restore</h3>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <p className="text-sm font-bold mb-1">Download family backup</p>
                            <p className="text-xs opacity-70">Exports the current family data that this parent account can read into a JSON file.</p>
                            <button
                              type="button"
                              onClick={() => void handleDownloadBackup()}
                              disabled={backupWorking || childrenLoading}
                              className="mt-4 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                              style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}
                            >
                              {backupWorking ? 'Creating backup...' : 'Download Backup'}
                            </button>
                          </div>

                          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                            <p className="text-sm font-bold mb-1">Restore from backup</p>
                            <p className="text-xs opacity-70">Restores a TikTrack JSON backup for this same family account. Matching document IDs will be overwritten.</p>
                            <label className="mt-4 inline-flex cursor-pointer rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white">
                              {restoreWorking ? 'Restoring...' : 'Choose Backup File'}
                              <input
                                type="file"
                                accept="application/json,.json"
                                disabled={restoreWorking}
                                onChange={(event) => void handleRestoreBackupFile(event)}
                                className="hidden"
                              />
                            </label>
                            {restoreFileName ? <p className="mt-3 text-xs opacity-70">Last selected: {restoreFileName}</p> : null}
                          </div>
                        </div>
                        <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-100">
                          This is a family-scoped app backup, not a Firebase Admin project export. For production disaster recovery, keep scheduled Firebase backups enabled separately.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'challenges' && (
                  <div className={`${cardBase} bg-[var(--surface)]`} style={{ borderColor: 'var(--border-main)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h2 className="text-lg font-bold inline-flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                        <Activity size={18} /> Challenges
                      </h2>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{filteredActiveChallenges.length + filteredCompletedChallenges.length}</span>
                        <button onClick={() => { setChTitle(''); setChChild(''); setChActivityId(''); setChTarget(''); setChDesc(''); setShowChallengeModal(true); }} className="py-2 px-4 rounded-xl text-sm font-bold text-white shadow-sm hover:shadow-md transition-shadow" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>+ Add Challenge</button>
                      </div>
                    </div>
                    {renderActivityFilter(challengeActivityFilter, setChallengeActivityFilter, activeChallenges.length + completedChallenges.length)}

                    {showChallengeModal && (
                      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4">
                        <div className="bg-[var(--surface)] w-full max-w-xl rounded-2xl shadow-2xl p-4 sm:p-6 border max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto" style={{ borderColor: 'var(--border-main)' }}>
                          <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Create Challenge</h3>
                            <button onClick={() => setShowChallengeModal(false)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
                          </div>
                          <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (!chTitle || !chChild || !chTarget) return;
                            setChallengeLoading(true);
                            try {
                              await createChallenge(chTitle, chChild, Number(chTarget), chDesc, chActivityId);
                              setChTitle(''); setChChild(''); setChActivityId(''); setChTarget(''); setChDesc('');
                              setSuccess('Challenge created!');
                              setShowChallengeModal(false);
                            } catch (err) {
                              setError('Could not create challenge.');
                            } finally {
                              setChallengeLoading(false);
                            }
                          }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <select required value={chChild} onChange={(e) => { setChChild(e.target.value); setChActivityId(''); }} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="">-- Select Child --</option>
                              {children.map((c) => (<option key={c.id} value={c.id}>{c.name || c.email}</option>))}
                            </select>
                            <select value={chActivityId} onChange={(e) => setChActivityId(e.target.value)} className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                              <option value="">-- Activity (Optional) --</option>
                              {chPrograms.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                            </select>
                            <input required value={chTitle} onChange={(e) => setChTitle(e.target.value)} placeholder="Challenge title" className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <input required value={chTarget as any} onChange={(e) => setChTarget(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Target score" type="number" min="1" className="col-span-1 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            <textarea value={chDesc} onChange={(e) => setChDesc(e.target.value)} placeholder="Description (optional)" rows={3} className="col-span-1 sm:col-span-2 rounded-xl py-2 px-3 border" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                            
                            <div className="col-span-1 sm:col-span-2 flex flex-col gap-3 mt-4 sm:flex-row">
                              <button disabled={challengeLoading} type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>{challengeLoading ? 'Creating...' : 'Create Challenge'}</button>
                              <button type="button" onClick={() => setShowChallengeModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-bold border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Cancel</button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                    <div className="space-y-6 mt-4">
                      {filteredActiveChallenges.length > 0 && (
                        <div>
                          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                            Active Challenges <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{filteredActiveChallenges.length}</span>
                          </h3>
                          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                            {filteredActiveChallenges.map((ch) => (
                              <div key={ch.id} className="rounded-xl border p-4 flex flex-col justify-between shadow-sm bg-[var(--surface-soft)]" style={{ borderColor: 'var(--border-main)' }}>
                                <div>
                                  <div className="flex justify-between items-start mb-1">
                                    <p className="font-bold text-base" style={{ color: 'var(--text-main)' }}>{ch.title}</p>
                                    <span className="font-bold text-emerald-600 text-xs bg-emerald-100 px-2 py-0.5 rounded-full">Target: {ch.target_score}</span>
                                  </div>
                                  <p className="text-sm line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>{ch.description || 'No description'}</p>
                                  
                                  <div className="flex items-center gap-4 mt-2">
                                    <div className="flex-1">
                                      <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Parent: <span className="text-violet-600">{ch.parent_score}</span></p>
                                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border-main)' }}>
                                        <div className="h-full" style={{ width: `${Math.min(100, (ch.parent_score / ch.target_score) * 100)}%`, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)' }} />
                                      </div>
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{getChildName(ch.child_id)}: <span className="text-pink-600">{ch.child_score}</span></p>
                                      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border-main)' }}>
                                        <div className="h-full" style={{ width: `${Math.min(100, (ch.child_score / ch.target_score) * 100)}%`, background: 'linear-gradient(90deg, #ec4899, #f472b6)' }} />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-main)' }}>
                                  <button onClick={() => void incrementScore(ch.id, 'parent')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700 hover:bg-violet-200">+1 Parent</button>
                                  <button onClick={() => void incrementScore(ch.id, 'child')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-pink-100 text-pink-700 hover:bg-pink-200">+1 Child</button>
                                  <button onClick={() => void deleteChallenge(ch.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-100 text-rose-700 hover:bg-rose-200 ml-auto">Delete</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {filteredCompletedChallenges.length > 0 && (
                        <div>
                          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                            Completed Challenges <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{filteredCompletedChallenges.length}</span>
                          </h3>
                          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {filteredCompletedChallenges.map((ch) => (
                              <div key={ch.id} className="rounded-xl border p-3 opacity-80 bg-[var(--surface-soft)]" style={{ borderColor: 'var(--border-main)' }}>
                                <p className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>{ch.title}</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Winner: <span className="font-semibold text-amber-600">{ch.winner === 'parent' ? 'Parent' : ch.winner === 'child' ? getChildName(ch.child_id) : 'Draw'}</span> • {ch.parent_score} vs {ch.child_score}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {filteredActiveChallenges.length === 0 && filteredCompletedChallenges.length === 0 && (
                        <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>{challengeActivityFilter === 'all' ? 'No challenges yet. Create one to get started!' : 'No challenges for this activity.'}</p>
                      )}
                    </div>
                  </div>
                )}
              </section>
          </main>
        </div>
      </div>

      {selectedActivity ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-3xl border bg-[var(--surface)] p-4 shadow-2xl sm:max-h-[90vh] sm:p-5" style={{ borderColor: 'var(--border-main)' }}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">Activity</p>
                <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>{selectedActivity.name}</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{children.find((child) => child.id === selectedActivity.childId)?.name || 'Child'}</p>
              </div>
              <div className="flex gap-2">
                {selectedActivity.isActive ? (
                  <button type="button" onClick={() => void handleCompleteActivity(selectedActivity)} className="rounded-lg bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">Complete</button>
                ) : (
                  <button type="button" onClick={() => void handleUnarchiveActivity(selectedActivity)} className="rounded-lg bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">Unarchive</button>
                )}
                <button type="button" onClick={() => { setSelectedActivity(null); setEditingSubId(null); setNewSubName(''); setNewSubTeacher(''); setNewSubInExam(true); }} className="rounded-lg border px-3 py-1 text-sm font-semibold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Close</button>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {(selectedActivity.modules || ['tasks']).map((moduleId) => (
                <button key={moduleId} type="button" onClick={() => setActivityModalTab(moduleId)} className={clsx('rounded-full border px-3 py-1.5 text-xs font-semibold', activityModalTab === moduleId ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-white text-slate-600 border-slate-200')}>
                  {moduleId}
                </button>
              ))}
            </div>

            {activityModalTab === 'tasks' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Mapped Tasks</p>
                  <button 
                    onClick={() => {
                      const title = window.prompt('Enter task title:');
                      if (title && user) {
                        void addDoc(collection(db, 'tasks'), {
                          title,
                          child_id: selectedActivity.childId,
                          family_id: familyId,
                          parent_id: familyId,
                          status: 'pending',
                          linked_program_id: selectedActivity.id,
                          category: 'homework',
                          priority: 'medium',
                          created_at: new Date().toISOString()
                        });
                      }
                    }}
                    className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    + Quick Add
                  </button>
                </div>
                {selectedActivityTasks.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No mapped tasks yet.</p> : null}
                {selectedActivityTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{task.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{activityRecurrenceLabel(task)} • {activityExpiryStatus('task', task)}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => setSelectedActivityDetail({ kind: 'task', item: task })} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Details</button>
                      {task.status !== 'completed' && task.status !== 'expired' && (
                        <button type="button" onClick={() => void handleCompleteMappedTask(task.id)} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200">Complete</button>
                      )}
                      <button type="button" onClick={() => void handleDeleteTask(task.id)} className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200">Delete</button>
                    </div>
                  </div>
                ))}
                <p className="pt-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Map Existing Tasks</p>
                {mappableTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-main)' }}>{task.title}</p>
                    <button type="button" onClick={() => void linkTaskToActivity(task.id)} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white">Map</button>
                  </div>
                ))}
              </div>
            ) : null}

            {activityModalTab === 'exams' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Mapped Exams</p>
                  <button 
                    onClick={() => {
                      const subject = window.prompt('Enter exam subject:');
                      if (subject && user) {
                        void addDoc(collection(db, 'exams'), {
                          subject,
                          child_id: selectedActivity.childId,
                          family_id: familyId,
                          parent_id: familyId,
                          exam_date: new Date().toISOString(),
                          status: 'scheduled',
                          linked_program_id: selectedActivity.id,
                          created_at: new Date().toISOString()
                        });
                      }
                    }}
                    className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    + Quick Add
                  </button>
                </div>
                {selectedActivityExams.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No mapped exams yet.</p> : null}
                {selectedActivityExams.map((exam) => (
                  <div key={exam.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{exam.subject}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {(exam.status || 'scheduled').replaceAll('_', ' ')} • {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString() : 'No date'} • {activityRecurrenceLabel(exam)}
                      </p>
                    </div>
                    <button type="button" onClick={() => setSelectedActivityDetail({ kind: 'exam', item: exam })} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Details</button>
                  </div>
                ))}
                <p className="pt-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Map Existing Exams</p>
                {mappableExams.map((exam) => (
                  <div key={exam.id} className="rounded-xl border p-3 flex items-center justify-between" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-main)' }}>{exam.subject}</p>
                    <button type="button" onClick={() => void linkExamToActivity(exam.id)} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white">Map</button>
                  </div>
                ))}
              </div>
            ) : null}

            {activityModalTab === 'events' ? (
              <div className="space-y-3">
                {selectedActivityEvents.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No mapped events yet.</p> : null}
                {selectedActivityEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-main)' }}>{ev.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{activityRecurrenceLabel(ev)} • {ev.date ? new Date(ev.date).toLocaleString() : 'No date'}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedActivityDetail({ kind: 'event', item: ev })} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Details</button>
                  </div>
                ))}
              </div>
            ) : null}

            {activityModalTab === 'timetable' ? (
              <div className="space-y-2">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Timetable preview for selected child.</p>
                {selectedChildTimetable ? (
                  <div className="rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}>
                    {selectedChildTimetable.periods.length} periods across {selectedChildTimetable.days.length} days.
                  </div>
                ) : null}
              </div>
            ) : null}

            {activityModalTab === 'challenges' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>Activity Challenges</p>
                  <button 
                    onClick={() => {
                      const title = window.prompt('Enter challenge title:');
                      const target = window.prompt('Enter target score:', '5');
                      if (title && target && user) {
                        void createActivityChallenge(title, familyId, Number(target));
                      }
                    }}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                  >
                    + New Challenge
                  </button>
                </div>
                {activityChallenges.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No challenges for this activity yet.</p> : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activityChallenges.map((ch) => (
                    <div key={ch.id} className="rounded-2xl border p-4 shadow-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                      <p className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>{ch.title}</p>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="text-center flex-1">
                          <p className="text-[10px] font-bold text-rose-500 uppercase">You</p>
                          <p className="text-xl font-black" style={{ color: 'var(--text-main)' }}>{ch.parent_score}</p>
                          <button 
                            onClick={() => void incrementActivityChallengeScore(ch.id, 'parent')}
                            disabled={ch.status === 'completed'}
                            className="mt-1 w-full rounded bg-rose-500 text-white py-1 text-[10px] font-bold disabled:opacity-30"
                          >
                            +1 Score
                          </button>
                        </div>
                        <div className="text-center flex-1">
                          <p className="text-[10px] font-bold text-cyan-500 uppercase">Child</p>
                          <p className="text-xl font-black" style={{ color: 'var(--text-main)' }}>{ch.child_score}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-center">
                        <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Target: {ch.target_score}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activityModalTab === 'subjects' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-indigo-400">{editingSubId ? 'Edit Subject' : 'Add New Subject'}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <input 
                      value={newSubName} 
                      onChange={(e) => setNewSubName(e.target.value)} 
                      placeholder="Subject Name" 
                      className="rounded-xl border px-3 py-2 text-sm outline-none" 
                      style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                    />
                    <input 
                      value={newSubTeacher} 
                      onChange={(e) => setNewSubTeacher(e.target.value)} 
                      placeholder="Teacher Name" 
                      className="rounded-xl border px-3 py-2 text-sm outline-none" 
                      style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newSubInExam} 
                        onChange={(e) => setNewSubInExam(e.target.checked)} 
                        className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500" 
                      />
                      <span className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Include in Exams</span>
                    </label>
                    <div className="flex gap-2">
                      {editingSubId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubId(null);
                            setNewSubName('');
                            setNewSubTeacher('');
                            setNewSubInExam(true);
                          }}
                          className="rounded-lg border px-4 py-2 text-xs font-bold"
                          style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                        >
                          Cancel
                        </button>
                      ) : null}
                      <button 
                        onClick={async () => {
                          if (!newSubName.trim()) return;
                          if (editingSubId) {
                            await updateActivitySubject(editingSubId, {
                              name: newSubName.trim(),
                              teacherName: newSubTeacher,
                              includeInExams: newSubInExam
                            });
                            setEditingSubId(null);
                          } else {
                            await addActivitySubject(newSubName, familyId, newSubTeacher, newSubInExam);
                          }
                          setNewSubName('');
                          setNewSubTeacher('');
                          setNewSubInExam(true);
                        }} 
                        className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-sm"
                      >
                        {editingSubId ? 'Save Subject' : '+ Add Subject'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activitySubjects.map((sub) => {
                    const subjectTasks = tasks.filter(t => t.linked_program_id === selectedActivity.id && subjectMatchesStoredValue(sub, t.subject_id));
                    const subjectExams = exams.filter(e => (
                      e.linked_program_id === selectedActivity.id &&
                      (
                        subjectMatchesStoredValue(sub, e.subject_id) ||
                        (typeof e.subject_id === 'string' && e.subject_id.split(',').some((subjectId: string) => subjectMatchesStoredValue(sub, subjectId.trim()))) ||
                        e.subject === sub.name ||
                        (typeof e.subject === 'string' && e.subject.split(',').some((subjectName: string) => subjectName.trim() === sub.name))
                      )
                    ));

                    return (
                    <div key={sub.id} className="group relative rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all hover:bg-white hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-800">{sub.name}</p>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{sub.teacherName || 'No Teacher'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {sub.includeInExams && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 uppercase">Exam</span>
                          )}
                          <button 
                            onClick={() => {
                              setEditingSubId(sub.id);
                              setNewSubName(sub.name);
                              setNewSubTeacher(sub.teacherName || '');
                              setNewSubInExam(Boolean(sub.includeInExams));
                            }} 
                            className="rounded-lg bg-indigo-100 px-2 py-1 text-[10px] font-bold text-indigo-700 transition-colors hover:bg-indigo-200"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => void removeActivitySubject(sub.id)} 
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Tasks ({subjectTasks.length})</p>
                          {subjectTasks.length > 0 ? (
                            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                              {subjectTasks.map(t => (
                                <div key={t.id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                  <span className="font-semibold text-slate-700 truncate mr-2" title={t.title}>{t.title}</span>
                                  <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", t.status === 'completed' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>{t.status}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">No tasks assigned.</p>
                          )}
                        </div>

                        {sub.includeInExams && (
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Exams ({subjectExams.length})</p>
                            {subjectExams.length > 0 ? (
                              <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                {subjectExams.map(ex => (
                                  <div key={ex.id} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                    <span className="font-semibold text-slate-700 truncate mr-2" title={(ex.exam_type || 'exam').replace('_', ' ')}>{(ex.exam_type || 'exam').replace('_', ' ')}</span>
                                    {ex.marks_scored !== undefined && ex.marks_scored !== null ? (
                                      <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">{ex.marks_scored}/{ex.total_marks}</span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold shrink-0">Upcoming</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-400 italic">No exams recorded.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                  {activitySubjects.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-400 text-sm italic font-medium">No subjects defined for this activity yet.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedActivityDetail ? (() => {
        const { kind, item } = selectedActivityDetail;
        const itemDate = activityItemDate(kind, item);
        const next = activityNextDate(kind, item);
        const status = activityExpiryStatus(kind, item);
        return (
          <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/65 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4">
            <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl border bg-[var(--surface)] p-4 shadow-2xl sm:max-h-[90vh] sm:p-5" style={{ borderColor: 'var(--border-main)' }}>
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">{kind} details</p>
                  <h3 className="mt-1 text-xl font-bold" style={{ color: 'var(--text-main)' }}>{activityItemTitle(kind, item)}</h3>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {kind === 'task' ? (
                    <>
                      {item.status !== 'completed' && item.status !== 'expired' && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleCompleteMappedTask(item.id);
                            setSelectedActivityDetail(null);
                          }}
                          className="rounded-lg bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 hover:bg-emerald-200"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteTask(item.id);
                          setSelectedActivityDetail(null);
                        }}
                        className="rounded-lg bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-200"
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => setSelectedActivityDetail(null)} className="rounded-lg border px-3 py-1 text-sm font-semibold" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}>Close</button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Scheduled</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{itemDate ? new Date(itemDate).toLocaleString() : 'No date'}</p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Repeat</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{activityRecurrenceLabel(item)}</p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Next</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-main)' }}>{next ? next.toLocaleString() : 'No upcoming occurrence'}</p>
                </div>
                <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Expiry</p>
                  <p className={clsx('mt-1 text-sm font-semibold', status === 'Expired' ? 'text-rose-500' : 'text-emerald-500')}>{status}</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-muted)' }}>
                {kind === 'task' ? (
                  <p>Status: {(item.status || 'pending').replaceAll('_', ' ')} • Stars: {item.star_value ?? item.points ?? 0} • Proof: {item.requires_proof ? 'Required' : 'Not required'}</p>
                ) : kind === 'exam' ? (
                  <p>Status: {(item.status || 'scheduled').replaceAll('_', ' ')} • Score: {item.marks_scored ?? '-'} / {item.total_marks ?? '-'}{item.syllabus_scope ? ` • ${item.syllabus_scope}` : ''}</p>
                ) : (
                  <p>Type: {item.type || item.category || 'event'} • Reminder: {item.reminder_days_before ?? 0} day(s) before</p>
                )}
              </div>
            </div>
          </div>
        );
      })() : null}

      {isActivityModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] z-50 sm:items-center sm:p-4">
          <div className="rounded-3xl w-full max-w-2xl p-4 sm:p-7 shadow-2xl relative border bg-[var(--surface)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-h-[90vh]" style={{ borderColor: 'var(--border-main)' }}>
            <button onClick={() => { clearActivityForm(); setIsActivityModalOpen(false); }} className="absolute top-4 right-4" style={{ color: 'var(--text-muted)' }}><X size={24} /></button>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2">Activities Hub</p>
            <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-main)' }}>{editingActivityId ? 'Edit Activity' : 'Create New Activity'}</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Configure the branches that will appear for this activity.</p>
            
            <form onSubmit={handleSaveActivity} className="space-y-4">
              <div className="kid-glass rounded-2xl p-3">
                <label className="text-sm font-bold ml-1 mb-2 block" style={{ color: 'var(--text-muted)' }}>Activity Name</label>
                <input required value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="e.g. School, Soccer, Piano" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1 mb-2 block" style={{ color: 'var(--text-muted)' }}>Start Date</label>
                  <input type="date" value={activityStartDate} onChange={(e) => setActivityStartDate(e.target.value)} className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1 mb-2 block" style={{ color: 'var(--text-muted)' }}>End Date (Expiry)</label>
                  <input type="date" value={activityEndDate} onChange={(e) => setActivityEndDate(e.target.value)} className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <div className="kid-glass rounded-2xl p-3">
                <label className="text-sm font-bold ml-1 mb-2 block" style={{ color: 'var(--text-muted)' }}>Enabled Branches</label>
                <div className="flex flex-wrap items-center gap-2">
                  {(['tasks', 'exams', 'timetable', 'challenges', 'events', 'subjects'] as PlannerActivityModule[]).map((moduleId) => (
                    <button key={moduleId} type="button" onClick={() => toggleActivityModule(moduleId)} className={clsx('rounded-full px-4 py-2 text-sm font-semibold border transition capitalize', activityModules.includes(moduleId) ? 'bg-cyan-100 text-cyan-800 border-cyan-300' : 'bg-white text-slate-600 border-slate-200')}>
                      {moduleId}
                    </button>
                  ))}
                </div>
              </div>
              {/* Stars Config — only shown for star-bearing modules */}
              {(['tasks', 'exams', 'challenges', 'events'] as PlannerActivityModule[]).some(m => activityModules.includes(m)) && (
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1 mb-3 block" style={{ color: 'var(--text-muted)' }}>⭐ Stars Config</label>
                  <p className="text-xs ml-1 mb-3" style={{ color: 'var(--text-muted)' }}>Set the default stars a child earns for each module. Leave blank for no stars.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {activityModules.includes('tasks') && (
                      <div>
                        <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Per Task</label>
                        <input type="number" min="0" value={activityTaskPoints as any} onChange={(e) => setActivityTaskPoints(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 5" className="w-full rounded-xl py-2 px-3 border focus:outline-none text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      </div>
                    )}
                    {activityModules.includes('exams') && (
                      <div>
                        <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Max Exam Stars</label>
                        <input type="number" min="0" value={activityExamPoints as any} onChange={(e) => setActivityExamPoints(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 10" className="w-full rounded-xl py-2 px-3 border focus:outline-none text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      </div>
                    )}
                    {activityModules.includes('challenges') && (
                      <div>
                        <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Per Challenge</label>
                        <input type="number" min="0" value={activityChallengePoints as any} onChange={(e) => setActivityChallengePoints(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 15" className="w-full rounded-xl py-2 px-3 border focus:outline-none text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      </div>
                    )}
                    {activityModules.includes('events') && (
                      <div>
                        <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--text-muted)' }}>Per Event</label>
                        <input type="number" min="0" value={activityEventPoints as any} onChange={(e) => setActivityEventPoints(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 3" className="w-full rounded-xl py-2 px-3 border focus:outline-none text-sm" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button type="submit" className="flex-1 text-white font-bold py-3.5 rounded-xl transition shadow-md hover:shadow-lg" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                  {editingActivityId ? 'Save Changes' : 'Create Activity'}
                </button>
                <button type="button" onClick={() => { clearActivityForm(); setIsActivityModalOpen(false); }} className="px-6 rounded-xl text-sm font-bold border hover:bg-slate-50 transition" style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)', background: 'var(--surface)' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModaling && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] z-50 sm:items-center sm:p-4">
          <div className="rounded-3xl w-full max-w-2xl p-4 sm:p-7 shadow-2xl relative border bg-[var(--surface)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-h-[90vh]" style={{ borderColor: 'var(--border-main)' }}>
            <button onClick={() => setIsModaling(false)} className="absolute top-4 right-4" style={{ color: 'var(--text-muted)' }}><X size={24} /></button>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2">Family Hub</p>
            <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-main)' }}>Create Child Adventure Account</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Simple username login for your child, managed by you.</p>

            {error && <div className="bg-red-100 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>}

            <form onSubmit={handleCreateChild} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Child's Name</label>
                  <input required value={cName} onChange={(e) => setCName(e.target.value)} type="text" placeholder="e.g. Athmika" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Unique Username</label>
                  <input required value={cUser} onChange={(e) => setCUser(e.target.value.replace(/\s+/g, ''))} type="text" placeholder="e.g. athmikastar" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <div className="kid-glass rounded-2xl p-3">
                <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Secret Password</label>
                <input required value={cPass} onChange={(e) => setCPass(e.target.value)} type="password" placeholder="Min 6 characters" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4">
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                  <input required value={cDob} onChange={(e) => setCDob(e.target.value)} type="date" className="mt-1 w-full min-w-0 rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Height (cm)</label>
                  <input required min="30" max="250" value={cHeight} onChange={(e) => setCHeight(e.target.value)} type="number" placeholder="120" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
                <div className="kid-glass rounded-2xl p-3">
                  <label className="text-sm font-bold ml-1" style={{ color: 'var(--text-muted)' }}>Weight (kg)</label>
                  <input required min="5" max="200" step="0.1" value={cWeight} onChange={(e) => setCWeight(e.target.value)} type="number" placeholder="22.5" className="mt-1 w-full rounded-xl py-3 px-4 border focus:outline-none" style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }} />
                </div>
              </div>
              <button disabled={childRegistering} type="submit" className="w-full text-white font-bold py-3.5 rounded-xl transition mt-4 disabled:opacity-70" style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}>
                {childRegistering ? 'Registering...' : 'Create Child Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isNudgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-3xl border bg-[var(--surface)] p-5 shadow-2xl sm:p-6" style={{ borderColor: 'var(--border-main)' }}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-cyan-500">Quick Nudge</p>
                <h2 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>Send encouragement</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                  Send a small message directly into the family chat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNudgeModalOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition hover:bg-slate-100 dark:hover:bg-white/10"
                style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                aria-label="Close nudge"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSendNudge} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Child
                </label>
                <select
                  required
                  value={nudgeChildId}
                  onChange={(event) => setNudgeChildId(event.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none"
                  style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                >
                  <option value="">Select child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name || child.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Pick a message
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {NUDGE_TEMPLATES.map((template) => (
                    <button
                      key={template}
                      type="button"
                      onClick={() => setNudgeMessage(template)}
                      className={clsx(
                        'min-h-16 rounded-2xl border p-3 text-left text-sm font-semibold transition',
                        nudgeMessage === template
                          ? 'border-cyan-300 bg-cyan-500/15 text-cyan-300 shadow-sm'
                          : 'hover:bg-slate-100 dark:hover:bg-white/10'
                      )}
                      style={nudgeMessage === template ? {} : { borderColor: 'var(--border-main)', color: 'var(--text-main)', background: 'var(--surface-soft)' }}
                    >
                      {template}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Message
                </label>
                <textarea
                  required
                  value={nudgeMessage}
                  onChange={(event) => setNudgeMessage(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border px-4 py-3 text-sm font-semibold outline-none"
                  style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                  placeholder="Write your own quick encouragement..."
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsNudgeModalOpen(false)}
                  className="rounded-xl border px-5 py-3 text-sm font-bold transition hover:bg-slate-100 dark:hover:bg-white/10"
                  style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:shadow-xl"
                  style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}
                >
                  Send Nudge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSickModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/60 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="bg-[var(--surface)] w-full max-w-md rounded-2xl shadow-2xl p-4 sm:p-6 border max-h-[calc(100dvh-1.5rem)] overflow-y-auto sm:max-h-[90vh]" style={{ borderColor: 'var(--border-main)' }}>
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-main)' }}>Mark Child Sick 🤒</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Start Date</label>
                <input
                  type="date"
                  value={sickStartDate}
                  onChange={(e) => setSickStartDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>End Date</label>
                <input
                  type="date"
                  value={sickEndDate}
                  onChange={(e) => setSickEndDate(e.target.value)}
                  className="w-full rounded-xl border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>Reason (Optional)</label>
                <input
                  type="text"
                  value={sickReason}
                  onChange={(e) => setSickReason(e.target.value)}
                  placeholder="e.g. Fever, Cold"
                  className="w-full rounded-xl border px-4 py-2 text-sm"
                  style={{ borderColor: 'var(--border-main)', background: 'var(--surface-soft)', color: 'var(--text-main)' }}
                />
              </div>
              <div className="flex flex-col gap-3 mt-6 sm:flex-row">
                <button
                  onClick={async () => {
                    try {
                      await initiateSickPeriod(sickTargetChild, 'parent', user?.id || '', sickStartDate, sickEndDate, sickReason);
                      setSuccess('Child marked sick successfully.');
                      setIsSickModalOpen(false);
                    } catch (error) {
                      setError('Failed to mark child sick.');
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--bg-hero-a), var(--bg-hero-b))' }}
                >
                  Confirm Sick Leave
                </button>
                <button
                  onClick={() => setIsSickModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  style={{ borderColor: 'var(--border-main)', color: 'var(--text-main)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function ParentDashboard() {
  const { user } = useAuth();

  if (!user) {
    return <ParentDashboardContent />;
  }

  return (
    <RealTimeProvider userId={user.id} userRole="parent_admin">
      <RealTimeNotifications />
      <ParentDashboardContent />
    </RealTimeProvider>
  );
}
