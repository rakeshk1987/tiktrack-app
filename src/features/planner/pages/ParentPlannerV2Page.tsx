import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import { PLANNER_EVENT_CATEGORIES } from '../constants/planner.constants';
import type { PlannerEvent } from '../types/planner.types';
import { createParentPlannerEvent, updateParentPlannerEvent } from '../services/planner.firestore';
import { usePlannerEvents } from '../hooks/usePlannerEvents';
import { usePlannerInsights } from '../hooks/usePlannerInsights';
import { usePlannerPrograms } from '../hooks/usePlannerPrograms';
import { usePlannerLightInsights } from '../hooks/usePlannerLightInsights';
import { usePlannerMutationQueue } from '../hooks/usePlannerMutationQueue';
import { usePlannerToast, PlannerToastProvider } from '../hooks/usePlannerToast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { type PlannerEventInput } from '../utils/planner.validation';
import { expandRecurringEventForRange } from '../utils/planner.recurrence';
import { PlannerConflictBanner } from '../components/shared/PlannerConflictBanner';
import { PlannerFilterBar } from '../components/shared/PlannerFilterBar';
import { PlannerLegend } from '../components/shared/PlannerLegend';
import { PlannerShell } from '../components/shared/PlannerShell';
import { PlannerToastViewport } from '../components/shared/PlannerToastViewport';
import { PlannerOfflineBanner } from '../components/shared/PlannerOfflineBanner';
import { ParentBurnoutPanel } from '../components/parent/ParentBurnoutPanel';
import { ParentConflictPanel } from '../components/parent/ParentConflictPanel';
import { ParentEventEditorModal } from '../components/parent/ParentEventEditorModal';
import { ParentExamTracker } from '../components/parent/ParentExamTracker';
import { ParentPlannerCalendarPanel } from '../components/parent/ParentPlannerCalendarPanel';
import { ParentPlannerSidebar } from '../components/parent/ParentPlannerSidebar';
import { ParentSyncStatus } from '../components/parent/ParentSyncStatus';
import { ParentWeeklyOverview } from '../components/parent/ParentWeeklyOverview';

type ParentStatusPeriod = 'month';

const ACTIVITY_PALETTE = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#f59e0b',
  '#fb7185',
  '#22d3ee',
  '#f472b6',
  '#84cc16'
];

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0, 0);
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function expandPlannerEventsAsPlannerEvents(events: PlannerEvent[], rangeStart: Date, rangeEnd: Date): PlannerEvent[] {
  return events.flatMap((event) =>
    expandRecurringEventForRange(event, rangeStart.toISOString(), rangeEnd.toISOString()).map((instance) => ({
      ...event,
      id: instance.instanceId,
      startAt: instance.startAt,
      endAt: instance.endAt,
      recurrence: { type: 'none', interval: 1, byWeekDays: [] }
    }))
  );
}

