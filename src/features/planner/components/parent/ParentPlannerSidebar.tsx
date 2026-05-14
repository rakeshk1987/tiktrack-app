import type { ReactNode } from 'react';

interface ParentPlannerSidebarProps {
  children?: ReactNode;
}

export function ParentPlannerSidebar({ children }: ParentPlannerSidebarProps) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">{children || 'Mini calendar, filters, quick actions.'}</section>;
}
