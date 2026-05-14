import type { PlannerEvent, PlannerProgram, PlannerTimetable } from '../types/planner.types';
import { PLANNER_CATEGORY_COLORS, PLANNER_CATEGORY_ICONS } from './planner.constants';

const now = new Date();

function atDayOffset(dayOffset: number, hour: number, minute: number, durationMinutes: number) {
  const start = new Date(now);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function event(id: string, title: string, category: PlannerEvent['category'], dayOffset: number, hour: number, minute: number, durationMinutes: number): PlannerEvent {
  const range = atDayOffset(dayOffset, hour, minute, durationMinutes);
  return {
    id,
    familyId: 'fam_mock_1',
    childId: 'child_mock_1',
    parentId: 'parent_mock_1',
    title,
    description: `${title} session`,
    category,
    color: PLANNER_CATEGORY_COLORS[category],
    startAt: range.startAt,
    endAt: range.endAt,
    allDay: false,
    timezone: 'Asia/Kolkata',
    recurrence: { type: 'none', interval: 1 },
    linkedProgramId: null,
    linkedTaskIds: [],
    participantIds: [],
    reminderIds: [],
    source: 'manual',
    sync: { googleEnabled: false, syncStatus: 'not_configured' },
    createdBy: 'parent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null
  };
}

export const MOCK_PLANNER_EVENTS: PlannerEvent[] = [
  event('ev_1', 'Math Class', 'school', 0, 9, 0, 60),
  event('ev_2', 'Science Revision', 'homework', 0, 17, 0, 45),
  event('ev_3', 'Tuition Physics', 'tuition', 1, 18, 0, 90),
  event('ev_4', 'Football Practice', 'extracurricular', 2, 16, 30, 60),
  event('ev_5', 'English Mock Exam', 'exam', 3, 10, 0, 120),
  event('ev_6', 'Art Club', 'personal', 4, 17, 0, 60),
  event('ev_7', 'Chemistry Lab', 'school', 5, 11, 0, 75),
  event('ev_8', 'Rest Evening', 'rest_day', 6, 19, 0, 60)
];

export const MOCK_PLANNER_PROGRAMS: PlannerProgram[] = [
  {
    id: 'prog_1',
    familyId: 'fam_mock_1',
    childId: 'child_mock_1',
    name: 'School Routine',
    icon: PLANNER_CATEGORY_ICONS.school,
    color: PLANNER_CATEGORY_COLORS.school,
    category: 'school',
    reminderDefaults: { minutesBefore: [30], pushEnabled: true },
    recurrenceRule: null,
    modules: ['tasks', 'exams', 'timetable'],
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prog_2',
    familyId: 'fam_mock_1',
    childId: 'child_mock_1',
    name: 'Exam Prep Sprint',
    icon: PLANNER_CATEGORY_ICONS.exam,
    color: PLANNER_CATEGORY_COLORS.exam,
    category: 'exam',
    reminderDefaults: { minutesBefore: [60, 15], pushEnabled: true },
    recurrenceRule: null,
    modules: ['tasks', 'exams', 'events'],
    isDefault: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const MOCK_PLANNER_TIMETABLE: PlannerTimetable = {
  periods: ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5'],
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  data: {
    'Period 1': { Mon: { subject: 'Math', room: 'A2' }, Tue: { subject: 'Physics', room: 'B1' }, Wed: { subject: 'English', room: 'C3' }, Thu: { subject: 'Biology', room: 'B2' }, Fri: { subject: 'Chemistry', room: 'Lab' } },
    'Period 2': { Mon: { subject: 'History', room: 'A1' }, Tue: { subject: 'Math', room: 'A2' }, Wed: { subject: 'Computer', room: 'Lab' }, Thu: { subject: 'Geography', room: 'C1' }, Fri: { subject: 'English', room: 'C3' } },
    'Period 3': { Mon: { subject: 'Chemistry', room: 'Lab' }, Tue: { subject: 'PE', room: 'Ground' }, Wed: { subject: 'Math', room: 'A2' }, Thu: { subject: 'Physics', room: 'B1' }, Fri: { subject: 'Computer', room: 'Lab' } },
    'Period 4': { Mon: { subject: 'Art', room: 'Studio' }, Tue: { subject: 'Biology', room: 'B2' }, Wed: { subject: 'History', room: 'A1' }, Thu: { subject: 'Math', room: 'A2' }, Fri: { subject: 'PE', room: 'Ground' } },
    'Period 5': { Mon: { subject: 'Reading', room: 'Library' }, Tue: { subject: 'Chemistry', room: 'Lab' }, Wed: { subject: 'Club', room: 'Hall' }, Thu: { subject: 'English', room: 'C3' }, Fri: { subject: 'Reflection', room: 'Home' } }
  }
};
