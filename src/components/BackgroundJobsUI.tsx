import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface JobLog {
  id: string;
  job_name: string;
  status: 'success' | 'error';
  message: string;
  executed_at: string;
  details?: any;
}

interface BackgroundJobsUIProps {
  parentId: string;
}

const BackgroundJobsUI: React.FC<BackgroundJobsUIProps> = ({ parentId }) => {
  const [jobLogs, setJobLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [manualTriggerLoading, setManualTriggerLoading] = useState<string | null>(null);

  // Fetch recent job execution logs
  useEffect(() => {
    const fetchJobLogs = async () => {
      try {
        const logsRef = collection(db, 'job_logs');
        const q = query(
          logsRef,
          orderBy('executed_at', 'desc'),
          limit(20)
        );

        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as JobLog));

        setJobLogs(logs);
      } catch (error) {
        console.error('Error fetching job logs:', error);
      }
    };

    fetchJobLogs();
  }, []);

  // Manual trigger functions
  const triggerJob = async (jobName: string, endpoint: string) => {
    setManualTriggerLoading(jobName);
    try {
      const response = await fetch(`https://us-central1-${process.env.REACT_APP_FIREBASE_PROJECT_ID}.cloudfunctions.net/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${jobName} triggered successfully!\n${JSON.stringify(result, null, 2)}`);
        // Refresh logs
        window.location.reload();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      alert(`❌ Failed to trigger ${jobName}: ${error.message}`);
    } finally {
      setManualTriggerLoading(null);
    }
  };

  const jobConfigs = [
    {
      name: 'Daily Task Generation',
      description: 'Generates personalized tasks for all children at 6:00 AM',
      schedule: 'Daily at 6:00 AM',
      endpoint: 'triggerDailyTasksJob',
      icon: '🤖',
    },
    {
      name: 'Reminder Dispatch',
      description: 'Sends scheduled reminders and notifications hourly',
      schedule: 'Every hour',
      endpoint: 'triggerReminderDispatchJob',
      icon: '🔔',
    },
    {
      name: 'Exam Prep Tasks',
      description: 'Creates exam preparation tasks for upcoming exams',
      schedule: 'Daily at 7:00 AM',
      endpoint: 'triggerExamPrepJob',
      icon: '📚',
    },
    {
      name: 'Data Cleanup',
      description: 'Removes expired tasks and old logs weekly',
      schedule: 'Weekly (Sunday 2:00 AM)',
      endpoint: 'triggerCleanupJob',
      icon: '🧹',
    },
  ];

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ⚙️ Background Job Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor and manually trigger automated background processes
        </p>
      </div>

      {/* Job Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {jobConfigs.map((job) => (
          <div key={job.name} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center">
                <span className="text-2xl mr-3">{job.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {job.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {job.schedule}
                  </p>
                </div>
              </div>
              <button
                onClick={() => triggerJob(job.name, job.endpoint)}
                disabled={manualTriggerLoading === job.name}
                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {manualTriggerLoading === job.name ? '⏳' : '▶️ Run'}
              </button>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {job.description}
            </p>
          </div>
        ))}
      </div>

      {/* Job Execution Logs */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          📋 Recent Job Executions
        </h3>

        {jobLogs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No job logs available yet
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {jobLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(log.status)}`}>
                      {log.status.toUpperCase()}
                    </span>
                    <span className="ml-3 font-medium text-gray-900 dark:text-white">
                      {log.job_name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(log.executed_at)}
                  </span>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {log.message}
                </p>

                {log.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800">
                      View Details
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Job Information */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          ℹ️ How Background Jobs Work
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• <strong>Daily Task Generation:</strong> Runs at 6 AM, creates 7-12 personalized tasks per child</li>
          <li>• <strong>Reminder Dispatch:</strong> Runs hourly, sends push notifications for active reminders</li>
          <li>• <strong>Exam Prep Tasks:</strong> Runs at 7 AM, generates study tasks for upcoming exams</li>
          <li>• <strong>Data Cleanup:</strong> Runs weekly, removes expired tasks and old logs</li>
          <li>• All jobs run in Firebase Cloud Functions with automatic error handling</li>
          <li>• Manual triggers available for testing and immediate execution</li>
        </ul>
      </div>

      {/* Troubleshooting */}
      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900 rounded-lg">
        <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
          🔧 Troubleshooting
        </h4>
        <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
          <li>• Check Firebase Console → Functions for execution logs</li>
          <li>• Verify Firebase project billing is enabled for Cloud Functions</li>
          <li>• Ensure proper IAM permissions for service account</li>
          <li>• Check timezone settings (Asia/Karachi) for scheduling</li>
          <li>• Manual triggers require HTTPS endpoints to be publicly accessible</li>
        </ul>
      </div>
    </div>
  );
};

export default BackgroundJobsUI;