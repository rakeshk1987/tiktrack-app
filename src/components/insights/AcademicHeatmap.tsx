import clsx from 'clsx';
import { detectWeakSubjects } from '../../hooks/useCoreLogic';
import type { ExamResult } from '../../types/schema';

interface Props {
  exams: ExamResult[];
  isDark: boolean;
}

export default function AcademicHeatmap({ exams, isDark }: Props) {
  const subjects = detectWeakSubjects(exams);

  if (subjects.length === 0) {
    return (
      <div className={clsx(
        "rounded-2xl border p-6 flex flex-col items-center justify-center text-center h-64",
        isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white/70'
      )}>
        <p className="opacity-60 font-bold">No academic data found.</p>
        <p className="text-sm opacity-40 mt-1">Please add exam logs to view the heatmap.</p>
      </div>
    );
  }

  return (
    <div className={clsx(
      "rounded-[2rem] border p-6 shadow-xl",
      isDark ? 'border-fuchsia-400/20 bg-[linear-gradient(145deg,rgba(49,15,54,0.6),rgba(15,23,42,0.8))]' : 'border-pink-200 bg-[linear-gradient(145deg,#ffffff,#fff0f5)]'
    )}>
      <div className="mb-6">
        <h3 className="font-bold text-lg">Academic Heatmap</h3>
        <p className="text-sm opacity-60">Subject weakness detection</p>
      </div>

      <div className="space-y-5">
        {subjects.map((sub, idx) => {
          const isWeak = sub.percentage < 50;
          const isOk = sub.percentage >= 50 && sub.percentage < 75;
          // const isStrong = sub.percentage >= 75;

          const barColor = isWeak ? 'bg-[linear-gradient(90deg,#f43f5e,#fb7185)]' : isOk ? 'bg-[linear-gradient(90deg,#f59e0b,#fbbf24)]' : 'bg-[linear-gradient(90deg,#10b981,#34d399)]';
          const shadowColor = isWeak ? 'shadow-[0_0_12px_rgba(244,63,94,0.6)]' : isOk ? 'shadow-[0_0_12px_rgba(245,158,11,0.6)]' : 'shadow-[0_0_12px_rgba(16,185,129,0.6)]';

          return (
            <div key={sub.subject} className="relative animate-in slide-in-from-right-4 duration-500 fill-mode-both" style={{ animationDelay: `${idx * 100}ms` }}>
              <div className="flex justify-between items-end mb-2 text-sm font-bold uppercase tracking-wider">
                <span className={isDark ? 'text-white/90' : 'text-slate-800'}>{sub.subject}</span>
                <span className={clsx(isWeak ? 'text-rose-400' : isOk ? 'text-amber-500' : 'text-emerald-500')}>{sub.percentage}%</span>
              </div>
              <div className={clsx("h-3.5 w-full rounded-full overflow-hidden", isDark ? 'bg-white/10' : 'bg-slate-200/80')}>
                <div 
                  className={clsx("h-full rounded-full transition-all duration-1000 ease-out", barColor, shadowColor)}
                  style={{ width: `${sub.percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
