import type { ExamResult, MoodLog, Task } from '../types/schema';

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
