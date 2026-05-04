import React, { useState } from 'react';
import type { Redemption } from '../types/schema';

interface RedemptionHistoryProps {
  redemptions: Redemption[];
  onUpdateStatus: (id: string, status: 'approved' | 'completed' | 'rejected', notes?: string) => Promise<void>;
  loading?: boolean;
}

const RedemptionHistory: React.FC<RedemptionHistoryProps> = ({
  redemptions,
  onUpdateStatus,
  loading = false,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    approved: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    completed: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    rejected: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  };

  const statusIcons: Record<string, string> = {
    pending: '⏳',
    approved: '✅',
    completed: '🎉',
    rejected: '❌',
  };

  const handleStatusUpdate = async (id: string, newStatus: 'approved' | 'completed' | 'rejected') => {
    try {
      await onUpdateStatus(id, newStatus, notes[id] || undefined);
      setNotes({ ...notes, [id]: '' });
      setExpandedId(null);
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update redemption status');
    }
  };

  const pendingCount = redemptions.filter(r => r.status === 'pending').length;
  const completedCount = redemptions.filter(r => r.status === 'completed').length;
  const rejectedCount = redemptions.filter(r => r.status === 'rejected').length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">📋 Redemption History</h2>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg text-center">
          <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">⏳ {pendingCount}</p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300">Pending</p>
        </div>
        <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">✅ {redemptions.filter(r => r.status === 'approved').length}</p>
          <p className="text-sm text-blue-700 dark:text-blue-300">Approved</p>
        </div>
        <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-800 dark:text-green-200">🎉 {completedCount}</p>
          <p className="text-sm text-green-700 dark:text-green-300">Completed</p>
        </div>
        <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg text-center">
          <p className="text-2xl font-bold text-red-800 dark:text-red-200">❌ {rejectedCount}</p>
          <p className="text-sm text-red-700 dark:text-red-300">Rejected</p>
        </div>
      </div>

      {/* Redemptions List */}
      <div className="space-y-3">
        {redemptions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No redemption requests yet. Child needs to redeem rewards first!
            </p>
          </div>
        ) : (
          redemptions
            .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
            .map(redemption => {
              const isExpanded = expandedId === redemption.id;
              const isProcessing = loading;

              return (
                <div
                  key={redemption.id}
                  className={`border-l-4 rounded-lg p-4 transition ${
                    statusColors[redemption.status] || 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : redemption.id)}>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{redemption.reward_item.icon}</span>
                        <div>
                          <h3 className="font-bold text-lg">{redemption.reward_item.name}</h3>
                          <p className="text-sm opacity-75">{redemption.reward_item.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm flex-wrap">
                        <span>⭐ {redemption.stars_spent} stars</span>
                        <span>📅 {new Date(redemption.requested_at).toLocaleDateString()}</span>
                        <span className={`px-2 py-1 rounded ${statusColors[redemption.status]}`}>
                          {statusIcons[redemption.status]} {redemption.status}
                        </span>
                      </div>
                    </div>
                    <span className="text-2xl ml-4">{isExpanded ? '▼' : '▶'}</span>
                  </div>

                  {/* Expanded Section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-300 border-opacity-30">
                      <div className="space-y-3">
                        {/* Notes Section */}
                        <div>
                          <label className="block text-sm font-medium mb-1">Add Notes</label>
                          <textarea
                            value={notes[redemption.id] || redemption.notes || ''}
                            onChange={(e) => setNotes({ ...notes, [redemption.id]: e.target.value })}
                            placeholder="Add notes about this redemption"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
                            rows={2}
                          />
                        </div>

                        {/* Action Buttons */}
                        {redemption.status === 'pending' && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleStatusUpdate(redemption.id, 'approved')}
                              disabled={isProcessing}
                              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50"
                            >
                              ✅ Approve
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(redemption.id, 'rejected')}
                              disabled={isProcessing}
                              className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50"
                            >
                              ❌ Reject
                            </button>
                          </div>
                        )}

                        {redemption.status === 'approved' && (
                          <button
                            onClick={() => handleStatusUpdate(redemption.id, 'completed')}
                            disabled={isProcessing}
                            className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition disabled:opacity-50"
                          >
                            🎉 Mark as Completed
                          </button>
                        )}

                        {/* Completion Details */}
                        {redemption.completed_at && (
                          <div className="p-2 bg-black bg-opacity-10 rounded text-sm">
                            <p>✓ Completed on {new Date(redemption.completed_at).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};

export default RedemptionHistory;
