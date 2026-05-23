import type { ReactNode } from 'react';

interface PlannerShellProps {
  left?: ReactNode;
  main: ReactNode;
  right?: ReactNode;
}

export function PlannerShell({ left, main, right }: PlannerShellProps) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      {left ? <aside className="min-w-0 space-y-4">{left}</aside> : null}
      <section className="min-w-0 space-y-4">{main}</section>
      {right ? <aside className="min-w-0 space-y-4">{right}</aside> : null}
    </div>
  );
}
