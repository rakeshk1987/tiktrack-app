import type { PlannerEvent } from '../types/planner.types';

export interface ExpandedPlannerEventInstance {
  instanceId: string;
  rootEventId: string;
  title: string;
  category: PlannerEvent['category'];
  color: string;
  startAt: string;
  endAt: string;
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function withTimeFrom(date: Date, source: Date): Date {
  const d = new Date(date);
  d.setHours(source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function overlaps(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return end >= rangeStart && start <= rangeEnd;
}

function normalizeWeekDays(days: number[] | undefined, fallback: number): number[] {
  const normalized = (days || [])
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  const unique = Array.from(new Set(normalized.length ? normalized : [fallback]));
  return unique.sort((a, b) => a - b);
}

export function expandRecurringEventForRange(
  event: PlannerEvent,
  rangeStartIso: string,
  rangeEndIso: string,
  maxInstances = 400
): ExpandedPlannerEventInstance[] {
  const rangeStart = new Date(rangeStartIso);
  const rangeEnd = new Date(rangeEndIso);

  if (event.recurrence.type === 'none') {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    if (!overlaps(start, end, rangeStart, rangeEnd)) return [];
    return [{
      instanceId: `${event.id}::0`,
      rootEventId: event.id,
      title: event.title,
      category: event.category,
      color: event.color,
      startAt: event.startAt,
      endAt: event.endAt
    }];
  }

  const instances: ExpandedPlannerEventInstance[] = [];
  const interval = Math.max(1, event.recurrence.interval || 1);
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const durationMs = Math.max(0, end.getTime() - start.getTime());

  if (event.recurrence.type === 'weekly') {
    const weekDays = normalizeWeekDays(event.recurrence.byWeekDays, start.getDay());
    const until = event.recurrence.until ? new Date(event.recurrence.until) : null;
    const count = event.recurrence.count || null;
    let weekStart = startOfWeek(start);
    let generatedCount = 0;
    let safety = 0;

    if (!count && rangeStart > weekStart) {
      const elapsedWeeks = Math.floor((startOfWeek(rangeStart).getTime() - weekStart.getTime()) / (7 * 86400000));
      const intervalsToSkip = Math.max(0, Math.floor(elapsedWeeks / interval) - 1);
      if (intervalsToSkip > 0) {
        weekStart = addDays(weekStart, intervalsToSkip * 7 * interval);
      }
    }

    while (instances.length < maxInstances && weekStart <= rangeEnd && safety < maxInstances * 8) {
      for (const weekDay of weekDays) {
        const occurrenceDay = addDays(weekStart, weekDay);
        const cursor = withTimeFrom(occurrenceDay, start);
        if (cursor < start) continue;
        if (until && cursor > until) return instances;
        if (count && generatedCount >= count) return instances;

        const instanceEnd = new Date(cursor.getTime() + durationMs);
        if (overlaps(cursor, instanceEnd, rangeStart, rangeEnd)) {
          instances.push({
            instanceId: `${event.id}::${generatedCount}`,
            rootEventId: event.id,
            title: event.title,
            category: event.category,
            color: event.color,
            startAt: cursor.toISOString(),
            endAt: instanceEnd.toISOString()
          });
          if (instances.length >= maxInstances) return instances;
        }
        generatedCount += 1;
      }

      weekStart = addDays(weekStart, 7 * interval);
      safety += 1;
    }

    return instances;
  }

  let cursor = new Date(start);
  let index = 0;

  if (!event.recurrence.count && rangeStart > cursor) {
    if (event.recurrence.type === 'daily') {
      const elapsedDays = Math.floor((rangeStart.getTime() - cursor.getTime()) / 86400000);
      const intervalsToSkip = Math.max(0, Math.floor(elapsedDays / interval) - 1);
      if (intervalsToSkip > 0) {
        cursor = addDays(cursor, intervalsToSkip * interval);
        index = intervalsToSkip;
      }
    } else if (event.recurrence.type === 'monthly') {
      const elapsedMonths = (rangeStart.getFullYear() - cursor.getFullYear()) * 12 + (rangeStart.getMonth() - cursor.getMonth());
      const intervalsToSkip = Math.max(0, Math.floor(elapsedMonths / interval) - 1);
      if (intervalsToSkip > 0) {
        cursor = addMonths(cursor, intervalsToSkip * interval);
        index = intervalsToSkip;
      }
    } else if (event.recurrence.type === 'yearly') {
      const elapsedYears = rangeStart.getFullYear() - cursor.getFullYear();
      const intervalsToSkip = Math.max(0, Math.floor(elapsedYears / interval) - 1);
      if (intervalsToSkip > 0) {
        cursor = addYears(cursor, intervalsToSkip * interval);
        index = intervalsToSkip;
      }
    }
  }

  while (instances.length < maxInstances && cursor <= rangeEnd) {
    const instanceEnd = new Date(cursor.getTime() + durationMs);
    const within = overlaps(cursor, instanceEnd, rangeStart, rangeEnd);
    if (within) {
      instances.push({
        instanceId: `${event.id}::${index}`,
        rootEventId: event.id,
        title: event.title,
        category: event.category,
        color: event.color,
        startAt: cursor.toISOString(),
        endAt: instanceEnd.toISOString()
      });
    }

    if (event.recurrence.type === 'daily') {
      cursor = addDays(cursor, interval);
    } else if (event.recurrence.type === 'monthly') {
      cursor = addMonths(cursor, interval);
    } else if (event.recurrence.type === 'yearly') {
      cursor = addYears(cursor, interval);
    } else {
      break;
    }

    index += 1;

    if (event.recurrence.until && cursor > new Date(event.recurrence.until)) break;
    if (event.recurrence.count && index >= event.recurrence.count) break;
  }

  return instances;
}

export function formatPlannerRecurrence(recurrence: PlannerEvent['recurrence']): string {
  if (!recurrence || recurrence.type === 'none') return 'One time';
  if (recurrence.type === 'daily') return 'Repeats daily';
  if (recurrence.type === 'weekly') {
    const days = normalizeWeekDays(recurrence.byWeekDays, 0).map((day) => WEEKDAY_LABELS[day]).join(', ');
    return `Repeats weekly${days ? ` on ${days}` : ''}`;
  }
  if (recurrence.type === 'monthly') return 'Repeats monthly';
  if (recurrence.type === 'yearly') return 'Repeats yearly';
  return 'Custom repeat';
}

export function getNextPlannerOccurrence(event: PlannerEvent, from = new Date()): ExpandedPlannerEventInstance | null {
  const rangeEnd = new Date(from);
  rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);
  const instances = expandRecurringEventForRange(event, from.toISOString(), rangeEnd.toISOString(), 500)
    .filter((instance) => new Date(instance.startAt).getTime() >= from.getTime())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  return instances[0] || null;
}

export function getPlannerExpiryStatus(event: PlannerEvent, from = new Date()): string {
  if (event.recurrence.type === 'none') {
    return new Date(event.endAt).getTime() < from.getTime() ? 'Expired' : 'Active';
  }
  if (event.recurrence.until && new Date(event.recurrence.until).getTime() < from.getTime()) {
    return 'Expired';
  }
  return getNextPlannerOccurrence(event, from) ? 'Active' : 'Expired';
}
