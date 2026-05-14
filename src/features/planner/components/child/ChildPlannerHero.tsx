interface ChildPlannerHeroProps {
  childName: string;
  subtitle?: string;
}

export function ChildPlannerHero({ childName, subtitle = 'Today-first planner with focus and momentum.' }: ChildPlannerHeroProps) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Planner</p>
      <h2 className="mt-2 text-3xl font-display font-bold text-white">Good planning day, {childName}</h2>
      <p className="mt-2 text-sm text-white/70">{subtitle}</p>
    </section>
  );
}
