interface PlannerConflictBannerProps {
  conflictCount: number;
}

export function PlannerConflictBanner({ conflictCount }: PlannerConflictBannerProps) {
  if (conflictCount <= 0) return null;

  return (
    <div className="rounded-2xl border border-rose-300/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
      {conflictCount} schedule conflict{conflictCount > 1 ? 's' : ''} detected. Review overlaps.
    </div>
  );
}
