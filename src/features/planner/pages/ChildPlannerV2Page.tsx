import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../config/firebase';
import { createChildQuickPlannerEvent } from '../services/planner.firestore';
import { PLANNER_FEATURE_FLAGS } from '../constants/planner.constants';
import type { PlannerEvent } from '../types/planner.types';
import type { ExamResult } from '../../../types/schema';
import { plannerQuickAddSchema } from '../utils/planner.validation';
import { usePlannerLightInsights } from '../hooks/usePlannerLightInsights';
import { usePlannerMutationQueue } from '../hooks/usePlannerMutationQueue';
import { usePlannerToast, PlannerToastProvider } from '../hooks/usePlannerToast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { ChildExamCountdown } from '../components/child/ChildExamCountdown';
import { ChildPlannerHero } from '../components/child/ChildPlannerHero';
import { ChildQuickAdd } from '../components/child/ChildQuickAdd';
import { ChildQuestTimeline } from '../components/child/ChildQuestTimeline';
import { ChildTodayAgenda } from '../components/child/ChildTodayAgenda';
import { ChildUpcomingRail } from '../components/child/ChildUpcomingRail';
import { PlannerConflictBanner } from '../components/shared/PlannerConflictBanner';
import { PlannerEventModal } from '../components/shared/PlannerEventModal';
import { PlannerShell } from '../components/shared/PlannerShell';
import { PlannerOfflineBanner } from '../components/shared/PlannerOfflineBanner';
import { PlannerToastViewport } from '../components/shared/PlannerToastViewport';
import { usePlannerEvents } from '../hooks/usePlannerEvents';
import { usePlannerInsights } from '../hooks/usePlannerInsights';
import { deriveSubjectTrends } from '../../../utils/childProgression';

function buildQuickEvent(childId: string, title = 'Quick Reminder'): PlannerEvent {
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60000);
  return {
    id: `quick_${Date.now()}`,
    familyId: 'fam_mock_1',
    childId,
    parentId: 'parent_mock_1',
    title,
    description: 'Child quick reminder',
    category: 'personal',
    color: '#38bdf8',
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    allDay: false,
    timezone: 'Asia/Kolkata',
    recurrence: { type: 'none', interval: 1 },
    linkedProgramId: null,
    linkedTaskIds: [],
    participantIds: [],
    reminderIds: [],
    source: 'manual',
    sync: { googleEnabled: false, syncStatus: 'not_configured' },
    createdBy: 'child',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
}

