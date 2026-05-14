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

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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

  let cursor = new Date(start);
  let index = 0;

  while (index < maxInstances && cursor <= rangeEnd) {
    const instanceEnd = new Date(cursor.getTime() + durationMs);
    const within = instanceEnd >= rangeStart && cursor <= rangeEnd;
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
    } else if (event.recurrence.type === 'weekly') {
      cursor = addDays(cursor, 7 * interval);
    } else if (event.recurrence.type === 'monthly') {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + interval);
      cursor = next;
    } else if (event.recurrence.type === 'yearly') {
      const next = new Date(cursor);
      next.setFullYear(next.getFullYear() + interval);
      cursor = next;
    } else {
      break;
    }

    index += 1;

    if (event.recurrence.until && cursor > new Date(event.recurrence.until)) break;
    if (event.recurrence.count && index >= event.recurrence.count) break;
  }

  return instances;
}
