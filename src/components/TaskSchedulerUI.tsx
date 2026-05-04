import React, { useState } from 'react';
import type { RoutineConfiguration, Event } from '../types/schema';

interface TaskSchedulerUIProps {
  routine: RoutineConfiguration | null;
  upcomingExams: Event[];
  onGenerateTodaysTasks: () => Promise<void>;
  onGenerateExamTasks?: (exam: Event, daysUntil: number) => Promise<void>;
  loading?: boolean;
}

const TaskSchedulerUI: React.FC<TaskSchedulerUIProps> = ({
  routine,
  upcomingExams,
  onGenerateTodaysTasks,
  onGenerateExamTasks,
  loading = false,
}) => {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [lastGeneratedTime, setLastGeneratedTime] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGenerateTodaysTasks = async () => {
    try {
      await onGenerateTodaysTasks();
      setLastGeneratedTime(new Date().toLocaleTimeString());
      setMessage({
        type: 'success',
        text: '✅ Today\'s tasks generated successfully!',
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to generate tasks',
      });
    }
  };

  const handleGenerateExamTasks = async (exam: Event) => {
    if (!onGenerateExamTasks) return;

    try {
      const today = new Date();
      const examDate = new Date(exam.date);
      const daysUntil = Math.ceil(
        (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      await onGenerateExamTasks(exam, daysUntil);
      setMessage({
        type: 'success',
        text: `📚 Exam prep tasks generated for ${exam.title}!`,
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to generate exam tasks',
      });
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🤖 Intelligent Task Scheduler
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Auto-generate optimized tasks based on routine, performance, and upcoming exams
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Routine Status */}
      {routine && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">
            📋 Current Configuration
          </p>
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Mode: <span className="font-bold">{routine.current_mode}</span>
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {routine.current_mode === 'academic'
                  ? `📚 School Days (${routine.school_days_routine.length} slots)`
                  : `🌞 Vacation (${routine.vacation_routine.length} slots)`}
              </p>
            </div>
            {lastGeneratedTime && (
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Last generated: {lastGeneratedTime}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Auto-Generate Toggle */}
      <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white mb-1">
              ⏰ Auto-Generate Daily Tasks
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Automatically generate optimized tasks at 6:00 AM daily
            </p>
          </div>
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
              className="mr-2 w-5 h-5"
            />
            <span className={autoGenerate ? 'text-green-600' : 'text-gray-600'}>
              {autoGenerate ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      {/* Manual Generation */}
      <div className="mb-6">
        <button
          onClick={handleGenerateTodaysTasks}
          disabled={loading || !routine}
          className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '⏳ Generating...' : '🚀 Generate Today\'s Tasks Now'}
        </button>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Creates 7-12 personalized tasks based on routine, performance, and mood
        </p>
      </div>

      {/* Exam Prep Tasks */}
      {upcomingExams.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900 border border-orange-200 dark:border-orange-700 rounded-lg p-6">
          <p className="font-semibold text-orange-900 dark:text-orange-100 mb-4">
            📚 Upcoming Exams - Generate Prep Tasks
          </p>

          <div className="space-y-3">
            {upcomingExams.slice(0, 3).map(exam => {
              const today = new Date();
              const examDate = new Date(exam.date);
              const daysUntil = Math.ceil(
                (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
              );

              if (daysUntil < 0) return null;

              const urgencyColor =
                daysUntil <= 1
                  ? 'bg-red-100 dark:bg-red-900'
                  : daysUntil <= 3
                  ? 'bg-orange-100 dark:bg-orange-800'
                  : 'bg-yellow-100 dark:bg-yellow-800';

              return (
                <div
                  key={exam.id}
                  className={`p-3 rounded-lg flex justify-between items-center ${urgencyColor}`}
                >
                  <div>
                    <p className="font-semibold text-orange-900 dark:text-orange-100">
                      {exam.title}
                    </p>
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      {daysUntil === 0
                        ? '🔴 Today!'
                        : daysUntil === 1
                        ? '🟠 Tomorrow'
                        : `📅 ${daysUntil} days away`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleGenerateExamTasks(exam)}
                    disabled={loading}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded transition text-sm font-semibold disabled:opacity-50"
                  >
                    Generate
                  </button>
                </div>
              );
            })}
          </div>

          {upcomingExams.length > 3 && (
            <p className="text-xs text-orange-700 dark:text-orange-300 mt-3">
              + {upcomingExams.length - 3} more exams
            </p>
          )}
        </div>
      )}

      {/* Features List */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <p className="font-semibold text-gray-900 dark:text-white mb-3">
          ✨ Smart Scheduling Features
        </p>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>✅ Routine-aware task generation (study, leisure, health, prayer slots)</li>
          <li>✅ Weak subject detection and prioritization</li>
          <li>✅ Difficulty scaling based on streak and consistency</li>
          <li>✅ Exam countdown and prep task generation</li>
          <li>✅ Mood-based task adjustment (sad = easier, excited = challenging)</li>
          <li>✅ Challenge tasks for mastery-level children (21+ day streak)</li>
          <li>✅ Motivational tasks for struggling learners</li>
          <li>✅ Automatic expiration of exam-specific tasks</li>
        </ul>
      </div>

      {/* Status Indicator */}
      <div className="mt-6 p-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
          📊 Generation Status
        </p>
        <div className="space-y-1 text-xs text-blue-800 dark:text-blue-300">
          <p>
            {routine ? '✅ Routine configured' : '⚠️ Routine not configured'}
          </p>
          <p>
            {autoGenerate ? '✅ Auto-generation enabled' : '❌ Auto-generation disabled'}
          </p>
          <p>
            {lastGeneratedTime ? `✅ Last generated: ${lastGeneratedTime}` : '⏳ Never generated'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TaskSchedulerUI;
