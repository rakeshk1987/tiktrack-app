import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { PLANNER_CATEGORY_COLORS } from '../constants/planner.constants';
import type { PlannerActivityModule, PlannerDateRange, PlannerEvent, PlannerProgram, PlannerTimetable } from '../types/planner.types';
import type { PlannerEventInput, PlannerQuickAddInput, PlannerTimetableCellInput } from '../utils/planner.validation';

function mapPlannerEvent(docId: string, raw: Record<string, unknown>): PlannerEvent {
  return {
    id: docId,
    familyId: String(raw.family_id || ''),
    childId: String(raw.child_id || ''),
    parentId: String(raw.parent_id || ''),
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    category: (raw.type || raw.category || 'custom') as PlannerEvent['category'],
    color: String(raw.color || '#3b82f6'),
    startAt: String(raw.start_at || raw.date || new Date().toISOString()),
    endAt: String(raw.end_at || raw.date || new Date().toISOString()),
    allDay: Boolean(raw.all_day || false),
    timezone: String(raw.timezone || 'Asia/Kolkata'),
    recurrence: {
      type: ((raw.recurrence as Record<string, unknown> | undefined)?.type || 'none') as PlannerEvent['recurrence']['type'],
      interval: Number((raw.recurrence as Record<string, unknown> | undefined)?.interval || 1),
      byWeekDays: (((raw.recurrence as Record<string, unknown> | undefined)?.by_week_days as number[]) || []),
      byMonthDays: (((raw.recurrence as Record<string, unknown> | undefined)?.by_month_days as number[]) || []),
      until: ((raw.recurrence as Record<string, unknown> | undefined)?.until as string) || null,
      count: ((raw.recurrence as Record<string, unknown> | undefined)?.count as number) || null,
      rrule: ((raw.recurrence as Record<string, unknown> | undefined)?.rrule as string) || null
    },
    linkedProgramId: (raw.linked_program_id as string) || null,
    linkedTaskIds: Array.isArray(raw.linked_task_ids) ? (raw.linked_task_ids as string[]) : [],
    participantIds: Array.isArray(raw.participant_ids) ? (raw.participant_ids as string[]) : [],
    reminderIds: Array.isArray(raw.reminder_ids) ? (raw.reminder_ids as string[]) : [],
    source: (raw.source || 'manual') as PlannerEvent['source'],
    sync: {
      googleEnabled: Boolean((raw.sync as Record<string, unknown> | undefined)?.google_enabled || false),
      googleEventId: ((raw.sync as Record<string, unknown> | undefined)?.google_event_id as string) || null,
      syncStatus: (((raw.sync as Record<string, unknown> | undefined)?.sync_status as PlannerEvent['sync']['syncStatus']) || 'not_configured'),
      lastSyncAt: ((raw.sync as Record<string, unknown> | undefined)?.last_sync_at as string) || null,
      syncError: ((raw.sync as Record<string, unknown> | undefined)?.sync_error as string) || null
    },
    createdBy: (raw.created_by || 'parent') as PlannerEvent['createdBy'],
    createdAt: String(raw.created_at || new Date().toISOString()),
    updatedAt: String(raw.updated_at || raw.created_at || new Date().toISOString()),
    deletedAt: (raw.deleted_at as string) || null
  };
}

function mapPlannerProgram(docId: string, raw: Record<string, unknown>): PlannerProgram {
  const modulesRaw = Array.isArray(raw.modules) ? (raw.modules as PlannerActivityModule[]) : [];
  return {
    id: docId,
    familyId: String(raw.family_id || ''),
    childId: String(raw.child_id || ''),
    name: String(raw.name || ''),
    icon: String(raw.icon || '📘'),
    color: String(raw.color || '#3b82f6'),
    category: (raw.category || 'custom') as PlannerProgram['category'],
    reminderDefaults: {
      minutesBefore: Array.isArray((raw.reminder_defaults as Record<string, unknown> | undefined)?.minutes_before)
        ? (((raw.reminder_defaults as Record<string, unknown>).minutes_before as number[]) || [30])
        : [30],
      pushEnabled: Boolean((raw.reminder_defaults as Record<string, unknown> | undefined)?.push_enabled ?? true)
    },
    recurrenceRule: (raw.recurrence_rule as string) || null,
    modules: modulesRaw.length ? modulesRaw : ['tasks'],
    isDefault: Boolean(raw.is_default || false),
    isActive: raw.is_active !== false,
    startDate: (raw.start_date as string) || null,
    endDate: (raw.end_date as string) || null,
    createdAt: String(raw.created_at || new Date().toISOString()),
    updatedAt: String(raw.updated_at || raw.created_at || new Date().toISOString())
  };
}

function recurrencePayload(input: PlannerEventInput) {
  if (input.recurrenceType === 'daily') {
    return { type: 'daily', interval: 1, by_week_days: [], by_month_days: [], until: null, count: null, rrule: null };
  }
  if (input.recurrenceType === 'weekly') {
    return { type: 'weekly', interval: 1, by_week_days: input.recurrenceWeekDays, by_month_days: [], until: null, count: null, rrule: null };
  }
  if (input.recurrenceType === 'monthly') {
    return { type: 'monthly', interval: 1, by_week_days: [], by_month_days: [new Date(input.startAt).getDate()], until: null, count: null, rrule: null };
  }
  return { type: 'none', interval: 1, by_week_days: [], by_month_days: [], until: null, count: null, rrule: null };
}

export async function fetchPlannerEventsByRange(childId: string, range: PlannerDateRange): Promise<PlannerEvent[]> {
  const q = query(
    collection(db, 'events'),
    where('child_id', '==', childId),
    where('start_at', '>=', range.startAt),
    where('start_at', '<=', range.endAt),
    orderBy('start_at', 'asc'),
    limit(600)
  );

  const snap = await getDocs(q);
  return snap.docs.map((docRow) => mapPlannerEvent(docRow.id, docRow.data() as Record<string, unknown>));
}

