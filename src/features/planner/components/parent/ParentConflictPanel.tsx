interface ParentConflictPanelProps {
  count: number;
}

export function ParentConflictPanel({ count }: ParentConflictPanelProps) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">Conflicts: {count}</section>;
}
