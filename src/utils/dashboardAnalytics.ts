import type { ChildProfile, Task, TaskLog, ExamResult, GrowthLog, MoodLog } from '../types/schema';

export interface DashboardMetrics {
  consistency_score: number;
  consistency_trend: 'improving' | 'stable' | 'declining';
  total_stars_earned: number;
  tasks_completed_this_week: number;
  tasks_completed_this_month: number;
  completion_rate_this_week: number;
  current_streak: number;
  streak_shields: number;
  level: number;
  next_level_progress: number;
}

export interface PerformanceAnalysis {
  strongest_subjects: string[];
  weakest_subjects: string[];
  average_exam_score: number;
  recent_exam_trend: 'improving' | 'stable' | 'declining';
  total_exams_taken: number;
}

export interface HealthAnalysis {
  latest_height_cm: number;
  latest_weight_kg: number;
  latest_bmi: number;
  growth_trend_cm_per_month: number;
  weight_trend_kg_per_month: number;
  last_measurement_date: string;
}

export interface MoodAnalysis {
  recent_moods: Array<{ date: string; mood: string }>;
  dominant_mood: string;
  mood_trend: string;
  days_sad_this_week: number;
}

export interface ComprehensiveDashboard {
  metrics: DashboardMetrics;
  performance: PerformanceAnalysis;
  health: HealthAnalysis | null;
  mood: MoodAnalysis;
  alerts: string[];
  recommendations: string[];
}

/**
 * Calculate dashboard metrics from child profile and task logs
 */
export const calculateMetrics = (
  profile: ChildProfile,
  taskLogs: TaskLog[],
  todayStr: string
): DashboardMetrics => {
  const thisWeekStart = new Date(todayStr);
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);
  const thisWeekStr = thisWeekStart.toISOString().split('T')[0];

  const thisMonthStart = new Date(todayStr);
  thisMonthStart.setDate(1);
  const thisMonthStr = thisMonthStart.toISOString().split('T')[0];

  const thisWeekLogs = taskLogs.filter(
    log => log.date >= thisWeekStr && log.date <= todayStr
  );
  const thisMonthLogs = taskLogs.filter(
    log => log.date >= thisMonthStr && log.date <= todayStr
  );

  const completedThisWeek = thisWeekLogs.filter(
    log => log.status === 'completed'
  ).length;
  const totalThisWeek = thisWeekLogs.length;
  const completionRateThisWeek = totalThisWeek > 0 ? (completedThisWeek / totalThisWeek) * 100 : 0;

  const completedThisMonth = thisMonthLogs.filter(
    log => log.status === 'completed'
  ).length;

  // Determine consistency trend
  let consistency_trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (profile.consistency_score >= 80) {
    consistency_trend = 'improving';
  } else if (profile.consistency_score <= 40) {
    consistency_trend = 'declining';
  }

  const level = Math.max(1, Math.floor((profile.total_stars || 0) / 20) + 1);
  const nextLevelProgress = ((profile.total_stars || 0) % 20 / 20) * 100;

  return {
    consistency_score: Math.round(profile.consistency_score || 0),
    consistency_trend,
    total_stars_earned: profile.total_stars || 0,
    tasks_completed_this_week: completedThisWeek,
    tasks_completed_this_month: completedThisMonth,
    completion_rate_this_week: Math.round(completionRateThisWeek),
    current_streak: profile.streak_count || 0,
    streak_shields: profile.streak_shields || 0,
    level,
    next_level_progress: Math.round(nextLevelProgress),
  };
};

/**
 * Analyze academic performance from exam results
 */
