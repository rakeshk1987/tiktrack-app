import React, { useState, useEffect } from 'react';
import { useRealTime, useRealTimeNotifications } from '../contexts/RealTimeContext';
import type { Task, Challenge } from '../types/schema';

interface RealTimeDashboardProps {
  childId: string;
  childName: string;
}

const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({ childId, childName }) => {
  const {
    liveTasks,
    liveChallenges,
    liveMessages,
    isConnected,
    connectionStatus,
    lastUpdate,
    updateCount,
  } = useRealTime();

  const { notifyTaskCompleted, notifyChallengeUpdate } = useRealTimeNotifications();

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    challengesActive: 0,
    starsEarned: 0,
    streakCurrent: 0,
  });

  // Track recent activity
  useEffect(() => {
    const activities = [];

    // Add recent task completions
    const completedTasks = liveTasks.filter(task =>
      task.status === 'completed' &&
      task.completed_at &&
      new Date(task.completed_at) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );

    completedTasks.forEach(task => {
      activities.push({
        id: `task-${task.id}`,
        type: 'task_completed',
        title: `Completed "${task.title}"`,
        timestamp: new Date(task.completed_at!),
        stars: task.star_value,
      });
    });

    // Add recent challenge updates
    const recentChallenges = liveChallenges.filter(challenge =>
      challenge.updated_at &&
      new Date(challenge.updated_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    recentChallenges.forEach(challenge => {
      activities.push({
        id: `challenge-${challenge.id}`,
        type: 'challenge_update',
        title: `Updated challenge "${challenge.title}"`,
        timestamp: new Date(challenge.updated_at),
        status: challenge.status,
      });
    });

    // Sort by timestamp (most recent first)
    activities.sort((a, b) => b.timestamp - a.timestamp);
    setRecentActivity(activities.slice(0, 10));
  }, [liveTasks, liveChallenges]);

  // Calculate live stats
  useEffect(() => {
    const completedTasks = liveTasks.filter(task => task.status === 'completed');
    const activeChallenges = liveChallenges.filter(challenge => challenge.status === 'active');
    const totalStars = completedTasks.reduce((sum, task) => sum + task.star_value, 0);

    setStats({
      tasksCompleted: completedTasks.length,
      challengesActive: activeChallenges.length,
      starsEarned: totalStars,
      streakCurrent: 5, // This would come from profile data
    });
  }, [liveTasks, liveChallenges]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task_completed': return '✅';
      case 'challenge_update': return '🏆';
      default: return '📝';
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'connecting': return 'text-yellow-600 bg-yellow-100';
      case 'disconnected': return 'text-red-600 bg-red-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            📊 Live Dashboard - {childName}
          </h2>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getConnectionStatusColor()}`}>
            {connectionStatus === 'connected' && '🟢'}
            {connectionStatus === 'connecting' && '🟡'}
            {connectionStatus === 'disconnected' && '🔴'}
            {connectionStatus === 'error' && '❌'}
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </div>
        </div>

        {lastUpdate && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Last updated: {lastUpdate.toLocaleTimeString()} • {updateCount} updates
          </p>
        )}
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
          <div className="flex items-center">
            <span className="text-2xl mr-2">✅</span>
            <div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.tasksCompleted}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Tasks Completed
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
          <div className="flex items-center">
            <span className="text-2xl mr-2">🏆</span>
            <div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.challengesActive}
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Active Challenges
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
          <div className="flex items-center">
            <span className="text-2xl mr-2">⭐</span>
            <div>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {stats.starsEarned}
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Stars Earned
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg">
          <div className="flex items-center">
            <span className="text-2xl mr-2">🔥</span>
            <div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.streakCurrent}
              </p>
              <p className="text-sm text-purple-600 dark:text-purple-400">
                Day Streak
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          🕒 Recent Activity (Last 24 Hours)
        </h3>

        {recentActivity.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No recent activity
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <span className="text-xl mr-3">{getActivityIcon(activity.type)}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activity.timestamp.toLocaleString()}
                    {activity.stars && ` • +${activity.stars} ⭐`}
                  </p>
                </div>
                {activity.status && (
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    activity.status === 'completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  }`}>
                    {activity.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Tasks Preview */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          📋 Active Tasks ({liveTasks.filter(t => t.status === 'pending').length})
        </h3>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {liveTasks
            .filter(task => task.status === 'pending')
            .slice(0, 5)
            .map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center">
                  <span className={`w-3 h-3 rounded-full mr-3 ${
                    task.priority === 'high' ? 'bg-red-500' :
                    task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}></span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {task.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {task.category} • {task.star_value} ⭐ • {task.energy_level} energy
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => notifyTaskCompleted(task, childName)}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded transition"
                >
                  Complete
                </button>
              </div>
            ))}
        </div>

        {liveTasks.filter(t => t.status === 'pending').length > 5 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            +{liveTasks.filter(t => t.status === 'pending').length - 5} more tasks
          </p>
        )}
      </div>

      {/* Active Challenges */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          🏆 Active Challenges ({liveChallenges.filter(c => c.status === 'active').length})
        </h3>

        <div className="space-y-2">
          {liveChallenges
            .filter(challenge => challenge.status === 'active')
            .slice(0, 3)
            .map((challenge) => (
              <div
                key={challenge.id}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {challenge.title}
                  </p>
                  <button
                    onClick={() => notifyChallengeUpdate(challenge, childName)}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition"
                  >
                    Update
                  </button>
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Parent: {challenge.parent_score}</span>
                  <span>Child: {challenge.child_score}</span>
                  <span>Target: {challenge.target_score}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Connection Info */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
          🔗 Real-time Connection
        </h4>
        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <p>• Status: {connectionStatus}</p>
          <p>• Updates received: {updateCount}</p>
          <p>• Tasks monitored: {liveTasks.length}</p>
          <p>• Challenges monitored: {liveChallenges.length}</p>
          <p>• Messages received: {liveMessages.length}</p>
        </div>
      </div>
    </div>
  );
};

export default RealTimeDashboard;
