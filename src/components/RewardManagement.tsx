import React, { useState } from 'react';
import type { RewardItem } from '../types/schema';

interface RewardManagementProps {
  rewards: RewardItem[];
  onCreateReward: (reward: Omit<RewardItem, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdateReward: (id: string, updates: Partial<RewardItem>) => Promise<void>;
  onDeleteReward: (id: string) => Promise<void>;
  loading?: boolean;
}

const RewardManagement: React.FC<RewardManagementProps> = ({
  rewards,
  onCreateReward,
  onUpdateReward,
  onDeleteReward,
  loading = false,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<RewardItem, 'id' | 'created_at' | 'updated_at'>>({
    parent_id: '',
    name: '',
    description: '',
    star_cost: 20,
    icon: '🎁',
    category: 'item',
    is_available: true,
  });

  const categoryOptions = [
    { value: 'activity', label: '🎯 Activity', icon: '🎯' },
    { value: 'item', label: '🎁 Item', icon: '🎁' },
    { value: 'privilege', label: '👑 Privilege', icon: '👑' },
    { value: 'experience', label: '✨ Experience', icon: '✨' },
  ];

  const emojiOptions = ['🎮', '🎬', '🍦', '🚗', '📵', '🍕', '💰', '👫', '🏆', '📚', '⚽', '🎨'];

  const handleAddReward = async () => {
    if (!formData.name || !formData.description) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await onCreateReward(formData);
      setShowAddForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to create reward:', err);
      alert('Failed to create reward');
    }
  };

  const handleUpdateReward = async (id: string) => {
    try {
      await onUpdateReward(id, formData as any);
      setEditingId(null);
      resetForm();
    } catch (err) {
      console.error('Failed to update reward:', err);
      alert('Failed to update reward');
    }
  };

  const handleEditClick = (reward: RewardItem) => {
    setFormData({
      parent_id: reward.parent_id,
      name: reward.name,
      description: reward.description,
      star_cost: reward.star_cost,
      icon: reward.icon,
      category: reward.category,
      is_available: reward.is_available,
      max_redemptions_per_week: reward.max_redemptions_per_week,
    });
    setEditingId(reward.id);
  };

  const resetForm = () => {
    setFormData({
      parent_id: '',
      name: '',
      description: '',
      star_cost: 20,
      icon: '🎁',
      category: 'item',
      is_available: true,
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">🎁 Manage Rewards</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
        >
          {showAddForm ? 'Cancel' : '+ Add Reward'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            {editingId ? 'Edit Reward' : 'Create New Reward'}
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reward Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                placeholder="e.g., Extra Gaming Time"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                placeholder="Describe what this reward includes"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Star Cost
                </label>
                <input
                  type="number"
                  value={formData.star_cost}
                  onChange={(e) => setFormData({ ...formData, star_cost: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                >
                  {categoryOptions.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Emoji Icon
              </label>
              <div className="flex gap-2 flex-wrap">
                {emojiOptions.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setFormData({ ...formData, icon: emoji })}
                    className={`text-2xl p-2 rounded transition ${
                      formData.icon === emoji
                        ? 'bg-blue-500 ring-2 ring-blue-600'
                        : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Redemptions Per Week (optional)
              </label>
              <input
                type="number"
                value={formData.max_redemptions_per_week || ''}
                onChange={(e) => setFormData({ ...formData, max_redemptions_per_week: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-600 dark:text-white"
                placeholder="Leave empty for unlimited"
                min="1"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="available"
                checked={formData.is_available}
                onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="available" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Available for redemption
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => (editingId ? handleUpdateReward(editingId) : handleAddReward())}
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

      {/* Rewards List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No rewards configured yet. Create one to get started!
            </p>
          </div>
        ) : (
          rewards.map(reward => (
            <div
              key={reward.id}
              className={`p-4 rounded-lg border-2 transition ${
                reward.is_available
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-4xl">{reward.icon}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditClick(reward)}
                    className="px-2 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded transition text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this reward?')) {
                        onDeleteReward(reward.id);
                      }
                    }}
                    className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                {reward.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {reward.description}
              </p>

              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-semibold">⭐ Cost:</span> {reward.star_cost} stars
                </p>
                <p className="text-sm">
                  <span className="font-semibold">📂 Category:</span> {reward.category}
                </p>
                {reward.max_redemptions_per_week && (
                  <p className="text-sm">
                    <span className="font-semibold">📊 Max/Week:</span> {reward.max_redemptions_per_week}
                  </p>
                )}
                <p className="text-sm">
                  <span className="font-semibold">Status:</span>{' '}
                  {reward.is_available ? '✅ Available' : '❌ Unavailable'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RewardManagement;