function ChildPlannerInner() {
  const { user } = useAuth();
  const { pushToast } = usePlannerToast();
  const { isOnline } = useNetworkStatus();
  const { queue, enqueue, retryOne, hasQueued } = usePlannerMutationQueue();
  const childId = user?.id || 'child_mock_1';
  const familyId = user?.linked_family_id || user?.id || 'fam_mock_1';

  const [localQuickEvents, setLocalQuickEvents] = useState<PlannerEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<PlannerEvent | null>(null);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [examLoading, setExamLoading] = useState(true);
  const { events: fetchedEvents, loading, refresh } = usePlannerEvents(childId, undefined, true);

  const events = useMemo(() => [...localQuickEvents, ...fetchedEvents], [fetchedEvents, localQuickEvents]);
  const insights = usePlannerInsights(events);
  const lightInsights = usePlannerLightInsights(events);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayAgenda = useMemo(() => insights.agenda.filter((item) => item.startAt.slice(0, 10) === todayKey), [insights.agenda, todayKey]);
  const upcoming = useMemo(() => insights.agenda.filter((item) => item.startAt.slice(0, 10) > todayKey).slice(0, 6), [insights.agenda, todayKey]);
  const nextExam = useMemo(() => insights.agenda.find((item) => item.category === 'exam' && item.startAt.slice(0, 10) >= todayKey), [insights.agenda, todayKey]);

  useEffect(() => {
    if (!isOnline) pushToast({ type: 'offline', message: 'Offline mode active in planner.' });
  }, [isOnline, pushToast]);

  useEffect(() => {
    const loadExams = async () => {
      setExamLoading(true);
      try {
        const snap = await getDocs(query(collection(db, 'exams'), where('child_id', '==', childId)));
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExamResult, 'id'>) }));
        setExamResults(rows);
      } finally {
        setExamLoading(false);
      }
    };

    if (childId) {
      void loadExams();
    }
  }, [childId]);

  async function runQuickAddMutation(title: string, next: PlannerEvent) {
    await createChildQuickPlannerEvent(childId, familyId, {
      title,
      startAt: next.startAt,
      endAt: next.endAt
    });
    await refresh();
  }

  async function handleQuickAdd() {
    const next = buildQuickEvent(childId);
    const parsed = plannerQuickAddSchema.safeParse({ title: next.title, startAt: next.startAt, endAt: next.endAt });

    if (!parsed.success) {
      pushToast({ type: 'error', message: parsed.error.issues[0]?.message || 'Invalid quick reminder' });
      return;
    }

    setLocalQuickEvents((prev) => [next, ...prev]);
    setSelectedEvent(next);

    try {
      await runQuickAddMutation(parsed.data.title, next);
      setLocalQuickEvents((prev) => prev.filter((event) => event.id !== next.id));
      pushToast({ type: 'success', message: 'Quick reminder added' });
    } catch {
      setLocalQuickEvents((prev) => prev.filter((event) => event.id !== next.id));
      const id = enqueue('Quick reminder retry', () => runQuickAddMutation(parsed.data.title, next));
      pushToast({ type: 'retry', message: 'Failed to save quick reminder', actionLabel: 'Retry', onAction: () => void retryOne(id) });
    }
  }

  const motivational = todayAgenda.length === 0 ? 'Fresh day to plan one win.' : todayAgenda.length <= 2 ? 'Great balance today. Keep your rhythm.' : 'Busy day ahead. Focus one step at a time.';

  const subjectTrends = useMemo(() => deriveSubjectTrends(examResults), [examResults]);
  const weakSubjects = useMemo(() => subjectTrends.filter((item) => item.weak), [subjectTrends]);
  const improvingSubjects = useMemo(() => subjectTrends.filter((item) => item.improving), [subjectTrends]);
  const examMode = Boolean(nextExam);

  return (
    <div className="mx-auto mt-6 max-w-7xl space-y-5 pb-24">
      <PlannerToastViewport />
      <PlannerOfflineBanner isOnline={isOnline} hasQueuedMutations={hasQueued} onRetryQueued={() => { for (const item of queue) void retryOne(item.id); }} />

      <ChildPlannerHero childName={user?.email?.split('@')[0] || 'Explorer'} subtitle="Agenda-first mode with upcoming classes, exam focus, and quick personal reminders." />

      <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-4 text-white shadow-[0_18px_45px_rgba(0,0,0,0.16)] transition-all duration-200">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">Today Snapshot</p>
        <p className="mt-2 text-sm text-white/80">{motivational}</p>
        <p className="mt-2 text-sm text-white/70">{todayAgenda.length} agenda item(s), {insights.conflicts.length} overlap(s), burnout score {insights.burnout.weeklyScore}.</p>
        <p className="mt-2 text-xs text-white/50">Feature flags: recurrence={String(PLANNER_FEATURE_FLAGS.advancedRecurrence)} sync={String(PLANNER_FEATURE_FLAGS.googleSync)}</p>
      </div>

      <PlannerConflictBanner conflictCount={insights.conflicts.length} />
      <div className="grid gap-2 sm:grid-cols-2">
        {lightInsights.overloadedDay ? <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Overloaded day: {lightInsights.overloadedDay}</p> : null}
        {lightInsights.freeDay ? <p className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Free day suggestion: {lightInsights.freeDay}</p> : null}
        {lightInsights.examProximityWarning ? <p className="rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">Exam week mode is active. Keep sessions short and steady.</p> : null}
        {lightInsights.consecutiveBusyWarning ? <p className="rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100">Busy streak: {lightInsights.maxBusyRun} days.</p> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-200">Exam Tracker</p>
          {examLoading ? <p className="mt-2 text-sm text-white/70">Loading exam updates...</p> : null}
          {!examLoading && !nextExam ? <p className="mt-2 text-sm text-white/70">No upcoming exams. Keep your steady study rhythm.</p> : null}
          {nextExam ? <p className="mt-2 text-sm text-white/90">Next exam: {nextExam.title} on {new Date(nextExam.startAt).toLocaleDateString()}</p> : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-200">Subject Trends</p>
          {!examLoading && subjectTrends.length === 0 ? <p className="mt-2 text-sm text-white/70">No marks yet. Ask parent to add recent exam scores.</p> : null}
          <div className="mt-2 space-y-1">
            {subjectTrends.slice(0, 3).map((subject) => (
              <p key={subject.subject} className="text-sm text-white/85">{subject.subject}: {subject.avg}% {subject.improving ? '↑' : ''}</p>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-200">Planner Priority</p>
          <p className="mt-2 text-sm text-white/85">{examMode ? 'Exam mode on: focus tasks first, keep rest balanced.' : 'Normal mode: balanced study, quests, and breaks.'}</p>
          {weakSubjects.length > 0 ? <p className="mt-1 text-xs text-amber-200">Focus support: {weakSubjects.map((x) => x.subject).join(', ')}</p> : null}
          {improvingSubjects.length > 0 ? <p className="mt-1 text-xs text-emerald-200">Improving: {improvingSubjects.map((x) => x.subject).join(', ')}</p> : null}
        </div>
      </div>

      <PlannerShell
        left={
          <div className="space-y-4">
            <ChildExamCountdown nextExam={nextExam} />
            <ChildQuestTimeline completedCount={5} pendingCount={3} />
          </div>
        }
        main={
          <div className="space-y-3">
            {loading ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">Loading agenda...</p> : null}
            {!loading && todayAgenda.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">No agenda yet. Tap quick add to create your first reminder.</p> : null}
            <div className="animate-[fadeIn_.2s_ease-out]">
              <ChildTodayAgenda items={todayAgenda} />
            </div>
          </div>
        }
        right={
          <div className="space-y-3">
            {loading ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">Loading upcoming events...</p> : null}
            {!loading && upcoming.length === 0 ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">No upcoming classes yet. You can add one when ready.</p> : null}
            <ChildUpcomingRail items={upcoming} />
          </div>
        }
      />

      <ChildQuickAdd onClick={() => void handleQuickAdd()} />

      <PlannerEventModal event={selectedEvent} open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}

export default function ChildPlannerV2Page() {
  return (
    <PlannerToastProvider>
      <ChildPlannerInner />
    </PlannerToastProvider>
  );
}
