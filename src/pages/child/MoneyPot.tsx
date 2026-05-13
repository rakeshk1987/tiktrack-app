import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { MoneyPotEntry } from '../../types/schema';
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

export default function ChildMoneyPot() {
  const { panelClass, mutedTextClass, profile, parentId } = useChildLayout();
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [popupOpen, setPopupOpen] = useState(false);
  const [amount, setAmount] = useState<number | ''>('');
  const [entryType, setEntryType] = useState<'receive' | 'spend'>('receive');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState<number | ''>(profile.money_weekly_goal || '');
  const [wishTitle, setWishTitle] = useState(profile.money_wish_title || '');
  const [wishTarget, setWishTarget] = useState<number | ''>(profile.money_wish_target || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [entries, setEntries] = useState<MoneyPotEntry[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'money_pot_entries'), where('child_id', '==', profile.id));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MoneyPotEntry, 'id'>) }));
      setEntries(mapped.sort((a, b) => a.date.localeCompare(b.date)));
    });
    return () => unsub();
  }, [profile.id]);

  const entryMapByDate = useMemo(() => {
    const map = new Map<string, MoneyPotEntry[]>();
    entries.forEach((entry) => {
      const list = map.get(entry.date) || [];
      list.push(entry);
      map.set(entry.date, list);
    });
    return map;
  }, [entries]);

  const balance = useMemo(
    () => entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    [entries]
  );

  const currentMonthCells = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const monthStart = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1), [monthCursor]);
  const monthEnd = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0), [monthCursor]);

  const monthlyReceived = useMemo(() => {
    return entries
      .filter((entry) => {
        const d = new Date(`${entry.date}T00:00:00`);
        return d >= monthStart && d <= monthEnd && entry.amount > 0;
      })
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }, [entries, monthEnd, monthStart]);

  const monthlySpent = useMemo(() => {
    return entries
      .filter((entry) => {
        const d = new Date(`${entry.date}T00:00:00`);
        return d >= monthStart && d <= monthEnd && entry.amount < 0;
      })
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount || 0)), 0);
  }, [entries, monthEnd, monthStart]);

  const selectedEntries = entryMapByDate.get(selectedDateKey) || [];
  const selectedDateNet = selectedEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const weekStart = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }, []);
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStart]);

  const weeklySaved = useMemo(() => {
    return entries
      .filter((entry) => {
        const d = new Date(`${entry.date}T00:00:00`);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }, [entries, weekEnd, weekStart]);

  const weeklyGoalNumber = Number(weeklyGoal || 0);
  const weeklyGoalProgress = weeklyGoalNumber > 0
    ? Math.min(100, Math.max(0, Math.round((Math.max(0, weeklySaved) / weeklyGoalNumber) * 100)))
    : 0;
  const weeklyGoalRemaining = Math.max(0, weeklyGoalNumber - Math.max(0, weeklySaved));

  const noSpendStreak = useMemo(() => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i += 1) {
      const cursor = new Date(today);
      cursor.setDate(today.getDate() - i);
      const key = toDateKey(cursor);
      const dayEntries = entryMapByDate.get(key) || [];
      const spentThatDay = dayEntries.some((entry) => Number(entry.amount) < 0);
      if (spentThatDay) break;
      streak += 1;
    }
    return streak;
  }, [entryMapByDate]);
  const todaySpent = useMemo(() => {
    const todayEntries = entryMapByDate.get(toDateKey(new Date())) || [];
    return todayEntries.some((entry) => Number(entry.amount) < 0);
  }, [entryMapByDate]);

  const wishTargetNumber = Number(wishTarget || 0);
  const wishProgress = wishTargetNumber > 0
    ? Math.min(100, Math.max(0, Math.round((Math.max(0, balance) / wishTargetNumber) * 100)))
    : 0;

  const saveEntry = async () => {
    const numeric = Number(amount);
    if (!numeric || numeric <= 0) return;
    setSaving(true);
    try {
      const signedAmount = entryType === 'spend' ? -numeric : numeric;
      await addDoc(collection(db, 'money_pot_entries'), {
        child_id: profile.id,
        parent_id: parentId,
        date: selectedDateKey,
        amount: signedAmount,
        type: entryType,
        note: note.trim() || '',
        created_at: new Date().toISOString()
      });
      setAmount('');
      setNote('');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateDoc(doc(db, 'child_profile', profile.id), {
        money_weekly_goal: Number(weeklyGoal || 0),
        money_wish_title: wishTitle.trim(),
        money_wish_target: Number(wishTarget || 0),
        updated_at: new Date().toISOString()
      });
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Money Pot</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>Track money received and spent by date to build saving habits.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Total Balance</p>
            <p className={clsx('mt-1 text-xl font-black', balance >= 0 ? 'text-emerald-300' : 'text-rose-300')}>Rs {balance.toFixed(0)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>This Month Received</p>
            <p className="mt-1 text-xl font-black text-emerald-300">Rs {monthlyReceived.toFixed(0)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>This Month Spent</p>
            <p className="mt-1 text-xl font-black text-rose-300">Rs {monthlySpent.toFixed(0)}</p>
          </div>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Savings Goals</h3>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Weekly Goal Meter</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>Saved this week: Rs {weeklySaved.toFixed(0)}</span>
              <span>Goal: Rs {weeklyGoalNumber || 0}</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-white/10 p-0.5">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#10b981)]" style={{ width: `${weeklyGoalProgress}%` }} />
            </div>
            <div className="mt-2 text-xs font-bold text-emerald-300">{weeklyGoalProgress}% complete</div>
            {weeklyGoalNumber > 0 ? (
              <p className={clsx('mt-2 text-xs font-semibold', weeklyGoalRemaining === 0 ? 'text-emerald-300' : 'text-cyan-200')}>
                {weeklyGoalRemaining === 0
                  ? 'Weekly goal completed. Amazing saving discipline!'
                  : `You are Rs ${weeklyGoalRemaining.toFixed(0)} away from this week’s goal.`}
              </p>
            ) : (
              <p className={clsx('mt-2 text-xs font-semibold', mutedTextClass)}>Set a weekly goal to unlock progress nudges.</p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>No-Spend Streak</p>
            <p className="mt-2 text-2xl font-black text-amber-300">{noSpendStreak} day{noSpendStreak === 1 ? '' : 's'}</p>
            <p className={clsx('mt-1 text-xs', mutedTextClass)}>Counts consecutive days with no spending entries.</p>
            <p className={clsx('mt-2 text-xs font-semibold', todaySpent ? 'text-rose-200' : 'text-emerald-200')}>
              {todaySpent
                ? 'No-spend streak broken today. Try a save-only day tomorrow.'
                : 'Streak alive today. Keep it going!'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[170px_1fr_170px_auto]">
          <input
            type="number"
            value={weeklyGoal}
            onChange={(event) => setWeeklyGoal(event.target.value ? Number(event.target.value) : '')}
            placeholder="Weekly goal (Rs)"
            className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white"
          />
          <input
            value={wishTitle}
            onChange={(event) => setWishTitle(event.target.value)}
            placeholder="Wish item (e.g., new book)"
            className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white"
          />
          <input
            type="number"
            value={wishTarget}
            onChange={(event) => setWishTarget(event.target.value ? Number(event.target.value) : '')}
            placeholder="Wish target (Rs)"
            className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white"
          />
          <button onClick={() => void saveSettings()} disabled={savingSettings} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {savingSettings ? 'Saving...' : 'Save Goals'}
          </button>
        </div>

        {wishTargetNumber > 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Wish Target</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-bold">{wishTitle || 'My Wish'}</span>
              <span>Rs {Math.max(0, balance).toFixed(0)} / Rs {wishTargetNumber.toFixed(0)}</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-white/10 p-0.5">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#ec4899)]" style={{ width: `${wishProgress}%` }} />
            </div>
            <div className="mt-2 text-xs font-bold text-violet-200">{wishProgress}% reached</div>
          </div>
        ) : null}
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
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
            const inMonth = cell.getMonth() === monthCursor.getMonth();
            const isToday = key === toDateKey(new Date());
            const dayEntries = entryMapByDate.get(key) || [];
            const dayNet = dayEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedDateKey(key);
                  setPopupOpen(true);
                }}
                className={clsx(
                  'relative min-h-[88px] rounded-2xl border p-2 text-left transition hover:border-cyan-300/60 hover:bg-cyan-500/10',
                  isToday ? 'border-cyan-300/65 bg-cyan-500/10' : 'border-white/10 bg-white/[0.03]',
                  !inMonth && 'opacity-45'
                )}
              >
                <span className="text-sm font-bold">{cell.getDate()}</span>
                {dayEntries.length > 0 ? (
                  <span className={clsx('absolute bottom-2 right-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold', dayNet >= 0 ? 'bg-emerald-400/25 text-emerald-200' : 'bg-rose-400/25 text-rose-200')}>
                    {dayNet >= 0 ? '+' : '-'}{Math.abs(dayNet)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className={clsx('mt-4 text-xs', mutedTextClass)}>
          Click a date to add money in or money out.
        </div>
      </div>

      {popupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className={clsx('w-full max-w-2xl rounded-[1.8rem] border p-5 shadow-2xl', panelClass)}>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-display font-bold">Money Pot Entry</h3>
              <button onClick={() => setPopupOpen(false)} className="rounded-xl border border-white/20 p-2"><X size={18} /></button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.04] p-4">
              <p className={clsx('text-xs font-bold uppercase tracking-[0.16em]', mutedTextClass)}>Selected date</p>
              <p className="mt-1 text-lg font-bold">{new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString()}</p>
              <p className={clsx('mt-1 text-sm', selectedDateNet >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                Net for this day: Rs {selectedDateNet.toFixed(0)}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-[180px_1fr]">
                <select value={entryType} onChange={(event) => setEntryType(event.target.value as 'receive' | 'spend')} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white">
                  <option value="receive">Received (+)</option>
                  <option value="spend">Spent (-)</option>
                </select>
                <input type="number" value={amount} onChange={(event) => setAmount(event.target.value ? Number(event.target.value) : '')} placeholder="Amount in rupees" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
              </div>

              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Note (gift, snack, toy, etc.)"
                className="mt-3 h-24 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white"
              />

              <div className="mt-4 flex gap-2">
                <button onClick={() => setPopupOpen(false)} className="w-1/2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-black">
                  Close
                </button>
                <button onClick={() => void saveEntry()} disabled={saving || !amount} className="w-1/2 rounded-2xl bg-[linear-gradient(135deg,#10b981,#14b8a6)] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-48 space-y-2 overflow-y-auto pr-1">
              {selectedEntries.length === 0 ? (
                <p className={mutedTextClass}>No entries for this date.</p>
              ) : (
                selectedEntries
                  .slice()
                  .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
                  .map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">{entry.type === 'receive' ? 'Received' : 'Spent'}</p>
                        <p className={clsx('text-sm font-black', entry.amount >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                          {entry.amount >= 0 ? '+' : '-'}Rs {Math.abs(entry.amount)}
                        </p>
                      </div>
                      {entry.note ? <p className={clsx('mt-1 text-xs', mutedTextClass)}>{entry.note}</p> : null}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
