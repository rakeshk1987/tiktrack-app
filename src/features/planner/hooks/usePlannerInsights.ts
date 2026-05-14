import { useMemo } from 'react';
import type { PlannerEvent } from '../types/planner.types';
import { buildAgenda } from '../utils/planner.agenda';
import { buildBurnoutInsight } from '../utils/planner.burnout';
import { detectPlannerConflicts } from '../utils/planner.conflicts';

export function usePlannerInsights(events: PlannerEvent[]) {
  const conflicts = useMemo(() => detectPlannerConflicts(events), [events]);
  const burnout = useMemo(() => buildBurnoutInsight(events), [events]);
  const agenda = useMemo(() => buildAgenda(events, conflicts), [events, conflicts]);

  return {
    conflicts,
    burnout,
    agenda
  };
}
