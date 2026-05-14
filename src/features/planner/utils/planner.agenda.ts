import type { PlannerAgendaItem, PlannerConflict, PlannerEvent } from '../types/planner.types';

export function buildAgenda(events: PlannerEvent[], conflicts: PlannerConflict[]): PlannerAgendaItem[] {
  const conflictIds = new Set<string>();
  for (const conflict of conflicts) {
    conflictIds.add(conflict.eventAId);
    conflictIds.add(conflict.eventBId);
  }

  return [...events]
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .map((event) => ({
      id: event.id,
      title: event.title,
      category: event.category,
      startAt: event.startAt,
      endAt: event.endAt,
      isConflict: conflictIds.has(event.id),
      isExamPriority: event.category === 'exam'
    }));
}
