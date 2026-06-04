import type { PlannerTimetableCell, PlannerTimetableSlot } from '../../types/planner.types';

interface SchoolTimetableTableProps {
  periods: string[];
  slots?: PlannerTimetableSlot[];
  days: string[];
  data: Record<string, Record<string, PlannerTimetableCell | undefined>>;
  selectedDay?: string;
  selectedPeriod?: string;
  onCellSelect?: (period: string, day: string) => void;
}

const sessionLabels = {
  morning: 'Morning Session',
  afternoon: 'Afternoon Session'
};

function getSlots(periods: string[], slots?: PlannerTimetableSlot[]) {
  return slots?.length
    ? slots
    : periods.map((period) => ({ id: period, label: period, type: 'class' as const }));
}

function getSessionGroups(slots: PlannerTimetableSlot[]) {
  return slots.reduce<Array<{ key: string; label: string; count: number }>>((groups, slot) => {
    const key = slot.session || 'all';
    const label = slot.session ? sessionLabels[slot.session] : 'Class Time Table';
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.count += 1;
      return groups;
    }
    return [...groups, { key, label, count: 1 }];
  }, []);
}

export function SchoolTimetableTable({ periods, slots, days, data, selectedDay, selectedPeriod, onCellSelect }: SchoolTimetableTableProps) {
  const timetableSlots = getSlots(periods, slots);
  const sessionGroups = getSessionGroups(timetableSlots);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold tracking-wide text-white/80">Class Time Table</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[980px] border-collapse text-center text-xs text-white/80">
          <thead>
            <tr className="border border-white/15">
              <th className="sticky left-0 z-20 border border-white/15 bg-slate-950 px-3 py-2 uppercase tracking-widest text-white" rowSpan={2}>
                Days
              </th>
              {sessionGroups.map((group) => (
                <th
                  key={`${group.key}-${group.label}`}
                  colSpan={group.count}
                  className="border border-white/15 bg-white/10 px-3 py-2 text-center text-sm font-black uppercase tracking-wider text-white"
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr>
              {timetableSlots.map((slot) => (
                <th
                  key={slot.id}
                  className={`border border-white/15 px-3 py-2 font-black uppercase tracking-wider text-white ${
                    slot.type === 'break' ? 'w-10 bg-white/5 text-[10px] text-cyan-100' : 'min-w-[96px] bg-cyan-500/15'
                  }`}
                >
                  {slot.type === 'break' ? '' : (
                    <span className="inline-flex flex-col items-center gap-0.5">
                      <span>{slot.label}</span>
                      {slot.durationMinutes ? <span className="text-[9px] font-bold text-white/45">{slot.durationMinutes}m</span> : null}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((day, dayIndex) => (
              <tr key={day}>
                <td className="sticky left-0 z-10 border border-white/15 bg-slate-950 px-3 py-3 font-black uppercase tracking-wider text-white">
                  {day}
                </td>
                {timetableSlots.map((slot) => {
                  if (slot.type === 'break') {
                    return dayIndex === 0 ? (
                      <td
                        key={slot.id}
                        rowSpan={days.length}
                        className="w-10 border border-white/15 bg-white/5 px-1 py-2 align-middle text-[10px] font-black uppercase tracking-widest text-cyan-100"
                      >
                        <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>{slot.label}</span>
                      </td>
                    ) : null;
                  }

                  const cell = data[slot.id]?.[day];
                  const selected = selectedPeriod === slot.id && selectedDay === day;
                  return (
                    <td key={`${slot.id}-${day}`} className="border border-white/15 p-1.5 align-top">
                      <button
                        type="button"
                        onClick={() => onCellSelect?.(slot.id, day)}
                        className={`min-h-[72px] w-full rounded-lg border px-2 py-2 text-left transition ${
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
