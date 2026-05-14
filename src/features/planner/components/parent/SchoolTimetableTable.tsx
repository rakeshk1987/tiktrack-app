import type { PlannerTimetableCell } from '../../types/planner.types';

interface SchoolTimetableTableProps {
  periods: string[];
  days: string[];
  data: Record<string, Record<string, PlannerTimetableCell | undefined>>;
}

export function SchoolTimetableTable({ periods, days, data }: SchoolTimetableTableProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold tracking-wide text-white/80">School Timetable</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-xs text-white/80">
          <thead>
            <tr>
              <th className="sticky left-0 bg-slate-950 px-3 py-2 text-left">Period</th>
              {days.map((day) => (
                <th key={day} className="px-3 py-2 text-left">{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period} className="border-t border-white/10">
                <td className="sticky left-0 bg-slate-950 px-3 py-2 font-semibold">{period}</td>
                {days.map((day) => {
                  const cell = data[period]?.[day];
                  return (
                    <td key={`${period}-${day}`} className="px-3 py-2 align-top">
                      {cell ? (
                        <>
                          <p>{cell.subject}</p>
                          {cell.room ? <p className="text-white/60">{cell.room}</p> : null}
                          {cell.teacher ? <p className="text-white/50">{cell.teacher}</p> : null}
                        </>
                      ) : (
                        <span className="text-white/40">-</span>
                      )}
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
