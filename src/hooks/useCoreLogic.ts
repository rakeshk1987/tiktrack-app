import type { Task } from '../types/schema';

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
