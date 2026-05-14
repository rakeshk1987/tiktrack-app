import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { EventContentArg, EventInput } from '@fullcalendar/core';
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
import type { PlannerEvent } from '../types/planner.types';

type ChildPlannerTab = 'calendar' | 'school' | `program_${string}`;

function categoryLabel(category: string) {
  return category.replace('_', ' ');
}

export default function ChildPlannerV2Page() {
  const { user } = useAuth();
  const childId = user?.id || '';
  const familyId = user?.linked_family_id || user?.id || '';
  const [activeTab, setActiveTab] = useState<ChildPlannerTab>('calendar');
  const [viewMode, setViewMode] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('dayGridMonth');
  const [period, setPeriod] = useState('Period 1');
  const [day, setDay] = useState('Mon');
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');
  const [teacher, setTeacher] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const [schoolError, setSchoolError] = useState('');

  const { events, loading } = usePlannerEvents(childId, undefined, true);
  const { programs } = usePlannerPrograms(childId, true);
  const { timetable, loading: timetableLoading, refresh: refreshTimetable } = usePlannerTimetable(childId, true);
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
        return {
          id: `exam_${d.id}`,
          familyId,
          childId,
          parentId: familyId,
          title: `${String(row.subject || 'Exam')} Exam`,
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

  const visibleEvents = useMemo(() => {
    if (activeTab === 'calendar' || activeTab === 'school') return allEvents;
    const programId = activeTab.replace('program_', '');
    return allEvents.filter((event) => event.linkedProgramId === programId || event.category === 'tuition' || event.category === 'extracurricular');
  }, [activeTab, allEvents]);

  const calendarEvents = useMemo<EventInput[]>(
    () => visibleEvents.map((event) => ({
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
    [visibleEvents]
  );

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

  return (
    <div className="mx-auto mt-4 max-w-7xl space-y-4 pb-20">
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-4 text-white">
        <p className="text-xs uppercase tracking-[0.15em] text-cyan-300">Planner</p>
        <h1 className="mt-2 text-2xl font-bold">Your Calendar</h1>
        <p className="mt-1 text-sm text-white/70">Monthly, weekly, or daily view with exams, tasks, school, and custom program schedules.</p>
      </section>

      <PlannerConflictBanner conflictCount={insights.conflicts.length} />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setActiveTab('calendar')} className={`min-h-[40px] rounded-lg px-3 text-sm ${activeTab === 'calendar' ? 'bg-cyan-500/30 text-cyan-100' : 'bg-white/10 text-white/80'}`}>Calendar</button>
        <button type="button" onClick={() => setActiveTab('school')} className={`min-h-[40px] rounded-lg px-3 text-sm ${activeTab === 'school' ? 'bg-cyan-500/30 text-cyan-100' : 'bg-white/10 text-white/80'}`}>School</button>
        {programs.map((program) => (
          <button key={program.id} type="button" onClick={() => setActiveTab(`program_${program.id}`)} className={`min-h-[40px] rounded-lg px-3 text-sm ${activeTab === `program_${program.id}` ? 'bg-cyan-500/30 text-cyan-100' : 'bg-white/10 text-white/80'}`}>
            {program.name}
          </button>
        ))}
      </div>

      {(activeTab === 'calendar' || activeTab.startsWith('program_')) ? (
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-3 text-white">
          <div className="mb-3 flex gap-2">
            <button type="button" onClick={() => setViewMode('dayGridMonth')} className={`min-h-[36px] rounded-md px-3 text-xs ${viewMode === 'dayGridMonth' ? 'bg-white/20' : 'bg-white/10'}`}>Month</button>
            <button type="button" onClick={() => setViewMode('timeGridWeek')} className={`min-h-[36px] rounded-md px-3 text-xs ${viewMode === 'timeGridWeek' ? 'bg-white/20' : 'bg-white/10'}`}>Week</button>
            <button type="button" onClick={() => setViewMode('timeGridDay')} className={`min-h-[36px] rounded-md px-3 text-xs ${viewMode === 'timeGridDay' ? 'bg-white/20' : 'bg-white/10'}`}>Day</button>
          </div>
          {loading ? <p className="px-2 py-3 text-sm text-white/70">Loading calendar...</p> : null}
          <div className="[&_.fc]:text-white [&_.fc-col-header-cell-cushion]:text-xs [&_.fc-toolbar-title]:text-base [&_.fc-toolbar]:flex-wrap [&_.fc-toolbar]:gap-2 [&_.fc-button]:min-h-[36px] [&_.fc-button]:text-xs [&_.fc-button]:bg-white/10 [&_.fc-button]:border-white/20">
            <FullCalendar
              key={viewMode}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView={viewMode}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              events={calendarEvents}
              height="auto"
              dayMaxEvents={3}
              eventContent={eventContent}
            />
          </div>
        </section>
      ) : null}

      {activeTab === 'school' ? (
        <section className="space-y-3 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-4 text-white">
          <h2 className="text-lg font-semibold">School Timetable</h2>
          <p className="text-sm text-white/70">You can update your school timetable here.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Period" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3" />
            <input value={day} onChange={(e) => setDay(e.target.value)} placeholder="Day (Mon)" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3" />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3" />
            <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Room" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3" />
            <input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Teacher" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.04] px-3" />
          </div>
          {schoolError ? <p className="text-sm text-rose-300">{schoolError}</p> : null}
          <button type="button" onClick={() => void saveSchoolCell()} disabled={savingCell} className="min-h-[44px] rounded-xl bg-cyan-500/25 px-4 text-sm font-semibold text-cyan-100 disabled:opacity-60">
            {savingCell ? 'Saving...' : 'Save timetable entry'}
          </button>
          {timetableLoading ? <p className="text-sm text-white/70">Loading timetable...</p> : null}
          {timetable ? <SchoolTimetableTable periods={timetable.periods} days={timetable.days} data={timetable.data} /> : null}
        </section>
      ) : null}
    </div>
  );
}
