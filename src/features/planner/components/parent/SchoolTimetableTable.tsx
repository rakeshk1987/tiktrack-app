import type { PlannerTimetableCell } from '../../types/planner.types';

interface SchoolTimetableTableProps {
  periods: string[];
  days: string[];
  data: Record<string, Record<string, PlannerTimetableCell | undefined>>;
  selectedDay?: string;
  selectedPeriod?: string;
  onCellSelect?: (period: string, day: string) => void;
}

const dayGradients = [
  'from-cyan-500/20 to-blue-500/20',
  'from-fuchsia-500/20 to-violet-500/20',
  'from-emerald-500/20 to-teal-500/20',
  'from-amber-500/20 to-orange-500/20',
  'from-rose-500/20 to-pink-500/20',
  'from-indigo-500/20 to-sky-500/20',
  'from-lime-500/20 to-green-500/20'
];

export function SchoolTimetableTable({ periods, days, data, selectedDay, selectedPeriod, onCellSelect }: SchoolTimetableTableProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold tracking-wide text-white/80">School Timetable</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-xs text-white/80">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-950 px-3 py-2 text-left">Period</th>
              {days.map((day, index) => (
                <th
                  key={day}
                  className={`bg-gradient-to-r ${dayGradients[index % dayGradients.length]} px-3 py-2 text-left font-semibold text-white`}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period} className="border-t border-white/10">
                <td className="sticky left-0 bg-slate-950 px-3 py-2 font-semibold">{period}</td>
                {days.map((day) => {
                  const cell = data[period]?.[day];
                  const selected = selectedPeriod === period && selectedDay === day;
                  return (
                    <td key={`${period}-${day}`} className="px-3 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => onCellSelect?.(period, day)}
                        className={`w-full rounded-xl border px-2 py-2 text-left transition ${
                          selected ? 'border-cyan-300 bg-cyan-400/20 shadow-[0_0_0_1px_rgba(34,211,238,0.35)]' : 'border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.06]'
                        }`}
                      >
                      {cell ? (
                        <>
                          <p className="font-semibold text-white">{cell.subject}</p>
                          {cell.room ? <p className="text-white/70">{cell.room}</p> : null}
                          {cell.teacher ? <p className="text-white/55">{cell.teacher}</p> : null}
                        </>
                      ) : (
                        <span className="text-white/40">Add class</span>
                      )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
