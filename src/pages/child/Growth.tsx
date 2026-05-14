import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { GrowthLog } from '../../types/schema';
import { useChildLayout } from './ChildLayout';

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function ChildGrowth() {
  const { panelClass, mutedTextClass, profile, parentId } = useChildLayout();
  const [date, setDate] = useState(todayKey());
  const [heightCm, setHeightCm] = useState<number | ''>(profile.height_cm || '');
  const [weightKg, setWeightKg] = useState<number | ''>(profile.weight_kg || '');
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<GrowthLog[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'growth_logs'), where('child_id', '==', profile.id));
    const unsub = onSnapshot(q, (snap) => {
      const mapped = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GrowthLog, 'id'>) }));
      setLogs(mapped.sort((a, b) => a.date.localeCompare(b.date)));
    });
    return () => unsub();
  }, [profile.id]);

  const saveGrowth = async () => {
    if (!heightCm || !weightKg || Number(heightCm) < 50 || Number(weightKg) < 10) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'growth_logs'), {
        child_id: profile.id,
        parent_id: parentId,
        height_cm: Number(heightCm),
        weight_kg: Number(weightKg),
        date: new Date(`${date}T00:00:00`).toISOString(),
        created_at: new Date().toISOString()
      });
      setHeightCm('');
      setWeightKg('');
    } finally {
      setSaving(false);
    }
  };

  const chartPoints = useMemo(() => {
    if (logs.length < 2) return '';
    const width = 680;
    const height = 220;
    const values = logs.map((log) => log.height_cm);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    return logs.map((log, index) => {
      const x = (index / (logs.length - 1)) * width;
      const y = height - ((log.height_cm - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
  }, [logs]);

  const weightChartPoints = useMemo(() => {
    if (logs.length < 2) return '';
    const width = 680;
    const height = 220;
    const values = logs.map((log) => log.weight_kg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(1, max - min);
    return logs.map((log, index) => {
      const x = (index / (logs.length - 1)) * width;
      const y = height - ((log.weight_kg - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
  }, [logs]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthLogs = logs.filter((log) => {
      const d = new Date(log.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    if (monthLogs.length < 2) {
      return 'Keep adding updates this month. Your growth story builds over time.';
    }

    const first = monthLogs[0];
    const last = monthLogs[monthLogs.length - 1];
    const heightDelta = (last.height_cm || 0) - (first.height_cm || 0);

    if (heightDelta > 0) {
      return `Great consistency this month. Height trend is up by ${heightDelta.toFixed(1)} cm.`;
    }

    return 'Consistency is a strength. Small steady updates matter and help build healthy habits.';
  }, [logs]);

  return (
    <div className="mt-6 space-y-5">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Growth Tracker</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>Capture height and weight updates with positive healthy encouragement.</p>
        <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{monthlyTrend}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Date</p>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Height (cm)</p>
            <input type="number" value={heightCm} onChange={(event) => setHeightCm(event.target.value ? Number(event.target.value) : '')} placeholder="e.g. 128" className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className={clsx('text-xs font-bold uppercase', mutedTextClass)}>Weight (kg)</p>
            <input type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value ? Number(event.target.value) : '')} placeholder="e.g. 30" className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
          </div>
        </div>
        <div className="mt-3">
          <button onClick={() => void saveGrowth()} disabled={saving || !heightCm || !weightKg} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving...' : 'Save Update'}</button>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Growth Charts</h3>
        {logs.length < 2 ? (
          <p className={clsx('mt-3 text-sm', mutedTextClass)}>Add at least 2 updates to unlock chart view.</p>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="overflow-x-auto rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-3">
              <p className="mb-2 text-sm font-bold text-cyan-200">Height (cm)</p>
              <svg viewBox="0 0 680 220" className="h-[220px] min-w-[680px] w-full"><polyline fill="none" stroke="#22d3ee" strokeWidth="3" points={chartPoints} /></svg>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-violet-300/20 bg-violet-500/5 p-3">
              <p className="mb-2 text-sm font-bold text-violet-200">Weight (kg)</p>
              <svg viewBox="0 0 680 220" className="h-[220px] min-w-[680px] w-full"><polyline fill="none" stroke="#a78bfa" strokeWidth="3" points={weightChartPoints} /></svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
