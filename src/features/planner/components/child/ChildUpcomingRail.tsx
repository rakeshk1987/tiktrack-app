import type { PlannerAgendaItem } from '../../types/planner.types';

interface ChildUpcomingRailProps {
  items: PlannerAgendaItem[];
}

export function ChildUpcomingRail({ items }: ChildUpcomingRailProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold tracking-wide text-white/80">Upcoming</h3>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <p className="text-sm text-white/60">No upcoming events.</p> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-white/10 px-3 py-2">
            <p className="text-sm font-semibold text-white">{item.title}</p>
            <p className="text-xs text-white/60">{new Date(item.startAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
