import React from 'react';
import { ComprehensiveDashboard } from '../utils/dashboardAnalytics';

interface AnalyticsDashboardProps {
  data: ComprehensiveDashboard;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ data }) => {
  const { metrics, performance, health, mood, alerts, recommendations } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📊 Child Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400">Comprehensive insights into progress and development</p>
      </div>

      {/* Key Metrics - Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Consistency */}
        <div className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900 dark:to-purple-800 rounded-lg p-6">
          <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">Consistency Score</p>
          <p className="text-4xl font-bold text-purple-900 dark:text-purple-100 mb-2">
            {metrics.consistency_score}%
          </p>
          <span className={`text-xs px-2 py-1 rounded ${
            metrics.consistency_trend === 'improving' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            metrics.consistency_trend === 'declining' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
          }`}>
            {metrics.consistency_trend === 'improving' ? '📈' : 
             metrics.consistency_trend === 'declining' ? '📉' : '→'} {metrics.consistency_trend}
          </span>
        </div>

        {/* Streak */}
        <div className="bg-gradient-to-br from-orange-100 to-orange-50 dark:from-orange-900 dark:to-orange-800 rounded-lg p-6">
          <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1">Current Streak</p>
          <p className="text-4xl font-bold text-orange-900 dark:text-orange-100 mb-2">
            🔥 {metrics.current_streak}
          </p>
          <p className="text-xs text-orange-700 dark:text-orange-300">Shields: {metrics.streak_shields}</p>
        </div>

        {/* Stars & Level */}
        <div className="bg-gradient-to-br from-yellow-100 to-yellow-50 dark:from-yellow-900 dark:to-yellow-800 rounded-lg p-6">
          <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300 mb-1">Total Stars</p>
          <p className="text-4xl font-bold text-yellow-900 dark:text-yellow-100 mb-2">
            ⭐ {metrics.total_stars_earned}
          </p>
          <p className="text-xs text-yellow-700 dark:text-yellow-300">Level {metrics.level}</p>
        </div>

        {/* Completion Rate */}
        <div className="bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900 dark:to-blue-800 rounded-lg p-6">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">This Week</p>
          <p className="text-4xl font-bold text-blue-900 dark:text-blue-100 mb-2">
            {metrics.completion_rate_this_week}%
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">{metrics.tasks_completed_this_week} completed</p>
        </div>
      </div>

      {/* Alerts & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">⚠️ Important Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-green-600 dark:text-green-400">✅ All good! No alerts at this time.</p>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, idx) => (
                <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-400 rounded">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">{alert}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">💡 Recommendations</h2>
          {recommendations.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">No specific recommendations at this time.</p>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-900 border-l-4 border-blue-400 rounded">
                  <p className="text-sm text-blue-800 dark:text-blue-200">{rec}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Academic Performance */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📚 Academic Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Key Stats</p>
            <div className="space-y-2">
              <p><span className="font-semibold">Total Exams:</span> {performance.total_exams_taken}</p>
              <p><span className="font-semibold">Average Score:</span> {performance.average_exam_score}%</p>
              <p className={`${
                performance.recent_exam_trend === 'improving' ? 'text-green-600' :
                performance.recent_exam_trend === 'declining' ? 'text-red-600' :
                'text-yellow-600'
              }`}>
                <span className="font-semibold">Recent Trend:</span> {performance.recent_exam_trend === 'improving' ? '📈' : 
                performance.recent_exam_trend === 'declining' ? '📉' : '→'} {performance.recent_exam_trend}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Subject Areas</p>
            <div>
              {performance.strongest_subjects.length > 0 && (
                <p className="text-green-600 dark:text-green-400 mb-2">
                  💪 <span className="font-semibold">Strong:</span> {performance.strongest_subjects.join(', ')}
                </p>
              )}
              {performance.weakest_subjects.length > 0 && (
                <p className="text-orange-600 dark:text-orange-400">
                  📖 <span className="font-semibold">Focus Area:</span> {performance.weakest_subjects.join(', ')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Health Tracking */}
      {health && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">❤️ Health Metrics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-red-50 dark:bg-red-900 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Height</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{health.latest_height_cm}</p>
              <p className="text-xs text-red-700 dark:text-red-300">cm</p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Weight</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{health.latest_weight_kg}</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">kg</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">BMI</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{health.latest_bmi}</p>
              <p className="text-xs text-green-700 dark:text-green-300">index</p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900 rounded-lg p-4 text-center">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">Last Check</p>
              <p className="text-xs text-purple-900 dark:text-purple-100">{new Date(health.last_measurement_date).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded">
            <p className="text-sm">
              <span className="font-semibold">Growth Trend:</span>{' '}
              {health.growth_trend_cm_per_month > 0 ? '📈 Growing' : '→ Stable'}{' '}
              ({health.growth_trend_cm_per_month} cm/month)
            </p>
          </div>
        </div>
      )}

      {/* Mood Analysis */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">😊 Mood Analysis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Last 7 Days</p>
            <div className="space-y-2">
              {mood.recent_moods.slice(0, 7).map((entry, idx) => {
                const moodEmojis: Record<string, string> = {
                  happy: '😊',
                  sad: '😢',
                  angry: '😠',
                  neutral: '😐',
                  excited: '🤩',
                };
                return (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-sm">{new Date(entry.date).toLocaleDateString()}</span>
                    <span className="text-lg">{moodEmojis[entry.mood] || '😐'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Summary</p>
            <div className="space-y-3">
              <p>
                <span className="font-semibold">Dominant Mood:</span>{' '}
                <span className="text-lg">
                  {mood.dominant_mood === 'happy' && '😊'}
                  {mood.dominant_mood === 'sad' && '😢'}
                  {mood.dominant_mood === 'excited' && '🤩'}
                  {mood.dominant_mood === 'neutral' && '😐'}
                  {mood.dominant_mood === 'angry' && '😠'}
                  {' '}{mood.dominant_mood}
                </span>
              </p>
              <p>
                <span className="font-semibold">Trend:</span> {
                  mood.mood_trend === 'concerned' ? '⚠️ Needs Attention' : '✅ Healthy'
                }
              </p>
              <p className={mood.days_sad_this_week > 2 ? 'text-orange-600 dark:text-orange-400' : ''}>
                <span className="font-semibold">Sad Days This Week:</span> {mood.days_sad_this_week}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
