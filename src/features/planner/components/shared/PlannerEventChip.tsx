import { PLANNER_CATEGORY_COLORS } from '../../constants/planner.constants';
import type { PlannerEvent } from '../../types/planner.types';

interface PlannerEventChipProps {
  event: PlannerEvent;
  onClick?: (event: PlannerEvent) => void;
}

export function PlannerEventChip({ event, onClick }: PlannerEventChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:bg-white/[0.06]"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: event.color || PLANNER_CATEGORY_COLORS[event.category] }} />
        <span className="truncate text-sm font-semibold text-white">{event.title}</span>
      </span>
      <span className="text-xs text-white/60">{new Date(event.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </button>
  );
}
