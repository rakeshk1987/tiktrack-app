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
