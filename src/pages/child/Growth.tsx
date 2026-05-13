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
    if (!heightCm || !weightKg) return;
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

  return (
    <div className="mt-6 space-y-5">
      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h2 className="text-3xl font-display font-bold">Height & Weight Tracker</h2>
        <p className={clsx('mt-1 text-sm', mutedTextClass)}>Add your growth updates and see your trend graph.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[180px_160px_160px_auto]">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
          <input type="number" value={heightCm} onChange={(event) => setHeightCm(event.target.value ? Number(event.target.value) : '')} placeholder="Height (cm)" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
          <input type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value ? Number(event.target.value) : '')} placeholder="Weight (kg)" className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-white" />
          <button onClick={() => void saveGrowth()} disabled={saving || !heightCm || !weightKg} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className={clsx('rounded-[1.75rem] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]', panelClass)}>
        <h3 className="text-2xl font-display font-bold">Height Graph</h3>
        {logs.length < 2 ? (
          <p className={clsx('mt-3 text-sm', mutedTextClass)}>Add at least 2 entries to show graph.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <svg viewBox="0 0 680 220" className="h-[220px] min-w-[680px] w-full">
              <polyline fill="none" stroke="#22d3ee" strokeWidth="3" points={chartPoints} />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

