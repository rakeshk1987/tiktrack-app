import { z } from 'zod';
import { PLANNER_EVENT_CATEGORIES } from '../constants/planner.constants';

const isoDateTimeSchema = z.string().datetime({ offset: true });
const categorySchema = z.enum(PLANNER_EVENT_CATEGORIES as [string, ...string[]]);

export const plannerEventInputSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(120, 'Title is too long'),
  category: categorySchema,
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema,
  linkedProgramId: z.string().nullable().optional(),
  recurrenceType: z.enum(['none', 'daily', 'weekly']).default('none'),
  recurrenceWeekDays: z.array(z.number().int().min(0).max(6)).default([])
}).superRefine((value, ctx) => {
  if (new Date(value.endAt).getTime() <= new Date(value.startAt).getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time must be after start time', path: ['endAt'] });
  }
  if (value.recurrenceType === 'weekly' && value.recurrenceWeekDays.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select at least one weekday for weekly recurrence', path: ['recurrenceWeekDays'] });
  }
});

export const plannerQuickAddSchema = z.object({
  title: z.string().trim().min(2, 'Reminder title must be at least 2 characters').max(80, 'Reminder title is too long'),
  startAt: isoDateTimeSchema,
  endAt: isoDateTimeSchema
}).superRefine((value, ctx) => {
  if (new Date(value.endAt).getTime() <= new Date(value.startAt).getTime()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time must be after start time', path: ['endAt'] });
  }
});

export const plannerTimetableCellSchema = z.object({
  period: z.string().trim().min(1, 'Period is required').max(40),
  day: z.string().trim().min(1, 'Day is required').max(16),
  subject: z.string().trim().min(1, 'Subject is required').max(60),
  room: z.string().trim().max(40).optional(),
  teacher: z.string().trim().max(60).optional()
});

export type PlannerEventInput = z.infer<typeof plannerEventInputSchema>;
export type PlannerQuickAddInput = z.infer<typeof plannerQuickAddSchema>;
export type PlannerTimetableCellInput = z.infer<typeof plannerTimetableCellSchema>;
