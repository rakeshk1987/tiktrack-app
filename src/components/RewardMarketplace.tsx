import React, { useState } from 'react';
import type { RewardItem, ChildProfile } from '../types/schema';

interface RewardMarketplaceProps {
  rewards: RewardItem[];
  childProfile: ChildProfile;
  onRedeemReward: (rewardId: string, reward: RewardItem) => Promise<void>;
  loading?: boolean;
}

const RewardMarketplace: React.FC<RewardMarketplaceProps> = ({
  rewards,
  childProfile,
  onRedeemReward,
  loading = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const categoryIcons: Record<string, string> = {
    activity: '🎯',
    item: '🎁',
    privilege: '👑',
    experience: '✨',
  };

  const categories = Array.from(new Set(rewards.map(r => r.category)));
  const filteredRewards = selectedCategory
    ? rewards.filter(r => r.category === selectedCategory)
    : rewards;

  const handleRedeem = async (reward: RewardItem) => {
    if (childProfile.total_stars < reward.star_cost) {
      setMessage({
        type: 'error',
        text: `Not enough stars! You need ${reward.star_cost} stars but have ${childProfile.total_stars}.`,
      });
      return;
    }

    try {
      setRedeeming(reward.id);
      await onRedeemReward(reward.id, reward);
      setMessage({
        type: 'success',
        text: `🎉 Redemption request sent! Parent needs to approve it.`,
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to redeem reward',
      });
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">🎁 Reward Marketplace</h2>
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-100 to-yellow-50 dark:from-yellow-900 dark:to-yellow-800 rounded-lg">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-300">Your Stars</p>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-300">
              ⭐ {childProfile.total_stars}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-300">Level</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">
              {Math.floor((childProfile.total_stars || 0) / 20) + 1}
            </p>
          </div>
        </div>
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

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Filter by Category</p>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-lg transition ${
                selectedCategory === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedCategory === cat
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {categoryIcons[cat]} {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rewards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRewards.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No rewards available in this category</p>
          </div>
        ) : (
          filteredRewards.map(reward => {
            const canRedeem = childProfile.total_stars >= reward.star_cost;
            const isRedeeming = redeeming === reward.id;

            return (
              <div
                key={reward.id}
                className={`p-4 rounded-lg border-2 transition ${
                  canRedeem
                    ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 opacity-75'
                }`}
              >
                <div className="text-4xl mb-2">{reward.icon}</div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                  {reward.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {reward.description}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                    ⭐ {reward.star_cost}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded">
                    {reward.category}
                  </span>
                </div>

                <button
                  onClick={() => handleRedeem(reward)}
                  disabled={!canRedeem || isRedeeming || loading}
                  className={`w-full py-2 rounded-lg transition font-semibold ${
                    canRedeem
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {isRedeeming ? 'Requesting...' : canRedeem ? '🎉 Redeem' : '💫 Not Enough Stars'}
                </button>

                {!canRedeem && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 text-center">
                    Need {reward.star_cost - childProfile.total_stars} more stars
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RewardMarketplace;
