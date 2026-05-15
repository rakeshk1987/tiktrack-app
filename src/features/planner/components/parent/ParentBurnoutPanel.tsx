interface ParentBurnoutPanelProps {
  level: 'normal' | 'heavy' | 'risk';
  recommendation?: string;
  active?: boolean;
  onClick?: () => void;
}

export function ParentBurnoutPanel({ level, recommendation, active = false, onClick }: ParentBurnoutPanelProps) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-3xl border p-4 text-left text-sm text-white/80 transition ${active ? 'border-cyan-300/60 bg-cyan-500/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
      <p>Burnout level: {level}</p>
      <p className="mt-1 text-white/60">{recommendation || 'No recommendation yet.'}</p>
    </button>
  );
}
