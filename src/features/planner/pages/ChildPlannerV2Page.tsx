import { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import type { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../config/firebase';
import { upsertSchoolTimetableCell } from '../services/planner.firestore';
import { usePlannerEvents } from '../hooks/usePlannerEvents';
import { usePlannerPrograms } from '../hooks/usePlannerPrograms';
import { usePlannerTimetable } from '../hooks/usePlannerTimetable';
import { usePlannerInsights } from '../hooks/usePlannerInsights';
import { usePlannerChallenges } from '../hooks/usePlannerChallenges';
import { usePlannerSubjects } from '../hooks/usePlannerSubjects';
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
  const [activeTab, setActiveTab] = useState<ChildPlannerTab>('calendar');
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

  const { events, loading, refresh: refreshEvents } = usePlannerEvents(childId, undefined, false);
  const { programs } = usePlannerPrograms(childId);
  const { timetable, refresh: refreshTimetable } = usePlannerTimetable(childId, false);
  const insights = usePlannerInsights(events);

  const activeActivityId = activeTab.startsWith('activity_') ? activeTab.replace('activity_', '') : '';
  const { challenges, createChallenge, incrementScore } = usePlannerChallenges(childId, activeActivityId);
  const { subjects, addSubject: addNewSubject } = usePlannerSubjects(childId, activeActivityId);

  // New Form States
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [taskCreating, setTaskCreating] = useState(false);

  const [showExamForm, setShowExamForm] = useState(false);
  const [newExamSubject, setNewExamSubject] = useState('');
  const [newExamSubjectId, setNewExamSubjectId] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [newExamMarks, setNewExamMarks] = useState<number | ''>('');
  const [newExamTotalMarks, setNewExamTotalMarks] = useState<number | ''>('');
  const [examCreating, setExamCreating] = useState(false);

  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [newChallengeTitle, setNewChallengeTitle] = useState('');
  const [newChallengeTarget, setNewChallengeTarget] = useState(5);
  const [challengeCreating, setChallengeCreating] = useState(false);

  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectTeacher, setNewSubjectTeacher] = useState('');
  const [newSubjectIncludeInExam, setNewSubjectIncludeInExam] = useState(true);
  const [subjectCreating, setSubjectCreating] = useState(false);

  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventRecurrence, setNewEventRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [eventCreating, setEventCreating] = useState(false);

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
          linkedProgramId: row.linked_program_id as string | undefined,
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
          linkedProgramId: row.linked_program_id as string | undefined,
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
    return visibleEvents.filter((event) => {
      if (event.linkedProgramId && activeCategoryFilters.includes(event.linkedProgramId)) {
        return true;
      }
      return false;
    });
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

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!childId || !newTaskTitle.trim() || !activeActivityId) return;
    setTaskCreating(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: newTaskTitle.trim(),
        child_id: childId,
        family_id: familyId,
        parent_id: familyId,
        status: 'pending',
        due_date: newTaskDue ? new Date(newTaskDue).toISOString() : null,
        recurrence_type: newTaskRecurrence,
        linked_program_id: activeActivityId,
        category: 'homework',
        priority: 'medium',
        created_at: new Date().toISOString(),
        created_ts: serverTimestamp()
      });
      setNewTaskTitle('');
      setNewTaskDue('');
      setNewTaskRecurrence('none');
      setShowTaskForm(false);
      await refreshEvents();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setTaskCreating(false);
    }
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    if (!childId || !newExamSubject.trim() || !activeActivityId) return;
    setExamCreating(true);
    try {
      await addDoc(collection(db, 'exams'), {
        subject: newExamSubject.trim(),
        subject_id: newExamSubjectId,
        child_id: childId,
        family_id: familyId,
        parent_id: familyId,
        exam_date: newExamDate ? new Date(newExamDate).toISOString() : new Date().toISOString(),
        marks_scored: newExamMarks === '' ? null : newExamMarks,
        total_marks: newExamTotalMarks === '' ? null : newExamTotalMarks,
        status: newExamMarks !== '' ? 'result_published' : 'scheduled',
        linked_program_id: activeActivityId,
        created_at: new Date().toISOString(),
        created_ts: serverTimestamp()
      });
      setNewExamSubject('');
      setNewExamSubjectId('');
      setNewExamDate('');
      setNewExamMarks('');
      setNewExamTotalMarks('');
      setShowExamForm(false);
      await refreshEvents();
    } catch (err) {
      console.error('Failed to create exam:', err);
    } finally {
      setExamCreating(false);
    }
  }

  async function handleCreateChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!childId || !newChallengeTitle.trim() || !activeActivityId) return;
    setChallengeCreating(true);
    try {
      await createChallenge(newChallengeTitle.trim(), familyId, newChallengeTarget);
      setNewChallengeTitle('');
      setNewChallengeTarget(5);
      setShowChallengeForm(false);
    } catch (err) {
      console.error('Failed to create challenge:', err);
    } finally {
      setChallengeCreating(false);
    }
  }

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    setSubjectCreating(true);
    try {
      await addNewSubject(newSubjectName, familyId, newSubjectTeacher, newSubjectIncludeInExam);
      setNewSubjectName('');
      setNewSubjectTeacher('');
      setNewSubjectIncludeInExam(true);
      setShowSubjectForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubjectCreating(false);
    }
  };


  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!childId || !newEventTitle.trim() || !activeActivityId) return;
    setEventCreating(true);
    try {
      await addDoc(collection(db, 'events'), {
        title: newEventTitle.trim(),
        child_id: childId,
        family_id: familyId,
        date: newEventDate ? new Date(newEventDate).toISOString() : new Date().toISOString(),
        reminder_days_before: 1,
        recurrence_type: newEventRecurrence,
        linked_program_id: activeActivityId,
        created_at: new Date().toISOString()
      });
      setNewEventTitle('');
      setNewEventDate('');
      setNewEventRecurrence('none');
      setShowEventForm(false);
      await refreshEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
    } finally {
      setEventCreating(false);
    }
  }

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
    const category = String(arg.event.extendedProps.category || 'event');
    
    return (
      <div className="flex h-full w-full flex-col justify-center overflow-hidden rounded-lg px-2 py-1 transition-all duration-300 hover:brightness-110">
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div className="h-1 w-1 shrink-0 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
          <span className="truncate text-[10px] font-black tracking-tight text-white">{arg.event.title}</span>
        </div>
        <div className="mt-0.5 truncate text-[7px] font-black uppercase tracking-[0.1em] text-white/50">
          {categoryLabel(category)}
        </div>
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

  const filterOptions = useMemo(() => {
    const defaultOptions = [{ id: 'all', label: 'All' }];
    const programOptions = programs.map((program) => ({
      id: program.id,
      label: program.name?.trim() || 'Activity'
    }));
    return [...defaultOptions, ...programOptions];
  }, [programs]);

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
    <div className="mx-auto mt-4 max-w-[1680px] space-y-6 pb-24 px-4">
      {/* Header & Top Navigation */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-800/40 p-1 backdrop-blur-xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-50" />
        <div className="relative flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-10 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-400">System Node: Planner</p>
            </div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
              Child <span className="bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent text-shadow-glow">Intelligence</span>
            </h1>
            <p className="mt-1 text-xs font-bold text-white/70 tracking-wide">Syncing parent directives and academic protocols.</p>
          </div>

          <nav className="flex flex-wrap gap-1.5 rounded-3xl bg-black/20 p-1.5 backdrop-blur-md border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`relative flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold transition-all duration-300 ${
                activeTab === 'calendar'
                  ? 'bg-white text-slate-900 shadow-[0_8px_20px_rgba(255,255,255,0.15)] scale-[1.02]'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              Main Planner
            </button>
            {activityTabs.map((activity) => (
              <button
                key={activity.id}
                type="button"
                onClick={() => setActiveTab(`activity_${activity.id}` as ChildPlannerTab)}
                className={`relative flex items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold transition-all duration-300 ${
                  activeTab === `activity_${activity.id}`
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-[0_8px_20px_rgba(34,211,238,0.25)] scale-[1.02]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-sm opacity-90">{programs.find(p => p.id === activity.id)?.icon || '📅'}</span>
                {activity.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <PlannerConflictBanner conflictCount={insights.conflicts.length} />

      {activeTab === 'calendar' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Sidebar: Advanced Filters */}
          <aside className="lg:col-span-3 space-y-4">
            <section className="rounded-[2rem] border border-white/10 bg-slate-800/80 p-6 backdrop-blur-xl shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Filters</h3>
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              </div>
              
              <div className="space-y-2.5">
                {filterOptions.map((option) => {
                  const active = activeCategoryFilters.includes(option.id) || (option.id === 'all' && activeCategoryFilters.includes('all'));
                  const program = programs.find(p => p.id === option.id);
                  const color = program?.color || (option.id === 'all' ? '#22d3ee' : '#94a3b8');
                  
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleFilter(option.id)}
                      className={`group relative w-full flex items-center justify-between overflow-hidden rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
                        active 
                          ? 'border-white/20 bg-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.2)]' 
                          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${active ? 'ring-4' : ''}`} 
                          style={{ 
                            backgroundColor: color, 
                            boxShadow: active ? `0 0 12px ${color}` : 'none'
                          }} 
                        />
                        <span className={`text-sm font-bold transition-colors ${active ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
                          {option.label}
                        </span>
                      </div>
                      {active && (
                        <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-400 to-blue-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Protocol Status</p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-400/80">Active Ingestion</span>
                </div>
              </div>
            </section>
          </aside>

          {/* Main Content: Calendar */}
          <section className="lg:col-span-9 rounded-[2.5rem] border border-white/10 bg-slate-800/50 p-4 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            
            
            {loading ? (
              <div className="flex h-[400px] items-center justify-center">
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                </div>
              </div>
            ) : null}

            <div className={`transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'} [&_.fc]:font-sans [&_.fc]:text-white [&_.fc-theme-standard_td]:border-white/5 [&_.fc-theme-standard_th]:border-white/5 [&_.fc-theme-standard_th]:!bg-black/20 [&_.fc-col-header-cell]:!py-3 [&_.fc-col-header-cell-cushion]:text-[10px] [&_.fc-col-header-cell-cushion]:font-black [&_.fc-col-header-cell-cushion]:uppercase [&_.fc-col-header-cell-cushion]:tracking-widest [&_.fc-col-header-cell-cushion]:!text-white/40 [&_.fc-toolbar-title]:text-xl [&_.fc-toolbar-title]:font-black [&_.fc-toolbar-title]:tracking-tight [&_.fc-button]:!bg-white/[0.05] [&_.fc-button]:!border-white/10 [&_.fc-button]:!text-white [&_.fc-button]:!px-4 [&_.fc-button]:!py-2 [&_.fc-button]:!text-xs [&_.fc-button]:!font-bold [&_.fc-button]:!rounded-xl [&_.fc-button:hover]:!bg-white/[0.1] [&_.fc-button-active]:!bg-white !important [&_.fc-button-active]:!text-slate-900 !important [&_.fc-day-today]:!bg-cyan-400/[0.03] [&_.fc-daygrid-day-number]:text-xs [&_.fc-daygrid-day-number]:font-bold [&_.fc-daygrid-day-number]:opacity-40 [&_.fc-daygrid-event]:!rounded-xl [&_.fc-daygrid-event]:!p-1 [&_.fc-daygrid-event]:!border-0`}>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{ left: 'prev today next', center: 'title', right: 'dayGridMonth,timeGridWeek,listYear' }}
                buttonText={{ dayGridMonth: 'Month', timeGridWeek: 'Week', listYear: 'Agenda', today: 'Today' }}
                events={calendarEvents}
                height="auto"
                dayMaxEvents={3}
                eventContent={eventContent}
                eventClick={onEventClick}
              />
            </div>
          </section>
        </div>
      ) : null}

      {activeTab !== 'calendar' ? (
        <section className="space-y-6">
          {/* Sub-Navigation for Activity Modules */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-black tracking-tight text-white">{activeActivityLabel}</h2>
              <p className="mt-1 text-sm font-medium text-white/50">Accessing specialized modules for this program.</p>
            </div>
            
            <nav className="flex flex-wrap gap-2 rounded-2xl bg-white/[0.03] p-1.5 border border-white/5 backdrop-blur-md">
              {activeActivityModules.map((moduleId: PlannerActivityModule) => (
                <button
                  key={moduleId}
                  type="button"
                  onClick={() => setActivitySubTab(moduleId)}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                    activitySubTab === moduleId
                      ? 'bg-white text-slate-900 shadow-xl scale-[1.05]'
                      : 'text-white/40 hover:bg-white/5 hover:text-white/70'
                  }`}
                >
                  {moduleId === 'tasks' ? 'Tasks' : moduleId === 'exams' ? 'Exams' : moduleId === 'timetable' ? 'Timetable' : moduleId === 'challenges' ? 'Challenges' : moduleId === 'subjects' ? 'Subjects' : 'Events'}
                </button>
              ))}
            </nav>
          </div>

          <div className="relative rounded-[2.5rem] border border-white/10 bg-slate-800/50 p-8 backdrop-blur-xl shadow-2xl overflow-hidden min-h-[400px]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            
            {activitySubTab === 'tasks' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Program Tasks</h3>
                    <p className="text-xs text-white/40">Manage your workload for this activity.</p>
                  </div>
                  <button 
                    onClick={() => setShowTaskForm(!showTaskForm)}
                    className="rounded-full bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 hover:bg-cyan-400/20 transition-all"
                  >
                    {showTaskForm ? 'Cancel' : '+ New Task'}
                  </button>
                </div>

                {showTaskForm && (
                  <form onSubmit={handleCreateTask} className="mb-8 rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input 
                        required
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="What needs to be done?"
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-cyan-500/50"
                      />
                      <input 
                        type="datetime-local"
                        value={newTaskDue}
                        onChange={(e) => setNewTaskDue(e.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-cyan-500/50"
                      />
                      <select 
                        value={newTaskRecurrence}
                        onChange={(e) => setNewTaskRecurrence(e.target.value as any)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-cyan-500/50"
                      >
                        <option value="none" className="bg-slate-900">One Time</option>
                        <option value="daily" className="bg-slate-900">Daily</option>
                        <option value="weekly" className="bg-slate-900">Weekly</option>
                        <option value="monthly" className="bg-slate-900">Monthly</option>
                      </select>
                    </div>
                    <button 
                      type="submit" 
                      disabled={taskCreating}
                      className="mt-4 w-full rounded-2xl bg-cyan-400 py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-cyan-400/20 disabled:opacity-50"
                    >
                      {taskCreating ? 'Creating...' : 'Initialize Task Protocol'}
                    </button>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleEvents.filter(e => e.linkedProgramId === activeActivityId || (isSchoolActivity && ['school', 'homework'].includes(e.category))).length ? 
                    visibleEvents.filter(e => e.linkedProgramId === activeActivityId || (isSchoolActivity && ['school', 'homework'].includes(e.category))).map((event) => (
                    <div key={event.id} className="group flex items-center justify-between gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:bg-white/[0.05] hover:border-white/10">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-xl group-hover:scale-110 transition-transform">
                          {event.category === 'homework' ? '📝' : '⚡'}
                        </div>
                        <div>
                          <p className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">{event.title}</p>
                          <p className="text-xs font-medium text-white/40">{new Date(event.startAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center">
                      <p className="text-lg font-medium text-white/20">No tasks currently assigned to this protocol.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activitySubTab === 'exams' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Academic Assessments</h3>
                    <p className="text-xs text-white/40">Track your performance and upcoming tests.</p>
                  </div>
                  <button 
                    onClick={() => setShowExamForm(!showExamForm)}
                    className="rounded-full bg-rose-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 hover:bg-rose-400/20 transition-all"
                  >
                    {showExamForm ? 'Cancel' : '+ New Exam'}
                  </button>
                </div>

                {showExamForm && (
                  <form onSubmit={handleCreateExam} className="mb-8 rounded-3xl border border-rose-400/20 bg-rose-400/5 p-6 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <select 
                        required
                        value={newExamSubjectId}
                        onChange={(e) => {
                          setNewExamSubjectId(e.target.value);
                          setNewExamSubject(subjects.find(s => s.id === e.target.value)?.name || '');
                        }}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-rose-500/50"
                      >
                        <option value="" className="bg-slate-900">Select Subject</option>
                        {subjects.filter(s => s.includeInExams).map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>)}
                        {subjects.filter(s => s.includeInExams).length === 0 && (
                          <option value="" disabled className="bg-slate-900">No subjects with "Exam" enabled</option>
                        )}
                      </select>
                      <input 
                        type="datetime-local"
                        value={newExamDate}
                        onChange={(e) => setNewExamDate(e.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-rose-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-3">
                        <span className="text-xs font-bold text-white/40 uppercase">Marks Scored</span>
                        <input 
                          type="number"
                          value={newExamMarks}
                          onChange={(e) => setNewExamMarks(e.target.value ? Number(e.target.value) : '')}
                          placeholder="Optional"
                          className="w-full bg-transparent text-sm font-bold text-white outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-3">
                        <span className="text-xs font-bold text-white/40 uppercase">Total Marks</span>
                        <input 
                          type="number"
                          value={newExamTotalMarks}
                          onChange={(e) => setNewExamTotalMarks(e.target.value ? Number(e.target.value) : '')}
                          placeholder="Optional"
                          className="w-full bg-transparent text-sm font-bold text-white outline-none"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={examCreating}
                      className="mt-4 w-full rounded-2xl bg-rose-400 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-rose-400/20 disabled:opacity-50"
                    >
                      {examCreating ? 'Scheduling...' : 'Record Exam Protocol'}
                    </button>
                  </form>
                )}

                <div className="space-y-3">
                  {(isSchoolActivity ? schoolExamItems : visibleEvents.filter((event) => event.category === 'exam')).length ? 
                    (isSchoolActivity ? schoolExamItems : visibleEvents.filter((event) => event.category === 'exam')).map((event) => (
                    <div key={event.id} className="flex items-center justify-between rounded-3xl border border-rose-500/20 bg-rose-500/5 p-6 backdrop-blur-md">
                      <div className="flex items-center gap-5">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-2xl">🎓</div>
                        <div>
                          <p className="text-lg font-black text-white tracking-tight">{event.title}</p>
                          <p className="text-sm font-semibold text-rose-400/80">{new Date(event.startAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <button className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all">Details</button>
                    </div>
                  )) : (
                    <div className="py-20 text-center">
                      <p className="text-lg font-medium text-white/20">No active examinations detected.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activitySubTab === 'timetable' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Class Matrix</h3>
                    <p className="text-sm font-medium text-white/40 italic">Editing: {day} // {period}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 ring-cyan-500/50">
                      {(timetable?.periods || []).map((p) => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                    </select>
                    <select value={day} onChange={(e) => setDay(e.target.value)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 ring-cyan-500/50">
                      {(timetable?.days || []).map((d) => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {subjects.length > 0 ? (
                    <select 
                      value={subject} 
                      onChange={(e) => {
                        const subName = e.target.value;
                        setSubject(subName);
                        const subObj = subjects.find(s => s.name === subName);
                        if (subObj?.teacherName) setTeacher(subObj.teacherName);
                      }} 
                      className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white focus:bg-white/10 transition-all outline-none"
                    >
                      <option value="" className="bg-slate-900">Select Subject</option>
                      {subjects.map(s => <option key={s.id} value={s.name} className="bg-slate-900">{s.name}</option>)}
                    </select>
                  ) : (
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Core Subject" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white placeholder:text-white/20 focus:bg-white/10 transition-all outline-none" />
                  )}
                  <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Facility/Room" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white placeholder:text-white/20 focus:bg-white/10 transition-all outline-none" />
                  <input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Lead Instructor" className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white placeholder:text-white/20 focus:bg-white/10 transition-all outline-none" />
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    type="button" 
                    onClick={() => void saveSchoolCell()} 
                    disabled={savingCell} 
                    className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {savingCell ? 'Updating Matrix...' : 'Commit Changes to Timetable'}
                  </button>
                </div>

                {schoolError && (
                  <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-bold text-rose-400 animate-bounce">
                    ⚠️ {schoolError}
                  </div>
                )}

                <div className="rounded-[2rem] border border-white/5 bg-black/20 p-4 overflow-x-auto custom-scrollbar">
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
                  ) : (
                    <div className="py-20 text-center text-white/20 font-black uppercase tracking-widest">Timetable Data Null</div>
                  )}
                </div>
              </div>
            )}

            {activitySubTab === 'subjects' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Subject Mastery</h3>
                    <p className="text-xs text-white/40">Define the core subjects for this program.</p>
                  </div>
                  <button 
                    onClick={() => setShowSubjectForm(!showSubjectForm)}
                    className="rounded-full bg-indigo-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:bg-indigo-400/20 transition-all"
                  >
                    {showSubjectForm ? 'Cancel' : '+ New Subject'}
                  </button>
                </div>

                {showSubjectForm && (
                  <form onSubmit={handleCreateSubject} className="mb-8 rounded-3xl border border-indigo-400/20 bg-indigo-400/5 p-6 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <input 
                        required
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        placeholder="Subject Name (e.g. Mathematics)"
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-indigo-500/50"
                      />
                      <input 
                        value={newSubjectTeacher}
                        onChange={(e) => setNewSubjectTeacher(e.target.value)}
                        placeholder="Teacher Name (optional)"
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-indigo-500/50"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className={`flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${newSubjectIncludeInExam ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                          <input 
                            type="checkbox"
                            className="hidden"
                            checked={newSubjectIncludeInExam}
                            onChange={(e) => setNewSubjectIncludeInExam(e.target.checked)}
                          />
                          <div className={`h-4 w-4 rounded-full bg-white transition-transform duration-300 ${newSubjectIncludeInExam ? 'translate-x-6' : 'translate-x-1'}`} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-white/60 group-hover:text-white transition-colors">Include in Exam List</span>
                      </label>
                      <button 
                        type="submit" 
                        disabled={subjectCreating}
                        className="rounded-2xl bg-indigo-400 px-8 py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-indigo-400/20 disabled:opacity-50"
                      >
                        {subjectCreating ? 'Adding Subject...' : 'Record Subject Protocol'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {subjects.length ? subjects.map((sub) => (
                    <div key={sub.id} className="relative group overflow-hidden flex items-center gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:bg-white/[0.05]">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative z-10 h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl shadow-inner">📚</div>
                      <div className="relative z-10 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-white truncate">{sub.name}</p>
                          {sub.includeInExams && (
                            <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]" title="Included in Exams" />
                          )}
                        </div>
                        <p className="text-[11px] font-bold text-indigo-300/60 uppercase tracking-wider truncate">{sub.teacherName || 'Independent Study'}</p>
                        <p className="text-[9px] text-white/20 font-black uppercase tracking-[0.15em] mt-1">Matrix Ref: {sub.id.slice(-6)}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center text-white/20 font-medium">No subjects registered in this protocol.</div>
                  )}
                </div>
              </div>
            )}
            {activitySubTab === 'challenges' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Parent VS Child</h3>
                    <p className="text-xs text-white/40">Challenge your parent and win stars!</p>
                  </div>
                  <button 
                    onClick={() => setShowChallengeForm(!showChallengeForm)}
                    className="rounded-full bg-amber-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 hover:bg-amber-400/20 transition-all"
                  >
                    {showChallengeForm ? 'Cancel' : '+ New Challenge'}
                  </button>
                </div>

                {showChallengeForm && (
                  <form onSubmit={handleCreateChallenge} className="mb-8 rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input 
                        required
                        value={newChallengeTitle}
                        onChange={(e) => setNewChallengeTitle(e.target.value)}
                        placeholder="Challenge title (e.g. Read 5 books)"
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-amber-500/50"
                      />
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-3">
                        <span className="text-xs font-bold text-white/40 uppercase">Target Score</span>
                        <input 
                          type="number"
                          value={newChallengeTarget}
                          onChange={(e) => setNewChallengeTarget(Number(e.target.value))}
                          className="w-full bg-transparent text-sm font-bold text-white outline-none"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={challengeCreating}
                      className="mt-4 w-full rounded-2xl bg-amber-400 py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-amber-400/20 disabled:opacity-50"
                    >
                      {challengeCreating ? 'Transmitting...' : 'Issue Challenge'}
                    </button>
                  </form>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {challenges.length ? challenges.map((ch) => (
                    <div key={ch.id} className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md">
                      <div className="absolute top-0 right-0 p-4 opacity-5">
                        <div className="text-4xl">⚔️</div>
                      </div>
                      <div className="mb-4">
                        <h4 className="text-lg font-black text-white">{ch.title}</h4>
                        <p className="text-xs font-medium text-white/40 uppercase tracking-widest">{ch.status}</p>
                      </div>

                      <div className="mb-6 grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-black/20 p-4 text-center border border-white/5">
                          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Your Score</p>
                          <p className="text-2xl font-black text-cyan-400">{ch.child_score}</p>
                          <button 
                            onClick={() => void incrementScore(ch.id, 'child')}
                            disabled={ch.status === 'completed'}
                            className="mt-2 w-full rounded-xl bg-cyan-400/20 py-1.5 text-[10px] font-black uppercase text-cyan-400 hover:bg-cyan-400 hover:text-slate-900 transition-all disabled:opacity-30"
                          >
                            + Score
                          </button>
                        </div>
                        <div className="rounded-2xl bg-black/20 p-4 text-center border border-white/5">
                          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Parent Score</p>
                          <p className="text-2xl font-black text-rose-400">{ch.parent_score}</p>
                          <div className="mt-2 h-7" />
                        </div>
                      </div>

                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/5">
                        <div 
                          className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000"
                          style={{ width: `${Math.min(100, (ch.child_score / ch.target_score) * 100)}%` }}
                        />
                        <div 
                          className="absolute right-0 top-0 h-full bg-gradient-to-l from-rose-400 to-pink-500 transition-all duration-1000 opacity-50"
                          style={{ width: `${Math.min(100, (ch.parent_score / ch.target_score) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] font-bold text-white/20 uppercase tracking-tighter">
                        <span>Initiated</span>
                        <span>Target: {ch.target_score}</span>
                        <span>Parent</span>
                      </div>

                      {ch.status === 'completed' && (
                        <div className="mt-4 rounded-xl bg-emerald-400/10 p-3 text-center border border-emerald-400/20">
                          <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">
                            Winner: {ch.winner === 'child' ? 'YOU! 🎉' : 'Parent 🏠'}
                          </p>
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center flex flex-col items-center">
                      <div className="mb-4 h-16 w-16 rounded-full bg-white/5 flex items-center justify-center text-3xl">🛡️</div>
                      <p className="text-lg font-medium text-white/20">No active challenges in this sector.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activitySubTab === 'events' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Program Events</h3>
                    <p className="text-xs text-white/40">Scheduled sessions and specialized protocols.</p>
                  </div>
                  <button 
                    onClick={() => setShowEventForm(!showEventForm)}
                    className="rounded-full bg-purple-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 hover:bg-purple-400/20 transition-all"
                  >
                    {showEventForm ? 'Cancel' : '+ New Event'}
                  </button>
                </div>

                {showEventForm && (
                  <form onSubmit={handleCreateEvent} className="mb-8 rounded-3xl border border-purple-400/20 bg-purple-400/5 p-6 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input 
                        required
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                        placeholder="Event Title"
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-purple-500/50"
                      />
                      <input 
                        type="datetime-local"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-purple-500/50"
                      />
                      <select 
                        value={newEventRecurrence}
                        onChange={(e) => setNewEventRecurrence(e.target.value as any)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-purple-500/50"
                      >
                        <option value="none" className="bg-slate-900">One Time</option>
                        <option value="daily" className="bg-slate-900">Daily</option>
                        <option value="weekly" className="bg-slate-900">Weekly</option>
                        <option value="monthly" className="bg-slate-900">Monthly</option>
                      </select>
                    </div>
                    <button 
                      type="submit" 
                      disabled={eventCreating}
                      className="mt-4 w-full rounded-2xl bg-purple-400 py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-purple-400/20 disabled:opacity-50"
                    >
                      {eventCreating ? 'Transmitting...' : 'Record Event Protocol'}
                    </button>
                  </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleEvents.filter(e => e.linkedProgramId === activeActivityId && e.category !== 'homework' && e.category !== 'exam').length ? 
                    visibleEvents.filter(e => e.linkedProgramId === activeActivityId && e.category !== 'homework' && e.category !== 'exam').map((event) => (
                    <div key={event.id} className="flex items-center gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl">📅</div>
                      <div>
                        <p className="text-base font-bold text-white">{event.title}</p>
                        <p className="text-xs font-medium text-white/40">{new Date(event.startAt).toLocaleString()}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-20 text-center text-white/20 font-medium">No specialized events found.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {selectedEvent ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setSelectedEvent(null)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900 p-1 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="rounded-[2.25rem] bg-gradient-to-br from-slate-800 to-slate-950 p-6">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <span className="inline-block rounded-full bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Event Decoded</span>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-white">{selectedEvent.title}</h3>
                </div>
                <button type="button" onClick={() => setSelectedEvent(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Classification</p>
                  <p className="text-sm font-black text-cyan-300 uppercase tracking-tight">{selectedEvent.category}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Start Time</p>
                    <p className="text-xs font-bold text-white/80">{selectedEvent.start}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">End Time</p>
                    <p className="text-xs font-bold text-white/80">{selectedEvent.end}</p>
                  </div>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setSelectedEvent(null)}
                className="mt-8 w-full rounded-2xl bg-white py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-900 shadow-xl transition-all hover:scale-[1.02] active:scale-95"
              >
                Terminate Signal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
