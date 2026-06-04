import { DEFAULT_KIDS_TIMETABLE_SLOTS } from '../constants/planner.mock';
import type { PlannerTimetable, PlannerTimetableSlot } from '../types/planner.types';

const DAY_TO_WEEKDAY = new Map([
  ['sun', 0],
  ['sunday', 0],
  ['mon', 1],
  ['monday', 1],
  ['tue', 2],
  ['tues', 2],
  ['tuesday', 2],
  ['wed', 3],
  ['wednesday', 3],
  ['thu', 4],
  ['thur', 4],
  ['thurs', 4],
  ['thursday', 4],
  ['fri', 5],
  ['friday', 5],
  ['sat', 6],
  ['saturday', 6]
]);

export function getTimetableClassPeriods(timetable: PlannerTimetable | null | undefined) {
  const slots = timetable?.slots?.length ? timetable.slots : timetable?.periods.map((period) => ({
    id: period,
    label: period,
    type: 'class' as const
  }));

  return (slots || [])
    .filter((slot) => slot.type === 'class')
    .map((slot) => slot.id);
}

export function normalizePlannerTimetable(raw: Record<string, unknown>): PlannerTimetable {
  const periods = Array.isArray(raw.periods) ? (raw.periods as string[]) : [];
  const days = Array.isArray(raw.days) ? (raw.days as string[]) : [];
  const rawSlots = Array.isArray(raw.slots) ? raw.slots : [];
  const parsedSlots = rawSlots
    .filter((slot): slot is PlannerTimetableSlot => {
      if (!slot || typeof slot !== 'object') return false;
      const value = slot as Record<string, unknown>;
      return typeof value.id === 'string' && typeof value.label === 'string' && (value.type === 'class' || value.type === 'break');
    })
    .map((slot) => ({
      id: slot.id,
      label: slot.label,
      type: slot.type,
      session: slot.session,
      durationMinutes: typeof slot.durationMinutes === 'number' ? slot.durationMinutes : undefined
    }));
  const defaultSlots = getDefaultKidsTimetableSlots();
  const baseSlots = parsedSlots.length ? parsedSlots : defaultSlots;
  const slotIds = new Set(baseSlots.map((slot) => slot.id));
  const customPeriodSlots = periods
    .filter((period) => !slotIds.has(period))
    .map((period) => ({ id: period, label: period, type: 'class' as const, durationMinutes: 40 }));
  const slots = [...baseSlots, ...customPeriodSlots];

  const nextPeriods = periods.length
    ? periods
    : slots.filter((slot) => slot.type === 'class').map((slot) => slot.id);
  const slotClassPeriods = slots.filter((slot) => slot.type === 'class').map((slot) => slot.id);

  return {
    periods: Array.from(new Set([...nextPeriods, ...slotClassPeriods])),
    slots,
    days: days.length ? days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    data: (raw.data as PlannerTimetable['data']) || {}
  };
}

export function getDefaultKidsTimetableSlots() {
  return DEFAULT_KIDS_TIMETABLE_SLOTS.map((slot) => ({ ...slot }));
}

function countWeekdayInMonth(anchor: Date, weekday: number) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    if (new Date(year, month, day).getDay() === weekday) count += 1;
  }

  return count;
}

function normalizeSubject(subject: string) {
  return subject.trim().replace(/\s+/g, ' ');
}

export function buildTimetableSubjectMonthlyInsights(timetable: PlannerTimetable, monthAnchor: Date) {
  const subjectMinutes = new Map<string, { subject: string; minutes: number; periods: number }>();
  const slots = timetable.slots?.length
    ? timetable.slots
    : timetable.periods.map((period) => ({ id: period, label: period, type: 'class' as const, durationMinutes: 40 }));

  for (const day of timetable.days) {
    const weekday = DAY_TO_WEEKDAY.get(day.trim().toLowerCase());
    if (weekday === undefined) continue;

    const dayOccurrences = countWeekdayInMonth(monthAnchor, weekday);
    for (const slot of slots) {
      if (slot.type !== 'class') continue;
      const subject = normalizeSubject(timetable.data[slot.id]?.[day]?.subject || '');
      if (!subject) continue;

      const key = subject.toLowerCase();
      const current = subjectMinutes.get(key) || { subject, minutes: 0, periods: 0 };
      current.minutes += (slot.durationMinutes || 40) * dayOccurrences;
      current.periods += dayOccurrences;
      subjectMinutes.set(key, current);
    }
  }

  return Array.from(subjectMinutes.values())
    .map((item) => ({
      ...item,
      hours: Math.round((item.minutes / 60) * 10) / 10
    }))
    .sort((a, b) => b.minutes - a.minutes || a.subject.localeCompare(b.subject));
}
