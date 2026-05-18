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
  subject?: string;
  content: string;
  timestamp: string; // ISO String
  is_read: boolean;
  sender_role?: 'parent' | 'child';
  sender_id?: string;
}

export interface ChildProfile {
  id: string;
  name: string;
  pet_name?: string;
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
  parent_id?: string;
  family_id?: string;
  money_weekly_goal?: number;
  money_wish_title?: string;
  money_wish_target?: number;
  avatar_emoji?: string;
  interests?: string[];
  personality_tags?: string[];
  communication_style?: 'cheerful' | 'calm' | 'challenge' | 'short';
  profile_motto?: string;
  early_bird_count?: number;
  reading_completed_count?: number;
  study_completed_count?: number;
  perfect_week_count?: number;
}

export interface Task {
  id: string;
  family_id: string;
  parent_id?: string;
  child_id?: string | null;
  subject_id?: string;
  title: string;
  description?: string;
  category?: 'chore' | 'homework' | 'personal' | 'custom' | string;
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'expired' | 'failed' | 'paused';
  points?: number;
  star_value: number;
  energy_level?: 'low' | 'medium' | 'high' | number | string;
  due_date?: string;
  expires_at?: string;
  recurrence_type?: 'none' | 'daily' | 'weekly';
  recurrence_days?: number[];
  requires_proof?: boolean;
  difficulty_level?: number;
  linked_program_id?: string | null;
  created_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Routine {
  id: string;
  family_id: string;
  child_id?: string | null;
  title: string;
  start_time: string;       // HH:MM
  end_time: string;         // HH:MM
  /** @deprecated use start_time instead */
  schedule_time?: string;
  day_range: 'weekday' | 'weekend' | 'everyday';
  points: number;
  streak: number;
  icon?: string;
  requires_approval: boolean;
  created_by: 'parent' | 'child';
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface RoutineLog {
  id: string;
  routine_id: string;
  family_id: string;
  child_id: string;
  date: string;
  status: 'completed' | 'missed' | 'sick';
  completed_at?: string;
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
  marks_scored?: number | null;
  total_marks?: number | null;
  exam_date: string;
  exam_type?: 'weekly_test' | 'unit_test' | 'midterm' | 'final' | 'practice' | 'other';
  status?: 'scheduled' | 'completed_pending_result' | 'result_published' | 'missed';
  result_published_at?: string | null;
  syllabus_scope?: string;
  reminder_plan?: string[];
  linked_program_id?: string | null;
  points_allocated?: number | null;
  points_earned?: number | null;
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
  recurrence_type?: 'none' | 'daily' | 'weekly' | 'monthly';
  linked_program_id?: string | null;
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
  updated_at?: string;
  completed_at?: string;
  linked_program_id?: string | null;
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
  linked_exam_id?: string;
  target_date?: string;
  offset_days?: number;
  is_enabled: boolean;
  frequency: 'once' | 'daily' | 'weekly';
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

export interface Achievement {
  id: string;
  child_id: string;
  parent_id?: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  category?: 'academic' | 'habit' | 'sports' | 'creative' | 'other';
  created_at?: string;
}

export interface Approval {
  id: string;
  family_id: string;
  child_id: string;
  type: 'task' | 'routine' | 'reward' | 'custom';
  reference_id?: string;
  title: string;
  points: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  proof_image_url?: string;
}

export interface Settlement {
  id: string;
  family_id: string;
  child_id: string;
  period_start: string;
  period_end: string;
  total_points: number;
  total_money: number;
  status: 'draft' | 'paid';
  created_at: string;
  paid_at?: string;
}

export interface SpecialDate {
  id: string;
  child_id: string;
  parent_id?: string;
  title: string;
  date: string; // YYYY-MM-DD
  theme?: 'birthday' | 'celebration' | 'festival' | 'custom';
  created_at?: string;
}

export interface MoneyPotEntry {
  id: string;
  child_id: string;
  parent_id?: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive for received, negative for spent
  type: 'receive' | 'spend';
  note?: string;
  created_at?: string;
}

export interface MoneyPotTarget {
  id: string;
  child_id: string;
  parent_id?: string;
  title: string;
  target_amount: number;
  period: 'monthly' | 'yearly';
  created_at?: string;
  achieved_at?: string;
}
