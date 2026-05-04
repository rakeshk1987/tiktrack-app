import {
  Task,
  RoutineSlot,
  ChildProfile,
  ExamResult,
  MoodLog,
  Event,
} from '../types/schema';

export interface TaskGenerationRule {
  routine_category: string;
  task_templates: TaskTemplate[];
  frequency: 'daily' | 'weekly' | 'exam_dependent';
  min_tasks: number;
  max_tasks: number;
}

export interface TaskTemplate {
  title_pattern: string; // Template with {subject}, {difficulty}, etc.
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
  expires_at?: string; // For temporary/exam-specific tasks
}

/**
 * Default task generation rules mapped to routine categories
 */
export const DEFAULT_TASK_RULES: Record<string, TaskGenerationRule> = {
  study: {
    routine_category: 'study',
    task_templates: [
      {
        title_pattern: 'Math Practice - {difficulty}',
        category: 'Mathematics',
        energy_level: 'high',
        priority: 'high',
        base_star_value: 3,
        requires_proof: true,
        description: 'Solve practice problems from textbook',
      },
      {
        title_pattern: 'Language Arts - {difficulty}',
        category: 'English',
        energy_level: 'high',
        priority: 'high',
        base_star_value: 2,
        requires_proof: true,
        description: 'Reading, writing, or grammar exercises',
      },
      {
        title_pattern: 'Science Experiment - {difficulty}',
        category: 'Science',
        energy_level: 'high',
        priority: 'medium',
        base_star_value: 3,
        requires_proof: true,
        description: 'Conduct an experiment or observation',
      },
    ],
    frequency: 'daily',
    min_tasks: 1,
    max_tasks: 3,
  },
  prayer: {
    routine_category: 'prayer',
    task_templates: [
      {
        title_pattern: 'Prayer & Meditation',
        category: 'Wellbeing',
        energy_level: 'low',
        priority: 'medium',
        base_star_value: 1,
        requires_proof: false,
        description: 'Take time for prayer or meditation',
      },
    ],
    frequency: 'daily',
    min_tasks: 1,
    max_tasks: 1,
  },
  leisure: {
    routine_category: 'leisure',
    task_templates: [
      {
        title_pattern: 'Creative Activity - {type}',
        category: 'Creative',
        energy_level: 'low',
        priority: 'low',
        base_star_value: 1,
        requires_proof: false,
        description: 'Art, music, writing, or creative pursuit',
      },
      {
        title_pattern: 'Reading Time',
        category: 'Reading',
        energy_level: 'low',
        priority: 'low',
        base_star_value: 2,
        requires_proof: false,
        description: 'Read a book or article of interest',
      },
    ],
    frequency: 'daily',
    min_tasks: 1,
    max_tasks: 2,
  },
  health: {
    routine_category: 'health',
    task_templates: [
      {
        title_pattern: 'Physical Activity - {type}',
        category: 'Health',
        energy_level: 'high',
        priority: 'high',
        base_star_value: 2,
        requires_proof: true,
        description: 'Exercise, sports, or physical activity',
      },
      {
        title_pattern: 'Healthy Meal',
        category: 'Health',
        energy_level: 'low',
        priority: 'medium',
        base_star_value: 1,
        requires_proof: false,
        description: 'Eat a nutritious meal',
      },
    ],
    frequency: 'daily',
    min_tasks: 1,
    max_tasks: 2,
  },
};

/**
 * Generate tasks for a specific routine slot
 */
