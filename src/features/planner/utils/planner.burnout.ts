import { PLANNER_BURNOUT_THRESHOLDS } from '../constants/planner.constants';
import type { PlannerBurnoutInsight, PlannerEvent } from '../types/planner.types';
import { minutesBetween, toIsoDateKey } from './planner.time';

const categoryWeight: Record<PlannerEvent['category'], number> = {
  school: 1.1,
  exam: 1.4,
  homework: 1.1,
  extracurricular: 1,
  tuition: 1.2,
  personal: 0.8,
  custom: 1,
  holiday: 0.2,
  rest_day: -1
};

export function buildBurnoutInsight(events: PlannerEvent[]): PlannerBurnoutInsight {
  if (!events.length) {
    return { weeklyScore: 0, level: 'normal', busyDayCount: 0, consecutiveBusyDays: 0, recommendation: 'Schedule healthy routines and one rest day.' };
  }

  const dayLoad = new Map<string, number>();
  let weightedMinutes = 0;

  for (const event of events) {
    const minutes = minutesBetween(event.startAt, event.endAt);
    weightedMinutes += minutes * (categoryWeight[event.category] ?? 1);
    const dayKey = toIsoDateKey(event.startAt);
    dayLoad.set(dayKey, (dayLoad.get(dayKey) ?? 0) + minutes);
  }

  const days = Array.from(dayLoad.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  let consecutiveBusyDays = 0;
  let currentRun = 0;

  for (const [, minutes] of days) {
    if (minutes >= 240) {
      currentRun += 1;
      consecutiveBusyDays = Math.max(consecutiveBusyDays, currentRun);
    } else {
      currentRun = 0;
    }
  }

  const weeklyScore = Math.round(weightedMinutes / 60 + consecutiveBusyDays * 1.5);
  const level = weeklyScore >= PLANNER_BURNOUT_THRESHOLDS.risk
    ? 'risk'
    : weeklyScore >= PLANNER_BURNOUT_THRESHOLDS.heavy
      ? 'heavy'
      : 'normal';

  const recommendation = level === 'risk'
    ? 'High intensity week. Add one rest day and reduce late sessions.'
    : level === 'heavy'
      ? 'Busy week detected. Consider reducing one extracurricular block.'
      : 'Great balance. Keep rest and study rhythm consistent.';

  return {
    weeklyScore,
    level,
    busyDayCount: Array.from(dayLoad.values()).filter((minutes) => minutes >= 240).length,
    consecutiveBusyDays,
    recommendation
  };
}
