interface ChildQuickAddProps {
  onClick: () => void;
}

export function ChildQuickAdd({ onClick }: ChildQuickAddProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-30 rounded-full border border-cyan-300/40 bg-cyan-500/20 px-4 py-3 text-sm font-semibold text-cyan-100 shadow-lg"
    >
      + Quick Add
    </button>
  );
}
