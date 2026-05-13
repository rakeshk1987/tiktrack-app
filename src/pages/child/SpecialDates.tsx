import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { SpecialDate } from '../../types/schema';
import { useChildLayout } from './ChildLayout';

const todayKey = () => new Date().toISOString().slice(0, 10);
const THEME_META: Record<string, { title: string; gradient: string; glow: string; emoji: string }> = {
  birthday: {
    title: 'Birthday Vibes',
    gradient: 'from-pink-500/35 via-fuchsia-500/25 to-amber-400/30',
    glow: 'shadow-[0_0_60px_rgba(236,72,153,0.28)]',
    emoji: '🎂'
  },
  celebration: {
    title: 'Celebration Mode',
    gradient: 'from-sky-500/30 via-cyan-400/20 to-emerald-400/30',
    glow: 'shadow-[0_0_60px_rgba(34,211,238,0.22)]',
    emoji: '🎉'
  },
  festival: {
    title: 'Festival Glow',
    gradient: 'from-amber-400/35 via-orange-400/25 to-rose-400/25',
    glow: 'shadow-[0_0_60px_rgba(251,191,36,0.24)]',
    emoji: '🪔'
  },
  custom: {
    title: 'Special Day',
    gradient: 'from-indigo-500/30 via-violet-500/20 to-pink-500/25',
    glow: 'shadow-[0_0_60px_rgba(99,102,241,0.22)]',
    emoji: '✨'
  }
};

export default function ChildSpecialDates() {
  const { panelClass, mutedTextClass, profile, parentId } = useChildLayout();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey());
  const [theme, setTheme] = useState<SpecialDate['theme']>('custom');
  const [saving, setSaving] = useState(false);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'special_dates'), where('child_id', '==', profile.id));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SpecialDate, 'id'>) }));
      setSpecialDates(mapped.sort((a, b) => a.date.localeCompare(b.date)));
    });
    return () => unsub();
  }, [profile.id]);

  const todayEvents = useMemo(() => {
    const todayMd = todayKey().slice(5);
    const birthdayMd = (profile.date_of_birth || '').slice(5, 10);
    const customToday = specialDates.filter((item) => item.date.slice(5) === todayMd);
    const birthdayToday = birthdayMd === todayMd ? [{
      id: 'birthday-default',
      title: 'Birthday',
      date: profile.date_of_birth?.slice(0, 10) || todayKey(),
      theme: 'birthday' as const
    }] : [];
    return [...birthdayToday, ...customToday];
  }, [profile.date_of_birth, specialDates]);
  const activeTheme = (todayEvents[0]?.theme || 'custom') as keyof typeof THEME_META;
  const themeMeta = THEME_META[activeTheme] || THEME_META.custom;

  const saveSpecialDate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'special_dates'), {
        child_id: profile.id,
        parent_id: parentId,
        title: title.trim(),
        date,
        theme: theme || 'custom',
        created_at: new Date().toISOString()
      });
      setTitle('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={clsx('mt-6 space-y-5 rounded-[2rem] border p-4 sm:p-5', panelClass)}>
      {todayEvents.length > 0 ? (
        <div className={clsx('relative overflow-hidden rounded-[1.75rem] border p-6 sm:p-7 bg-gradient-to-br', themeMeta.gradient, themeMeta.glow)}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/80">{themeMeta.title}</p>
            <h2 className="mt-2 text-3xl font-display font-bold text-white sm:text-4xl">
              {themeMeta.emoji} Today is for {todayEvents.map((event) => event.title).join(', ')}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-white/85">
              Enjoy your moment and make it memorable. Your special-date theme is active for today.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {todayEvents.map((event) => (
                <span key={event.id} className="rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  {event.theme || 'custom'} • {event.title}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
          No special date today. Add one below to activate custom themes.
        </div>
      )}

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Add Special Date</h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_170px_auto]">
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (Birthday, Festival, etc)" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
          <select value={theme} onChange={(event) => setTheme(event.target.value as SpecialDate['theme'])} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white">
            <option value="custom">Custom</option>
            <option value="birthday">Birthday</option>
            <option value="celebration">Celebration</option>
            <option value="festival">Festival</option>
          </select>
          <button onClick={() => void saveSpecialDate()} disabled={saving || !title.trim()} className="rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Upcoming Special Dates</h3>
        <div className="mt-4 space-y-2">
          {specialDates.length === 0 ? <p className={mutedTextClass}>No custom special dates yet.</p> : null}
          {specialDates.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="font-bold">{item.title}</p>
              <p className={clsx('text-xs', mutedTextClass)}>{new Date(`${item.date}T00:00:00`).toLocaleDateString()} • {item.theme || 'custom'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