export const analyzePerformance = (exams: ExamResult[]): PerformanceAnalysis => {
  if (exams.length === 0) {
    return {
      strongest_subjects: [],
      weakest_subjects: [],
      average_exam_score: 0,
      recent_exam_trend: 'stable',
      total_exams_taken: 0,
    };
  }

  // Group by subject
  const subjectScores = new Map<string, { scores: number[]; total: number }>();

  exams.forEach(exam => {
    const percentage = (exam.marks_scored / exam.total_marks) * 100;
    if (!subjectScores.has(exam.subject)) {
      subjectScores.set(exam.subject, { scores: [], total: 0 });
    }
    const subject = subjectScores.get(exam.subject)!;
    subject.scores.push(percentage);
    subject.total++;
  });

  // Calculate averages
  const subjectAverages = Array.from(subjectScores.entries()).map(([subject, data]) => ({
    subject,
    average: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
  }));

  subjectAverages.sort((a, b) => a.average - b.average);

  const strongest = subjectAverages.slice(-2).map(s => s.subject);
  const weakest = subjectAverages.slice(0, 2).map(s => s.subject);

  const averageScore =
    exams.reduce((sum, exam) => sum + (exam.marks_scored / exam.total_marks) * 100, 0) /
    exams.length;

  // Trend analysis (last 3 exams vs previous 3)
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (exams.length >= 6) {
    const recentExams = exams.slice(-3);
    const previousExams = exams.slice(-6, -3);

    const recentAvg =
      recentExams.reduce((sum, exam) => sum + (exam.marks_scored / exam.total_marks) * 100, 0) /
      recentExams.length;
    const previousAvg =
      previousExams.reduce((sum, exam) => sum + (exam.marks_scored / exam.total_marks) * 100, 0) /
      previousExams.length;

    if (recentAvg > previousAvg + 5) {
      trend = 'improving';
    } else if (recentAvg < previousAvg - 5) {
      trend = 'declining';
    }
  }

  return {
    strongest_subjects: strongest,
    weakest_subjects: weakest,
    average_exam_score: Math.round(averageScore),
    recent_exam_trend: trend,
    total_exams_taken: exams.length,
  };
};

/**
 * Analyze health metrics from growth logs
 */
