import type { ExamResult, Redemption } from '../types/schema';

export interface LevelTier {
  name: string;
  minStars: number;
}

export const LEVEL_TIERS: LevelTier[] = [
  { name: 'Junior Explorer', minStars: 0 },
  { name: 'Focus Master', minStars: 80 },
  { name: 'Learning Champion', minStars: 180 },
  { name: '6th Grade Legend', minStars: 320 }
];

export function getLevelProgress(totalStars: number) {
  const stars = Math.max(0, Number(totalStars || 0));
  let currentIndex = 0;

  for (let i = 0; i < LEVEL_TIERS.length; i += 1) {
    if (stars >= LEVEL_TIERS[i].minStars) {
      currentIndex = i;
    }
  }

  const current = LEVEL_TIERS[currentIndex];
  const next = LEVEL_TIERS[currentIndex + 1] || null;

  if (!next) {
    return {
      levelName: current.name,
      levelIndex: currentIndex + 1,
      progressPct: 100,
      starsToNext: 0,
      nextLevelName: null as string | null
    };
  }

  const span = Math.max(1, next.minStars - current.minStars);
  const progressPct = Math.max(0, Math.min(100, Math.round(((stars - current.minStars) / span) * 100)));

  return {
    levelName: current.name,
    levelIndex: currentIndex + 1,
    progressPct,
    starsToNext: Math.max(0, next.minStars - stars),
    nextLevelName: next.name
  };
}

export function getChildBadges(params: {
  consistencyScore: number;
  streakCount: number;
  earlyBirdCompletions: number;
  readingCompletions: number;
  studyCompletions: number;
  perfectWeekCount: number;
}) {
  const badges: Array<{ id: string; label: string; unlocked: boolean; hint: string }> = [
    {
      id: 'consistency',
      label: 'Consistency Badge',
      unlocked: params.consistencyScore >= 80,
      hint: 'Reach 80% consistency.'
    },
    {
      id: 'reading_streak',
      label: 'Reading Streak',
      unlocked: params.readingCompletions >= 10,
      hint: 'Complete 10 reading quests.'
    },
    {
      id: 'study_streak',
      label: 'Study Streak',
      unlocked: params.studyCompletions >= 12,
      hint: 'Complete 12 study quests.'
    },
    {
      id: 'early_bird',
      label: 'Early Bird',
      unlocked: params.earlyBirdCompletions >= 5,
      hint: 'Finish 5 tasks before 8:30 AM.'
    },
    {
      id: 'perfect_week',
      label: 'Perfect Week',
      unlocked: params.perfectWeekCount >= 1 || params.streakCount >= 7,
      hint: 'Complete all tasks for one full week.'
    }
  ];

  return badges;
}

export function computeMonthlyStars(logs: Array<{ date: string; status: string; task_id: string }>, taskStarById: Map<string, number>, month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0).toISOString().slice(0, 10);

  return logs
    .filter((log) => log.status === 'completed' && log.date >= start && log.date <= end)
    .reduce((sum, log) => sum + Number(taskStarById.get(log.task_id) || 0), 0);
}

export function computeRewardLedger(redemptions: Redemption[]) {
  return redemptions
    .slice()
    .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
    .map((item) => ({
      id: item.id,
      date: item.requested_at,
      stars: Number(item.stars_spent || 0),
      status: item.status,
      label: item.reward_item?.name || 'Reward'
    }));
}

export function deriveSubjectTrends(exams: ExamResult[]) {
  const bySubject = new Map<string, ExamResult[]>();

  for (const exam of exams) {
    const arr = bySubject.get(exam.subject) || [];
    arr.push(exam);
    bySubject.set(exam.subject, arr);
  }

  return Array.from(bySubject.entries()).map(([subject, rows]) => {
    const sorted = rows.slice().sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());
    const percentages = sorted.map((r) => (r.total_marks > 0 ? (r.marks_scored / r.total_marks) * 100 : 0));
    const recent = percentages.slice(-3);
    const avg = recent.length ? Math.round(recent.reduce((x, y) => x + y, 0) / recent.length) : 0;
    const trend = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;

    return {
      subject,
      avg,
      trend,
      weak: avg < 55,
      improving: trend >= 8
    };
  });
}
