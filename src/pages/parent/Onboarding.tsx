import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { seedStarterData } from '../../services/seedData';

export default function ParentOnboardingPage() {
  const { user } = useAuth();
  const [childName, setChildName] = useState('');
  const [childId, setChildId] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const familyId = user?.linked_family_id || user?.id || '';
  const parentId = user?.id || '';

  const canSeed = useMemo(() => Boolean(childId && childName && familyId && parentId), [childId, childName, familyId, parentId]);

  async function createStarterTaskOnly() {
    if (!childId || !familyId) return;
    setLoading(true);
    setStatus('');
    try {
      await addDoc(collection(db, 'tasks'), {
        title: 'First quest: 10-minute focus block',
        description: 'Celebrate your first completed quest.',
        category: 'Study',
        child_id: childId,
        parent_id: parentId,
        family_id: familyId,
        priority: 'medium',
        star_value: 5,
        requires_proof: false,
        status: 'pending',
        recurrence_type: 'daily',
        created_at: new Date().toISOString()
      });
      setStatus('First task created. Next: seed planner + rewards.');
    } finally {
      setLoading(false);
    }
  }

  async function runFullSeed() {
    if (!canSeed) return;
    setLoading(true);
    setStatus('');
    try {
      await seedStarterData({ childId, childName, familyId, parentId });
      setStatus('Starter data created. Open Parent Dashboard to review and adjust.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to seed starter data.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-white">
      <section className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(18,24,44,0.97),rgba(14,18,35,0.97))] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Launch Onboarding</p>
        <h1 className="mt-2 text-3xl font-extrabold">First-Time Family Setup</h1>
        <p className="mt-2 text-sm text-white/70">Complete these steps once, then run the app normally.</p>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-bold">1. Add child identity</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder="Child name (e.g. Aarav)" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2" />
          <input value={childId} onChange={(e) => setChildId(e.target.value)} placeholder="Child user id (existing uid)" className="min-h-[44px] rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2" />
        </div>
        <p className="mt-2 text-xs text-white/60">Tip: create child account in Parent Dashboard Settings, then paste the child UID here for seeding.</p>
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-bold">2. Create first workflow</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void createStarterTaskOnly()} disabled={loading || !childId} className="min-h-[44px] rounded-xl border border-cyan-300/35 bg-cyan-500/20 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Create first task
          </button>
          <button type="button" onClick={() => void runFullSeed()} disabled={loading || !canSeed} className="min-h-[44px] rounded-xl border border-emerald-300/35 bg-emerald-500/20 px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Seed planner + rewards + timetable
          </button>
        </div>
        {status ? <p className="mt-3 text-sm text-emerald-200">{status}</p> : null}
      </section>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-bold">3. Continue setup</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link to="/parent" className="min-h-[44px] rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-semibold">Open Parent Dashboard</Link>
          <Link to="/planner/parent" className="min-h-[44px] rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-semibold">Open Parent Planner</Link>
          <Link to="/child" className="min-h-[44px] rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-semibold">Preview Child Experience</Link>
        </div>
      </section>
    </main>
  );
}
