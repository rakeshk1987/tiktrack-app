import type { PlannerAgendaItem } from '../../types/planner.types';

interface ChildExamCountdownProps {
  nextExam?: PlannerAgendaItem;
}

export function ChildExamCountdown({ nextExam }: ChildExamCountdownProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold tracking-wide text-white/80">Exam Countdown</h3>
      <p className="mt-3 text-sm text-white">
        {nextExam ? `${nextExam.title} on ${new Date(nextExam.startAt).toLocaleDateString()}` : 'No upcoming exams.'}
      </p>
    </section>
  );
}
