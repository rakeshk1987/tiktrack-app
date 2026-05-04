import {
  Task,
  ChildProfile,
  ExamResult,
  MoodLog,
  RoutineSlot,
} from '../types/schema';

export interface TaskRecommendation {
  task: Task;
  reason: string;
  priority_score: number;
  icon: string;
}

export interface ChildDashboardRecommendations {
  recommended_tasks: TaskRecommendation[];
  motivational_message: string;
  focus_area?: string;
  suggested_challenge?: string;
  reward_suggestion?: string;
  wellness_tip?: string;
}

/**
 * Calculate priority score for a task based on various factors
 */
const calculateTaskPriority = (
  task: Task,
  profile: ChildProfile,
  currentSlot: RoutineSlot | null,
  weakSubjects: string[],
  currentMood?: string
): number => {
  let score = 0;

  // Base priority
  if (task.priority === 'high') score += 30;
  else if (task.priority === 'medium') score += 20;
  else score += 10;

  // Energy level match
  if (currentSlot?.category === 'study' && task.energy_level === 'high') score += 15;
  if (currentSlot?.category === 'leisure' && task.energy_level === 'low') score += 15;

  // Weak subject focus
  if (weakSubjects.some(subject =>
    task.title.toLowerCase().includes(subject.toLowerCase())
  )) {
    score += 25;
  }

  // Mood adjustment
  if (currentMood === 'sad' && task.priority === 'low') score += 10;
  if (currentMood === 'excited' && task.priority === 'high') score += 10;

  // Star value (higher value = more engagement incentive)
  score += task.star_value * 0.5;

  // Difficulty scaling based on streak
  if (profile.streak_count >= 21) score += 10; // Challenge for mastery
  else if (profile.streak_count >= 7) score += 5;

  return score;
};

/**
 * Get task recommendations for the child
 */