export const generateTasksForSlot = (
  slot: RoutineSlot,
  profile: ChildProfile,
  weakSubjects: string[] = [],
  upcomingExams: Event[] = [],
  currentMood?: string
): GeneratedTask[] => {
  const rule = DEFAULT_TASK_RULES[slot.category || 'leisure'];
  if (!rule) {
    return [];
  }

  const generatedTasks: GeneratedTask[] = [];
  const taskCount = Math.random() * (rule.max_tasks - rule.min_tasks + 1) + rule.min_tasks;

  for (let i = 0; i < Math.floor(taskCount); i++) {
    const template = rule.task_templates[i % rule.task_templates.length];

    // Calculate difficulty
    let difficulty = 3;
    if (profile.streak_count && profile.streak_count >= 21) {
      difficulty = 7;
    } else if (profile.streak_count && profile.streak_count >= 14) {
      difficulty = 6;
    } else if (profile.streak_count && profile.streak_count >= 7) {
      difficulty = 5;
    } else if (profile.consistency_score && profile.consistency_score < 50) {
      difficulty = 2;
    }

    // Generate title
    const difficultyLabels = ['Easy', 'Normal', 'Hard', 'Expert'];
    const activityTypes = ['Sports', 'Dance', 'Art', 'Music', 'Games'];
    let title = template.title_pattern
      .replace('{difficulty}', difficultyLabels[Math.min(3, Math.floor(difficulty / 2))])
      .replace('{type}', activityTypes[Math.floor(Math.random() * activityTypes.length)])
      .replace('{subject}', weakSubjects[0] || 'General');

    // Boost priority for weak subjects
    let priority = template.priority;
    if (
      weakSubjects.length > 0 &&
      template.category.toLowerCase().includes(weakSubjects[0].toLowerCase())
    ) {
      priority = 'high';
    }

    // Adjust stars based on mood
    let starValue = template.base_star_value;
    if (currentMood === 'sad') {
      starValue = Math.max(1, starValue - 1); // Easier rewards
    } else if (currentMood === 'excited') {
      starValue = Math.min(5, starValue + 1); // Bonus rewards
    }

    // Check for exam-related tasks
    let expiresAt: string | undefined;
    if (slot.category === 'study' && upcomingExams.length > 0) {
      const nearestExam = upcomingExams[0];
      expiresAt = new Date(nearestExam.date).toISOString();
      starValue += 1; // Bonus for exam prep
    }

    generatedTasks.push({
      title,
      category: template.category,
      priority,
      energy_level: template.energy_level,
      difficulty_level: difficulty,
      star_value: starValue,
      requires_proof: template.requires_proof,
      generated_at: new Date().toISOString(),
      generation_reason: `Auto-generated for ${slot.name} slot`,
      expires_at: expiresAt,
    });
  }

  return generatedTasks;
};

/**
 * Generate full day's tasks based on routine
 */
export const generateDailyTasks = (
  routineSlots: RoutineSlot[],
  profile: ChildProfile,
  exams: ExamResult[],
  upcomingEvents: Event[],
  currentMood?: string,
  maxTasksPerDay: number = 10
): GeneratedTask[] => {
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

  // Filter upcoming exams for next 14 days
  const today = new Date();
  const upcomingExams = upcomingEvents
    .filter(e => e.type === 'exam' || e.type === 'Exam')
    .filter(e => {
      const examDate = new Date(e.date);
      const daysUntil = (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntil >= 0 && daysUntil <= 14;
    });

  // Generate tasks for each slot
  let allTasks: GeneratedTask[] = [];
  for (const slot of routineSlots) {
    const slotTasks = generateTasksForSlot(
      slot,
      profile,
      weakSubjects,
      upcomingExams,
      currentMood
    );
    allTasks = allTasks.concat(slotTasks);
  }

  // Sort by priority and star value, cap at maxTasksPerDay
  allTasks.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff =
      (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
      (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);

    if (priorityDiff !== 0) return priorityDiff;
    return b.star_value - a.star_value;
  });

  return allTasks.slice(0, maxTasksPerDay);
};

/**
 * Generate tasks for exam prep (returns high-focus study tasks)
 */
export const generateExamPrepTasks = (
  exam: Event,
  daysUntilExam: number,
  profile: ChildProfile
): GeneratedTask[] => {
  const examTasks: GeneratedTask[] = [];
  const subject = exam.title;

  // Intensity increases as exam gets closer
  let taskCount = 1;
  if (daysUntilExam <= 1) taskCount = 4; // Final day push
  else if (daysUntilExam <= 3) taskCount = 3; // 3 days before
  else if (daysUntilExam <= 7) taskCount = 2; // 1 week before

  for (let i = 0; i < taskCount; i++) {
    const reviewTypes = [
      'Review notes and key concepts',
      'Practice previous year questions',
      'Group discussion and explanation',
      'Mock test/sample paper',
    ];

    examTasks.push({
      title: `${subject} - ${reviewTypes[i % reviewTypes.length]}`,
      category: subject,
      priority: 'high',
      energy_level: 'high',
      difficulty_level: Math.min(8, 5 + Math.floor((7 - daysUntilExam) * 0.5)),
      star_value: 4 + (7 - daysUntilExam), // Bonus stars as exam approaches
      requires_proof: true,
      generated_at: new Date().toISOString(),
      generation_reason: `Exam prep for ${subject} (${daysUntilExam} days away)`,
      expires_at: exam.date,
    });
  }

  return examTasks;
};

