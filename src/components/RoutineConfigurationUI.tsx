import React, { useState } from 'react';
import type { RoutineConfiguration, RoutineSlot } from '../types/schema';

interface RoutineConfigurationProps {
  routine: RoutineConfiguration | null;
  onUpdate: (updates: Partial<RoutineConfiguration>) => Promise<void>;
  loading?: boolean;
}

const RoutineConfigurationUI: React.FC<RoutineConfigurationProps> = ({
  routine,
  onUpdate,
  loading = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'academic' | 'vacation'>('academic');
  const [editingSlot, setEditingSlot] = useState<RoutineSlot | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [academicRoutine, setAcademicRoutine] = useState<RoutineSlot[]>(
    routine?.school_days_routine || []
  );
  const [vacationRoutine, setVacationRoutine] = useState<RoutineSlot[]>(
    routine?.vacation_routine || []
  );

  if (!routine) {
    return <div className="p-4 text-gray-500">Loading routine configuration...</div>;
  }

  const currentRoutine = activeTab === 'academic' ? academicRoutine : vacationRoutine;

  const handleAddSlot = () => {
    const newSlot: RoutineSlot = {
      name: 'New Activity',
      start_time: '09:00',
      end_time: '10:00',
      category: 'study',
    };
    if (activeTab === 'academic') {
      setAcademicRoutine([...academicRoutine, newSlot]);
    } else {
      setVacationRoutine([...vacationRoutine, newSlot]);
    }
  };

  const handleEditSlot = (slot: RoutineSlot, index: number) => {
    setEditingSlot({ ...slot });
    setEditingIndex(index);
  };

  const handleUpdateSlot = () => {
    if (editingSlot === null || editingIndex === null) return;

    if (activeTab === 'academic') {
      const updated = [...academicRoutine];
      updated[editingIndex] = editingSlot;
      setAcademicRoutine(updated);
    } else {
      const updated = [...vacationRoutine];
      updated[editingIndex] = editingSlot;
      setVacationRoutine(updated);
    }

    setEditingSlot(null);
    setEditingIndex(null);
  };

  const handleDeleteSlot = (index: number) => {
    if (activeTab === 'academic') {
      setAcademicRoutine(academicRoutine.filter((_, i) => i !== index));
    } else {
      setVacationRoutine(vacationRoutine.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    try {
      await onUpdate({
        school_days_routine: academicRoutine,
        vacation_routine: vacationRoutine,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save routine:', err);
    }
  };

  const categoryColors: Record<string, string> = {
    study: 'bg-blue-100 text-blue-900',
    play: 'bg-green-100 text-green-900',
    leisure: 'bg-purple-100 text-purple-900',
    prayer: 'bg-orange-100 text-orange-900',
    health: 'bg-red-100 text-red-900',
  };

  const categoryIcons: Record<string, string> = {
    study: '📚',
    play: '🎮',
    leisure: '🎨',
    prayer: '🙏',
    health: '❤️',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Routine Configuration</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Mode Display */}
      <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <p className="text-gray-700 dark:text-gray-300">
          Current Mode:{' '}
          <span className="font-bold text-lg">
            {routine.current_mode === 'academic' ? '📚 Academic' : '🌞 Vacation'}
          </span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Academic Mode: {routine.academic_mode_start} - {routine.academic_mode_end}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('academic')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'academic'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          📚 School Days Routine
        </button>
        <button
          onClick={() => setActiveTab('vacation')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'vacation'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          🌞 Vacation Routine
        </button>
      </div>

      {/* Routine Slots List */}
      <div className="space-y-3 mb-6">
        {currentRoutine.map((slot, index) => (
          <div key={index} className={`p-4 rounded-lg ${categoryColors[slot.category || 'leisure']}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{categoryIcons[slot.category || 'leisure']}</span>
                <div>
                  <p className="font-semibold">{slot.name}</p>
                  <p className="text-sm opacity-75">
                    {slot.start_time} - {slot.end_time}
                  </p>
                </div>
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditSlot(slot, index)}
                    className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteSlot(index)}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Slot Modal */}
      {editingSlot && editingIndex !== null && isEditing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Routine Slot</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Activity Name
                </label>
                <input
                  type="text"
                  value={editingSlot.name}
                  onChange={(e) => setEditingSlot({ ...editingSlot, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={editingSlot.start_time}
                    onChange={(e) => setEditingSlot({ ...editingSlot, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={editingSlot.end_time}
                    onChange={(e) => setEditingSlot({ ...editingSlot, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={editingSlot.category || 'study'}
                  onChange={(e) => setEditingSlot({ ...editingSlot, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="study">📚 Study</option>
                  <option value="play">🎮 Play</option>
                  <option value="leisure">🎨 Leisure</option>
                  <option value="prayer">🙏 Prayer</option>
                  <option value="health">❤️ Health</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateSlot}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditingSlot(null);
                  setEditingIndex(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isEditing && (
        <div className="flex gap-3">
          <button
            onClick={handleAddSlot}
            className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition"
            disabled={loading}
          >
            + Add Routine Slot
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Routine'}
          </button>
        </div>
      )}
    </div>
  );
};

export default RoutineConfigurationUI;
