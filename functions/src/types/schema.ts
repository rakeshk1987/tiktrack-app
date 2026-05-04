export type Role = 'parent_admin' | 'child_user';

export interface User {
  id: string;
  email: string;
  role: Role;
  parent_id?: string;
  linked_family_id?: string; // For Co-parenting link
}

export interface InboxMessage {
  id: string;
  child_id: string;
  parent_id: string;
  content: string;
  timestamp: string; // ISO String
  is_read: boolean;
}

export interface ChildProfile {
  id: string;
  name: string;
  date_of_birth: string; // ISO String
  height_cm: number;
  weight_kg: number;
  streak_count: number;
  streak_shields: number;
  consistency_score: number;
  total_stars: number;
  is_sick_mode: boolean;
  last_streak_eval: string; // ISO Date YYYY-MM-DD
  last_task_date?: string; // ISO Date YYYY-MM-DD
  user_id: string;
  fcm_token?: string; // Added for push notifications
}

export interface Task {
  id: string;
  title: string;
  category: string;
  child_id?: string;
  priority: 'low' | 'medium' | 'high';
  energy_level: 'low' | 'medium' | 'high';
  difficulty_level: number;
  star_value: number;
  requires_proof: boolean;
  generated_at?: string;
  generation_reason?: string;
  expires_at?: string;
  is_generated?: boolean;
}

export type TaskStatus = 'pending' | 'completed' | 'failed' | 'skipped';

export interface TaskLog {
  id: string;
  task_id: string;
  child_id: string;
  date: string; // YYYY-MM-DD
  status: TaskStatus;
}

export interface ProofLog {
  id: string;
  task_id: string;
  image_url: string;
  timestamp: string;
  approval_status: 'pending' | 'approved' | 'rejected';
}

export interface ExamResult {
  id: string;
  child_id: string;
  subject: string;
  marks_scored: number;
  total_marks: number;
  exam_date: string;
}

export interface GrowthLog {
  id: string;
  child_id: string;
  height_cm: number;
  weight_kg: number;
  date: string;
}

export interface MoodLog {
  id: string;
  child_id: string;
  date: string;
  mood: 'happy' | 'sad' | 'angry' | 'neutral' | 'excited';
}

export interface DiaryEntry {
  id: string;
  child_id: string;
  date: string;
  content: string;
}

export interface Event {
  id: string;
  child_id?: string;
  type: string;
  title: string;
  date: string;
  reminder_days_before: number;
}

export interface RewardSetting {
  id: string;
  parent_id: string;
  star_to_currency_rate: number;
  weekly_bonus_enabled: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  description?: string;
  parent_id: string;
  child_id: string;
  parent_score: number;
  child_score: number;
  target_score: number;
  status: 'active' | 'completed';
  winner?: 'parent' | 'child' | 'draw';
  created_at: string;
  completed_at?: string;
}

export interface Shield {
  id: string;
  child_id: string;
  count: number;
}

export interface RoutineSlot {
  name: string;
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  category?: string; // 'study' | 'play' | 'prayer' | 'health' | 'leisure'
}

export interface RoutineConfiguration {
  id: string;
  parent_id: string;
  child_id?: string; // If empty, applies to all children
  school_days_routine: RoutineSlot[];
  vacation_routine: RoutineSlot[];
  academic_mode_start: string; // MM-DD format, e.g., '06-01'
  academic_mode_end: string; // MM-DD format, e.g., '03-31'
  current_mode: 'academic' | 'vacation';
  created_at: string;
  updated_at: string;
}

export type ReminderType = 'morning_greeting' | 'task_reminder' | 'exam_countdown' | 'missed_task_alert' | 'achievement' | 'custom';

export interface Reminder {
  id: string;
  child_id: string;
  parent_id: string;
  type: ReminderType;
  title: string;
  message: string;
  schedule_time?: string; // HH:MM format for daily reminders
  task_id?: string;
  exam_event_id?: string;
  is_enabled: boolean;
  is_active: boolean; // Added for backgroundJobs
  frequency: 'once' | 'daily' | 'weekly';
  scheduled_day?: number; // 0-6, Sunday=0 for weekly reminders
  scheduled_time?: number; // Hour 0-23 for daily/weekly reminders
  days_of_week?: number[]; // 0-6, Sunday=0
  next_send_at?: string; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export interface ReminderLog {
  id: string;
  reminder_id: string;
  child_id: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'dismissed';
  device_token?: string;
}

export interface RewardItem {
  id: string;
  parent_id: string;
  name: string;
  description: string;
  star_cost: number;
  icon?: string;
  category: 'activity' | 'item' | 'privilege' | 'experience';
  is_available: boolean;
  max_redemptions_per_week?: number;
  created_at: string;
  updated_at: string;
}

export interface Redemption {
  id: string;
  child_id: string;
  parent_id: string;
  reward_item_id: string;
  reward_item: RewardItem; // Denormalized for quick access
  stars_spent: number;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  requested_at: string;
  completed_at?: string;
  notes?: string;
}