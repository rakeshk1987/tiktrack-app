import type { PlannerAgendaItem } from '../../types/planner.types';

interface PlannerAgendaListProps {
  items: PlannerAgendaItem[];
}

export function PlannerAgendaList({ items }: PlannerAgendaListProps) {
  if (!items.length) {
    return <p className="text-sm text-white/60">No agenda items.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition-all duration-200 hover:border-cyan-300/35 hover:bg-cyan-500/[0.08]">
          <p className="text-sm font-semibold text-white">{item.title}</p>
          <p className="text-xs leading-5 text-white/75">
            {new Date(item.startAt).toLocaleString()} - {new Date(item.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ))}
    </div>
  );
}