export const getTaskRecommendations = (
  tasks: Task[],
  profile: ChildProfile,
  exams: ExamResult[],
  currentSlot: RoutineSlot | null,
  currentMood?: string,
  limit: number = 5
): TaskRecommendation[] => {
  // Detect weak subjects
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

  const subjectAverages = Array.from(subjectScores.entries()).map(([subject, data]) => ({
    subject,
    average: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
  }));

  subjectAverages.sort((a, b) => a.average - b.average);
  const weakSubjects = subjectAverages.slice(0, 2).map(s => s.subject);

  // Filter and score tasks
  const scored = tasks.map(task => ({
    task,
    score: calculateTaskPriority(
      task,
      profile,
      currentSlot,
      weakSubjects,
      currentMood
    ),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Map to recommendations with reasons
  return scored.slice(0, limit).map(({ task, score }) => {
    let reason = 'Recommended based on your schedule';
    let icon = '📝';

    if (task.priority === 'high') {
      reason = 'High priority task!';
      icon = '🔴';
    } else if (weakSubjects.some(s => task.title.toLowerCase().includes(s.toLowerCase()))) {
      reason = `Focus on your ${task.category || 'weak area'}`;
      icon = '📚';
    } else if (task.energy_level === 'high' && currentSlot?.category === 'study') {
      reason = 'Perfect for your study slot';
      icon = '💪';
    } else if (task.energy_level === 'low' && currentSlot?.category === 'leisure') {
      reason = 'Great for your leisure time';
      icon = '🎨';
    }

    if (currentMood === 'sad' && task.priority === 'low') {
      reason = 'Comfort task to boost your mood';
      icon = '😊';
    }

    return {
      task,
      reason,
      priority_score: score,
      icon,
    };
  });
};

/**
 * Generate motivational message based on profile and mood
 */
export const generateMotivationalMessage = (
  profile: ChildProfile,
  mood?: string
): string => {
  const level = Math.floor((profile.total_stars || 0) / 20) + 1;
  const streak = profile.streak_count || 0;

  if (mood === 'sad') {
    return '💙 Remember, every step forward counts! You\'ve got this!';
  }

  if (mood === 'excited') {
    return '🚀 Awesome energy! Let\'s make today legendary!';
  }

  if (streak >= 21) {
    return '🏆 You\'re a consistency master! Keep crushing it!';
  }

  if (streak >= 14) {
    return '🔥 Almost there! 7 more days to mastery!';
  }

  if (streak >= 7) {
    return '⭐ You\'re on fire! Keep the streak going!';
  }

  if (level >= 5) {
    return '🎉 You\'re level ' + level + '! You\'re becoming a legend!';
  }

  if (profile.consistency_score >= 80) {
    return '💪 Your consistency is amazing! Keep it up!';
  }

  return '🌟 Every quest completed makes you stronger! Let\'s go!';
};

/**
 * Suggest focus area based on weak subjects
 */
export const suggestFocusArea = (exams: ExamResult[]): string | undefined => {
  if (exams.length === 0) return undefined;

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

  const subjectAverages = Array.from(subjectScores.entries()).map(([subject, data]) => ({
    subject,
    average: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
  }));

  subjectAverages.sort((a, b) => a.average - b.average);

  if (subjectAverages[0] && subjectAverages[0].average < 70) {
    return `📖 Let's boost your ${subjectAverages[0].subject} score!`;
  }

  return undefined;
};

/**
 * Suggest a challenge based on streak and performance
 */
export const suggestChallenge = (profile: ChildProfile): string | undefined => {
  const streak = profile.streak_count || 0;

  if (streak === 0) {
    return '⚡ Start a 3-day streak challenge!';
  }

  if (streak === 6) {
    return '🎯 One more day to your first shield!';
  }

  if (streak === 20) {
    return '🏆 Almost to mastery! Complete one more day!';
  }

  if (streak >= 21 && streak % 7 === 0) {
    return '🚀 Ready for the next level? Try our advanced quest!';
  }

  return undefined;
};

/**
 * Suggest reward based on star accumulation
 */
export const suggestReward = (profile: ChildProfile): string | undefined => {
  const stars = profile.total_stars || 0;

  if (stars >= 50 && stars < 100) {
    return '🎁 You have 50+ stars! Check out rewards you can claim!';
  }

  if (stars >= 100 && stars < 200) {
    return '🎉 You\'ve earned 100+ stars! Premium rewards unlocked!';
  }

  if (stars >= 200) {
    return '👑 You\'re a star collector! Choose your ultimate reward!';
  }

  return undefined;
};

/**
 * Generate wellness/health tip
 */
export const generateWellnessTip = (): string => {
  const tips = [
    '💧 Remember to drink water throughout the day!',
    '🚶 Take a 5-minute walk to refresh your mind.',
    '👁️ Follow the 20-20-20 rule: Every 20 min, look 20 ft away for 20 sec.',
    '😴 Getting enough sleep helps you perform better!',
    '🥗 Healthy snacks = sustained energy for quests!',
    '🧘 Try a quick meditation to recharge.',
    '⚽ Physical activity makes you stronger both ways!',
    '😊 Help someone today and feel good!',
  ];

  return tips[Math.floor(Math.random() * tips.length)];
};

/**
 * Generate comprehensive child dashboard recommendations
 */
export const generateChildDashboardRecommendations = (
  tasks: Task[],
  profile: ChildProfile,
  exams: ExamResult[],
  currentSlot: RoutineSlot | null,
  currentMood?: string
): ChildDashboardRecommendations => {
  const recommended_tasks = getTaskRecommendations(
    tasks,
    profile,
    exams,
    currentSlot,
    currentMood,
    5
  );

  const motivational_message = generateMotivationalMessage(profile, currentMood);
  const focus_area = suggestFocusArea(exams);
  const suggested_challenge = suggestChallenge(profile);
  const reward_suggestion = suggestReward(profile);
  const wellness_tip = generateWellnessTip();

  return {
    recommended_tasks,
    motivational_message,
    focus_area,
    suggested_challenge,
    reward_suggestion,
    wellness_tip,
  };
};
