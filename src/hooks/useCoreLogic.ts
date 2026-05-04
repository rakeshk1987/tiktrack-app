import type { Event, ExamResult, MoodLog, Task, RoutineSlot } from '../types/schema';

// Energy Sync logic based on time of day
export function useEnergySync(tasks: Task[]) {
  const hour = new Date().getHours();
  let timeOfDay: 'morning' | 'afternoon' | 'evening' = 'afternoon';
  
  if (hour < 12) timeOfDay = 'morning';
  else if (hour > 17) timeOfDay = 'evening';

  // Filter logic:
  // Morning: High-focus tasks (study, maths)
  // Evening: Creative/light tasks
  // Afternoon: standard/mix
  
  const recommendedTasks = tasks.filter(task => {
    if (timeOfDay === 'morning') return task.energy_level === 'high' || task.priority === 'high';
    if (timeOfDay === 'evening') return task.energy_level === 'low' || task.category === 'Creative';
    return true; // afternoon fits all
  });

  return { timeOfDay, recommendedTasks };
}

/**
 * Routine-aware energy sync based on current routine slot
 * Returns tasks that match the current routine slot's category
 */
export function useRoutineAwareEnergySync(tasks: Task[], currentSlot: RoutineSlot | null) {
  if (!currentSlot) {
    return useEnergySync(tasks);
  }

  const slotCategory = currentSlot.category || 'leisure';
  const categoryEnergyMap: Record<string, 'high' | 'medium' | 'low'> = {
    'study': 'high',
    'prayer': 'low',
    'health': 'medium',
    'leisure': 'low',
  };

  const recommendedEnergy = categoryEnergyMap[slotCategory] || 'medium';

  const recommendedTasks = tasks.filter(task => {
    if (slotCategory === 'study') {
      return task.energy_level === 'high' || task.priority === 'high';
    }
    if (slotCategory === 'leisure') {
      return task.energy_level === 'low' || task.priority === 'low';
    }
    if (slotCategory === 'health') {
      return task.category === 'Health' || task.energy_level === 'medium';
    }
    return true;
  });

  return { 
    timeOfDay: 'routine',
    currentSlot,
    slotCategory,
    recommendedEnergy,
    recommendedTasks 
  };
}

export function evaluateStreak(completedDaysInARow: number) {
  // 21 days mastery
  if (completedDaysInARow >= 21) {
    return { masteryAchieved: true, message: "Mastery unlocked! 21 Days of consistency!" };
  }
  return { masteryAchieved: false, message: `Keep going! ${21 - completedDaysInARow} days left for mastery.` };
}

export function calculateAgeFromDob(dateOfBirth: string, referenceDate = new Date()) {
  const dob = new Date(dateOfBirth);
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();
  const dayDiff = referenceDate.getDate() - dob.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return Math.max(age, 0);
}

export function calculateBmi(heightCm: number, weightKg: number) {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const heightMeters = heightCm / 100;
  return Number((weightKg / (heightMeters * heightMeters)).toFixed(1));
}

export function detectWeakSubjects(exams: ExamResult[]) {
  const subjectScores = new Map<string, { scored: number; total: number }>();

  exams.forEach((exam) => {
    const current = subjectScores.get(exam.subject) ?? { scored: 0, total: 0 };
    subjectScores.set(exam.subject, {
      scored: current.scored + exam.marks_scored,
      total: current.total + exam.total_marks
    });
  });

  return [...subjectScores.entries()]
    .map(([subject, values]) => ({
      subject,
      percentage: values.total > 0 ? Math.round((values.scored / values.total) * 100) : 0
    }))
    .sort((a, b) => a.percentage - b.percentage);
}

export function getMoodAdjustedTaskLoad(mood?: MoodLog['mood']) {
  switch (mood) {
    case 'sad':
      return { loadFactor: 0.7, message: 'Lighten the day and focus on comfort wins.' };
    case 'happy':
      return { loadFactor: 1.1, message: 'Steady bonus energy is available today.' };
    case 'excited':
      return { loadFactor: 1.2, message: 'Great day for a bonus quest if needed.' };
    case 'neutral':
    case 'angry':
    default:
      return { loadFactor: 1, message: 'Keep a balanced plan for today.' };
  }
}

export function determineDifficultyAdjustment(completedStreak: number, missesInRecentWindow: number) {
  if (missesInRecentWindow >= 3) {
    return { direction: 'decrease' as const, reason: 'Repeated misses suggest reducing the challenge for now.' };
  }
  if (completedStreak >= 5) {
    return { direction: 'increase' as const, reason: 'Consistent completion suggests readiness for a slightly harder quest.' };
  }
  return { direction: 'keep' as const, reason: 'Current difficulty looks appropriate.' };
}

// --- Progression & Challenges helpers ---
export function computeLevelFromStars(totalStars: number) {
  // Simple leveling: every 20 stars is a level
  const perLevel = 20;
  const level = Math.max(1, Math.floor(totalStars / perLevel) + 1);
  const progress = perLevel > 0 ? Math.round(((totalStars % perLevel) / perLevel) * 100) : 0;
  return { level, progress }; // progress in percent toward next level
}

