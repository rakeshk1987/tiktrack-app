import React from 'react';
import { ChildDashboardRecommendations, TaskRecommendation } from '../utils/childRecommendations';

interface RecommendationsPanelProps {
  recommendations: ChildDashboardRecommendations;
  onTaskSelect?: (task: any) => void;
}

const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  recommendations,
  onTaskSelect,
}) => {
  const {
    recommended_tasks,
    motivational_message,
    focus_area,
    suggested_challenge,
    reward_suggestion,
    wellness_tip,
  } = recommendations;

  return (
    <div className="space-y-4">
      {/* Motivational Message */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white shadow-lg">
        <p className="text-2xl font-bold mb-2">✨ {motivational_message}</p>
        <p className="text-sm opacity-90">You have the power to make today amazing!</p>
      </div>

      {/* Recommended Tasks */}
      {recommended_tasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🎯 Recommended for You</h3>
          <div className="space-y-3">
            {recommended_tasks.map((rec, idx) => (
              <div
                key={idx}
                onClick={() => onTaskSelect?.(rec.task)}
                className="p-4 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{rec.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {rec.task.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {rec.reason}
                    </p>
                    <div className="flex gap-3 text-xs">
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                        ⭐ {rec.task.star_value} stars
                      </span>
                      <span className={`px-2 py-1 rounded ${
                        rec.task.priority === 'high'
                          ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          : rec.task.priority === 'medium'
                          ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      }`}>
                        {rec.task.priority}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Focus Area */}
      {focus_area && (
        <div className="bg-orange-50 dark:bg-orange-900 border-l-4 border-orange-500 rounded-lg p-6">
          <p className="text-lg font-bold text-orange-900 dark:text-orange-100">{focus_area}</p>
          <p className="text-sm text-orange-800 dark:text-orange-200 mt-2">
            Focusing on your weaker areas helps you become more well-rounded!
          </p>
        </div>
      )}

      {/* Challenge Suggestion */}
      {suggested_challenge && (
        <div className="bg-red-50 dark:bg-red-900 border-l-4 border-red-500 rounded-lg p-6">
          <p className="text-lg font-bold text-red-900 dark:text-red-100">{suggested_challenge}</p>
          <button
            className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition text-sm"
          >
            Accept Challenge
          </button>
        </div>
      )}

      {/* Reward Suggestion */}
      {reward_suggestion && (
        <div className="bg-green-50 dark:bg-green-900 border-l-4 border-green-500 rounded-lg p-6">
          <p className="text-lg font-bold text-green-900 dark:text-green-100">{reward_suggestion}</p>
          <button
            className="mt-3 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition text-sm"
          >
            View Rewards
          </button>
        </div>
      )}

      {/* Wellness Tip */}
      {wellness_tip && (
        <div className="bg-purple-50 dark:bg-purple-900 border-l-4 border-purple-500 rounded-lg p-6">
          <p className="text-lg font-bold text-purple-900 dark:text-purple-100 mb-2">💡 Wellness Tip</p>
          <p className="text-sm text-purple-800 dark:text-purple-200">
            {wellness_tip}
          </p>
        </div>
      )}
    </div>
  );
};

export default RecommendationsPanel;
