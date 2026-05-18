import { describe, expect, it } from 'vitest';
import { expandRecurringEventForRange } from '../src/features/planner/utils/planner.recurrence';
import type { PlannerEvent } from '../src/features/planner/types/planner.types';

const baseEvent: PlannerEvent = {
  id: 'event-1',
  familyId: 'family-1',
  childId: 'child-1',
  parentId: 'parent-1',
  title: 'Public Speaking',
  category: 'homework',
  color: '#eab308',
  startAt: '2026-05-18T07:10:00.000Z',
  endAt: '2026-05-18T08:10:00.000Z',
  allDay: false,
  timezone: 'Asia/Kolkata',
  recurrence: { type: 'weekly', interval: 1, byWeekDays: [1, 3], byMonthDays: [], until: null, count: null, rrule: null },
  linkedTaskIds: [],
  participantIds: [],
  reminderIds: [],
  source: 'manual',
  sync: { googleEnabled: false, syncStatus: 'not_configured' },
  createdBy: 'parent',
  createdAt: '2026-05-18T00:00:00.000Z',
  updatedAt: '2026-05-18T00:00:00.000Z',
  deletedAt: null
};

describe('planner recurrence expansion', () => {
  it('expands weekly recurrence across every selected weekday', () => {
    const instances = expandRecurringEventForRange(
      baseEvent,
      '2026-05-18T00:00:00.000Z',
      '2026-05-31T23:59:59.999Z'
    );

    expect(instances.map((instance) => instance.startAt.slice(0, 10))).toEqual([
      '2026-05-18',
      '2026-05-20',
      '2026-05-25',
      '2026-05-27'
    ]);
  });

  it('falls back to the original weekday when weekly days are missing', () => {
    const instances = expandRecurringEventForRange(
      { ...baseEvent, recurrence: { ...baseEvent.recurrence, byWeekDays: [] } },
      '2026-05-18T00:00:00.000Z',
      '2026-05-31T23:59:59.999Z'
    );

    expect(instances.map((instance) => new Date(instance.startAt).getUTCDay())).toEqual([1, 1]);
  });
});