/**
 * Generate challenge tasks (harder, for mastery-level children)
 */
export const generateChallengeTasks = (
  profile: ChildProfile,
  weeklyCompletionRate: number
): GeneratedTask[] => {
  if (profile.streak_count === undefined || profile.streak_count < 21) {
    return []; // Only for mastery level
  }

  const challenges: GeneratedTask[] = [];

  if (weeklyCompletionRate > 80) {
    challenges.push({
      title: 'Weekly Challenge Quest',
      category: 'Challenge',
      priority: 'high',
      energy_level: 'high',
      difficulty_level: 9,
      star_value: 10,
      requires_proof: true,
      generated_at: new Date().toISOString(),
      generation_reason: 'Bonus challenge for consistent excellence',
    });
  }

  if (profile.consistency_score && profile.consistency_score > 85) {
    challenges.push({
      title: 'Mastery Milestone Task',
      category: 'Achievement',
      priority: 'high',
      energy_level: 'medium',
      difficulty_level: 8,
      star_value: 8,
      requires_proof: true,
      generated_at: new Date().toISOString(),
      generation_reason: 'Celebration of consistent achievement',
    });
  }

  return challenges;
};

/**
 * Generate motivational tasks for low performers
 */
export const generateMotivationalTasks = (
  profile: ChildProfile,
  mood?: string
): GeneratedTask[] => {
  if (
    (profile.consistency_score === undefined || profile.consistency_score > 60) &&
    (profile.streak_count === undefined || profile.streak_count > 2)
  ) {
    return []; // Only for struggling children
  }

  const motivationalTasks: GeneratedTask[] = [];

  if (mood === 'sad') {
    motivationalTasks.push({
      title: 'Comfort Activity - Choose Your Favorite',
      category: 'Wellbeing',
      priority: 'low',
      energy_level: 'low',
      difficulty_level: 1,
      star_value: 2,
      requires_proof: false,
      generated_at: new Date().toISOString(),
      generation_reason: 'Mood boost - low-pressure activity',
    });
  }

  if (profile.streak_count === 0) {
    motivationalTasks.push({
      title: 'Fresh Start - Quick Win Task',
      category: 'Starter',
      priority: 'high',
      energy_level: 'low',
      difficulty_level: 1,
      star_value: 3,
      requires_proof: false,
      generated_at: new Date().toISOString(),
      generation_reason: 'Start building a new streak',
    });
  }

  return motivationalTasks;
};

/**
 * Smart task generation combining all logic
 */
export const generateSmartDailyTasks = (
  routineSlots: RoutineSlot[],
  profile: ChildProfile,
  exams: ExamResult[],
  upcomingEvents: Event[],
  currentMood?: string,
  weeklyCompletionRate: number = 50
): GeneratedTask[] => {
  let tasks: GeneratedTask[] = [];

  // Generate routine-based tasks
  const routineTasks = generateDailyTasks(
    routineSlots,
    profile,
    exams,
    upcomingEvents,
    currentMood,
    7 // Max 7 routine tasks
  );
  tasks = tasks.concat(routineTasks);

  // Add exam prep tasks if exams coming
  const today = new Date();
  const upcomingExams = upcomingEvents
    .filter(e => (e.type === 'exam' || e.type === 'Exam'))
    .map(e => {
      const examDate = new Date(e.date);
      const daysUntil = (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
      return { event: e, daysUntil };
    })
    .filter(e => e.daysUntil >= 0 && e.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (upcomingExams.length > 0) {
    const examTasks = generateExamPrepTasks(upcomingExams[0].event, upcomingExams[0].daysUntil, profile);
    tasks = tasks.concat(examTasks);
  }

  // Add challenge tasks for top performers
  const challengeTasks = generateChallengeTasks(profile, weeklyCompletionRate);
  tasks = tasks.concat(challengeTasks);

  // Add motivational tasks for struggling children
  const motivationalTasks = generateMotivationalTasks(profile, currentMood);
  tasks = tasks.concat(motivationalTasks);

  // Cap total tasks
  return tasks.slice(0, 12);
};
