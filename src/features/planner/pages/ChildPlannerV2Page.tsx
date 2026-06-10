import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { addDoc, collection, query, serverTimestamp, where, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import type { EventClickArg, EventContentArg, EventInput } from '@fullcalendar/core';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../config/firebase';
import { saveSchoolTimetableConfig } from '../services/planner.firestore';
import { DEFAULT_KIDS_TIMETABLE } from '../constants/planner.mock';
import { useChildProofs, useQuestActions } from '../../../hooks/useData';
import { usePlannerEvents } from '../hooks/usePlannerEvents';
import { usePlannerPrograms } from '../hooks/usePlannerPrograms';
import { usePlannerTimetable } from '../hooks/usePlannerTimetable';
import { usePlannerInsights } from '../hooks/usePlannerInsights';
import { usePlannerChallenges } from '../hooks/usePlannerChallenges';
import { usePlannerSubjects } from '../hooks/usePlannerSubjects';
import { buildGeneratedTimetableSlots, buildTimetableSubjectMonthlyInsights, getTimetableClassPeriods } from '../utils/planner.timetable';
import { PlannerConflictBanner } from '../components/shared/PlannerConflictBanner';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import type { PlannerActivityModule, PlannerEvent } from '../types/planner.types';
import { expandRecurringEventForRange, formatPlannerRecurrence, getNextPlannerOccurrence, getPlannerExpiryStatus } from '../utils/planner.recurrence';

type ChildPlannerTab = 'calendar' | `activity_${string}`;
type ActivitySubTab = PlannerActivityModule;
type ActivityStatusPeriod = 'month';

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

function categoryLabel(category: string) {
  return category.replace('_', ' ');
}

function getPlannerEventTime(event: PlannerEvent, field: 'startAt' | 'endAt' = 'startAt') {
  const value = field === 'startAt' ? event.startAt : event.endAt;
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortPlannerEventsByStart(events: PlannerEvent[], direction: 'asc' | 'desc' = 'asc') {
  return [...events].sort((a, b) => {
    const diff = getPlannerEventTime(a) - getPlannerEventTime(b);
    return direction === 'asc' ? diff : -diff;
  });
}

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

function sanitizeDayLabel(label: string) {
  return label.trim().slice(0, 16);
}

function toNonNegativeInteger(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : fallback;
}

function expandPlannerEventsAsOccurrences(
  events: PlannerEvent[],
  rangeStart: Date,
  rangeEnd: Date
): PlannerEvent[] {
  return events.flatMap((event) =>
    expandRecurringEventForRange(event, rangeStart.toISOString(), rangeEnd.toISOString()).map((instance) => ({
      ...event,
      id: instance.instanceId,
      startAt: instance.startAt,
      endAt: instance.endAt
    }))
  );
}

export default function ChildPlannerV2Page() {
  const { user } = useAuth();
  const childId = user?.id || '';
  const familyId = user?.linked_family_id || user?.id || '';
  const [activeTab, setActiveTab] = useState<ChildPlannerTab>('calendar');
  const [activitySubTab, setActivitySubTab] = useState<ActivitySubTab>('tasks');
  const [savingCell, setSavingCell] = useState(false);
  const [schoolError, setSchoolError] = useState('');
  const [showTimetableConfig, setShowTimetableConfig] = useState(false);
  const [timetableDaysDraft, setTimetableDaysDraft] = useState<string[]>(DEFAULT_KIDS_TIMETABLE.days);
  const [timetableDayPeriodCountsDraft, setTimetableDayPeriodCountsDraft] = useState<Record<string, number>>(DEFAULT_KIDS_TIMETABLE.dayPeriodCounts || {});
  const [periodDurationDraft, setPeriodDurationDraft] = useState(40);
  const [newTimetableDay, setNewTimetableDay] = useState('');
  const [savingTimetableConfig, setSavingTimetableConfig] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PlannerEvent | null>(null);
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<string[]>(['all']);
  const [activityStatusPeriod] = useState<ActivityStatusPeriod>('month');
  const [activityPeriodAnchor, setActivityPeriodAnchor] = useState(() => startOfMonth(new Date()));

  const { events, loading, refresh: refreshEvents } = usePlannerEvents(childId, undefined, false);
  const { programs } = usePlannerPrograms(childId);
  const { timetable, refresh: refreshTimetable } = usePlannerTimetable(childId, false);
  const editableTimetable = timetable || DEFAULT_KIDS_TIMETABLE;
  const editablePeriods = useMemo(() => getTimetableClassPeriods(editableTimetable), [editableTimetable]);
  const timetableMaxPeriods = useMemo(() => {
    const counts = Object.values(editableTimetable.dayPeriodCounts || {});
    return Math.max(1, ...counts, editablePeriods.length || 1);
  }, [editablePeriods.length, editableTimetable.dayPeriodCounts]);
  const insights = usePlannerInsights(events);

  const activeActivityId = activeTab.startsWith('activity_') ? activeTab.replace('activity_', '') : '';

  const activityTabs = useMemo<Array<{ id: string; label: string; modules: PlannerActivityModule[]; program: typeof programs[0] }>>(() => {
    return programs
      .map((program) => ({
        id: program.id,
        label: program.name?.trim() || 'Activity',
        modules: (program.modules && program.modules.length ? program.modules : ['tasks']) as PlannerActivityModule[],
        program
      }))
      .filter((program, index, arr) => arr.findIndex((x) => x.label.toLowerCase() === program.label.toLowerCase()) === index);
  }, [programs]);

  const activityColorById = useMemo(() => {
    const colorMap = new Map<string, string>();
    activityTabs.forEach((activity, index) => {
      colorMap.set(activity.id, ACTIVITY_PALETTE[index % ACTIVITY_PALETTE.length]);
    });
    return colorMap;
  }, [activityTabs]);

  const resolveEventColor = (event: PlannerEvent) => {
    if (event.linkedProgramId && activityColorById.has(event.linkedProgramId)) {
      return activityColorById.get(event.linkedProgramId)!;
    }
    if (event.category === 'exam') return '#fb7185';
    if (event.category === 'homework') return '#f59e0b';
    if (event.category === 'personal') return '#a78bfa';
    return event.color || '#94a3b8';
  };

  const activeActivity = activityTabs.find((tab) => tab.id === activeActivityId);
  const activeProgram = activeActivity?.program || null;
  const activityPointsConfig = activeProgram?.pointsConfig || null;
  const activeActivityLabel = activeActivity?.label || '';
  const activeActivityModules: PlannerActivityModule[] = activeActivity?.modules || ['tasks'];
  const isSchoolActivity = activeActivityLabel.toLowerCase() === 'school' || activeActivityId === 'school';
  const activityPeriodRange = useMemo(() => {
    if (activityStatusPeriod === 'month') {
      return {
        start: startOfMonth(activityPeriodAnchor),
        end: endOfMonth(activityPeriodAnchor),
        label: formatMonthYear(activityPeriodAnchor)
      };
    }

    return {
      start: startOfMonth(activityPeriodAnchor),
      end: endOfMonth(activityPeriodAnchor),
      label: formatMonthYear(activityPeriodAnchor)
    };
  }, [activityPeriodAnchor, activityStatusPeriod]);
  const monthlySubjectHours = useMemo(
    () => buildTimetableSubjectMonthlyInsights(editableTimetable, activityPeriodAnchor),
    [editableTimetable, activityPeriodAnchor]
  );
  const { challenges, createChallenge, incrementScore } = usePlannerChallenges(childId, activeActivityId, activityPointsConfig?.challengePoints);
  const { subjects, addSubject: addNewSubject, removeSubject, updateSubject } = usePlannerSubjects(childId, activeActivityId);
  const subjectHoursByName = useMemo(() => {
    return new Map(monthlySubjectHours.map((item) => [item.subject.toLowerCase(), item]));
  }, [monthlySubjectHours]);
  const subjectsByTimetableHours = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const aMinutes = subjectHoursByName.get(a.name.toLowerCase())?.minutes || 0;
      const bMinutes = subjectHoursByName.get(b.name.toLowerCase())?.minutes || 0;
      return bMinutes - aMinutes || a.name.localeCompare(b.name);
    });
  }, [subjectHoursByName, subjects]);

  // New Form States
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskExpiresAt, setNewTaskExpiresAt] = useState('');
  const [newTaskMandatory, setNewTaskMandatory] = useState(false);
  const [newTaskRecurrence, setNewTaskRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [newTaskSubjectId, setNewTaskSubjectId] = useState('');
  const [taskCreating, setTaskCreating] = useState(false);

  const [showExamForm, setShowExamForm] = useState(false);
  const [newExamSubjects, setNewExamSubjects] = useState<string[]>([]);
  const [newExamSubjectIds, setNewExamSubjectIds] = useState<string[]>([]);
  const [newExamDate, setNewExamDate] = useState('');
  const [newExamMarks, setNewExamMarks] = useState<number | ''>('');
  const [newExamTotalMarks, setNewExamTotalMarks] = useState<number | ''>('');
  const [newExamPointsAllocated, setNewExamPointsAllocated] = useState<number | ''>('');
  const [examCreating, setExamCreating] = useState(false);

  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [newChallengeTitle, setNewChallengeTitle] = useState('');
  const [newChallengeTarget, setNewChallengeTarget] = useState(5);
  const [challengeCreating, setChallengeCreating] = useState(false);

  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectTeacher, setNewSubjectTeacher] = useState('');
  const [newSubjectIncludeInExam, setNewSubjectIncludeInExam] = useState(true);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectCreating, setSubjectCreating] = useState(false);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  const [showEventForm, setShowEventForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventRecurrence, setNewEventRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [eventCreating, setEventCreating] = useState(false);

  const allEvents = useMemo(() => [...events], [events]);

  const [selectedExamDetail, setSelectedExamDetail] = useState<PlannerEvent | null>(null);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<PlannerEvent | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNotes, setProofNotes] = useState('');
  const [newExamRecurrence, setNewExamRecurrence] = useState<'none' | 'daily' | 'weekly'>('none');
  const [newExamRecurrenceDays, setNewExamRecurrenceDays] = useState<number[]>([]);
  
  const { uploadProof, uploading } = useChildProofs(childId);
  const { completeTask, markTaskPendingProof, saving: questSaving } = useQuestActions(childId);

  useEffect(() => {
    setNewTaskSubjectId('');
    setNewExamSubjects([]);
    setNewExamSubjectIds([]);
  }, [activeActivityId]);

  // 30-Minute approaching task/exam reminders
  const [triggeredReminders, setTriggeredReminders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Ask notification permission if default
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      const now = new Date().getTime();
      
      events.forEach((event) => {
        if (triggeredReminders.has(event.id)) return;

        const eventTime = new Date(event.startAt).getTime();
        const diffMinutes = (eventTime - now) / (1000 * 60);

        // Check if starting in the next 30 minutes (between 1 and 30 mins)
        if (diffMinutes > 0 && diffMinutes <= 30) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('TikTrack Approaching Alert ⏰', {
              body: `Your ${event.category === 'exam' ? 'exam' : 'task'} "${event.title}" is starting in 30 minutes!`,
              icon: '/favicon.ico',
            });
            setTriggeredReminders((prev) => {
              const next = new Set(prev);
              next.add(event.id);
              return next;
            });
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [events, triggeredReminders]);




  const visibleEvents = useMemo(() => {
    if (activeTab === 'calendar') return allEvents;
    if (!activeActivityId) return allEvents;
    if (isSchoolActivity) {
      return allEvents.filter((event) => (
        event.linkedProgramId === activeActivityId ||
        (!event.linkedProgramId && ['school', 'homework', 'exam', 'tuition'].includes(event.category))
      ));
    }
    return allEvents.filter((event) => event.linkedProgramId === activeActivityId);
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

  const calendarEvents = useMemo<EventInput[]>(() => {
    const startRange = new Date();
    startRange.setDate(startRange.getDate() - 30);
    const endRange = new Date();
    endRange.setDate(endRange.getDate() + 90);

    const expanded: EventInput[] = [];
    for (const event of filteredEvents) {
      const instances = expandRecurringEventForRange(
        event,
        startRange.toISOString(),
        endRange.toISOString()
      );
      for (const inst of instances) {
        const program = programs.find(p => p.id === event.linkedProgramId);
        const resolvedColor = resolveEventColor(event);

        expanded.push({
          id: inst.instanceId,
          title: inst.title,
          start: inst.startAt,
          end: inst.endAt,
          allDay: event.allDay,
          backgroundColor: resolvedColor,
          borderColor: resolvedColor,
          extendedProps: {
            category: inst.category,
            rootEventId: inst.rootEventId,
            eventObj: event,
            programName: program?.name || '',
            programColor: resolvedColor
          }
        });
      }
    }
    return expanded;
  }, [filteredEvents, programs, activityColorById]);

  useEffect(() => {
    if (!activeActivityModules.includes(activitySubTab)) {
      setActivitySubTab(activeActivityModules[0] || 'tasks');
    }
  }, [activeActivityModules, activitySubTab]);

  useEffect(() => {
    setTimetableDaysDraft(editableTimetable.days);
    setTimetableDayPeriodCountsDraft(editableTimetable.dayPeriodCounts || {});
    setPeriodDurationDraft(editableTimetable.slots?.find((slot) => slot.type === 'class')?.durationMinutes || 40);
  }, [editableTimetable]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!childId || !newTaskTitle.trim() || !activeActivityId || !newTaskSubjectId) return;
    if (newTaskMandatory && !newTaskExpiresAt) {
      alert('Please add a complete-before time for a mandatory task.');
      return;
    }
    setTaskCreating(true);
    try {
      const starValue = activityPointsConfig?.taskPoints || 0;
      const availableFrom = newTaskDue ? new Date(newTaskDue).toISOString() : null;
      const expiresAt = newTaskExpiresAt ? new Date(newTaskExpiresAt).toISOString() : null;
      const createdRef = await addDoc(collection(db, 'tasks'), {
        title: newTaskTitle.trim(),
        child_id: childId,
        family_id: familyId,
        parent_id: familyId,
        status: 'pending',
        available_from: availableFrom,
        due_date: availableFrom,
        expires_at: expiresAt,
        end_date: expiresAt || availableFrom,
        recurrence_type: newTaskRecurrence,
        linked_program_id: activeActivityId,
        subject_id: newTaskSubjectId,
        category: 'homework',
        priority: 'medium',
        star_value: starValue,
        points: starValue,
        created_by: 'child',
        approval_status: 'pending',
        is_mandatory: newTaskMandatory,
        missed_action: {
          notify_parent: newTaskMandatory,
          notify_child: true,
          reduce_stars: false,
          star_penalty: 0,
          create_parent_approval: newTaskMandatory,
        },
        created_at: new Date().toISOString(),
        created_ts: serverTimestamp()
      });
      await addDoc(collection(db, 'approvals'), {
        family_id: familyId,
        child_id: childId,
        type: 'task',
        reference_id: createdRef.id,
        title: newTaskTitle.trim(),
        points: 0,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      setNewTaskTitle('');
      setNewTaskDue('');
      setNewTaskExpiresAt('');
      setNewTaskMandatory(false);
      setNewTaskRecurrence('none');
      setNewTaskSubjectId('');
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
    if (!childId || newExamSubjects.length === 0 || !activeActivityId) return;
    const selectedSubjectRows = newExamSubjectIds
      .filter((subjectId) => subjectId !== 'custom')
      .map((subjectId) => subjects.find((subject) => subject.id === subjectId))
      .filter((subject): subject is typeof subjects[number] => Boolean(subject));
    const knownSubjectNames = new Set(subjects.map((subject) => subject.name));
    const customSubjects = newExamSubjectIds.includes('custom')
      ? newExamSubjects.map((subject) => subject.trim()).filter((subject) => subject && !knownSubjectNames.has(subject))
      : [];
    const normalizedSubjects = [
      ...selectedSubjectRows.map((subject) => subject.name),
      ...customSubjects
    ];

    if (selectedSubjectRows.length !== newExamSubjectIds.filter((subjectId) => subjectId !== 'custom').length) return;
    if (normalizedSubjects.length === 0) return;


    if (newExamMarks !== '' && Number(newExamMarks) < 0) { alert('Marks scored cannot be negative.'); return; }
    if (newExamTotalMarks !== '' && Number(newExamTotalMarks) < 0) { alert('Total marks cannot be negative.'); return; }
    if (newExamMarks !== '' && newExamTotalMarks !== '' && Number(newExamMarks) > Number(newExamTotalMarks)) { alert('Marks scored cannot be greater than total marks.'); return; }

    setExamCreating(true);
    try {
      const hasResult = newExamMarks !== '' && newExamTotalMarks !== '';
      const allocatedPoints = activityPointsConfig?.examPoints || null;

      const createdRef = await addDoc(collection(db, 'exams'), {
        subject: normalizedSubjects.join(', '),
        subject_id: newExamSubjectIds.includes('custom') ? '' : selectedSubjectRows.map((subject) => subject.id).join(','),
        child_id: childId,
        family_id: familyId,
        parent_id: familyId,
        exam_date: newExamDate ? new Date(newExamDate).toISOString() : new Date().toISOString(),
        marks_scored: newExamMarks === '' ? null : newExamMarks,
        total_marks: newExamTotalMarks === '' ? null : newExamTotalMarks,
        points_allocated: allocatedPoints,
        points_earned: null,
        status: hasResult ? 'completed_pending_result' : 'scheduled',
        linked_program_id: activeActivityId,
        recurrence_type: newExamRecurrence,
        recurrence_days: newExamRecurrence === 'weekly' ? newExamRecurrenceDays : [],
        created_by: 'child',
        approval_status: 'pending',
        result_published_at: null,
        created_at: new Date().toISOString(),
        created_ts: serverTimestamp()
      });
      await addDoc(collection(db, 'approvals'), {
        family_id: familyId,
        child_id: childId,
        type: 'exam',
        reference_id: createdRef.id,
        title: normalizedSubjects.join(', ') || 'Exam',
        points: 0,
        status: 'pending',
        created_at: new Date().toISOString()
      });
      setNewExamSubjects([]);
      setNewExamSubjectIds([]);
      setNewExamDate('');
      setNewExamMarks('');
      setNewExamTotalMarks('');
      setNewExamRecurrence('none');
      setNewExamRecurrenceDays([]);
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
      if (editingSubjectId) {
        await updateSubject(editingSubjectId, {
          name: newSubjectName.trim(),
          teacherName: newSubjectTeacher,
          includeInExams: newSubjectIncludeInExam
        });
      } else {
        await addNewSubject(newSubjectName, familyId, newSubjectTeacher, newSubjectIncludeInExam);
      }
      setNewSubjectName('');
      setNewSubjectTeacher('');
      setNewSubjectIncludeInExam(true);
      setEditingSubjectId(null);
      setShowSubjectForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubjectCreating(false);
    }
  };

  const resetSubjectForm = () => {
    setNewSubjectName('');
    setNewSubjectTeacher('');
    setNewSubjectIncludeInExam(true);
    setEditingSubjectId(null);
    setShowSubjectForm(false);
  };

  const startEditSubject = (sub: any) => {
    setEditingSubjectId(sub.id);
    setNewSubjectName(sub.name);
    setNewSubjectTeacher(sub.teacherName || '');
    setNewSubjectIncludeInExam(sub.includeInExams ?? true);
    setShowSubjectForm(true);
  };


  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!childId || !newEventTitle.trim() || !activeActivityId) return;
    setEventCreating(true);
    try {
      const eventDateIso = newEventDate ? new Date(newEventDate).toISOString() : new Date().toISOString();
      const eventEndDateIso = newEventDate 
        ? new Date(new Date(newEventDate).getTime() + 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await addDoc(collection(db, 'events'), {
        title: newEventTitle.trim(),
        child_id: childId,
        family_id: familyId,
        date: eventDateIso,
        start_at: eventDateIso,
        end_at: eventEndDateIso,
        reminder_days_before: 1,
        recurrence_type: newEventRecurrence,
        linked_program_id: activeActivityId,
        points_allocated: activityPointsConfig?.eventPoints || null,
        attendance_approved: false,
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

  async function saveTimetableCellSubject(nextPeriod: string, nextDay: string, nextSubjectName: string) {
    setSchoolError('');
    const selectedSubject = subjects.find((item) => item.name === nextSubjectName);
    if (nextSubjectName && !selectedSubject) {
      setSchoolError(subjects.length ? 'Select a subject from the Subjects section' : 'Add subjects in the Subjects section before filling the timetable');
      return;
    }
    if (!childId || !familyId) return;
    setSavingCell(true);

    const nextData = {
      ...editableTimetable.data,
      [nextPeriod]: {
        ...(editableTimetable.data[nextPeriod] || {})
      }
    };

    if (nextSubjectName && selectedSubject) {
      nextData[nextPeriod][nextDay] = {
        subject: selectedSubject.name,
        teacher: selectedSubject.teacherName || '',
        room: editableTimetable.data[nextPeriod]?.[nextDay]?.room || ''
      };
    } else {
      delete nextData[nextPeriod][nextDay];
    }

    try {
      await saveSchoolTimetableConfig(childId, familyId, {
        days: editableTimetable.days,
        slots: editableTimetable.slots || [],
        activeWeeks: editableTimetable.activeWeeks || 4,
        dayPeriodCounts: editableTimetable.dayPeriodCounts || {},
        data: nextData
      });
      await refreshTimetable();
    } catch (error) {
      setSchoolError(error instanceof Error ? error.message : 'Failed to save timetable entry');
    } finally {
      setSavingCell(false);
    }
  }

  function addTimetableDay() {
    const nextDay = sanitizeDayLabel(newTimetableDay);
    if (!nextDay || timetableDaysDraft.some((existingDay) => existingDay.toLowerCase() === nextDay.toLowerCase())) return;
    setTimetableDaysDraft((current) => [...current, nextDay]);
    setTimetableDayPeriodCountsDraft((current) => ({ ...current, [nextDay]: 6 }));
    setNewTimetableDay('');
  }

  function removeTimetableDay(dayToRemove: string) {
    setTimetableDaysDraft((current) => current.filter((draftDay) => draftDay !== dayToRemove));
    setTimetableDayPeriodCountsDraft((current) => {
      const next = { ...current };
      delete next[dayToRemove];
      return next;
    });
  }

  async function saveTimetableConfig() {
    setSchoolError('');
    if (!childId || !familyId) return;

    const nextDays = timetableDaysDraft.map(sanitizeDayLabel).filter(Boolean);
    const nextDayPeriodCounts = Object.fromEntries(
      nextDays.map((draftDay) => [draftDay, toNonNegativeInteger(timetableDayPeriodCountsDraft[draftDay])])
    );
    const maxPeriods = Math.max(1, ...Object.values(nextDayPeriodCounts));
    const nextSlots = buildGeneratedTimetableSlots(maxPeriods, periodDurationDraft);

    if (nextDays.length === 0) {
      setSchoolError('Add at least one timetable day');
      return;
    }
    if (!Object.values(nextDayPeriodCounts).some((count) => count > 0)) {
      setSchoolError('Set at least one period for one day');
      return;
    }

    const daySet = new Set(nextDays);
    const slotSet = new Set(nextSlots.map((slot) => slot.id));
    const nextData = Object.fromEntries(
      Object.entries(editableTimetable.data)
        .filter(([slotId]) => slotSet.has(slotId))
        .map(([slotId, cells]) => [
          slotId,
          Object.fromEntries(Object.entries(cells || {}).filter(([cellDay]) => daySet.has(cellDay)))
        ])
    );

    setSavingTimetableConfig(true);
    try {
      await saveSchoolTimetableConfig(childId, familyId, {
        days: nextDays,
        slots: nextSlots,
        activeWeeks: editableTimetable.activeWeeks || 4,
        dayPeriodCounts: nextDayPeriodCounts,
        data: nextData
      });
      await refreshTimetable();
      setShowTimetableConfig(false);
    } catch (error) {
      setSchoolError(error instanceof Error ? error.message : 'Failed to save timetable configuration');
    } finally {
      setSavingTimetableConfig(false);
    }
  }

  const eventContent = (arg: EventContentArg) => {
    const category = String(arg.event.extendedProps.category || 'event');
    const isPrivate = category === 'personal' || category === 'custom';
    const isExam = category === 'exam';
    const isTask = category === 'homework' || category === 'task';
    const programName = String(arg.event.extendedProps.programName || '');
    const resolvedColor = arg.event.backgroundColor || '#94a3b8';
    
    return (
      <div 
        className="group flex h-full w-full flex-col justify-center overflow-hidden rounded-xl border px-2.5 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${resolvedColor}, ${resolvedColor}cc)`,
          borderColor: `${resolvedColor}99`,
          boxShadow: `0 10px 24px ${resolvedColor}26`
        }}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          {isTask && <span className="text-[10px]">📝</span>}
          {isPrivate && <span className="text-[10px]">🔒</span>}
          {isExam && <span className="text-[10px]">🎓</span>}
          {category === 'event' && <span className="text-[10px]">📅</span>}
          <span className="truncate text-[11px] font-black text-white drop-shadow-sm">{arg.event.title}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-[9px] font-bold uppercase tracking-wide text-white/80">{programName || categoryLabel(category)}</span>
          {!arg.event.allDay && arg.timeText ? (
            <span className="shrink-0 rounded-full bg-black/18 px-1.5 py-0.5 text-[9px] font-black text-white/90">{arg.timeText}</span>
          ) : null}
        </div>
      </div>
    );
  };

  const onEventClick = (arg: EventClickArg) => {
    const eventObj = arg.event.extendedProps.eventObj as PlannerEvent | undefined;
    if (eventObj) {
      if (eventObj.category === 'exam') {
        setSelectedExamDetail(eventObj);
      } else if (eventObj.category === 'homework' || eventObj.linkedTaskIds.length > 0) {
        setSelectedTaskDetail(eventObj);
      } else {
        setSelectedEvent(eventObj);
      }
    }
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

  const renderActivityPeriodControl = (tone: 'cyan' | 'rose' | 'purple') => {
    const toneClass = {
      cyan: 'text-cyan-300 border-cyan-300/25 bg-cyan-400/10 hover:bg-cyan-400/15',
      rose: 'text-rose-300 border-rose-300/25 bg-rose-400/10 hover:bg-rose-400/15',
      purple: 'text-purple-300 border-purple-300/25 bg-purple-400/10 hover:bg-purple-400/15'
    }[tone];
    const iconClass = {
      cyan: 'text-cyan-300',
      rose: 'text-rose-300',
      purple: 'text-purple-300'
    }[tone];

    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActivityPeriodAnchor((prev) => shiftMonth(prev, -1))}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${toneClass}`}
          title="Previous month"
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex h-10 min-w-[190px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-white">
          <CalendarDays size={16} className={iconClass} />
          <span>{activityPeriodRange.label}</span>
        </div>
        <button
          type="button"
          onClick={() => setActivityPeriodAnchor((prev) => shiftMonth(prev, 1))}
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${toneClass}`}
          title="Next month"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
        <button
          type="button"
          onClick={() => setActivityPeriodAnchor(startOfMonth(new Date()))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.08] hover:text-white"
          title="Current month"
          aria-label="Current month"
        >
          <RotateCcw size={15} />
        </button>
      </div>
    );
  };

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
                <span
                  className="h-3 w-3 rounded-full ring-2 ring-white/10 shadow-[0_0_14px_currentColor]"
                  style={{ backgroundColor: activityColorById.get(activity.id) || '#38bdf8', color: activityColorById.get(activity.id) || '#38bdf8' }}
                />
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
          <aside className="lg:col-span-2 space-y-4">
            <section className="rounded-[2rem] border border-white/10 bg-slate-800/80 p-6 backdrop-blur-xl shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Filters</h3>
                <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              </div>
              
              <div className="space-y-2.5">
                {filterOptions.map((option) => {
                  const active = activeCategoryFilters.includes(option.id) || (option.id === 'all' && activeCategoryFilters.includes('all'));
                  const color = option.id === 'all' ? '#22d3ee' : activityColorById.get(option.id) || '#94a3b8';
                  
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleFilter(option.id)}
                      className={`group relative grid min-h-[56px] w-full grid-cols-[10px_minmax(0,1fr)] items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 pr-5 text-left transition-all duration-300 ${
                        active 
                          ? 'border-white/20 bg-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.2)]' 
                          : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${active ? 'ring-4 ring-white/10' : ''}`}
                        style={{
                          backgroundColor: color,
                          boxShadow: active ? `0 0 12px ${color}` : 'none'
                        }}
                        aria-hidden="true"
                      />
                      <span className={`min-w-0 text-sm font-bold leading-5 transition-colors ${active ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
                        {option.label}
                      </span>
                      <span
                        className={`absolute right-0 top-0 h-full w-1.5 transition-opacity duration-300 ${
                          active ? 'opacity-100 shadow-[0_0_12px_currentColor]' : 'opacity-45'
                        }`}
                        style={{ background: `linear-gradient(180deg, ${color}, ${color}88)`, color }}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Protocol Status</p>
                <div className="flex items-center gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${loading ? 'bg-amber-400 animate-bounce' : 'bg-emerald-400 animate-pulse'}`} />
                  <span className={`text-xs font-semibold ${loading ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {loading ? 'Ingesting Data...' : 'Live Sync Active'}
                  </span>
                </div>
              </div>
            </section>
          </aside>

          {/* Main Content: Calendar */}
          <section className="lg:col-span-10 relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(18,27,52,0.94),rgba(9,14,30,0.98))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />
            
            {loading ? (
              <div className="flex h-[400px] items-center justify-center">
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                </div>
              </div>
            ) : null}

            <div className={`relative transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'} [&_.fc]:font-sans [&_.fc]:text-white [&_.fc-scrollgrid]:!border-white/10 [&_.fc-theme-standard_td]:border-white/[0.07] [&_.fc-theme-standard_th]:border-white/[0.07] [&_.fc-theme-standard_th]:!bg-black/25 [&_.fc-col-header-cell]:!py-4 [&_.fc-col-header-cell-cushion]:text-[10px] [&_.fc-col-header-cell-cushion]:font-black [&_.fc-col-header-cell-cushion]:uppercase [&_.fc-col-header-cell-cushion]:tracking-[0.24em] [&_.fc-col-header-cell-cushion]:!text-white/40 [&_.fc-toolbar]:!mb-6 [&_.fc-toolbar-title]:text-2xl [&_.fc-toolbar-title]:font-black [&_.fc-toolbar-title]:tracking-tight [&_.fc-toolbar-title]:bg-gradient-to-r [&_.fc-toolbar-title]:from-cyan-200 [&_.fc-toolbar-title]:via-sky-300 [&_.fc-toolbar-title]:to-violet-300 [&_.fc-toolbar-title]:bg-clip-text [&_.fc-toolbar-title]:text-transparent [&_.fc-button]:!bg-white/[0.06] [&_.fc-button]:!border-white/10 [&_.fc-button]:!text-white [&_.fc-button]:!px-4 [&_.fc-button]:!py-2.5 [&_.fc-button]:!text-xs [&_.fc-button]:!font-black [&_.fc-button]:!rounded-2xl [&_.fc-button]:!shadow-none [&_.fc-button:hover]:!bg-white/[0.12] [&_.fc-button-active]:!bg-white [&_.fc-button-active]:!text-slate-950 [&_.fc-daygrid-day]:!bg-white/[0.015] [&_.fc-daygrid-day-frame]:!min-h-[104px] [&_.fc-day-today]:!bg-cyan-400/[0.07] [&_.fc-day-today]:!shadow-[inset_0_0_0_1px_rgba(34,211,238,0.55)] [&_.fc-daygrid-day-number]:p-2 [&_.fc-daygrid-day-number]:text-xs [&_.fc-daygrid-day-number]:font-black [&_.fc-daygrid-day-number]:text-white/55 [&_.fc-day-other_.fc-daygrid-day-number]:text-white/20 [&_.fc-daygrid-event]:!rounded-xl [&_.fc-daygrid-event]:!p-0 [&_.fc-daygrid-event]:!border-0 [&_.fc-daygrid-event]:!bg-transparent [&_.fc-event]:!bg-transparent [&_.fc-event]:!border-0`}>
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
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Program Tasks</h3>
                    <p className="text-xs text-white/40">Manage your workload for {activityPeriodRange.label}.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {renderActivityPeriodControl('cyan')}
                    <button 
                      onClick={() => setShowTaskForm(!showTaskForm)}
                      className="rounded-full bg-cyan-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 hover:bg-cyan-400/20 transition-all"
                    >
                      {showTaskForm ? 'Cancel' : '+ New Task'}
                    </button>
                  </div>
                </div>

                {showTaskForm && (
                  <form onSubmit={handleCreateTask} className="mb-8 rounded-3xl border border-cyan-400/20 bg-cyan-400/5 p-6 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <input 
                        required
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        placeholder="What needs to be done?"
                        className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-cyan-500/50"
                      />
                      <select
                        required
                        value={newTaskSubjectId}
                        onChange={(e) => setNewTaskSubjectId(e.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-cyan-500/50"
                      >
                        <option value="" className="bg-slate-900">Select Subject</option>
                        {subjects.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>)}
                        <option value="general" className="bg-slate-900">General Activity</option>
                      </select>
                      <input 
                        required
                        type="datetime-local"
                        value={newTaskDue}
                        onChange={(e) => setNewTaskDue(e.target.value)}
                        aria-label="Available from"
                        title="Available from"
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-cyan-500/50"
                      />
                      <input 
                        type="datetime-local"
                        value={newTaskExpiresAt}
                        onChange={(e) => setNewTaskExpiresAt(e.target.value)}
                        aria-label="Complete before"
                        title="Complete before"
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
                      <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/70">
                        <input
                          type="checkbox"
                          checked={newTaskMandatory}
                          onChange={(e) => setNewTaskMandatory(e.target.checked)}
                          className="h-4 w-4 accent-cyan-400"
                        />
                        Mandatory
                      </label>
                    </div>
                    <p className="mt-3 text-[11px] font-bold text-cyan-100/55">
                      Mandatory tasks stay active only inside this window and will ask your parent to approve the request.
                    </p>
                    <button 
                      type="submit" 
                      disabled={taskCreating}
                      className="mt-4 w-full rounded-2xl bg-cyan-400 py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-cyan-400/20 disabled:opacity-50"
                    >
                      {taskCreating ? 'Creating...' : 'Initialize Task Protocol'}
                    </button>
                  </form>
                )}

                {(() => {
                  const activityTaskEvents = visibleEvents.filter(e => e.category === 'homework' && (e.linkedProgramId === activeActivityId || isSchoolActivity));
                  const activityTasks = expandPlannerEventsAsOccurrences(activityTaskEvents, activityPeriodRange.start, activityPeriodRange.end);
                  
                  if (activityTasks.length === 0) {
                    return (
                      <div className="col-span-full py-20 text-center border border-white/5 bg-white/[0.02] rounded-3xl">
                        <p className="text-lg font-medium text-white/20">No tasks found for {activityPeriodRange.label}.</p>
                      </div>
                    );
                  }

                  const now = Date.now();
                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);
                  const todayEnd = new Date(todayStart.getTime() + 86400000);

                  const tToday: PlannerEvent[] = [];
                  const tFuture: PlannerEvent[] = [];
                  const tPast: PlannerEvent[] = [];

                  activityTasks.forEach(event => {
                    const dTime = getPlannerEventTime(event);
                    const endTime = getPlannerEventTime(event, 'endAt');
                    const isActiveNow = dTime <= now && endTime >= now;
                    if (!event.startAt) {
                      tToday.push(event);
                    } else if (isActiveNow || (dTime >= todayStart.getTime() && dTime < todayEnd.getTime())) {
                      tToday.push(event);
                    } else if (dTime < todayStart.getTime()) {
                      tPast.push(event);
                    } else {
                      tFuture.push(event);
                    }
                  });

                  const currentTasks = sortPlannerEventsByStart(tToday);
                  const futureTasks = sortPlannerEventsByStart(tFuture);
                  const pastTasks = sortPlannerEventsByStart(tPast, 'desc');

                  const renderTaskList = (title: string, list: PlannerEvent[], tone: 'current' | 'future' | 'past') => (
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-white/50">{title}</h4>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                        <span className="text-xs font-black text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full">{list.length}</span>
                      </div>
                      <div className="relative space-y-4 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-cyan-300/50 before:via-white/10 before:to-transparent">
                        {list.length === 0 ? (
                          <div className="ml-14 py-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
                            <p className="text-xs font-medium text-white/20 italic">No tasks in this category.</p>
                          </div>
                        ) : list.map((event) => (
                          <div key={event.id} className="relative pl-14">
                            <div
                              className={clsx(
                                'absolute left-[17px] top-8 z-10 h-4 w-4 rounded-full border-2 shadow-[0_0_16px_currentColor]',
                                tone === 'current' && 'border-cyan-200 bg-cyan-400 text-cyan-400',
                                tone === 'future' && 'border-sky-200 bg-sky-400 text-sky-400',
                                tone === 'past' && 'border-white/30 bg-slate-500 text-slate-500'
                              )}
                              aria-hidden="true"
                            />
                            <div className="group flex items-center justify-between gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:bg-white/[0.05] hover:border-white/10">
                              <div className="flex items-center gap-4 min-w-0">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-xl group-hover:scale-110 transition-transform">
                                  {event.category === 'homework' ? '📝' : '⚡'}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-base font-bold text-white group-hover:text-cyan-300 transition-colors">{event.title}</p>
                                  <p className="text-xs font-medium text-white/40">{new Date(event.startAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {activityPointsConfig?.taskPoints ? (
                                  <div className="flex items-center gap-1 rounded-xl bg-amber-400/10 px-3 py-1.5 border border-amber-400/20">
                                    <span className="text-xs">⭐</span>
                                    <span className="text-xs font-black text-amber-400">{activityPointsConfig.taskPoints}</span>
                                  </div>
                                ) : null}
                                <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                              </div>
                              <button onClick={() => setSelectedTaskDetail(event)} className="ml-4 shrink-0 rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all">Details</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );

                  return (
                    <div className="space-y-4 mt-8">
                      {renderTaskList('Current / Today', currentTasks, 'current')}
                      {renderTaskList('Upcoming / Future', futureTasks, 'future')}
                      {renderTaskList('Past / Overdue', pastTasks, 'past')}
                    </div>
                  );
                })()}
              </div>
            )}

            {activitySubTab === 'exams' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Academic Assessments</h3>
                    <p className="text-xs text-white/40">Track performance and upcoming tests for {activityPeriodRange.label}.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {renderActivityPeriodControl('rose')}
                    <button 
                      onClick={() => setShowExamForm(!showExamForm)}
                      className="rounded-full bg-rose-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 hover:bg-rose-400/20 transition-all"
                    >
                      {showExamForm ? 'Cancel' : '+ New Exam'}
                    </button>
                  </div>
                </div>

                {showExamForm && (
                  <form onSubmit={handleCreateExam} className="mb-8 rounded-3xl border border-rose-400/20 bg-rose-400/5 p-6 animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="col-span-1 md:col-span-2 flex flex-col gap-2 mb-4">
                        <label className="text-sm font-semibold text-white/80">Subjects</label>
                        <div className="flex flex-wrap gap-2">
                          {subjects.filter(s => s.includeInExams).map(s => {
                            const isSelected = newExamSubjectIds.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setNewExamSubjectIds(prev => prev.filter(id => id !== s.id));
                                    setNewExamSubjects(prev => prev.filter(name => name !== s.name));
                                  } else {
                                    setNewExamSubjectIds(prev => [...prev, s.id]);
                                    setNewExamSubjects(prev => [...prev, s.name]);
                                  }
                                }}
                                className={`px-4 py-2 rounded-2xl text-xs font-bold border transition-colors ${isSelected ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-black/20 text-white/70 border-white/10 hover:bg-white/5'}`}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              if (newExamSubjectIds.includes('custom')) {
                                setNewExamSubjectIds(prev => prev.filter(id => id !== 'custom'));
                              } else {
                                setNewExamSubjectIds(prev => [...prev, 'custom']);
                              }
                            }}
                            className={`px-4 py-2 rounded-2xl text-xs font-bold border transition-colors ${newExamSubjectIds.includes('custom') ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' : 'bg-black/20 text-white/70 border-white/10 hover:bg-white/5'}`}
                          >
                            Custom Subject
                          </button>
                        </div>

                        {newExamSubjectIds.includes('custom') && (
                          <input 
                            required 
                            value={newExamSubjects.filter(s => !subjects.find(es => es.name === s)).join(', ')} 
                            onChange={(ev) => {
                              const nonCustom = newExamSubjects.filter(s => subjects.find(es => es.name === s));
                              const customValue = ev.target.value;
                              setNewExamSubjects(customValue ? [...nonCustom, customValue] : nonCustom);
                            }} 
                            placeholder="Enter Custom Subject Name" 
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-rose-500/50 mt-2 mb-3"
                          />
                        )}
                      </div>

                      <select 
                        value={newExamRecurrence}
                        onChange={(e) => setNewExamRecurrence(e.target.value as any)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-rose-500/50"
                      >
                        <option value="none" className="bg-slate-900">One Time</option>
                        <option value="daily" className="bg-slate-900">Daily</option>
                        <option value="weekly" className="bg-slate-900">Weekly</option>
                      </select>

                      <input 
                        type="datetime-local"
                        value={newExamDate}
                        onChange={(e) => setNewExamDate(e.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm text-white outline-none focus:ring-2 ring-rose-500/50"
                      />

                      {newExamRecurrence === 'weekly' && (
                        <div className="col-span-full flex flex-wrap gap-2 rounded-2xl bg-black/20 p-3 border border-white/10">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setNewExamRecurrenceDays((prev) => prev.includes(dayIndex) ? prev.filter((x) => x !== dayIndex) : [...prev, dayIndex])}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all ${
                                newExamRecurrenceDays.includes(dayIndex)
                                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                                  : 'bg-white/5 text-white/60 hover:bg-white/10'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-3">
                        <span className="text-xs font-bold text-white/40 uppercase whitespace-nowrap">Max Stars</span>
                        <input 
                          type="number"
                          value={newExamPointsAllocated}
                          onChange={(e) => setNewExamPointsAllocated(e.target.value ? Number(e.target.value) : '')}
                          placeholder="Optional"
                          className="w-full bg-transparent text-sm font-bold text-white outline-none min-w-0"
                        />
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-3">
                        <span className="text-xs font-bold text-white/40 uppercase whitespace-nowrap">Marks Scored</span>
                        <input 
                          type="number"
                          value={newExamMarks}
                          onChange={(e) => setNewExamMarks(e.target.value ? Number(e.target.value) : '')}
                          placeholder="Optional"
                          className="w-full bg-transparent text-sm font-bold text-white outline-none min-w-0"
                        />
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-5 py-3">
                        <span className="text-xs font-bold text-white/40 uppercase whitespace-nowrap">Total Marks</span>
                        <input 
                          type="number"
                          value={newExamTotalMarks}
                          onChange={(e) => setNewExamTotalMarks(e.target.value ? Number(e.target.value) : '')}
                          placeholder="Optional"
                          className="w-full bg-transparent text-sm font-bold text-white outline-none min-w-0"
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

                {(() => {
                  const activityExamEvents = visibleEvents.filter((event) => event.category === 'exam' && (event.linkedProgramId === activeActivityId || isSchoolActivity));
                  const activityExams = expandPlannerEventsAsOccurrences(activityExamEvents, activityPeriodRange.start, activityPeriodRange.end);
                  
                  if (activityExams.length === 0) {
                    return (
                      <div className="py-20 text-center border border-white/5 bg-white/[0.02] rounded-3xl mt-8">
                        <p className="text-lg font-medium text-white/20">No exams found for {activityPeriodRange.label}.</p>
                      </div>
                    );
                  }

                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);
                  const todayEnd = new Date(todayStart.getTime() + 86400000);

                  const eToday: any[] = [];
                  const eFuture: any[] = [];
                  const ePast: any[] = [];

                  activityExams.forEach(event => {
                    const dTime = event.startAt ? new Date(event.startAt).getTime() : 0;
                    if (!event.startAt) {
                      eToday.push(event);
                    } else if (dTime < todayStart.getTime()) {
                      ePast.push(event);
                    } else if (dTime >= todayEnd.getTime()) {
                      eFuture.push(event);
                    } else {
                      eToday.push(event);
                    }
                  });

                  const renderExamList = (title: string, list: any[]) => (
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-white/50">{title}</h4>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                        <span className="text-xs font-black text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-full">{list.length}</span>
                      </div>
                      <div className="space-y-3">
                        {list.length === 0 ? (
                          <div className="col-span-full py-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl">
                            <p className="text-xs font-medium text-white/20 italic">No exams in this category.</p>
                          </div>
                        ) : list.map((event) => {
                          const isGreen = event.color === '#10b981';
                          const isAmber = event.color === '#f59e0b';
                          const bgBorderClass = isGreen ? 'border-emerald-500/20 bg-emerald-500/5' : isAmber ? 'border-amber-500/20 bg-amber-500/5' : 'border-rose-500/20 bg-rose-500/5';
                          const iconBgClass = isGreen ? 'bg-emerald-500/10' : isAmber ? 'bg-amber-500/10' : 'bg-rose-500/10';
                          const timeTextClass = isGreen ? 'text-emerald-400/80' : isAmber ? 'text-amber-400/80' : 'text-rose-400/80';
                          const hasResult = event.marksScored != null && event.totalMarks != null && event.totalMarks > 0;
                          const examStatus = event.taskStatus
                            ? event.taskStatus.replace(/_/g, ' ')
                            : hasResult ? 'Result recorded' : new Date(event.startAt).getTime() < Date.now() ? 'Awaiting result' : 'Scheduled';
                          
                          return (
                            <div key={event.id} className={`flex flex-col gap-4 rounded-3xl border ${bgBorderClass} p-6 backdrop-blur-md lg:flex-row lg:items-center lg:justify-between`}>
                              <div className="flex min-w-0 items-center gap-5">
                                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconBgClass} text-2xl`}>🎓</div>
                                <div className="min-w-0">
                                  <p className="truncate text-lg font-black text-white tracking-tight">{event.title}</p>
                                  <p className={`text-sm font-semibold ${timeTextClass}`}>{new Date(event.startAt).toLocaleString()}</p>
                                  <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-white/35">{examStatus}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                {activityPointsConfig?.examPoints ? (
                                  <div className="flex items-center gap-1 rounded-xl bg-amber-400/10 px-3 py-1.5 border border-amber-400/20">
                                    <span className="text-xs">⭐</span>
                                    <span className="text-xs font-black text-amber-400">Up to {activityPointsConfig.examPoints}</span>
                                  </div>
                                ) : null}
                                {event.marksScored != null && event.totalMarks ? (
                                  <div className="flex items-center gap-1 rounded-xl bg-cyan-400/10 px-3 py-1.5 border border-cyan-400/20">
                                    <span className="text-xs font-black text-cyan-400">{event.marksScored}/{event.totalMarks} ({Math.round((event.marksScored / event.totalMarks) * 100)}%)</span>
                                  </div>
                                ) : null}
                                <button onClick={() => setSelectedExamDetail(event)} className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all">Details</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );

                  const gradedExams = activityExams.filter(e => e.marksScored != null && e.totalMarks != null && e.totalMarks > 0);
                  const scheduledExams = activityExams.filter(e => e.marksScored == null || e.totalMarks == null || e.totalMarks <= 0);
                  const marksScoredTotal = gradedExams.reduce((acc, e) => acc + (e.marksScored || 0), 0);
                  const maxMarksTotal = gradedExams.reduce((acc, e) => acc + (e.totalMarks || 0), 0);
                  const avgPercent = gradedExams.length ? Math.round(gradedExams.reduce((acc, e) => acc + (e.marksScored! / e.totalMarks!), 0) / gradedExams.length * 100) : 0;

                  return (
                    <div className="space-y-4 mt-8">
                      {activityExams.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1">Monthly Exams</p>
                            <p className="text-3xl font-black text-white">{activityExams.length}</p>
                          </div>
                          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1">Scheduled</p>
                            <p className="text-3xl font-black text-cyan-400">{scheduledExams.length}</p>
                          </div>
                          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1">Marks Recorded</p>
                            <p className="text-3xl font-black text-emerald-400">{marksScoredTotal}/{maxMarksTotal || 0}</p>
                          </div>
                          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                            <p className="text-xs font-bold uppercase tracking-wider text-white/40 mb-1">Avg Score</p>
                            <p className="text-3xl font-black text-rose-400">{avgPercent}%</p>
                          </div>
                        </div>
                      )}
                      
                      {renderExamList('Today / Active', eToday)}
                      {renderExamList('Upcoming / Future', eFuture)}
                      {renderExamList('Past / Completed', ePast)}
                    </div>
                  );
                })()}
              </div>
            )}

            {activitySubTab === 'timetable' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Class Matrix</h3>
                    <p className="text-sm font-medium text-white/40 italic">{activityPeriodRange.label} // {timetableMaxPeriods} generated periods</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTimetableConfig((value) => !value)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                    >
                      <Pencil size={14} />
                      Configure
                    </button>
                  </div>
                </div>

                {showTimetableConfig && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-white">Timetable Structure</h4>
                        <p className="text-xs font-semibold text-white/40">School days and period count for each day.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void saveTimetableConfig()}
                        disabled={savingTimetableConfig}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-400 disabled:pointer-events-none disabled:opacity-50"
                      >
                        <Save size={14} />
                        {savingTimetableConfig ? 'Saving...' : 'Save Structure'}
                      </button>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
                      <div>
                        <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/50">Period Duration</p>
                        <input
                          type="number"
                          min={1}
                          value={periodDurationDraft}
                          onChange={(e) => setPeriodDurationDraft(Math.max(1, toNonNegativeInteger(e.target.value, 40)))}
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none"
                          aria-label="Period duration minutes"
                        />

                        <p className="mb-2 mt-4 text-xs font-black uppercase tracking-widest text-white/50">School Days</p>
                        <div className="flex flex-wrap gap-2">
                          {timetableDaysDraft.map((draftDay) => (
                            <button
                              key={draftDay}
                              type="button"
                              onClick={() => removeTimetableDay(draftDay)}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:border-rose-300/40 hover:bg-rose-500/10"
                            >
                              {draftDay}
                              <Trash2 size={12} />
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input value={newTimetableDay} onChange={(e) => setNewTimetableDay(e.target.value)} placeholder="Sat" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white placeholder:text-white/25 outline-none" />
                          <button type="button" onClick={addTimetableDay} className="rounded-xl bg-cyan-500 px-3 py-2 text-white">
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/50">Periods Per Day</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {timetableDaysDraft.map((draftDay) => (
                            <label key={draftDay} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                              <span className="text-sm font-black text-white">{draftDay}</span>
                              <input
                                type="number"
                                min={0}
                                value={timetableDayPeriodCountsDraft[draftDay] ?? 0}
                                onChange={(e) => {
                                  const count = toNonNegativeInteger(e.target.value);
                                  setTimetableDayPeriodCountsDraft((current) => ({ ...current, [draftDay]: count }));
                                }}
                                className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-right text-xs font-bold text-white outline-none"
                                aria-label={`${draftDay} period count`}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {subjects.length === 0 && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs font-bold text-amber-100">
                    Add subjects in the Subjects section before filling the timetable.
                    <button
                      type="button"
                      onClick={() => {
                        setActivitySubTab('subjects');
                        setShowSubjectForm(true);
                      }}
                      className="ml-3 rounded-lg bg-amber-300 px-3 py-1.5 font-black uppercase tracking-widest text-slate-950"
                    >
                      Add Subject
                    </button>
                  </div>
                )}

                {schoolError && (
                  <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-bold text-rose-400 animate-bounce">
                    ⚠️ {schoolError}
                  </div>
                )}

                <div className="rounded-[2rem] border border-white/5 bg-black/20 p-4 overflow-x-auto custom-scrollbar">
                  <table className="min-w-[820px] w-full border-collapse text-xs text-white/80">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 border border-white/10 bg-slate-950 px-3 py-3 text-left font-black uppercase tracking-widest text-white">Day</th>
                        {Array.from({ length: timetableMaxPeriods }, (_, index) => (
                          <th key={index} className="border border-white/10 bg-cyan-500/10 px-3 py-3 text-center font-black text-white">
                            Period {index + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editableTimetable.days.map((tableDay) => {
                        const periodCount = editableTimetable.dayPeriodCounts?.[tableDay] ?? timetableMaxPeriods;
                        return (
                          <tr key={tableDay}>
                            <td className="sticky left-0 z-10 border border-white/10 bg-slate-950 px-3 py-3 font-black uppercase tracking-widest text-white">{tableDay}</td>
                            {Array.from({ length: timetableMaxPeriods }, (_, index) => {
                              const periodId = `Period ${index + 1}`;
                              const isActiveCell = index < periodCount;
                              const cell = editableTimetable.data[periodId]?.[tableDay];
                              return (
                                <td key={`${tableDay}-${periodId}`} className="border border-white/10 p-2">
                                  {isActiveCell ? (
                                    <select
                                      value={subjects.some((item) => item.name === cell?.subject) ? cell?.subject || '' : ''}
                                      disabled={subjects.length === 0 || savingCell}
                                      onChange={(e) => void saveTimetableCellSubject(periodId, tableDay, e.target.value)}
                                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <option value="" className="bg-slate-900">Select</option>
                                      {subjectsByTimetableHours.map((sub) => (
                                        <option key={sub.id} value={sub.name} className="bg-slate-900">{sub.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-center font-bold text-white/20">Off</div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {activitySubTab === 'subjects' && (
              <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{editingSubjectId ? 'Modify Subject' : 'Subject Mastery'}</h3>
                    <p className="text-xs text-white/40">{editingSubjectId ? 'Refine the subject details below.' : 'Define the core subjects for this program.'}</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      if (showSubjectForm) {
                        resetSubjectForm();
                      } else {
                        setEditingSubjectId(null);
                        setNewSubjectName('');
                        setNewSubjectTeacher('');
                        setNewSubjectIncludeInExam(true);
                        setShowSubjectForm(true);
                      }
                    }}
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
                        {subjectCreating ? 'Processing...' : (editingSubjectId ? 'Update Subject Protocol' : 'Record Subject Protocol')}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  {subjectsByTimetableHours.length ? subjectsByTimetableHours.map((sub) => {
                    const subjectTasks = allEvents.filter(t => t.category === 'homework' && t.linkedProgramId === activeActivityId && t.subjectId === sub.id);
                    const subjectExams = allEvents.filter(e => (
                      e.category === 'exam' &&
                      e.linkedProgramId === activeActivityId &&
                      (
                        e.subjectId === sub.id ||
                        e.subjectId?.split(',').some((subjectId) => subjectId.trim() === sub.id) ||
                        e.subject === sub.name ||
                        (e.subject && e.subject.split(', ').includes(sub.name))
                      )
                    ));
                    const subjectHourInsight = subjectHoursByName.get(sub.name.toLowerCase());

                    return (
                    <div 
                      key={sub.id} 
                      onClick={() => setExpandedSubjectId(expandedSubjectId === sub.id ? null : sub.id)}
                      className={`relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] transition-all hover:bg-white/[0.05] cursor-pointer ${expandedSubjectId === sub.id ? 'ring-2 ring-indigo-500/50' : ''}`}
                    >
                      <div className="grid grid-cols-1 items-center gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_120px_110px_auto]">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate text-base font-bold text-white">{sub.name}</p>
                            {sub.includeInExams ? (
                              <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-300">Exams</span>
                            ) : null}
                          </div>
                          <p className="text-[11px] font-bold text-indigo-300/60 uppercase tracking-wider truncate">
                            {subjectHourInsight ? `${subjectHourInsight.periods} periods • ` : ''}{sub.teacherName || 'Independent Study'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Hours</p>
                          <p className="mt-0.5 text-sm font-black text-cyan-300">{subjectHourInsight ? `${subjectHourInsight.hours}h` : '0h'}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Tasks</p>
                          <p className="mt-0.5 text-sm font-black text-white">{subjectTasks.length}</p>
                        </div>
                        <div className="flex justify-end gap-1.5 z-20">
                          <button 
                            onClick={(e) => { e.stopPropagation(); startEditSubject(sub); }}
                            className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); if(confirm('Delete subject?')) removeSubject(sub.id); }}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {expandedSubjectId === sub.id && (
                        <div className="border-t border-white/10 p-4 pt-3 space-y-3 z-10 relative w-full">
                          <div className="rounded-xl bg-black/20 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400 mb-1.5">Tasks ({subjectTasks.length})</p>
                            {subjectTasks.length > 0 ? (
                              <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                {subjectTasks.map(t => (
                                  <div key={t.id} className="flex justify-between items-center text-xs bg-black/40 p-2 rounded-xl border border-white/5 shadow-sm">
                                    <span className="text-white font-semibold truncate mr-2" title={t.title}>{t.title}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${t.color === '#10b981' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>PENDING</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-white/30 italic">No tasks assigned.</p>
                            )}
                          </div>

                          {sub.includeInExams && (
                            <div className="rounded-xl bg-black/20 p-3">
                              <p className="text-[10px] font-black uppercase tracking-wider text-rose-400 mb-1.5">Exams ({subjectExams.length})</p>
                              {subjectExams.length > 0 ? (
                                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                  {subjectExams.map(ex => (
                                    <div key={ex.id} className="flex justify-between items-center text-xs bg-black/40 p-2 rounded-xl border border-white/5 shadow-sm">
                                      <span className="text-white font-semibold truncate mr-2" title={ex.title}>{ex.title.replace(' Exam', '')}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 ${ex.color === '#10b981' ? 'bg-emerald-500/20 text-emerald-400' : ex.color === '#f59e0b' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                        {ex.title.includes('(') ? ex.title.split('(')[1].replace(')', '') : 'Upcoming'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-white/30 italic">No exams recorded.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}) : (
                    <div className="py-20 text-center text-white/20 font-medium">No subjects registered in this protocol.</div>
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
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">Program Events</h3>
                    <p className="text-xs text-white/40">Scheduled sessions and specialized protocols for {activityPeriodRange.label}.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {renderActivityPeriodControl('purple')}
                    <button 
                      onClick={() => setShowEventForm(!showEventForm)}
                      className="rounded-full bg-purple-400/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 hover:bg-purple-400/20 transition-all"
                    >
                      {showEventForm ? 'Cancel' : '+ New Event'}
                    </button>
                  </div>
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

                {(() => {
                  const activityEventRecords = visibleEvents.filter(e => e.linkedProgramId === activeActivityId && e.category !== 'homework' && e.category !== 'exam');
                  const activityEvents = sortPlannerEventsByStart(expandPlannerEventsAsOccurrences(activityEventRecords, activityPeriodRange.start, activityPeriodRange.end));

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activityEvents.length ? activityEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5">
                          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-xl">📅</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-bold text-white">{event.title}</p>
                            <p className="text-xs font-medium text-white/40">{new Date(event.startAt).toLocaleString()}</p>
                          </div>
                          {activityPointsConfig?.eventPoints ? (
                            <div className="ml-auto flex items-center gap-1 rounded-xl bg-amber-400/10 px-3 py-1.5 border border-amber-400/20">
                              <span className="text-xs">⭐</span>
                              <span className="text-xs font-black text-amber-400">{activityPointsConfig.eventPoints}</span>
                            </div>
                          ) : null}
                          <button onClick={() => setSelectedEvent(event)} className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all">Details</button>
                        </div>
                      )) : (
                        <div className="col-span-full py-20 text-center text-white/20 font-medium">No events found for {activityPeriodRange.label}.</div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {selectedEvent ? (() => {
        const next = getNextPlannerOccurrence(selectedEvent);
        const status = getPlannerExpiryStatus(selectedEvent);
        return (
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
                  <p className="text-sm font-black text-cyan-300 uppercase tracking-tight">{categoryLabel(selectedEvent.category)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Start Time</p>
                    <p className="text-xs font-bold text-white/80">{new Date(selectedEvent.startAt).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">End Time</p>
                    <p className="text-xs font-bold text-white/80">{new Date(selectedEvent.endAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Repeat</p>
                    <p className="text-xs font-bold text-white/80">{formatPlannerRecurrence(selectedEvent.recurrence)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Status</p>
                    <p className={clsx('text-xs font-bold', status === 'Expired' ? 'text-rose-300' : 'text-emerald-300')}>{status}</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] p-4 border border-white/5">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Next Time</p>
                  <p className="text-xs font-bold text-white/80">{next ? new Date(next.startAt).toLocaleString() : 'No upcoming occurrence'}</p>
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
        );
      })() : null}

      {/* EXAM DETAIL MODAL */}
      {selectedExamDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl relative">
            <button onClick={() => setSelectedExamDetail(null)} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
            <h3 className="text-xl font-black text-white mb-1">Exam Details</h3>
            <p className="text-sm font-bold text-white/60 mb-6">{selectedExamDetail.title}</p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Date & Time</span>
                <span className="text-sm font-bold text-white">{new Date(selectedExamDetail.startAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Repeat</span>
                <span className="text-sm font-bold text-white">{formatPlannerRecurrence(selectedExamDetail.recurrence)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Next</span>
                <span className="text-sm font-bold text-white">{getNextPlannerOccurrence(selectedExamDetail) ? new Date(getNextPlannerOccurrence(selectedExamDetail)!.startAt).toLocaleString() : 'No upcoming occurrence'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Expiry</span>
                <span className="text-sm font-bold text-white">{getPlannerExpiryStatus(selectedExamDetail)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Status</span>
                <span className="text-sm font-bold text-rose-400 capitalize">{selectedExamDetail.taskStatus || 'Scheduled'}</span>
              </div>
              {selectedExamDetail.marksScored != null && selectedExamDetail.totalMarks && (
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-xs font-bold text-white/40 uppercase">Score</span>
                  <span className="text-sm font-black text-cyan-400">
                    {selectedExamDetail.marksScored} / {selectedExamDetail.totalMarks} 
                    <span className="ml-2 text-emerald-400">({Math.round((selectedExamDetail.marksScored / selectedExamDetail.totalMarks) * 100)}%)</span>
                  </span>
                </div>
              )}
              {selectedExamDetail.syllabusScope && (
                <div className="py-2 border-b border-white/5">
                  <span className="text-xs font-bold text-white/40 uppercase block mb-1">Syllabus / Notes</span>
                  <span className="text-sm text-white/80">{selectedExamDetail.syllabusScope}</span>
                </div>
              )}
            </div>
            
            <button onClick={() => setSelectedExamDetail(null)} className="mt-8 w-full rounded-2xl bg-white/10 py-3 text-sm font-bold text-white hover:bg-white/20 transition-all">Close</button>
          </div>
        </div>
      )}

      {/* TASK DETAIL & PROOF MODAL */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-black/40">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl relative">
            <button onClick={() => { setSelectedTaskDetail(null); setProofFile(null); setProofNotes(''); }} className="absolute top-4 right-4 text-white/40 hover:text-white">✕</button>
            <h3 className="text-xl font-black text-white mb-1">Task Details</h3>
            <p className="text-sm font-bold text-white/60 mb-6">{selectedTaskDetail.title}</p>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Due Date</span>
                <span className="text-sm font-bold text-white">{new Date(selectedTaskDetail.startAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Repeat</span>
                <span className="text-sm font-bold text-white">{formatPlannerRecurrence(selectedTaskDetail.recurrence)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Next</span>
                <span className="text-sm font-bold text-white">{getNextPlannerOccurrence(selectedTaskDetail) ? new Date(getNextPlannerOccurrence(selectedTaskDetail)!.startAt).toLocaleString() : 'No upcoming occurrence'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Expiry</span>
                <span className="text-sm font-bold text-white">{getPlannerExpiryStatus(selectedTaskDetail)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs font-bold text-white/40 uppercase">Status</span>
                <span className="text-sm font-bold text-cyan-400 capitalize">{selectedTaskDetail.taskStatus || 'Pending'}</span>
              </div>
              {selectedTaskDetail.taskApprovalStatus !== 'none' && (
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-xs font-bold text-white/40 uppercase">Approval</span>
                  <span className={`text-sm font-bold capitalize ${selectedTaskDetail.taskApprovalStatus === 'approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedTaskDetail.taskApprovalStatus}
                  </span>
                </div>
              )}
            </div>

            {selectedTaskDetail.taskStatus !== 'completed' && selectedTaskDetail.taskStatus !== 'pending_proof' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase block mb-2">Upload Proof (Screenshot / Photo)</label>
                  <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="w-full text-sm text-white/80 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400/10 file:px-4 file:py-2 file:text-xs file:font-black file:text-cyan-400 hover:file:bg-cyan-400/20" />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/40 uppercase block mb-2">Notes for Parent</label>
                  <textarea value={proofNotes} onChange={(e) => setProofNotes(e.target.value)} placeholder="Optional notes..." className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:ring-2 ring-cyan-500/50 min-h-[80px]" />
                </div>
                
                <button 
                  disabled={uploading || questSaving || !proofFile}
                  onClick={async () => {
                    const taskId = selectedTaskDetail.linkedTaskIds[0];
                    if (!taskId || !proofFile) return;
                    await uploadProof({ id: taskId, title: selectedTaskDetail.title } as any, proofFile, proofNotes);
                    await markTaskPendingProof({ id: taskId, title: selectedTaskDetail.title } as any);
                    setSelectedTaskDetail(null);
                    setProofFile(null);
                    setProofNotes('');
                    refreshEvents();
                  }}
                  className="w-full rounded-2xl bg-cyan-400 py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-lg shadow-cyan-400/20 disabled:opacity-50"
                >
                  {uploading || questSaving ? 'Uploading...' : 'Submit Proof & Complete'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
