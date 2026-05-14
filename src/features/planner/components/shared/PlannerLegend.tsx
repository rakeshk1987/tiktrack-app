import { PLANNER_CATEGORY_COLORS } from '../../constants/planner.constants';
import type { PlannerCategory } from '../../types/planner.types';

interface PlannerLegendProps {
  categories?: PlannerCategory[];
}

export function PlannerLegend({ categories = Object.keys(PLANNER_CATEGORY_COLORS) as PlannerCategory[] }: PlannerLegendProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {categories.map((category) => (
        <div key={category} className="flex items-center gap-2 text-xs text-white/70">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLANNER_CATEGORY_COLORS[category] }} />
          <span>{category.replace('_', ' ')}</span>
        </div>
      ))}
    </div>
  );
}
