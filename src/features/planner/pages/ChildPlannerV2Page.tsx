import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../config/firebase';
import { upsertSchoolTimetableCell } from '../services/planner.firestore';
import { usePlannerEvents } from '../hooks/usePlannerEvents';
import { usePlannerPrograms } from '../hooks/usePlannerPrograms';
import { usePlannerTimetable } from '../hooks/usePlannerTimetable';
import { usePlannerInsights } from '../hooks/usePlannerInsights';
import { plannerTimetableCellSchema } from '../utils/planner.validation';
import { SchoolTimetableTable } from '../components/parent/SchoolTimetableTable';
import { PlannerConflictBanner } from '../components/shared/PlannerConflictBanner';
import type { PlannerActivityModule, PlannerEvent } from '../types/planner.types';

type ChildPlannerTab = 'calendar' | `activity_${string}`;
type ActivitySubTab = PlannerActivityModule;

function categoryLabel(category: string) {
  return category.replace('_', ' ');
}

export default function ChildPlannerV2Page() {
  const { user } = useAuth();
  const childId = user?.id || '';
  const familyId = user?.linked_family_id || user?.id || '';
  const [activeTab, setActiveTab] = useState<'calendar' | 'activities'>('calendar');
  const [activeActivityId, setActiveActivityId] = useState<string>('');
  const [activitySubTab, setActivitySubTab] = useState<ActivitySubTab>('tasks');
  const [period, setPeriod] = useState('Period 1');
  const [day, setDay] = useState('Mon');
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const [schoolError, setSchoolError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<{
    title: string;
    category: string;
    start: string;
    end: string;
  } | null>(null);
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<string[]>(['all']);

  const { events, loading } = usePlannerEvents(childId, undefined, false);
  const { programs } = usePlannerPrograms(childId, false);
  const { timetable, loading: timetableLoading, refresh: refreshTimetable } = usePlannerTimetable(childId, false);
  const insights = usePlannerInsights(events);

  const [taskEvents, setTaskEvents] = useState<PlannerEvent[]>([]);
  const [examEvents, setExamEvents] = useState<PlannerEvent[]>([]);

  useEffect(() => {
    const loadExtra = async () => {
      if (!childId) return;
      const now = new Date().toISOString();
      const taskSnap = await getDocs(query(collection(db, 'tasks'), where('child_id', '==', childId)));
      const examSnap = await getDocs(query(collection(db, 'exams'), where('child_id', '==', childId)));

      const mappedTasks: PlannerEvent[] = taskSnap.docs.map((d) => {
        const row = d.data() as Record<string, unknown>;
        const baseStart = typeof row.due_date === 'string' ? row.due_date : now;
        return {
          id: `task_${d.id}`,
          familyId,
          childId,
          parentId: familyId,
          title: String(row.title || 'Task'),
          category: 'homework',
          color: '#eab308',
          startAt: baseStart,
          endAt: baseStart,
          allDay: true,
          timezone: 'Asia/Kolkata',
          recurrence: { type: 'none', interval: 1 },
          linkedTaskIds: [d.id],
          participantIds: [],
          reminderIds: [],
          source: 'manual',
          sync: { googleEnabled: false, syncStatus: 'not_configured' },
          createdBy: 'child',
          createdAt: now,
          updatedAt: now
        };
      });

      const mappedExams: PlannerEvent[] = examSnap.docs.map((d) => {
        const row = d.data() as Record<string, unknown>;
        const startAt = typeof row.exam_date === 'string' ? `${row.exam_date}T09:00:00.000Z` : now;
        const endAt = typeof row.exam_date === 'string' ? `${row.exam_date}T11:00:00.000Z` : now;
        const marksScored = typeof row.marks_scored === 'number' ? row.marks_scored : null;
        const totalMarks = typeof row.total_marks === 'number' ? row.total_marks : null;
        const resultSuffix = marksScored !== null && totalMarks !== null ? ` (${marksScored}/${totalMarks})` : '';
        return {
          id: `exam_${d.id}`,
          familyId,
          childId,
          parentId: familyId,
          title: `${String(row.subject || 'Exam')} Exam${resultSuffix}`,
          category: 'exam',
          color: '#ef4444',
          startAt,
          endAt,
          allDay: false,
          timezone: 'Asia/Kolkata',
          recurrence: { type: 'none', interval: 1 },
          linkedTaskIds: [],
          participantIds: [],
          reminderIds: [],
          source: 'manual',
          sync: { googleEnabled: false, syncStatus: 'not_configured' },
          createdBy: 'parent',
          createdAt: now,
          updatedAt: now
        };
      });

      setTaskEvents(mappedTasks);
      setExamEvents(mappedExams);
    };
    void loadExtra();
  }, [childId, familyId]);

  const allEvents = useMemo(() => [...events, ...taskEvents, ...examEvents], [events, taskEvents, examEvents]);

  const activityTabs = useMemo<Array<{ id: string; label: string; modules: PlannerActivityModule[] }>>(() => {
    return programs
      .map((program) => ({
        id: program.id,
        label: program.name?.trim() || 'Activity',
        modules: (program.modules && program.modules.length ? program.modules : ['tasks']) as PlannerActivityModule[]
      }))
      .filter((program, index, arr) => arr.findIndex((x) => x.label.toLowerCase() === program.label.toLowerCase()) === index);
  }, [programs]);

  useEffect(() => {
    if (!activeActivityId && programs.length > 0) {
      setActiveActivityId(programs[0].id);
    }
  }, [programs, activeActivityId]);

  const activeActivity = activityTabs.find((tab) => tab.id === activeActivityId);
  const activeActivityLabel = activeActivity?.label || '';
  const activeActivityModules: PlannerActivityModule[] = activeActivity?.modules || ['tasks'];
  const isSchoolActivity = activeActivityLabel.toLowerCase() === 'school' || activeActivityId === 'school';

  const visibleEvents = useMemo(() => {
    if (activeTab === 'calendar') return allEvents;
    if (!activeActivityId) return allEvents;
    if (isSchoolActivity) {
      return allEvents.filter((event) => ['school', 'homework', 'exam', 'tuition'].includes(event.category));
    }
    return allEvents.filter((event) => event.linkedProgramId === activeActivityId || event.category === 'extracurricular' || event.category === 'custom');
  }, [activeTab, allEvents, activeActivityId, isSchoolActivity]);

  const filteredEvents = useMemo(() => {
    if (activeCategoryFilters.includes('all')) return visibleEvents;
    return visibleEvents.filter((event) => activeCategoryFilters.includes(event.category));
  }, [visibleEvents, activeCategoryFilters]);

  const calendarEvents = useMemo<EventInput[]>(
    () => filteredEvents.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.startAt,
      end: event.endAt,
      allDay: event.allDay,
      backgroundColor: event.color,
      borderColor: event.color,
      extendedProps: {
        category: event.category
      }
    })),
    [filteredEvents]
  );

  const schoolRoutineItems = useMemo(() => {
    return allEvents
      .filter((event) => ['school', 'homework', 'tuition', 'exam', 'extracurricular'].includes(event.category))
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 20);
  }, [allEvents]);
  const schoolExamItems = useMemo(() => schoolRoutineItems.filter((event) => event.category === 'exam'), [schoolRoutineItems]);

  useEffect(() => {
    if (!activeActivityModules.includes(activitySubTab)) {
      setActivitySubTab(activeActivityModules[0] || 'tasks');
    }
  }, [activeActivityModules, activitySubTab]);

  useEffect(() => {
    if (!timetable) return;
    if (!timetable.periods.includes(period)) setPeriod(timetable.periods[0] || 'Period 1');
    if (!timetable.days.includes(day)) setDay(timetable.days[0] || 'Mon');
  }, [timetable, period, day]);

  async function saveSchoolCell() {
    setSchoolError('');
    const parsed = plannerTimetableCellSchema.safeParse({ period, day, subject, room, teacher });
    if (!parsed.success) {
      setSchoolError(parsed.error.issues[0]?.message || 'Invalid timetable entry');
      return;
    }
    if (!childId || !familyId) return;
    setSavingCell(true);
    try {
      await upsertSchoolTimetableCell(childId, familyId, parsed.data);
      await refreshTimetable();
      setSubject('');
      setRoom('');
      setTeacher('');
    } catch (error) {
      setSchoolError(error instanceof Error ? error.message : 'Failed to save timetable entry');
    } finally {
      setSavingCell(false);
    }
  }

  const eventContent = (arg: EventContentArg) => {
    const label = categoryLabel(String(arg.event.extendedProps.category || 'event'));
    return (
      <div className="rounded-md px-1 py-[2px] text-[10px] font-semibold leading-tight">
        <div className="truncate">{arg.event.title}</div>
        <div className="truncate text-[9px] opacity-90">{label}</div>
      </div>
    );
  };

  const onEventClick = (arg: EventClickArg) => {
    const start = arg.event.start;
    const end = arg.event.end;
    setSelectedEvent({
      title: arg.event.title || 'Event',
      category: categoryLabel(String(arg.event.extendedProps.category || 'event')),
      start: start ? start.toLocaleString() : '-',
      end: end ? end.toLocaleString() : '-'
    });
  };

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'school', label: 'School' },
    { id: 'homework', label: 'Homework' },
    { id: 'exam', label: 'Exams' },
    { id: 'tuition', label: 'Tuition' },
    { id: 'extracurricular', label: 'Activities' }
  ];

  function toggleFilter(id: string) {
    if (id === 'all') {
      setActiveCategoryFilters(['all']);
      return;
    }
    setActiveCategoryFilters((prev) => {
      const next = prev.includes('all') ? [] : [...prev];
      const updated = next.includes(id) ? next.filter((x) => x !== id) : [...next, id];
      return updated.length ? updated : ['all'];
    });
  }

  return (
    <div className="mx-auto mt-4 max-w-7xl space-y-4 pb-20">
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(36,25,71,0.85),rgba(18,27,62,0.95)_45%,rgba(8,14,35,0.98))] p-4 text-white shadow-[0_18px_50px_rgba(18,20,50,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-cyan-300">Planner</p>
            <h1 className="mt-1 text-2xl font-bold">Your Calendar</h1>
            <p className="mt-1 text-sm text-white/70">Monthly, weekly, or daily view with exams, tasks, school, and custom program schedules.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActiveTab('calendar')} className={`min-h-[40px] rounded-full border px-4 text-sm ${activeTab === 'calendar' ? 'border-cyan-300/80 bg-cyan-400/25 text-cyan-100' : 'border-white/20 bg-white/10 text-white/85'}`}>Calendar</button>
            {activityTabs.length > 0 && (
              <button type="button" onClick={() => setActiveTab('activities')} className={`min-h-[40px] rounded-full border px-4 text-sm ${activeTab === 'activities' ? 'border-cyan-300/80 bg-cyan-400/25 text-cyan-100' : 'border-white/20 bg-white/10 text-white/85'}`}>Activities</button>
            )}
          </div>
        </div>
      </section>

      <PlannerConflictBanner conflictCount={insights.conflicts.length} />

      {activeTab === 'calendar' ? (
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(20,30,64,0.97),rgba(11,16,35,0.98))] p-3 text-white shadow-[0_20px_70px_rgba(5,7,18,0.45)]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {filterOptions.map((option) => {
              const active = activeCategoryFilters.includes(option.id) || (option.id === 'all' && activeCategoryFilters.includes('all'));
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleFilter(option.id)}
                  className={`min-h-[34px] rounded-full border px-3 text-xs font-semibold ${
                    active ? 'border-cyan-300/80 bg-cyan-400/25 text-cyan-100' : 'border-white/20 bg-white/8 text-white/80'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {loading ? <p className="px-2 py-3 text-sm text-white/70">Loading calendar...</p> : null}
          <div className="[&_.fc]:text-white [&_.fc-theme-standard_td]:border-white/20 [&_.fc-theme-standard_th]:border-white/20 [&_.fc-scrollgrid]:border-white/20 [&_.fc-col-header-cell-cushion]:text-xs [&_.fc-col-header-cell-cushion]:font-semibold [&_.fc-toolbar-title]:text-base [&_.fc-toolbar-title]:font-semibold [&_.fc-toolbar]:flex-nowrap [&_.fc-toolbar]:items-center [&_.fc-toolbar]:gap-2 [&_.fc-button]:min-h-[36px] [&_.fc-button]:rounded-full [&_.fc-button]:border [&_.fc-button]:border-white/20 [&_.fc-button]:bg-white/8 [&_.fc-button]:px-4 [&_.fc-button]:text-xs [&_.fc-button]:font-semibold [&_.fc-button]:text-white [&_.fc-button:hover]:bg-white/16 [&_.fc-button-active]:!border-cyan-300/80 [&_.fc-button-active]:!bg-cyan-400/25 [&_.fc-daygrid-day]:bg-transparent [&_.fc-timegrid-slot]:border-white/15 [&_.fc-timegrid-axis]:text-white/60 [&_.fc-list-day]:bg-white/5 [&_.fc-list-event]:bg-transparent [&_.fc-list-event:hover_td]:bg-white/10 [&_.fc-day-today]:!bg-cyan-400/10 [&_.fc-daygrid-event]:!rounded-xl [&_.fc-daygrid-event]:!px-2 [&_.fc-daygrid-event]:!py-1 [&_.fc-daygrid-event]:!border-0">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{ left: 'prev dayGridMonth,timeGridWeek,timeGridDay,listYear', center: 'title', right: 'next' }}
              buttonText={{ dayGridMonth: 'Month', timeGridWeek: 'Week', timeGridDay: 'Day', listYear: 'Year', prev: 'Back', next: 'Next' }}
              events={calendarEvents}
              height="auto"
              dayMaxEvents={3}
              eventContent={eventContent}
              eventClick={onEventClick}
            />
          </div>
        </section>
      ) : null}

      {activeTab === 'activities' ? (
        <section className="space-y-4 rounded-3xl border border-white/10 bg-[linear-gradient(165deg,rgba(17,36,69,0.96),rgba(22,17,50,0.98))] p-4 text-white shadow-[0_20px_70px_rgba(6,10,30,0.45)]">
          <div className="mb-4 flex flex-wrap gap-2">
            {activityTabs.map((activity) => (
              <button key={activity.id} type="button" onClick={() => setActiveActivityId(activity.id)} className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold ${activeActivityId === activity.id ? 'border-cyan-300/80 bg-cyan-400/25 text-cyan-100' : 'border-white/20 bg-white/8 text-white/80'}`}>
                {activity.label}
              </button>
            ))}
          </div>

          <div>
            <h2 className="text-lg font-semibold">{isSchoolActivity ? 'School' : activeActivityLabel || 'Activity'}</h2>
            <p className="text-sm text-white/70">{isSchoolActivity ? 'School routine with configurable subtabs.' : 'Activity-specific tasks and schedule managed by your parent.'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeActivityModules.map((moduleId: PlannerActivityModule) => (
              <button key={moduleId} type="button" onClick={() => setActivitySubTab(moduleId)} className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold ${activitySubTab === moduleId ? 'border-cyan-300/80 bg-cyan-400/25 text-cyan-100' : 'border-white/20 bg-white/8 text-white/80'}`}>
                {moduleId === 'tasks' ? 'Tasks' : moduleId === 'exams' ? 'Exams' : moduleId === 'timetable' ? 'Class Timetable' : moduleId === 'challenges' ? 'Challenges' : 'Events'}
              </button>
            ))}
          </div>

          {activitySubTab === 'tasks' ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <h3 className="text-sm font-semibold text-white/85">{isSchoolActivity ? 'School Tasks' : `${activeActivityLabel || 'Activity'} Tasks`}</h3>
              <div className="mt-2 space-y-2">
                {visibleEvents.length ? visibleEvents.slice(0, 20).map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{event.title}</p>
                      <p className="text-xs text-white/65">{new Date(event.startAt).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full border border-cyan-300/35 bg-cyan-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100">
                      {categoryLabel(event.category)}
                    </span>
                  </div>
                )) : <p className="text-xs text-white/60">No tasks yet.</p>}
              </div>
            </div>
          ) : null}

          {activitySubTab === 'exams' ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <h3 className="text-sm font-semibold text-white/85">Exams & Tests</h3>
              <div className="mt-2 space-y-2">
                {(isSchoolActivity ? schoolExamItems : visibleEvents.filter((event) => event.category === 'exam')).length ? (isSchoolActivity ? schoolExamItems : visibleEvents.filter((event) => event.category === 'exam')).map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{event.title}</p>
                      <p className="text-xs text-white/65">{new Date(event.startAt).toLocaleString()}</p>
                    </div>
                    <span className="rounded-full border border-rose-300/35 bg-rose-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-100">Exam</span>
                  </div>
                )) : <p className="text-xs text-white/60">No exams scheduled.</p>}
              </div>
            </div>
          ) : null}

          {activitySubTab === 'timetable' ? (
            <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.08] px-3 text-white">
              {(timetable?.periods || []).map((rowPeriod) => <option key={rowPeriod} value={rowPeriod} className="bg-slate-900">{rowPeriod}</option>)}
            </select>
            <select value={day} onChange={(e) => setDay(e.target.value)} className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.08] px-3 text-white">
              {(timetable?.days || []).map((rowDay) => <option key={rowDay} value={rowDay} className="bg-slate-900">{rowDay}</option>)}
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.08] px-3" />
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.08] px-3" />
            <input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Teacher" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.08] px-3" />
          </div>
          <div className="rounded-2xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">Editing: {day} • {period}</div>
          {schoolError ? <p className="text-sm text-rose-300">{schoolError}</p> : null}
          <button type="button" onClick={() => void saveSchoolCell()} disabled={savingCell} className="min-h-[44px] rounded-xl border border-cyan-300/50 bg-cyan-400/20 px-4 text-sm font-semibold text-cyan-100 shadow-[0_10px_25px_rgba(34,211,238,0.18)] disabled:opacity-60">
            {savingCell ? 'Saving...' : 'Save timetable entry'}
          </button>
          {timetableLoading ? <p className="text-sm text-white/70">Loading timetable...</p> : null}
          {timetable ? (
            <SchoolTimetableTable
              periods={timetable.periods}
              days={timetable.days}
              data={timetable.data}
              selectedDay={day}
              selectedPeriod={period}
              onCellSelect={(nextPeriod, nextDay) => {
                setPeriod(nextPeriod);
                setDay(nextDay);
                const existing = timetable.data[nextPeriod]?.[nextDay];
                setSubject(existing?.subject || '');
                setRoom(existing?.room || '');
                setTeacher(existing?.teacher || '');
              }}
            />
          ) : null}
            </>
          ) : null}
          {activitySubTab === 'challenges' ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <h3 className="text-sm font-semibold text-white/85">Challenges</h3>
              <p className="mt-2 text-xs text-white/60">Challenges configured for School will appear here.</p>
            </div>
          ) : null}
          {activitySubTab === 'events' ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <h3 className="text-sm font-semibold text-white/85">Events</h3>
              <p className="mt-2 text-xs text-white/60">Events configured for School will appear here.</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-300/35 bg-[linear-gradient(165deg,rgba(16,32,60,0.98),rgba(30,20,56,0.98))] p-5 text-white shadow-[0_25px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-semibold">{selectedEvent.title}</h3>
              <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-lg border border-white/20 px-2 py-1 text-xs text-white/85 hover:bg-white/10">Close</button>
            </div>
            <p className="mt-2 inline-block rounded-full border border-cyan-300/40 bg-cyan-400/20 px-2.5 py-1 text-xs font-semibold capitalize text-cyan-100">{selectedEvent.category}</p>
            <div className="mt-4 space-y-2 text-sm text-white/85">
              <p><span className="text-white/60">Start:</span> {selectedEvent.start}</p>
              <p><span className="text-white/60">End:</span> {selectedEvent.end}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
