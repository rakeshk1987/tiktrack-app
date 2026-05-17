import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useChildLayout } from './ChildLayout';

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
  const { diarySaving, entries, mutedTextClass, panelClass, handleDiarySubmitForDate } = useChildLayout();
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
    setCalendarOpen(false);
  };

  return (
    <div className="mt-6">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-display font-bold">Diary Calendar</h2>
            <p className={clsx('mt-1 text-sm', mutedTextClass)}>Click any date to create or update your note.</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-white/[0.05] px-4 py-2">
            <p className={clsx('text-xs font-bold uppercase tracking-[0.16em]', mutedTextClass)}>Current streak</p>
            <p className="mt-0.5 text-2xl font-black text-emerald-300">{streak} day{streak === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-bold"
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          <p className="text-lg font-black">{monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
          <button
            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-bold"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wide text-white/60">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {currentMonthCells.map((cell) => {
            const key = toDateKey(cell);
            const isFilled = filledKeys.has(key);
            const inMonth = cell.getMonth() === monthCursor.getMonth();
            const isToday = key === toDateKey(new Date());
            return (
              <button
                key={key}
                onClick={() => {
                  openDateEntry(key);
                  setCalendarOpen(true);
                }}
                className={clsx(
                  'relative min-h-[84px] rounded-2xl border p-2 text-left transition hover:border-cyan-300/60 hover:bg-cyan-500/10',
                  isToday ? 'border-cyan-300/65 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03]',
                  !inMonth && 'opacity-45'
                )}
              >
                <span className="text-sm font-bold">{cell.getDate()}</span>
                {isFilled && <span className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full bg-emerald-400" />}
              </button>
            );
          })}
        </div>

        <div className={clsx('mt-4 text-xs', mutedTextClass)}>
          Green dot means entry exists. Click a date to add or edit.
        </div>
      </div>

      {calendarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className={clsx('w-full max-w-2xl rounded-[1.8rem] border p-5 shadow-2xl', panelClass)}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-display font-bold">Diary Entry</h3>
              <button onClick={() => setCalendarOpen(false)} className="rounded-xl border border-white/20 p-2"><X size={18} /></button>
            </div>
            <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.04] p-4">
              <p className={clsx('text-xs font-bold uppercase tracking-[0.16em]', mutedTextClass)}>Selected date</p>
              <p className="mt-1 text-lg font-bold">{new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString()}</p>
              <textarea
                value={entryDraft}
                onChange={(event) => setEntryDraft(event.target.value)}
                placeholder="Write your day here..."
                className="mt-4 h-56 w-full rounded-[1.1rem] border border-white/12 bg-white/[0.05] px-4 py-4 text-white outline-none transition placeholder:text-white/45"
              />
              {selectedEntry ? <p className={clsx('mt-2 text-xs', mutedTextClass)}>Existing entry loaded. Update and save to edit it.</p> : null}
              <div className="mt-4 flex gap-2">
                <button onClick={() => setCalendarOpen(false)} className="w-1/2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-black">
                  Cancel
                </button>
                <button onClick={() => void saveSelectedDate()} disabled={!entryDraft.trim() || diarySaving} className="w-1/2 rounded-2xl bg-[linear-gradient(135deg,#8b5cf6,#ec4899)] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                  {diarySaving ? 'Saving...' : (selectedEntry ? 'Update Entry' : 'Create Entry')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
