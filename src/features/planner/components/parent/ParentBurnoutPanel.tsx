interface ParentBurnoutPanelProps {
  level: 'normal' | 'heavy' | 'risk';
  recommendation?: string;
}

export function ParentBurnoutPanel({ level, recommendation }: ParentBurnoutPanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
      <p>Burnout level: {level}</p>
      <p className="mt-1 text-white/60">{recommendation || 'No recommendation yet.'}</p>
    </section>
  );
}
