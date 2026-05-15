import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { useAuth } from '../../../contexts/AuthContext';
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

function ParentPlannerInner() {
  const { user } = useAuth();
  const { pushToast } = usePlannerToast();
  const { isOnline } = useNetworkStatus();
  const { queue, enqueue, retryOne, hasQueued } = usePlannerMutationQueue();

  const childId = user?.linked_family_id || user?.id || 'child_mock_1';
  const familyId = user?.linked_family_id || user?.id || 'fam_mock_1';

  const [activeCategories, setActiveCategories] = useState<PlannerEvent['category'][]>([...PLANNER_EVENT_CATEGORIES]);
  const [calendarNote, setCalendarNote] = useState('Tap events or drag to simulate rescheduling.');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);
  const [optimisticEvents, setOptimisticEvents] = useState<PlannerEvent[]>([]);
  const [insightFocus, setInsightFocus] = useState<'none' | 'workload' | 'conflicts' | 'burnout' | 'exams' | 'sync'>('none');

  useUnsavedChangesGuard(false, 'You have unsaved timetable changes. Leave anyway?');

  const { events: fetchedEvents, loading: eventsLoading, refresh: refreshEvents } = usePlannerEvents(childId, undefined, true);
  const { programs, loading: programsLoading } = usePlannerPrograms(childId, true);

  const mergedEvents = useMemo(() => {
    const byId = new Map<string, PlannerEvent>();
    for (const event of fetchedEvents) byId.set(event.id, event);
    for (const event of optimisticEvents) byId.set(event.id, event);
    return Array.from(byId.values());
  }, [fetchedEvents, optimisticEvents]);

  const filteredEvents = useMemo(() => mergedEvents.filter((event) => activeCategories.includes(event.category)), [mergedEvents, activeCategories]);
  const insights = usePlannerInsights(filteredEvents);
  const lightInsights = usePlannerLightInsights(filteredEvents);

  const focusedEvents = useMemo(() => {
    if (insightFocus === 'none' || insightFocus === 'workload' || insightFocus === 'sync') return filteredEvents;
    if (insightFocus === 'exams') return filteredEvents.filter((event) => event.category === 'exam');
    if (insightFocus === 'burnout') {
      const heavy = new Set(['school', 'exam', 'tuition', 'homework']);
      return filteredEvents.filter((event) => heavy.has(event.category));
    }
    if (insightFocus === 'conflicts') {
      const ids = new Set<string>();
      for (const conflict of insights.conflicts) {
        ids.add(conflict.eventAId);
        ids.add(conflict.eventBId);
      }
      return filteredEvents.filter((event) => ids.has(event.id));
    }
    return filteredEvents;
  }, [filteredEvents, insightFocus, insights.conflicts]);

  const calendarEvents = useMemo<EventInput[]>(
    () => focusedEvents.map((event) => ({ id: event.id, title: event.title, start: event.startAt, end: event.endAt, color: event.color })),
    [focusedEvents]
  );

  const upcomingExamCount = filteredEvents.filter((event) => event.category === 'exam' && new Date(event.startAt).getTime() >= Date.now()).length;

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
    const target = mergedEvents.find((event) => event.id === arg.event.id);
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
    const target = mergedEvents.find((event) => event.id === arg.event.id);
    if (!target || !arg.event.start || !arg.event.end) return;

    const payload: PlannerEventInput = {
      title: target.title,
      category: target.category,
      startAt: arg.event.start.toISOString(),
      endAt: arg.event.end.toISOString(),
      linkedProgramId: target.linkedProgramId || null,
      recurrenceType: target.recurrence.type === 'daily' || target.recurrence.type === 'weekly' ? target.recurrence.type : 'none',
      recurrenceWeekDays: target.recurrence.byWeekDays || []
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
    <div className="mx-auto max-w-[1500px] space-y-4 pb-8">
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
                <p className="text-sm font-semibold text-white/85">Programs</p>
                <button type="button" onClick={() => { setModalMode('create'); setEditingEvent(null); setModalOpen(true); }} className="min-h-[40px] rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-2 py-1 text-xs text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">+ Event</button>
              </div>
              {programsLoading ? <p className="text-sm text-white/70">Loading programs...</p> : null}
              {!programsLoading && programs.length === 0 ? (
                <p className="text-sm text-white/60">
                  No active programs. <Link to="/parent/onboarding" className="text-cyan-300 underline">Run setup</Link> to seed starter planner data.
                </p>
              ) : null}
              <div className="space-y-2 text-sm text-white/70">
                {programs.map((program) => (
                  <div key={program.id} className="rounded-xl border border-white/10 px-3 py-2">{program.icon} {program.name}</div>
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
            {eventsLoading ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">Loading calendar events...</p> : null}
            {!eventsLoading && calendarEvents.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                No events found for this range. <Link to="/parent/onboarding" className="text-cyan-300 underline">Create onboarding data</Link>.
              </p>
            ) : null}
            <ParentPlannerCalendarPanel events={calendarEvents} onSelectSlot={onSelectSlot} onClickEvent={onClickEvent} onEventDrop={(arg) => void handleEventMoveOrResize(arg)} onEventResize={(arg) => void handleEventMoveOrResize(arg)} />
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
            <ParentExamTracker upcomingExamCount={upcomingExamCount} active={insightFocus === 'exams'} onClick={() => toggleFocus('exams')} />
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

export default function ParentPlannerV2Page() {
  return (
    <PlannerToastProvider>
      <ParentPlannerInner />
    </PlannerToastProvider>
  );
}
