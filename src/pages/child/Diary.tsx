import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, X } from 'lucide-react';
import { useChildLayout } from './ChildLayout';

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

function buildMonthGrid(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }).map((_, index) => {
    const d = new Date(start);
    d.setDate(start.getDate() + index);
    return d;
  });
}

export default function ChildDiary() {
  const { diarySaving, entries, mutedTextClass, panelClass, softTextClass, handleDiarySubmitForDate } = useChildLayout();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [entryDraft, setEntryDraft] = useState('');

  const entryMap = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((entry) => {
      const key = entry.date.slice(0, 10);
      map.set(key, entry.content);
    });
    return map;
  }, [entries]);

  const filledKeys = useMemo(() => new Set(Array.from(entryMap.keys())), [entryMap]);
  const currentMonthCells = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const selectedEntry = entryMap.get(selectedDateKey) || '';
  const streak = useMemo(() => {
    let count = 0;
    const cursor = new Date();
    while (filledKeys.has(toDateKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [filledKeys]);

  const openDateEntry = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setEntryDraft(entryMap.get(dateKey) || '');
  };

  const saveSelectedDate = async () => {
    await handleDiarySubmitForDate(selectedDateKey, entryDraft);
  };

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-display font-bold">Quest diary</h2>
            <p className={clsx('mt-2 text-sm', mutedTextClass)}>Open calendar and write for any date. Filled dates stay highlighted for streak tracking.</p>
          </div>
          <button onClick={() => setCalendarOpen(true)} className="inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#3b82f6,#2563eb)] px-4 py-3 text-sm font-black text-white">
            <CalendarDays size={16} />
            Calendar
          </button>
        </div>
        <div className="mt-6 rounded-[1.2rem] border border-white/12 bg-white/[0.05] p-4">
          <p className={clsx('text-xs font-bold uppercase tracking-[0.16em]', mutedTextClass)}>Current streak</p>
          <p className="mt-1 text-3xl font-black text-emerald-300">{streak} day{streak === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Recent notes</h3>
        <div className="mt-4 space-y-3 max-h-[520px] overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className={clsx('text-xs font-bold uppercase tracking-[0.18em]', mutedTextClass)}>{new Date(entry.date).toLocaleDateString()}</p>
              <p className={clsx('mt-2 text-sm leading-6', softTextClass)}>{entry.content}</p>
            </div>
          ))}
        </div>
      </div>

      {calendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className={clsx('w-full max-w-5xl rounded-[1.8rem] border p-5 shadow-2xl', panelClass)}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-display font-bold">Diary Calendar</h3>
              <button onClick={() => setCalendarOpen(false)} className="rounded-xl border border-white/20 p-2"><X size={18} /></button>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} className="rounded-lg border border-white/15 px-3 py-1 text-sm">Prev</button>
                  <p className="font-bold">{monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
                  <button onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} className="rounded-lg border border-white/15 px-3 py-1 text-sm">Next</button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-white/60">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {currentMonthCells.map((cell) => {
                    const key = toDateKey(cell);
                    const isSelected = key === selectedDateKey;
                    const isFilled = filledKeys.has(key);
                    const inMonth = cell.getMonth() === monthCursor.getMonth();
                    return (
                      <button
                        key={key}
                        onClick={() => openDateEntry(key)}
                        className={clsx(
                          'relative rounded-xl border px-2 py-2 text-sm transition',
                          isSelected ? 'border-cyan-300 bg-cyan-500/20 text-cyan-100' : 'border-white/10 bg-white/[0.03]',
                          !inMonth && 'opacity-45'
                        )}
                      >
                        {cell.getDate()}
                        {isFilled && <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-4">
                <p className={clsx('text-xs font-bold uppercase tracking-[0.16em]', mutedTextClass)}>Selected date</p>
                <p className="mt-1 text-lg font-bold">{new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString()}</p>
                <textarea
                  value={entryDraft}
                  onChange={(event) => setEntryDraft(event.target.value)}
                  placeholder="Write your day here..."
                  className="mt-4 h-56 w-full rounded-[1.1rem] border border-white/12 bg-white/[0.05] px-4 py-4 text-white outline-none transition placeholder:text-white/45"
                />
                {selectedEntry ? <p className={clsx('mt-2 text-xs', mutedTextClass)}>Existing entry loaded. Update and save to edit it.</p> : null}
                <button onClick={() => void saveSelectedDate()} disabled={!entryDraft.trim() || diarySaving} className="mt-4 w-full rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#ec4899)] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                  {diarySaving ? 'Saving...' : 'Save Diary For Date'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
