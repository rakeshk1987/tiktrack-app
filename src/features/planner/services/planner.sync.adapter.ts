import type { PlannerEvent } from '../types/planner.types';

export interface CalendarSyncAdapter {
  provider: 'google';
  pushEvent: (event: PlannerEvent) => Promise<void>;
  updateEvent: (event: PlannerEvent) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
}

// Placeholder for future Google Calendar integration. OAuth and token handling are intentionally out of scope.
export const googleCalendarAdapter: CalendarSyncAdapter = {
  provider: 'google',
  async pushEvent() {},
  async updateEvent() {},
  async deleteEvent() {}
};
