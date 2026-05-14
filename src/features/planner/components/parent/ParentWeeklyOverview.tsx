interface ParentWeeklyOverviewProps {
  weeklyScore: number;
}

export function ParentWeeklyOverview({ weeklyScore }: ParentWeeklyOverviewProps) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">Weekly score: {weeklyScore}</section>;
}