export function evaluateBadges(profile: { total_stars?: number; streak_count?: number; consistency_score?: number }) {
  const badges: string[] = [];
  const stars = Number(profile.total_stars) || 0;
  const streak = Number(profile.streak_count) || 0;
  const consistency = Number(profile.consistency_score) || 0;

  if (stars >= 200) badges.push('Legendary Star');
  else if (stars >= 100) badges.push('Master Star');
  else if (stars >= 50) badges.push('Rising Star');

  if (streak >= 21) badges.push('Consistency Champion');
  else if (streak >= 7) badges.push('Steady Streak');

  if (consistency >= 85) badges.push('Consistent Hero');

  return badges;
}

export function applyTaskCompletionToProfile(profile: {
  total_stars?: number;
  streak_count?: number;
  streak_shields?: number;
  consistency_score?: number;
  last_task_date?: string;
}, taskStarValue: number, success = true, todayStr: string, isEarlyBird = false) {
  const updated = { ...profile } as any;
  let earnedStars = success ? Number(taskStarValue) || 0 : 0;
  
  if (success && isEarlyBird) {
    earnedStars += 5; // Early Bird Bonus
  }

  updated.total_stars = (Number(profile.total_stars) || 0) + earnedStars;

  if (success && updated.last_task_date !== todayStr) {
    // Daily streak increment (only once per day)
    updated.streak_count = (Number(profile.streak_count) || 0) + 1;
    updated.last_task_date = todayStr;
    
    // Milestone shield granting
    if (updated.streak_count > 0 && updated.streak_count % 7 === 0) {
      updated.streak_shields = (Number(profile.streak_shields) || 0) + 1;
    }
  } else if (!success) {
    // If we wanted to penalize for explicit task failure
    // updated.streak_count = 0;
  }

  // smooth consistency score: exponential moving average-ish
  const prev = Number(profile.consistency_score) || 0;
  const sample = success ? 100 : 0;
  updated.consistency_score = Math.round(prev * 0.8 + sample * 0.2);

  // return derived metadata as well
  const levelInfo = computeLevelFromStars(updated.total_stars);
  const badges = evaluateBadges(updated);

  return { updatedProfile: updated, levelInfo, badges };
}

export function processDailyConsistency(profile: any, todayStr: string) {
  const updated = { ...profile };
  let shieldUsed = false;
  let streakReset = false;
  let pointsReduced = 0;
  let missedDays = 0;

  if (!updated.last_streak_eval) {
    updated.last_streak_eval = todayStr;
    return { updated, shieldUsed, streakReset, pointsReduced, missedDays, adjustmentTrigger: 'normal' };
  }

  if (updated.last_streak_eval === todayStr) {
    return { updated, shieldUsed, streakReset, pointsReduced, missedDays, adjustmentTrigger: updated.streak_count >= 21 ? 'mastery' : 'normal' };
  }

  const lastEval = new Date(updated.last_streak_eval);
  const today = new Date(todayStr);
  const diffDays = Math.floor((today.getTime() - lastEval.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= 1) {
    const inBetweenDays = diffDays - 1;
    const missedLastEval = updated.last_task_date !== updated.last_streak_eval;
    missedDays = inBetweenDays + (missedLastEval ? 1 : 0);

    if (missedDays > 0 && !profile.is_sick_mode) {
      let remainingMisses = missedDays;
      while (remainingMisses > 0) {
        if (updated.streak_shields > 0) {
          updated.streak_shields -= 1;
          shieldUsed = true;
        } else {
          updated.streak_count = 0;
          streakReset = true;
          pointsReduced += 10;
        }
        remainingMisses--;
      }
      updated.total_stars = Math.max(0, (updated.total_stars || 0) - pointsReduced);
    }
    
    updated.last_streak_eval = todayStr;
  }

  const adjustmentTrigger = missedDays >= 3 ? 'struggle' : (updated.streak_count >= 21 ? 'mastery' : 'normal');

  return { updated, shieldUsed, streakReset, pointsReduced, missedDays, adjustmentTrigger };
}

export function getExamPlannerStats(events: Event[], tasksVisible: { task: Task; log?: any }[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingExams = events
    .filter((e) => e.type === 'exam' || e.type === 'Exam')
    .map((e) => ({
      ...e,
      dateObj: new Date(e.date)
    }))
    .filter((e) => e.dateObj >= today)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  if (upcomingExams.length === 0) {
    return {
      nearestExam: null,
      isLightDay: false,
      daysRemaining: -1,
      virtualTasks: []
    };
  }

  const nearest = upcomingExams[0];
  const diffTime = nearest.dateObj.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isLightDay = daysRemaining === 1;
  const virtualTasks: Task[] = [];

  // Generate study tasks if within 14 days
  if (daysRemaining >= 0 && daysRemaining <= 14) {
    const isSubjectSerious = nearest.title.toLowerCase().includes('math') || nearest.title.toLowerCase().includes('science');
    
    virtualTasks.push({
      id: `virtual_exam_study_${nearest.id}`,
      title: daysRemaining === 0 ? `Final Review: ${nearest.title}` : `Focus Quest: Study for ${nearest.title}`,
      category: 'Academic',
      priority: 'high',
      energy_level: 'high',
      difficulty_level: isSubjectSerious ? 8 : 5,
      star_value: daysRemaining <= 3 ? 4 : 3, // higher reward as exam nears
      requires_proof: true
    });
  }

  return {
    nearestExam: nearest,
    isLightDay,
    daysRemaining,
    virtualTasks
  };
}
