import clsx from 'clsx';
import { Compass, Flame, Shield, Sparkles, Star } from 'lucide-react';
import { useChildLayout } from './ChildLayout';

function StatPill({
  icon,
  value,
  label,
  tone
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: 'amber' | 'orange' | 'sky';
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : tone === 'orange'
        ? 'bg-orange-100 text-orange-700 border-orange-200'
        : 'bg-sky-100 text-sky-700 border-sky-200';

  return (
    <div className={clsx('rounded-2xl border px-4 py-3', toneClass)}>
      <div className="flex items-center gap-2 text-xl font-black">
        {icon}
        <span>{value}</span>
      </div>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.15em]">{label}</p>
    </div>
  );
}

function VariantPlayful({ childName }: { childName: string }) {
  return (
    <section className="rounded-[1.6rem] border border-pink-200 bg-[linear-gradient(135deg,#fff7ed,#ffe4f2_55%,#e7f0ff)] p-4 shadow-[0_18px_45px_rgba(236,72,153,0.16)]">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-pink-500">Playful</p>
      <h3 className="mt-2 text-2xl font-black text-slate-900">Hey {childName}, ready for a tiny win?</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatPill icon={<Star size={16} className="fill-current" />} value={22} label="Stars" tone="amber" />
        <StatPill icon={<Flame size={16} className="fill-current" />} value={4} label="Streak" tone="orange" />
        <StatPill icon={<Shield size={16} className="fill-current" />} value={1} label="Shields" tone="sky" />
      </div>
      <button className="mt-4 rounded-2xl bg-[linear-gradient(90deg,#fb7185,#a855f7,#3b82f6)] px-5 py-3 text-sm font-black text-white shadow-lg">
        Start Next Quest
      </button>
    </section>
  );
}

function VariantAdventure() {
  return (
    <section className="rounded-[1.6rem] border border-indigo-200 bg-[linear-gradient(160deg,#0f172a,#1e1b4b_52%,#312e81)] p-4 text-white shadow-[0_18px_45px_rgba(49,46,129,0.4)]">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">Adventure</p>
      <div className="mt-2 flex items-center justify-between">
        <h3 className="text-2xl font-black">Quest Path</h3>
        <Compass size={20} className="text-cyan-200" />
      </div>
      <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">Next Unlock</p>
        <p className="mt-1 text-lg font-black">Brain Champ Badge in 2 stars</p>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-white/75">
          <span>Map progress</span>
          <span>78%</span>
        </div>
        <div className="h-3 rounded-full bg-white/10 p-0.5">
          <div className="h-full w-[78%] rounded-full bg-[linear-gradient(90deg,#22d3ee,#60a5fa,#a78bfa,#f472b6)]" />
        </div>
      </div>
    </section>
  );
}

function VariantMinimalGame() {
  return (
    <section className="rounded-[1.6rem] border border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f1fff7)] p-4 shadow-[0_18px_45px_rgba(16,185,129,0.14)]">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">Minimal Game</p>
      <h3 className="mt-2 text-2xl font-black text-slate-900">One Mission at a Time</h3>
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Today mission</p>
        <p className="mt-1 text-base font-black text-slate-900">Finish 1 focus quest before 7 PM</p>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-bold text-slate-700">Mood check completed</p>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">
          <Sparkles size={12} /> + calm mode
        </span>
      </div>
    </section>
  );
}

export default function ChildMockups() {
  const { childName, isDark } = useChildLayout();

  return (
    <div className="mt-5 space-y-4">
      <div className={clsx('rounded-[1.6rem] border p-4', isDark ? 'border-white/15 bg-white/5 text-white' : 'border-indigo-200/70 bg-white/85 text-slate-900')}>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-70">Mockup Preview</p>
        <h2 className="mt-2 text-2xl font-black">Child Dashboard Variants</h2>
        <p className="mt-1 text-sm opacity-80">Compare these concepts and tell me which direction to implement on the real dashboard.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <VariantPlayful childName={childName} />
        <VariantAdventure />
        <VariantMinimalGame />
      </div>
    </div>
  );
}

