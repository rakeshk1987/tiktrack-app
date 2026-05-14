import { useMemo } from 'react';
import type { PlannerEvent } from '../types/planner.types';

export function usePlannerLightInsights(events: PlannerEvent[]) {
  return useMemo(() => {
    const now = Date.now();
    const dayMap = new Map<string, number>();

    for (const event of events) {
      const day = event.startAt.slice(0, 10);
      const start = new Date(event.startAt).getTime();
      const end = new Date(event.endAt).getTime();
      const minutes = Math.max(0, Math.round((end - start) / 60000));
      dayMap.set(day, (dayMap.get(day) || 0) + minutes);
    }

    const sorted = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const overloadedDay = sorted.find(([, minutes]) => minutes >= 360)?.[0] || null;
    const freeDay = sorted.find(([, minutes]) => minutes <= 60)?.[0] || null;

    let maxBusyRun = 0;
    let run = 0;
    for (const [, minutes] of sorted) {
      if (minutes >= 240) {
        run += 1;
        maxBusyRun = Math.max(maxBusyRun, run);
      } else {
        run = 0;
      }
    }

    const upcomingExam = events
      .filter((event) => event.category === 'exam' && new Date(event.startAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0];

    const examProximityWarning = upcomingExam
      ? Math.ceil((new Date(upcomingExam.startAt).getTime() - now) / 86400000) <= 7
      : false;

    return {
      overloadedDay,
      freeDay,
      examProximityWarning,
      consecutiveBusyWarning: maxBusyRun >= 3,
      maxBusyRun
    };
  }, [events]);
}
