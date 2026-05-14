interface ChildQuestTimelineProps {
  completedCount: number;
  pendingCount: number;
}

export function ChildQuestTimeline({ completedCount, pendingCount }: ChildQuestTimelineProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold tracking-wide text-white/80">Quest Timeline</h3>
      <p className="mt-3 text-sm text-white/80">Completed: {completedCount}</p>
      <p className="text-sm text-white/60">Pending: {pendingCount}</p>
    </section>
  );
}
