export type PlannerRole = 'child' | 'parent';

export type PlannerCategory =
  | 'school'
  | 'exam'
  | 'homework'
  | 'extracurricular'
  | 'tuition'
  | 'personal'
  | 'custom'
  | 'holiday'
  | 'rest_day';

export type PlannerRecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type PlannerActivityModule = 'tasks' | 'exams' | 'timetable' | 'challenges' | 'events' | 'subjects';

export interface PlannerRecurrence {
  type: PlannerRecurrenceType;
  interval: number;
  byWeekDays?: number[];
  byMonthDays?: number[];
  until?: string | null;
  count?: number | null;
  rrule?: string | null;
}

export interface PlannerProgram {
  id: string;
  familyId: string;
  childId: string;
  name: string;
  icon: string;
  color: string;
  category: Exclude<PlannerCategory, 'holiday' | 'rest_day'>;
  reminderDefaults: {
    minutesBefore: number[];
    pushEnabled: boolean;
  };
  recurrenceRule?: string | null;
  modules?: PlannerActivityModule[];
  pointsConfig?: {
    taskPoints?: number | null;
    examPoints?: number | null;
    challengePoints?: number | null;
    eventPoints?: number | null;
  } | null;
  isDefault?: boolean;
  isActive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerSubject {
  id: string;
  familyId: string;
  childId: string;
  programId: string;
  name: string;
  teacherName?: string;
  includeInExams?: boolean;
  description?: string;
  color?: string;
  createdAt: string;
}

export interface PlannerEventSync {
  googleEnabled: boolean;
  googleEventId?: string | null;
  syncStatus: 'not_configured' | 'pending' | 'synced' | 'failed';
  lastSyncAt?: string | null;
  syncError?: string | null;
}

export interface PlannerEvent {
  id: string;
  familyId: string;
  childId: string;
  parentId: string;
  title: string;
  description?: string;
  category: PlannerCategory;
  color: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  timezone: string;
  recurrence: PlannerRecurrence;
  linkedProgramId?: string | null;
  subjectId?: string | null;
  subject?: string | null;
  linkedTaskIds: string[];
  participantIds: string[];
  reminderIds: string[];
  source: 'manual' | 'program' | 'automation' | 'import';
  sync: PlannerEventSync;
  taskStatus?: string;
  taskApprovalStatus?: string;
  taskPoints?: number;
  marksScored?: number | null;
  totalMarks?: number | null;
  syllabusScope?: string;
  createdBy: 'parent' | 'child' | 'system';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface PlannerConflict {
  id: string;
  eventAId: string;
  eventBId: string;
  startAt: string;
  endAt: string;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

export interface PlannerBurnoutInsight {
  weeklyScore: number;
  level: 'normal' | 'heavy' | 'risk';
  busyDayCount: number;
  consecutiveBusyDays: number;
  recommendation?: string;
}

export interface PlannerAgendaItem {
  id: string;
  title: string;
  category: PlannerCategory;
  startAt: string;
  endAt: string;
  isConflict: boolean;
  isExamPriority: boolean;
}

export interface PlannerTimetableCell {
  subject: string;
  room?: string;
  teacher?: string;
}

export type PlannerTimetableSlotType = 'class' | 'break';
export type PlannerTimetableSession = 'morning' | 'afternoon';

export interface PlannerTimetableSlot {
  id: string;
  label: string;
  type: PlannerTimetableSlotType;
  session?: PlannerTimetableSession;
  durationMinutes?: number;
}

export interface PlannerTimetable {
  periods: string[];
  slots?: PlannerTimetableSlot[];
  days: string[];
  activeWeeks?: number;
  dayPeriodCounts?: Record<string, number>;
  data: Record<string, Record<string, PlannerTimetableCell | undefined>>;
}

export interface PlannerDateRange {
  startAt: string;
  endAt: string;
}
