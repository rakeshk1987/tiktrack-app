import type { PlannerConflict, PlannerEvent } from '../types/planner.types';
import { overlaps } from './planner.time';

function getSeverity(a: PlannerEvent, b: PlannerEvent): PlannerConflict['severity'] {
  if (a.category === 'exam' || b.category === 'exam') return 'high';
  const mediumCategories = new Set(['school', 'tuition']);
  if (mediumCategories.has(a.category) || mediumCategories.has(b.category)) return 'medium';
  return 'low';
}

export function detectPlannerConflicts(events: PlannerEvent[]): PlannerConflict[] {
  const sorted = [...events].sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime());
  const conflicts: PlannerConflict[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    for (let j = i + 1; j < sorted.length; j += 1) {
      const next = sorted[j];
      if (new Date(next.startAt).getTime() >= new Date(current.endAt).getTime()) break;
      if (!overlaps(current.startAt, current.endAt, next.startAt, next.endAt)) continue;

      const startAt = new Date(Math.max(new Date(current.startAt).getTime(), new Date(next.startAt).getTime())).toISOString();
      const endAt = new Date(Math.min(new Date(current.endAt).getTime(), new Date(next.endAt).getTime())).toISOString();

      conflicts.push({
        id: `${current.id}_${next.id}`,
        eventAId: current.id,
        eventBId: next.id,
        startAt,
        endAt,
        severity: getSeverity(current, next),
        reason: `${current.title} overlaps with ${next.title}`
      });
    }
  }

  return conflicts;
}
