interface ParentExamTrackerProps {
  upcomingExamCount: number;
  active?: boolean;
  onClick?: () => void;
}

export function ParentExamTracker({ upcomingExamCount, active = false, onClick }: ParentExamTrackerProps) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-3xl border p-4 text-left text-sm text-white/80 transition ${active ? 'border-cyan-300/60 bg-cyan-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
      Upcoming exams: {upcomingExamCount}
    </button>
  );
}
