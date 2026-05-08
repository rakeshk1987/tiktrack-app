import { Task, RoutineSlot, ChildProfile, ExamResult, Event } from './types/schema';
export interface TaskGenerationRule {
    routine_category: string;
    task_templates: TaskTemplate[];
    frequency: 'daily' | 'weekly' | 'exam_dependent';
    min_tasks: number;
    max_tasks: number;
}
export interface TaskTemplate {
    title_pattern: string;
    category: string;
    energy_level: 'low' | 'medium' | 'high';
    priority: 'low' | 'medium' | 'high';
    base_star_value: number;
    requires_proof: boolean;
    description?: string;
}
export interface GeneratedTask extends Omit<Task, 'id' | 'child_id'> {
    generated_at: string;
    generation_reason: string;
    expires_at?: string;
}
/**
 * Default task generation rules mapped to routine categories
 */
export declare const DEFAULT_TASK_RULES: Record<string, TaskGenerationRule>;
/**
 * Generate tasks for a specific routine slot
 */
export declare const generateTasksForSlot: (slot: RoutineSlot, profile: ChildProfile, weakSubjects?: string[], upcomingExams?: Event[], currentMood?: string) => GeneratedTask[];
/**
 * Generate full day's tasks based on routine
 */
export declare const generateDailyTasks: (routineSlots: RoutineSlot[], profile: ChildProfile, exams: ExamResult[], upcomingEvents: Event[], currentMood?: string, maxTasksPerDay?: number) => GeneratedTask[];
/**
 * Generate tasks for exam prep (returns high-focus study tasks)
 */
export declare const generateExamPrepTasks: (exam: Event, daysUntilExam: number, profile: ChildProfile) => GeneratedTask[];
/**
 * Generate challenge tasks (harder, for mastery-level children)
 */
export declare const generateChallengeTasks: (profile: ChildProfile, weeklyCompletionRate: number) => GeneratedTask[];
/**
 * Generate motivational tasks for low performers
 */
export declare const generateMotivationalTasks: (profile: ChildProfile, mood?: string) => GeneratedTask[];
/**
 * Smart task generation combining all logic
 */
export declare const generateSmartDailyTasks: (routineSlots: RoutineSlot[], profile: ChildProfile, exams: ExamResult[], upcomingEvents: Event[], currentMood?: string, weeklyCompletionRate?: number) => GeneratedTask[];
