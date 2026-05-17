import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { MOCK_PLANNER_EVENTS } from '../constants/planner.mock';
import { fetchPlannerEventsByRange } from '../services/planner.firestore';
import type { PlannerDateRange, PlannerEvent } from '../types/planner.types';
import { useAuth } from '../../../contexts/AuthContext';

const DEFAULT_RANGE_DAYS = 30;

function defaultRange(): PlannerDateRange {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  const end = new Date();
  end.setDate(end.getDate() + DEFAULT_RANGE_DAYS);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export function usePlannerEvents(childId: string, range?: PlannerDateRange, useMockFallback = true) {
  const { user } = useAuth();
  const familyId = user?.linked_family_id || user?.id || '';
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [taskEvents, setTaskEvents] = useState<PlannerEvent[]>([]);
  const [examEvents, setExamEvents] = useState<PlannerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const effectiveRange = useMemo(() => range || defaultRange(), [range?.endAt, range?.startAt]);

  const load = useCallback(async () => {
    if (!childId) {
      setEvents(useMockFallback ? MOCK_PLANNER_EVENTS : []);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await fetchPlannerEventsByRange(childId, effectiveRange);
      if (rows.length === 0 && useMockFallback) {
        setEvents(MOCK_PLANNER_EVENTS.map((event) => ({ ...event, childId })));
      } else {
        setEvents(rows);
      }
    } catch (err) {
      console.error('usePlannerEvents error:', err);
      setEvents(useMockFallback ? MOCK_PLANNER_EVENTS.map((event) => ({ ...event, childId })) : []);
    } finally {
      setLoading(false);
    }
  }, [childId, effectiveRange, useMockFallback]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!childId || !familyId) return;

    const taskQuery = query(collection(db, 'tasks'), where('child_id', '==', childId));
    const examQuery = query(collection(db, 'exams'), where('child_id', '==', childId));

    const unsubTasks = onSnapshot(taskQuery, (snap) => {
      const now = new Date().toISOString();
      const mappedTasks: PlannerEvent[] = snap.docs.map((d) => {
        const row = d.data() as Record<string, unknown>;
        let baseStart = now;
        if (typeof row.due_date === 'string') {
          baseStart = row.due_date;
        } else if (typeof row.end_date === 'string') {
          baseStart = row.end_date;
        }
        let endAt = baseStart;
        if (typeof row.end_date === 'string') {
          endAt = row.end_date;
        }
        return {
          id: `task_${d.id}`,
          familyId,
          childId,
          parentId: familyId,
          title: String(row.title || 'Task'),
          category: 'homework',
          color: '#eab308',
          startAt: baseStart,
          endAt: endAt,
          allDay: true,
          timezone: 'Asia/Kolkata',
          recurrence: { type: 'none', interval: 1, byWeekDays: [], byMonthDays: [], until: null, count: null, rrule: null },
          linkedProgramId: (row.linked_program_id as string) || null,
          subjectId: (row.subject_id as string) || null,
          linkedTaskIds: [d.id],
          participantIds: [],
          reminderIds: [],
          source: 'manual',
          sync: { googleEnabled: false, googleEventId: null, syncStatus: 'not_configured', lastSyncAt: null, syncError: null },
          createdBy: 'child',
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
      });
      setTaskEvents(mappedTasks);
    });

    const unsubExams = onSnapshot(examQuery, (snap) => {
      const now = new Date().toISOString();
      const mappedExams: PlannerEvent[] = snap.docs.map((d) => {
        const row = d.data() as Record<string, unknown>;
        let startAt = now;
        let endAt = now;
        if (typeof row.exam_date === 'string') {
          const isIso = row.exam_date.includes('T');
          startAt = isIso ? row.exam_date : `${row.exam_date}T09:00:00.000Z`;
          endAt = isIso ? row.exam_date : `${row.exam_date}T11:00:00.000Z`;
        } else if (typeof row.date === 'string') {
          const isIso = row.date.includes('T');
          startAt = isIso ? row.date : `${row.date}T09:00:00.000Z`;
          endAt = isIso ? row.date : `${row.date}T11:00:00.000Z`;
        }

        const marksScored = typeof row.marks_scored === 'number' ? row.marks_scored : null;
        const totalMarks = typeof row.total_marks === 'number' ? row.total_marks : null;
        const resultSuffix = marksScored !== null && totalMarks !== null ? ` (${marksScored}/${totalMarks})` : '';
        
        let examColor = '#ef4444'; // default red
        if (marksScored !== null && totalMarks !== null && totalMarks > 0) {
          const pct = marksScored / totalMarks;
          if (pct >= 0.8) {
            examColor = '#10b981'; // Green
          } else if (pct >= 0.5) {
            examColor = '#f59e0b'; // Amber
          } else {
            examColor = '#ef4444'; // Red
          }
        }

        return {
          id: `exam_${d.id}`,
          familyId,
          childId,
          parentId: familyId,
          title: `${String(row.subject || 'Exam')} Exam${resultSuffix}`,
          category: 'exam',
          color: examColor,
          startAt,
          endAt,
          allDay: false,
          timezone: 'Asia/Kolkata',
          recurrence: { type: 'none', interval: 1, byWeekDays: [], byMonthDays: [], until: null, count: null, rrule: null },
          linkedProgramId: (row.linked_program_id as string) || null,
          subjectId: (row.subject_id as string) || null,
          subject: (row.subject as string) || null,
          linkedTaskIds: [],
          participantIds: [],
          reminderIds: [],
          source: 'manual',
          sync: { googleEnabled: false, googleEventId: null, syncStatus: 'not_configured', lastSyncAt: null, syncError: null },
          createdBy: 'parent',
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        };
      });
      setExamEvents(mappedExams);
    });

    return () => {
      unsubTasks();
      unsubExams();
    };
  }, [childId, familyId]);

  const allEvents = useMemo(() => [...events, ...taskEvents, ...examEvents], [events, taskEvents, examEvents]);

  const upcoming = useMemo(
    () => allEvents.filter((event) => new Date(event.endAt).getTime() >= Date.now()).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [allEvents]
  );

  return { events: allEvents, upcoming, loading, refresh: load };
}