export const analyzeHealth = (growthLogs: GrowthLog[]): HealthAnalysis | null => {
  if (growthLogs.length === 0) {
    return null;
  }

  const sortedLogs = [...growthLogs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const latest = sortedLogs[0];

  // Calculate trends
  let heightTrendPerMonth = 0;
  let weightTrendPerMonth = 0;

  if (sortedLogs.length >= 2) {
    const second = sortedLogs[1];
    const daysDiff =
      (new Date(latest.date).getTime() - new Date(second.date).getTime()) /
      (1000 * 60 * 60 * 24);
    const monthsDiff = daysDiff / 30;

    if (monthsDiff > 0) {
      heightTrendPerMonth = (latest.height_cm - second.height_cm) / monthsDiff;
      weightTrendPerMonth = (latest.weight_kg - second.weight_kg) / monthsDiff;
    }
  }

  const heightMeters = latest.height_cm / 100;
  const bmi = latest.weight_kg / (heightMeters * heightMeters);

  return {
    latest_height_cm: latest.height_cm,
    latest_weight_kg: latest.weight_kg,
    latest_bmi: Math.round(bmi * 10) / 10,
    growth_trend_cm_per_month: Math.round(heightTrendPerMonth * 100) / 100,
    weight_trend_kg_per_month: Math.round(weightTrendPerMonth * 100) / 100,
    last_measurement_date: latest.date,
  };
};

/**
 * Analyze recent moods
 */
export const analyzeMood = (moodLogs: MoodLog[], days: number = 7): MoodAnalysis => {
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - days);
  const recentDateStr = recentDate.toISOString().split('T')[0];

  const recentMoods = moodLogs
    .filter(log => log.date >= recentDateStr)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Find dominant mood
  const moodCounts = new Map<string, number>();
  recentMoods.forEach(mood => {
    moodCounts.set(mood.mood, (moodCounts.get(mood.mood) || 0) + 1);
  });

  const dominantMood =
    Array.from(moodCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  const sadDaysThisWeek = recentMoods.filter(m => m.mood === 'sad').length;

  return {
    recent_moods: recentMoods.map(m => ({ date: m.date, mood: m.mood })),
    dominant_mood: dominantMood,
    mood_trend: sadDaysThisWeek > 2 ? 'concerned' : 'healthy',
    days_sad_this_week: sadDaysThisWeek,
  };
};

/**
 * Generate alerts based on metrics and analysis
 */
export const generateAlerts = (
  metrics: DashboardMetrics,
  performance: PerformanceAnalysis,
  mood: MoodAnalysis,
  health: HealthAnalysis | null
): string[] => {
  const alerts: string[] = [];

  // Streak and consistency alerts
  if (metrics.current_streak === 0) {
    alerts.push('Streak at risk! Child has no current streak. Encourage participation.');
  } else if (metrics.current_streak >= 21) {
    alerts.push('🏆 Amazing! Child has achieved 21-day mastery milestone!');
  }

  if (metrics.consistency_score < 50) {
    alerts.push('⚠️ Consistency declining. Consider checking in with the child.');
  }

  if (metrics.streak_shields === 0 && metrics.current_streak > 0) {
    alerts.push('Shield stock low. Next 7-day milestone will grant new shield.');
  }

  // Performance alerts
  if (performance.recent_exam_trend === 'declining') {
    alerts.push('📉 Exam performance declining. Consider additional support.');
  }

  if (performance.weakest_subjects.length > 0) {
    alerts.push(
      `📚 Focus area: ${performance.weakest_subjects.join(', ')} needs attention.`
    );
  }

  // Mood alerts
  if (mood.days_sad_this_week > 2) {
    alerts.push('💙 Child seems sad recently. Check in and offer support.');
  }

  // Health alerts
  if (health && health.latest_bmi > 25) {
    alerts.push('📊 BMI slightly elevated. Encourage physical activity.');
  }

  return alerts;
};

/**
 * Generate recommendations
 */
export const generateRecommendations = (
  metrics: DashboardMetrics,
  performance: PerformanceAnalysis,
  mood: MoodAnalysis
): string[] => {
  const recommendations: string[] = [];

  // Engagement recommendations
  if (metrics.tasks_completed_this_week === 0) {
    recommendations.push('🎯 Create engaging tasks to boost participation.');
  }

  if (metrics.completion_rate_this_week < 50) {
    recommendations.push('✂️ Consider reducing task difficulty or quantity.');
  } else if (metrics.completion_rate_this_week > 80) {
    recommendations.push('📈 Great engagement! Consider increasing difficulty.');
  }

  // Academic recommendations
  if (performance.weakest_subjects.length > 0) {
    recommendations.push(
      `📖 Create focused tasks for ${performance.weakest_subjects[0]} improvement.`
    );
  }

  if (performance.average_exam_score < 60) {
    recommendations.push('📚 Increase study task frequency and provide more guidance.');
  }

  // Reward recommendations
  if (metrics.total_stars_earned > 100) {
    recommendations.push(
      '🎁 Stars accumulating! Ensure reward marketplace has attractive options.'
    );
  }

  // Mood-based recommendations
  if (mood.dominant_mood === 'sad') {
    recommendations.push('😊 Consider adding fun/leisure tasks to improve mood.');
  }

  return recommendations;
};

/**
 * Generate comprehensive dashboard data
 */
export const generateComprehensiveDashboard = (
  profile: ChildProfile,
  taskLogs: TaskLog[],
  exams: ExamResult[],
  growthLogs: GrowthLog[],
  moodLogs: MoodLog[],
  todayStr: string = new Date().toISOString().split('T')[0]
): ComprehensiveDashboard => {
  const metrics = calculateMetrics(profile, taskLogs, todayStr);
  const performance = analyzePerformance(exams);
  const health = analyzeHealth(growthLogs);
  const mood = analyzeMood(moodLogs);

  const alerts = generateAlerts(metrics, performance, mood, health);
  const recommendations = generateRecommendations(metrics, performance, mood);

  return {
    metrics,
    performance,
    health,
    mood,
    alerts,
    recommendations,
  };
};
