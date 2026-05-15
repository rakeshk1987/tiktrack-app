import { useCallback, useEffect, useMemo, useState } from 'react';
import { MOCK_PLANNER_EVENTS } from '../constants/planner.mock';
import { fetchPlannerEventsByRange } from '../services/planner.firestore';
import type { PlannerDateRange, PlannerEvent } from '../types/planner.types';

const DEFAULT_RANGE_DAYS = 30;

function defaultRange(): PlannerDateRange {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  const end = new Date();
  end.setDate(end.getDate() + DEFAULT_RANGE_DAYS);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

export function usePlannerEvents(childId: string, range?: PlannerDateRange, useMockFallback = true) {
  const [events, setEvents] = useState<PlannerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const effectiveRange = useMemo(() => range || defaultRange(), [range?.endAt, range?.startAt]);

  const load = useCallback(async () => {
    if (!childId) {
      setEvents(useMockFallback ? MOCK_PLANNER_EVENTS : []);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const rows = await fetchPlannerEventsByRange(childId, effectiveRange);
      if (rows.length === 0 && useMockFallback) {
        setEvents(MOCK_PLANNER_EVENTS.map((event) => ({ ...event, childId })));
      } else {
        setEvents(rows);
      }
    } catch (err) {
      console.error('usePlannerEvents error:', err);
      setEvents(useMockFallback ? MOCK_PLANNER_EVENTS.map((event) => ({ ...event, childId })) : []);
    } finally {
      setLoading(false);
    }
  }, [childId, effectiveRange, useMockFallback]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = useMemo(
    () => events.filter((event) => new Date(event.endAt).getTime() >= Date.now()).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [events]
  );

  return { events, upcoming, loading, refresh: load };
}