function ParentPlannerInner({ childId, familyId }: { childId: string; familyId: string }) {
  const { pushToast } = usePlannerToast();
  const { isOnline } = useNetworkStatus();
  const { queue, enqueue, retryOne, hasQueued } = usePlannerMutationQueue();

  const [activeCategories, setActiveCategories] = useState<PlannerEvent['category'][]>([...PLANNER_EVENT_CATEGORIES]);
  const [calendarNote, setCalendarNote] = useState('Tap events or drag to simulate rescheduling.');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);
  const [optimisticEvents, setOptimisticEvents] = useState<PlannerEvent[]>([]);
  const [insightFocus, setInsightFocus] = useState<'none' | 'workload' | 'conflicts' | 'burnout' | 'exams' | 'sync'>('none');
  const [statusPeriod] = useState<ParentStatusPeriod>('month');
  const [periodAnchor, setPeriodAnchor] = useState(() => startOfMonth(new Date()));
  const [activeActivityFilter, setActiveActivityFilter] = useState('all');

  useUnsavedChangesGuard(false, 'You have unsaved timetable changes. Leave anyway?');

  const { events: fetchedEvents, loading: eventsLoading, refresh: refreshEvents } = usePlannerEvents(childId, undefined, false);
  const { programs, loading: programsLoading } = usePlannerPrograms(childId);
  const activityColorById = useMemo(() => {
    const colorMap = new Map<string, string>();
    programs.forEach((program, index) => {
      colorMap.set(program.id, ACTIVITY_PALETTE[index % ACTIVITY_PALETTE.length]);
    });
    return colorMap;
  }, [programs]);

  const mergedEvents = useMemo(() => {
    const byId = new Map<string, PlannerEvent>();
    for (const event of fetchedEvents) byId.set(event.id, event);
    for (const event of optimisticEvents) byId.set(event.id, event);
    return Array.from(byId.values());
  }, [fetchedEvents, optimisticEvents]);

  const filteredEvents = useMemo(() => {
    return mergedEvents.filter((event) => {
      const categoryVisible = activeCategories.includes(event.category);
      const activityVisible = activeActivityFilter === 'all' || event.linkedProgramId === activeActivityFilter;
      return categoryVisible && activityVisible;
    });
  }, [mergedEvents, activeCategories, activeActivityFilter]);

  const periodRange = useMemo(() => {
    if (statusPeriod === 'month') {
      return {
        start: startOfMonth(periodAnchor),
        end: endOfMonth(periodAnchor),
        label: formatMonthYear(periodAnchor),
        initialDate: toDateKey(startOfMonth(periodAnchor))
      };
    }

    return {
      start: startOfMonth(periodAnchor),
      end: endOfMonth(periodAnchor),
      label: formatMonthYear(periodAnchor),
      initialDate: toDateKey(startOfMonth(periodAnchor))
    };
  }, [periodAnchor, statusPeriod]);

  const monthlyEvents = useMemo(() => {
    return expandPlannerEventsAsPlannerEvents(filteredEvents, periodRange.start, periodRange.end);
  }, [filteredEvents, periodRange.end, periodRange.start]);
  const insights = usePlannerInsights(monthlyEvents);
  const lightInsights = usePlannerLightInsights(monthlyEvents);

  const focusedEvents = useMemo(() => {
    if (insightFocus === 'none' || insightFocus === 'workload' || insightFocus === 'sync') return monthlyEvents;
    if (insightFocus === 'exams') return monthlyEvents.filter((event) => event.category === 'exam');
    if (insightFocus === 'burnout') {
      const heavy = new Set(['school', 'exam', 'tuition', 'homework']);
      return monthlyEvents.filter((event) => heavy.has(event.category));
    }
    if (insightFocus === 'conflicts') {
      const ids = new Set<string>();
      for (const conflict of insights.conflicts) {
        ids.add(conflict.eventAId);
        ids.add(conflict.eventBId);
      }
      return monthlyEvents.filter((event) => ids.has(event.id));
    }
    return monthlyEvents;
  }, [monthlyEvents, insightFocus, insights.conflicts]);

  const calendarEvents = useMemo<EventInput[]>(() => {
    const expanded: EventInput[] = [];
    for (const event of focusedEvents) {
      expanded.push({
        id: event.id,
        title: event.title,
        start: event.startAt,
        end: event.endAt,
        color: event.color,
        extendedProps: {
          category: event.category,
          rootEventId: event.id.split('::')[0]
        }
      });
    }
    return expanded;
  }, [focusedEvents]);

  const monthlyExamEvents = useMemo(() => monthlyEvents.filter((event) => event.category === 'exam'), [monthlyEvents]);
  const upcomingExamCount = monthlyExamEvents.filter((event) => new Date(event.startAt).getTime() >= Date.now()).length;
  const scheduledExamCount = monthlyExamEvents.filter((event) => event.marksScored == null || event.totalMarks == null || event.totalMarks <= 0).length;
  const gradedExamEvents = monthlyExamEvents.filter((event) => event.marksScored != null && event.totalMarks != null && event.totalMarks > 0);
  const marksScoredTotal = gradedExamEvents.reduce((total, event) => total + (event.marksScored || 0), 0);
  const maxMarksTotal = gradedExamEvents.reduce((total, event) => total + (event.totalMarks || 0), 0);
  const averageScore = gradedExamEvents.length
    ? Math.round(gradedExamEvents.reduce((total, event) => total + (event.marksScored! / event.totalMarks!), 0) / gradedExamEvents.length * 100)
    : 0;
  const monthlyTaskCount = monthlyEvents.filter((event) => event.category === 'homework').length;
  const monthlyEventCount = monthlyEvents.filter((event) => event.category !== 'homework' && event.category !== 'exam').length;

  function toggleFocus(mode: 'workload' | 'conflicts' | 'burnout' | 'exams' | 'sync') {
    setInsightFocus((prev) => {
      const next = prev === mode ? 'none' : mode;
      if (next === 'none') setCalendarNote('Showing all planner events.');
      if (next === 'workload') setCalendarNote('Workload focus active. Showing all events.');
      if (next === 'conflicts') setCalendarNote('Conflict focus active. Showing overlapping events.');
      if (next === 'burnout') setCalendarNote('Burnout focus active. Showing high-load categories.');
      if (next === 'exams') setCalendarNote('Exam focus active. Showing exam events only.');
      if (next === 'sync') setCalendarNote('Sync status viewed. Google integration is not connected.');
      return next;
    });
  }

  useEffect(() => {
    if (!isOnline) {
      pushToast({ type: 'offline', message: 'Offline mode active. Using cached/mock planner data.' });
    }
  }, [isOnline, pushToast]);

  function toggleCategory(category: PlannerEvent['category']) {
    setActiveCategories((prev) => (prev.includes(category) ? prev.filter((x) => x !== category) : [...prev, category]));
  }

  function selectActivityFilter(activityId: string) {
    setActiveActivityFilter(activityId);
    if (activityId === 'all') {
      setCalendarNote('Showing all activities.');
      return;
    }
    const activity = programs.find((program) => program.id === activityId);
    setCalendarNote(`Showing ${activity?.name || 'selected activity'} only.`);
  }

  function onCalendarDatesSet(arg: DatesSetArg) {
    const visibleStart = startOfMonth(arg.view.currentStart);
    setPeriodAnchor((prev) => (
      prev.getFullYear() === visibleStart.getFullYear() && prev.getMonth() === visibleStart.getMonth()
        ? prev
        : visibleStart
    ));
  }

  const periodControl = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Monthly Status</p>
        <p className="mt-1 text-sm font-semibold text-white/75">Showing tasks, exams, and events for this month only.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPeriodAnchor((prev) => shiftMonth(prev, -1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200 transition hover:bg-cyan-400/15"
          title="Previous month"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex h-10 min-w-[190px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white">
          <CalendarDays size={16} className="text-cyan-300" />
          <span>{periodRange.label}</span>
        </div>
        <button
          type="button"
          onClick={() => setPeriodAnchor((prev) => shiftMonth(prev, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200 transition hover:bg-cyan-400/15"
          title="Next month"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => setPeriodAnchor(startOfMonth(new Date()))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white"
          title="Current month"
          aria-label="Current month"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    </div>
  );

  function onSelectSlot(slot: DateSelectArg) {
    setModalMode('create');
    setEditingEvent({
      id: 'draft_new',
      familyId,
      childId,
      parentId: familyId,
      title: 'New Event',
      description: '',
      category: 'school',
      color: '#3b82f6',
      startAt: slot.startStr,
      endAt: slot.endStr,
      allDay: false,
      timezone: 'Asia/Kolkata',
      recurrence: { type: 'none', interval: 1, byWeekDays: [] },
      linkedProgramId: null,
      linkedTaskIds: [],
      participantIds: [],
      reminderIds: [],
      source: 'manual',
      sync: { googleEnabled: false, syncStatus: 'not_configured' },
      createdBy: 'parent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null
    });
    setModalOpen(true);
  }

  function onClickEvent(arg: EventClickArg) {
    const rootId = arg.event.extendedProps.rootEventId || arg.event.id.split('::')[0];
    const target = mergedEvents.find((event) => event.id === rootId);
    if (!target) return;
    setModalMode('edit');
    setEditingEvent(target);
    setModalOpen(true);
  }

  async function safeMutation(actionLabel: string, work: () => Promise<void>) {
    try {
      await work();
      pushToast({ type: 'success', message: actionLabel });
    } catch (error) {
      const id = enqueue(actionLabel, work);
      pushToast({ type: 'retry', message: `Failed to save. ${actionLabel}`, actionLabel: 'Retry', onAction: () => void retryOne(id) });
      throw error;
    }
  }

  async function handleSubmitEvent(input: PlannerEventInput) {
    if (modalMode === 'create') {
      const optimistic: PlannerEvent = {
        id: `tmp_${Date.now()}`,
        familyId,
        childId,
        parentId: familyId,
        title: input.title,
        description: '',
        category: input.category as PlannerEvent['category'],
        color: '#3b82f6',
        startAt: input.startAt,
        endAt: input.endAt,
        allDay: false,
        timezone: 'Asia/Kolkata',
        recurrence: { type: input.recurrenceType, interval: 1, byWeekDays: input.recurrenceWeekDays },
        linkedProgramId: input.linkedProgramId || null,
        linkedTaskIds: [],
        participantIds: [],
        reminderIds: [],
        source: 'manual',
        sync: { googleEnabled: false, syncStatus: 'not_configured' },
        createdBy: 'parent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null
      };

      setOptimisticEvents((prev) => [optimistic, ...prev]);
      try {
        await safeMutation('Event created', async () => {
          await createParentPlannerEvent(familyId, familyId, childId, input);
          await refreshEvents();
        });
        setCalendarNote('Event created successfully.');
      } catch {
        setOptimisticEvents((prev) => prev.filter((event) => event.id !== optimistic.id));
      }
      return;
    }

    if (!editingEvent) return;
    const previous = mergedEvents.find((event) => event.id === editingEvent.id);
    if (!previous) return;

    const next: PlannerEvent = {
      ...previous,
      title: input.title,
      category: input.category as PlannerEvent['category'],
      startAt: input.startAt,
      endAt: input.endAt,
      linkedProgramId: input.linkedProgramId || null,
      recurrence: { ...previous.recurrence, type: input.recurrenceType, byWeekDays: input.recurrenceWeekDays },
      updatedAt: new Date().toISOString()
    };

    setOptimisticEvents((prev) => [next, ...prev.filter((event) => event.id !== next.id)]);
    try {
      await safeMutation('Event updated', async () => {
        await updateParentPlannerEvent(editingEvent.id, input);
        await refreshEvents();
      });
      setCalendarNote('Event updated successfully.');
    } catch {
      setOptimisticEvents((prev) => [previous, ...prev.filter((event) => event.id !== previous.id)]);
    }
  }

  async function handleEventMoveOrResize(arg: EventDropArg | { event: { id: string; start: Date | null; end: Date | null }; revert: () => void }) {
    const rootId = arg.event.id.split('::')[0];
    const target = mergedEvents.find((event) => event.id === rootId);
    if (!target || !arg.event.start || !arg.event.end) return;
    if (target.recurrence.type !== 'none') {
      setCalendarNote('Recurring events must be edited from the event details to avoid changing the whole series by accident.');
      arg.revert();
      return;
    }

    const payload: PlannerEventInput = {
      title: target.title,
      category: target.category,
      startAt: arg.event.start.toISOString(),
      endAt: arg.event.end.toISOString(),
      linkedProgramId: target.linkedProgramId || null,
      recurrenceType: 'none',
      recurrenceWeekDays: []
    };

    const previous = target;
    const next = { ...target, startAt: payload.startAt, endAt: payload.endAt, updatedAt: new Date().toISOString() };
    setOptimisticEvents((prev) => [next, ...prev.filter((event) => event.id !== next.id)]);

    try {
      await safeMutation('Event rescheduled', async () => {
        await updateParentPlannerEvent(target.id, payload);
        await refreshEvents();
      });
    } catch {
      setOptimisticEvents((prev) => [previous, ...prev.filter((event) => event.id !== previous.id)]);
      arg.revert();
    }
  }

  return (
    <div className="mx-auto max-w-[1680px] space-y-4 pb-8">
      <PlannerToastViewport />
      <PlannerOfflineBanner isOnline={isOnline} hasQueuedMutations={hasQueued} onRetryQueued={() => { for (const item of queue) void retryOne(item.id); }} />

      <PlannerConflictBanner conflictCount={insights.conflicts.length} />
      <div className="grid gap-2 sm:grid-cols-2">
        {lightInsights.overloadedDay ? <p className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Overloaded day: {lightInsights.overloadedDay}</p> : null}
        {lightInsights.freeDay ? <p className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Suggested free day: {lightInsights.freeDay}</p> : null}
        {lightInsights.examProximityWarning ? <p className="rounded-xl border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">Exam proximity warning: less than 7 days.</p> : null}
        {lightInsights.consecutiveBusyWarning ? <p className="rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/10 px-3 py-2 text-xs text-fuchsia-100">Busy-day streak warning: {lightInsights.maxBusyRun} consecutive days.</p> : null}
      </div>

      <PlannerShell
        left={
          <div className="space-y-4">
            <ParentPlannerSidebar>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white/85">Activities</p>
                <button type="button" onClick={() => { setModalMode('create'); setEditingEvent(null); setModalOpen(true); }} className="min-h-[40px] rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-2 py-1 text-xs text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">+ Event</button>
              </div>
              {programsLoading ? <p className="text-sm text-white/70">Loading programs...</p> : null}
              {!programsLoading && programs.length === 0 ? (
                <p className="text-sm text-white/60">
                  No active programs. <Link to="/parent/onboarding" className="text-cyan-300 underline">Run setup</Link> to seed starter planner data.
                </p>
              ) : null}
              <div className="space-y-2 text-sm text-white/70">
                <button
                  type="button"
                  onClick={() => selectActivityFilter('all')}
                  className={`group relative flex min-h-[38px] w-full items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left transition ${
                    activeActivityFilter === 'all'
                      ? 'border-cyan-300/35 bg-cyan-400/15 text-white'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.75)]" aria-hidden="true" />
                  <span className="min-w-0 truncate font-semibold">All</span>
                  <span className="absolute right-0 top-0 h-full w-1 bg-cyan-300" aria-hidden="true" />
                </button>
                {programs.map((program) => (
                  <button
                    key={program.id}
                    type="button"
                    onClick={() => selectActivityFilter(program.id)}
                    className={`group relative flex min-h-[38px] w-full items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 pr-4 text-left transition ${
                      activeActivityFilter === program.id
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor]"
                      style={{ backgroundColor: activityColorById.get(program.id) || '#38bdf8', color: activityColorById.get(program.id) || '#38bdf8' }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">{program.name}</span>
                    <span
                      className={`absolute right-0 top-0 h-full w-1 transition-opacity ${activeActivityFilter === program.id ? 'opacity-100' : 'opacity-45'}`}
                      style={{ background: `linear-gradient(180deg, ${activityColorById.get(program.id) || '#38bdf8'}, ${(activityColorById.get(program.id) || '#38bdf8')}88)` }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </ParentPlannerSidebar>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-3 text-sm font-semibold text-white/85">Category Filters</p>
              <PlannerFilterBar categories={PLANNER_EVENT_CATEGORIES} activeCategories={activeCategories} onToggleCategory={toggleCategory} />
              <div className="mt-4"><PlannerLegend categories={PLANNER_EVENT_CATEGORIES} /></div>
            </div>
          </div>
        }
        main={
          <div className="space-y-4">
            {periodControl}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Tasks</p>
                <p className="mt-1 text-2xl font-black text-cyan-200">{monthlyTaskCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Exams</p>
                <p className="mt-1 text-2xl font-black text-rose-200">{monthlyExamEvents.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Events</p>
                <p className="mt-1 text-2xl font-black text-violet-200">{monthlyEventCount}</p>
              </div>
            </div>
            {eventsLoading ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">Loading calendar events...</p> : null}
            {!eventsLoading && calendarEvents.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                No events found for {periodRange.label}. <Link to="/parent/onboarding" className="text-cyan-300 underline">Create onboarding data</Link>.
              </p>
            ) : null}
            <ParentPlannerCalendarPanel
              events={calendarEvents}
              initialDate={periodRange.initialDate}
              onDatesSet={onCalendarDatesSet}
              onSelectSlot={onSelectSlot}
              onClickEvent={onClickEvent}
              onEventDrop={(arg) => void handleEventMoveOrResize(arg)}
              onEventResize={(arg) => void handleEventMoveOrResize(arg)}
            />
            <p className="rounded-2xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100">{calendarNote}</p>

            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
              School timetable is managed in Child Planner under the <span className="text-cyan-300">School</span> tab.
            </p>
          </div>
        }
        right={
          <div className="space-y-4">
            <ParentWeeklyOverview weeklyScore={insights.burnout.weeklyScore} active={insightFocus === 'workload'} onClick={() => toggleFocus('workload')} />
            <ParentConflictPanel count={insights.conflicts.length} active={insightFocus === 'conflicts'} onClick={() => toggleFocus('conflicts')} />
            <ParentBurnoutPanel level={insights.burnout.level} recommendation={insights.burnout.recommendation} active={insightFocus === 'burnout'} onClick={() => toggleFocus('burnout')} />
            <ParentExamTracker
              upcomingExamCount={upcomingExamCount}
              monthlyExamCount={monthlyExamEvents.length}
              scheduledExamCount={scheduledExamCount}
              marksLabel={`${marksScoredTotal}/${maxMarksTotal || 0}`}
              averageScore={averageScore}
              periodLabel={periodRange.label}
              active={insightFocus === 'exams'}
              onClick={() => toggleFocus('exams')}
            />
            <ParentSyncStatus status="not_connected" active={insightFocus === 'sync'} onClick={() => toggleFocus('sync')} />
          </div>
        }
      />

      <ParentEventEditorModal
        open={modalOpen}
        mode={modalMode}
        event={editingEvent}
        programs={programs}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitEvent}
      />
    </div>
  );
}

export default function ParentPlannerV2Page({ childId, familyId }: { childId: string; familyId: string }) {
  return (
    <PlannerToastProvider>
      <ParentPlannerInner childId={childId} familyId={familyId} />
    </PlannerToastProvider>
  );
}
