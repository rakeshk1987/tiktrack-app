import type { PlannerEvent } from '../../types/planner.types';

interface PlannerEventModalProps {
  event: PlannerEvent | null;
  open: boolean;
  onClose: () => void;
}

export function PlannerEventModal({ event, open, onClose }: PlannerEventModalProps) {
  if (!open || !event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950 p-5 shadow-2xl max-h-[85vh] overflow-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">{event.title}</h3>
            <p className="mt-1 text-sm text-white/60">{event.category.replace('_', ' ')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/70">Close</button>
        </div>
        <p className="mt-4 text-sm text-white/80">{event.description || 'No description provided.'}</p>
      </div>
    </div>
  );
}
