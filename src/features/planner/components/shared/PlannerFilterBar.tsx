import type { PlannerCategory } from '../../types/planner.types';

interface PlannerFilterBarProps {
  categories: PlannerCategory[];
  activeCategories: PlannerCategory[];
  onToggleCategory: (category: PlannerCategory) => void;
}

export function PlannerFilterBar({ categories, activeCategories, onToggleCategory }: PlannerFilterBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const active = activeCategories.includes(category);
        return (
          <button
            key={category}
            type="button"
            onClick={() => onToggleCategory(category)}
            className={active ? 'rounded-full border border-cyan-300/40 bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-100' : 'rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70'}
          >
            {category.replace('_', ' ')}
          </button>
        );
      })}
    </div>
  );
}
