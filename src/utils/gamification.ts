import type { Task } from '../types/schema';

export const GAMIFICATION_RULES = {
  STARS_PER_STANDARD_TASK: 1,
  STARS_PER_HIGH_FOCUS_TASK: 2,
  STAR_TO_CURRENCY_CONVERSION_RATE: 5, // 1 star = ₹5
};

export function calculateTaskReward(task: Task): number {
  if (task.energy_level === 'high') {
    return GAMIFICATION_RULES.STARS_PER_HIGH_FOCUS_TASK;
  }
  // Base off explicitly defined star values if they exist
  return task.star_value || GAMIFICATION_RULES.STARS_PER_STANDARD_TASK;
}

export function convertStarsToCurrency(stars: number): number {
  return stars * GAMIFICATION_RULES.STAR_TO_CURRENCY_CONVERSION_RATE;
}

export function handleTaskFailure(currentShieldCount: number) {
  // Logic from failure_handling specs
  if (currentShieldCount > 0) {
    return {
      success: false,
      shieldUsed: true,
      message: "It's okay! We used a shield to protect your streak.",
      remainingShields: currentShieldCount - 1
    };
  }
  return {
    success: false,
    shieldUsed: false,
    message: "Don't worry, everyone has off days. Let's try again tomorrow!",
    remainingShields: 0
  };
}
