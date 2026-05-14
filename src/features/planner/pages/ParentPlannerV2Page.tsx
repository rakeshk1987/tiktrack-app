import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { useAuth } from '../../../contexts/AuthContext';
import { PLANNER_EVENT_CATEGORIES, PLANNER_FEATURE_FLAGS } from '../constants/planner.constants';
import type { PlannerEvent } from '../types/planner.types';
import { createParentPlannerEvent, updateParentPlannerEvent, upsertSchoolTimetableCell } from '../services/planner.firestore';
import { usePlannerEvents } from '../hooks/usePlannerEvents';
import { usePlannerInsights } from '../hooks/usePlannerInsights';
import { usePlannerPrograms } from '../hooks/usePlannerPrograms';
import { usePlannerTimetable } from '../hooks/usePlannerTimetable';
import { usePlannerLightInsights } from '../hooks/usePlannerLightInsights';
import { usePlannerMutationQueue } from '../hooks/usePlannerMutationQueue';
import { usePlannerToast, PlannerToastProvider } from '../hooks/usePlannerToast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { plannerTimetableCellSchema, type PlannerEventInput } from '../utils/planner.validation';
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
import { SchoolTimetableTable } from '../components/parent/SchoolTimetableTable';

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

  const [period, setPeriod] = useState('Period 1');
  const [day, setDay] = useState('Mon');
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [timetableError, setTimetableError] = useState('');
  const [timetableSaving, setTimetableSaving] = useState(false);

  const timetableDirty = Boolean(subject || room || teacher);
  useUnsavedChangesGuard(timetableDirty, 'You have unsaved timetable changes. Leave anyway?');

  const { events: fetchedEvents, loading: eventsLoading, refresh: refreshEvents } = usePlannerEvents(childId, undefined, true);
  const { programs, loading: programsLoading } = usePlannerPrograms(childId, true);
  const { timetable, loading: timetableLoading, refresh: refreshTimetable } = usePlannerTimetable(childId, true);

  const mergedEvents = useMemo(() => {
    const byId = new Map<string, PlannerEvent>();
    for (const event of fetchedEvents) byId.set(event.id, event);
    for (const event of optimisticEvents) byId.set(event.id, event);
    return Array.from(byId.values());
  }, [fetchedEvents, optimisticEvents]);

  const filteredEvents = useMemo(() => mergedEvents.filter((event) => activeCategories.includes(event.category)), [mergedEvents, activeCategories]);
  const insights = usePlannerInsights(filteredEvents);
  const lightInsights = usePlannerLightInsights(filteredEvents);

  const calendarEvents = useMemo<EventInput[]>(() => filteredEvents.map((event) => ({ id: event.id, title: event.title, start: event.startAt, end: event.endAt, color: event.color })), [filteredEvents]);

  const upcomingExamCount = filteredEvents.filter((event) => event.category === 'exam' && new Date(event.startAt).getTime() >= Date.now()).length;

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

  async function handleSaveTimetableCell() {
    setTimetableError('');
    const parsed = plannerTimetableCellSchema.safeParse({ period, day, subject, room, teacher });
    if (!parsed.success) {
      setTimetableError(parsed.error.issues[0]?.message || 'Invalid timetable data');
      pushToast({ type: 'error', message: parsed.error.issues[0]?.message || 'Invalid timetable data' });
      return;
    }

    setTimetableSaving(true);
    try {
      await safeMutation('Timetable updated', async () => {
        await upsertSchoolTimetableCell(childId, familyId, parsed.data);
        await refreshTimetable();
      });
      setSubject('');
      setRoom('');
      setTeacher('');
    } catch (error) {
      setTimetableError(error instanceof Error ? error.message : 'Failed to save timetable cell');
    } finally {
      setTimetableSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 pb-8">
      <PlannerToastViewport />
      <PlannerOfflineBanner isOnline={isOnline} hasQueuedMutations={hasQueued} onRetryQueued={() => { for (const item of queue) void retryOne(item.id); }} />

      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.2)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Parent Planner</p>
        <h2 className="mt-2 text-3xl font-display font-bold">Master Calendar Control Center</h2>
        <p className="mt-2 text-sm text-white/70">Controlled scheduling flows with Firestore-backed create/edit and timetable CRUD.</p>
        <p className="mt-2 text-xs text-white/50">Feature flags: recurrence={String(PLANNER_FEATURE_FLAGS.advancedRecurrence)} burnout={String(PLANNER_FEATURE_FLAGS.burnoutEngine)} sync={String(PLANNER_FEATURE_FLAGS.googleSync)}</p>
      </section>

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

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-3 text-sm font-semibold text-white/85">Timetable Editor (Parent)</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                <input aria-label="Timetable period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Period" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
                <input aria-label="Timetable day" value={day} onChange={(e) => setDay(e.target.value)} placeholder="Day" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
                <input aria-label="Timetable subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
                <input aria-label="Timetable room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room (optional)" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
                <input aria-label="Timetable teacher" value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Teacher (optional)" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300" />
              </div>
              {timetableError ? <p className="mt-2 text-sm text-rose-300">{timetableError}</p> : null}
              <button type="button" onClick={() => void handleSaveTimetableCell()} disabled={timetableSaving} className="mt-3 min-h-[44px] rounded-xl bg-cyan-500/30 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">{timetableSaving ? 'Saving...' : 'Save Timetable Entry'}</button>
            </div>

            {timetableLoading ? <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">Loading timetable...</p> : null}
            {!timetableLoading && !timetable ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                No timetable configured. Use the editor above or <Link to="/parent/onboarding" className="text-cyan-300 underline">seed sample timetable</Link>.
              </p>
            ) : null}
            {timetable ? <SchoolTimetableTable periods={timetable.periods} days={timetable.days} data={timetable.data} /> : null}
          </div>
        }
        right={
          <div className="space-y-4">
            <ParentWeeklyOverview weeklyScore={insights.burnout.weeklyScore} />
            <ParentConflictPanel count={insights.conflicts.length} />
            <ParentBurnoutPanel level={insights.burnout.level} recommendation={insights.burnout.recommendation} />
            <ParentExamTracker upcomingExamCount={upcomingExamCount} />
            <ParentSyncStatus status="not_connected" />
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
