import type { PlannerAgendaItem } from '../../types/planner.types';
import { PlannerAgendaList } from '../shared/PlannerAgendaList';

interface ChildTodayAgendaProps {
  items: PlannerAgendaItem[];
}

export function ChildTodayAgenda({ items }: ChildTodayAgendaProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold tracking-wide text-white/80">Today's Agenda</h3>
      <div className="mt-3">
        <PlannerAgendaList items={items} />
      </div>
    </section>
  );
}
