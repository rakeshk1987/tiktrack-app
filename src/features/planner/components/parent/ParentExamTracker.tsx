interface ParentExamTrackerProps {
  upcomingExamCount: number;
  monthlyExamCount?: number;
  scheduledExamCount?: number;
  marksLabel?: string;
  averageScore?: number;
  periodLabel?: string;
  active?: boolean;
  onClick?: () => void;
}

export function ParentExamTracker({
  upcomingExamCount,
  monthlyExamCount = upcomingExamCount,
  scheduledExamCount = 0,
  marksLabel = '0/0',
  averageScore = 0,
  periodLabel = 'This month',
  active = false,
  onClick
}: ParentExamTrackerProps) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-3xl border p-4 text-left text-sm text-white/80 transition ${active ? 'border-cyan-300/60 bg-cyan-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
      <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">{periodLabel}</span>
      <span className="mt-1 block text-base font-semibold text-white">Exams: {monthlyExamCount}</span>
      <span className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-xl bg-white/[0.04] px-2 py-1.5 text-white/65">Upcoming {upcomingExamCount}</span>
        <span className="rounded-xl bg-white/[0.04] px-2 py-1.5 text-white/65">Scheduled {scheduledExamCount}</span>
        <span className="rounded-xl bg-white/[0.04] px-2 py-1.5 text-white/65">Marks {marksLabel}</span>
        <span className="rounded-xl bg-white/[0.04] px-2 py-1.5 text-white/65">Avg {averageScore}%</span>
      </span>
    </button>
  );
}