export async function fetchPlannerPrograms(childId: string): Promise<PlannerProgram[]> {
  const q = query(collection(db, 'programs'), where('child_id', '==', childId), limit(500));
  const snap = await getDocs(q);
  return snap.docs
    .map((docRow) => mapPlannerProgram(docRow.id, docRow.data() as Record<string, unknown>))
    .filter((p) => p.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PlannerProgramInput {
  name: string;
  icon?: string;
  color?: string;
  category?: PlannerProgram['category'];
  modules: PlannerActivityModule[];
  isDefault?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export async function upsertPlannerProgram(childId: string, familyId: string, input: PlannerProgramInput, programId?: string): Promise<string> {
  const payload = {
    family_id: familyId,
    child_id: childId,
    name: input.name.trim(),
    icon: input.icon || '📘',
    color: input.color || '#3b82f6',
    category: input.category || 'custom',
    reminder_defaults: {
      minutes_before: [30],
      push_enabled: true
    },
    recurrence_rule: null,
    modules: input.modules,
    is_default: Boolean(input.isDefault),
    is_active: true,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    updated_at: new Date().toISOString(),
    updated_ts: serverTimestamp()
  };

  if (programId) {
    await updateDoc(doc(db, 'programs', programId), payload);
    return programId;
  }

  const ref = await addDoc(collection(db, 'programs'), {
    ...payload,
    created_at: new Date().toISOString(),
    created_ts: serverTimestamp()
  });
  return ref.id;
}

export async function fetchSchoolTimetable(childId: string): Promise<PlannerTimetable | null> {
  const q = query(collection(db, 'school_timetables'), where('child_id', '==', childId), where('is_active', '==', true), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const raw = snap.docs[0].data() as Record<string, unknown>;
  return {
    periods: Array.isArray(raw.periods) ? (raw.periods as string[]) : [],
    days: Array.isArray(raw.days) ? (raw.days as string[]) : [],
    data: (raw.data as PlannerTimetable['data']) || {}
  };
}

export async function createParentPlannerEvent(parentId: string, familyId: string, childId: string, input: PlannerEventInput): Promise<string> {
  const payload = {
    family_id: familyId,
    child_id: childId,
    parent_id: parentId,
    title: input.title,
    description: '',
    category: input.category,
    color: PLANNER_CATEGORY_COLORS[input.category],
    start_at: input.startAt,
    end_at: input.endAt,
    all_day: false,
    timezone: 'Asia/Kolkata',
    recurrence: recurrencePayload(input),
    linked_program_id: input.linkedProgramId || null,
    linked_task_ids: [],
    participant_ids: [],
    reminder_ids: [],
    source: 'manual',
    sync: {
      google_enabled: false,
      google_event_id: null,
      sync_status: 'not_configured',
      last_sync_at: null,
      sync_error: null
    },
    created_by: 'parent',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    created_ts: serverTimestamp(),
    updated_ts: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'events'), payload);
  return ref.id;
}

export async function updateParentPlannerEvent(eventId: string, input: PlannerEventInput): Promise<void> {
  await updateDoc(doc(db, 'events', eventId), {
    title: input.title,
    category: input.category,
    color: PLANNER_CATEGORY_COLORS[input.category],
    start_at: input.startAt,
    end_at: input.endAt,
    linked_program_id: input.linkedProgramId || null,
    recurrence: recurrencePayload(input),
    updated_at: new Date().toISOString(),
    updated_ts: serverTimestamp()
  });
}

export async function createChildQuickPlannerEvent(childId: string, familyId: string, input: PlannerQuickAddInput): Promise<string> {
  const payload = {
    family_id: familyId,
    child_id: childId,
    parent_id: familyId,
    title: input.title,
    description: 'Child quick reminder',
    category: 'personal',
    color: PLANNER_CATEGORY_COLORS.personal,
    start_at: input.startAt,
    end_at: input.endAt,
    all_day: false,
    timezone: 'Asia/Kolkata',
    recurrence: { type: 'none', interval: 1, by_week_days: [], by_month_days: [], until: null, count: null, rrule: null },
    linked_program_id: null,
    linked_task_ids: [],
    participant_ids: [],
    reminder_ids: [],
    source: 'manual',
    sync: { google_enabled: false, google_event_id: null, sync_status: 'not_configured', last_sync_at: null, sync_error: null },
    created_by: 'child',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    created_ts: serverTimestamp(),
    updated_ts: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'events'), payload);
  return ref.id;
}

export async function upsertSchoolTimetableCell(childId: string, familyId: string, input: PlannerTimetableCellInput): Promise<void> {
  const timetableRef = doc(db, 'school_timetables', `${childId}_active`);
  const existing = await fetchSchoolTimetable(childId);
  const periods = existing?.periods || [];
  const days = existing?.days || [];
  const data = existing?.data || {};

  const nextPeriods = periods.includes(input.period) ? periods : [...periods, input.period];
  const nextDays = days.includes(input.day) ? days : [...days, input.day];

  const row = data[input.period] || {};
  const nextData = {
    ...data,
    [input.period]: {
      ...row,
      [input.day]: {
        subject: input.subject,
        room: input.room || '',
        teacher: input.teacher || ''
      }
    }
  };

  await setDoc(timetableRef, {
    family_id: familyId,
    child_id: childId,
    is_active: true,
    periods: nextPeriods,
    days: nextDays,
    data: nextData,
    updated_at: new Date().toISOString(),
    updated_ts: serverTimestamp(),
    created_ts: serverTimestamp()
  }, { merge: true });
}
