import React, { useState } from 'react';
import type { Reminder, ReminderType } from '../types/schema';

interface ReminderManagementProps {
  reminders: Reminder[];
  onUpdate: (id: string, updates: Partial<Reminder>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreate: (reminder: Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>) => Promise<void>;
  loading?: boolean;
}

const ReminderManagement: React.FC<ReminderManagementProps> = ({
  reminders,
  onUpdate,
  onDelete,
  onCreate,
  loading = false,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Reminder, 'id' | 'created_at' | 'updated_at' | 'next_send_at'>>({
    child_id: '',
    parent_id: '',
    type: 'custom',
    title: '',
    message: '',
    schedule_time: '07:00',
    is_enabled: true,
    frequency: 'daily',
    days_of_week: [1, 2, 3, 4, 5],
  });

  const reminderTypeIcons: Record<ReminderType, string> = {
    morning_greeting: '🌅',
    task_reminder: '⏰',
    exam_countdown: '📚',
    missed_task_alert: '⚠️',
    achievement: '🏆',
    custom: '📢',
  };

  const reminderTypeLabels: Record<ReminderType, string> = {
    morning_greeting: 'Morning Greeting',
    task_reminder: 'Task Reminder',
    exam_countdown: 'Exam Countdown',
    missed_task_alert: 'Missed Task Alert',
    achievement: 'Achievement Notification',
    custom: 'Custom Reminder',
  };

  const handleAddReminder = async () => {
    try {
      await onCreate(formData);
      setShowAddForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to create reminder:', err);
    }
  };

  const handleUpdateReminder = async (id: string) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder) return;

    try {
      const updates = {
        title: formData.title,
        message: formData.message,
        schedule_time: formData.schedule_time,
        is_enabled: formData.is_enabled,
        frequency: formData.frequency,
        days_of_week: formData.days_of_week,
      };
      await onUpdate(id, updates);
      setEditingId(null);
      resetForm();
    } catch (err) {
      console.error('Failed to update reminder:', err);
    }
  };

  const handleEditClick = (reminder: Reminder) => {
    setFormData({
      child_id: reminder.child_id,
      parent_id: reminder.parent_id,
      type: reminder.type,
      title: reminder.title,
      message: reminder.message,
      schedule_time: reminder.schedule_time,
      is_enabled: reminder.is_enabled,
      frequency: reminder.frequency,
      days_of_week: reminder.days_of_week,
      task_id: reminder.task_id,
      exam_event_id: reminder.exam_event_id,
    });
    setEditingId(reminder.id);
  };

  const resetForm = () => {
    setFormData({
      child_id: '',
      parent_id: '',
      type: 'custom',
      title: '',
      message: '',
      schedule_time: '07:00',
      is_enabled: true,
      frequency: 'daily',
      days_of_week: [1, 2, 3, 4, 5],
    });
  };

  const toggleDayOfWeek = (day: number) => {
    const days = formData.days_of_week || [];
    if (days.includes(day)) {
      setFormData({ ...formData, days_of_week: days.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, days_of_week: [...days, day].sort() });
    }
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🔔 Reminders</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
        >
          {showAddForm ? 'Cancel' : '+ Add Reminder'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            {editingId ? 'Edit Reminder' : 'Create New Reminder'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as ReminderType })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
              >
                {Object.entries(reminderTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {reminderTypeIcons[key as ReminderType]} {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                placeholder="Reminder title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Message
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                placeholder="Reminder message"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Frequency
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                >
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {(formData.frequency === 'daily' || formData.frequency === 'weekly') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={formData.schedule_time}
                    onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                  />
                </div>
              )}
            </div>

            {formData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Days of Week
                </label>
                <div className="flex gap-2 flex-wrap">
                  {dayLabels.map((label, day) => (
                    <button
                      key={day}
                      onClick={() => toggleDayOfWeek(day)}
                      className={`px-3 py-2 rounded transition ${
                        (formData.days_of_week || []).includes(day)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.is_enabled}
                onChange={(e) => setFormData({ ...formData, is_enabled: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enabled
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => (editingId ? handleUpdateReminder(editingId) : handleAddReminder())}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setShowAddForm(false);
                resetForm();
              }}
              className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Reminders List */}
      <div className="space-y-3">
        {reminders.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">
            No reminders configured yet. Create one to get started!
          </p>
        ) : (
          reminders.map(reminder => (
            <div
              key={reminder.id}
              className={`p-4 rounded-lg border-l-4 transition ${
                reminder.is_enabled
                  ? 'bg-white dark:bg-gray-700 border-blue-500'
                  : 'bg-gray-100 dark:bg-gray-700 border-gray-400 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">
                      {reminderTypeIcons[reminder.type]}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {reminder.title}
                    </h3>
                    <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                      {reminderTypeLabels[reminder.type]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{reminder.message}</p>
                  <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>⏰ {reminder.schedule_time || 'No specific time'}</span>
                    <span>📅 {reminder.frequency}</span>
                    {reminder.frequency === 'weekly' && reminder.days_of_week && (
                      <span>
                        📆{' '}
                        {reminder.days_of_week
                          .map(d => dayLabels[d])
                          .join(', ')}
                      </span>
                    )}
                    <span className={reminder.is_enabled ? 'text-green-600' : 'text-red-600'}>
                      {reminder.is_enabled ? '✓ Active' : '✗ Disabled'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEditClick(reminder)}
                    className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this reminder?')) {
                        onDelete(reminder.id);
                      }
                    }}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReminderManagement;
