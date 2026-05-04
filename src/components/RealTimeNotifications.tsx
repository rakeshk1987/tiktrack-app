import React, { useState, useEffect } from 'react';
import { useRealTime } from '../contexts/RealTimeContext';

interface RealTimeNotificationsProps {
  className?: string;
  maxVisible?: number;
  autoHideDelay?: number; // milliseconds
}

const RealTimeNotifications: React.FC<RealTimeNotificationsProps> = ({
  className = '',
  maxVisible = 5,
  autoHideDelay = 5000,
}) => {
  const { liveMessages, markMessageAsRead, unreadCount } = useRealTime();
  const [visibleMessages, setVisibleMessages] = useState<any[]>([]);
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());

  // Handle new messages
  useEffect(() => {
    const newMessages = liveMessages.filter(msg => !msg.read).slice(0, maxVisible);

    // Add new messages with animation
    setVisibleMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const trulyNew = newMessages.filter(m => !existingIds.has(m.id));

      if (trulyNew.length > 0) {
        // Play notification sound (if supported)
        if ('Notification' in window && Notification.permission === 'granted') {
          // Browser notification for important messages
          if (trulyNew.some(m => m.type === 'achievement' || m.type === 'task_completed')) {
            new Notification('TikTrack Update', {
              body: trulyNew[0].message,
              icon: '/favicon.ico',
            });
          }
        }
      }

      return [...trulyNew, ...prev].slice(0, maxVisible);
    });
  }, [liveMessages, maxVisible]);

  // Auto-hide messages after delay
  useEffect(() => {
    if (visibleMessages.length === 0) return;

    const timer = setTimeout(() => {
      setAnimatingOut(new Set(visibleMessages.map(m => m.id)));
    }, autoHideDelay);

    return () => clearTimeout(timer);
  }, [visibleMessages, autoHideDelay]);

  // Remove messages after animation
  useEffect(() => {
    if (animatingOut.size === 0) return;

    const timer = setTimeout(() => {
      setVisibleMessages(prev => prev.filter(m => !animatingOut.has(m.id)));
      setAnimatingOut(new Set());
    }, 300); // Match CSS animation duration

    return () => clearTimeout(timer);
  }, [animatingOut]);

  const handleMessageClick = async (message: any) => {
    await markMessageAsRead(message.id);
    setAnimatingOut(prev => new Set([...prev, message.id]));
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'task_completed': return '🎉';
      case 'challenge_update': return '🏆';
      case 'achievement': return '⭐';
      case 'reminder': return '🔔';
      case 'inbox_message': return '💬';
      default: return '📢';
    }
  };

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'task_completed': return 'bg-green-100 border-green-500 text-green-800';
      case 'challenge_update': return 'bg-blue-100 border-blue-500 text-blue-800';
      case 'achievement': return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      case 'reminder': return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'inbox_message': return 'bg-purple-100 border-purple-500 text-purple-800';
      default: return 'bg-gray-100 border-gray-500 text-gray-800';
    }
  };

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 space-y-2 ${className}`}>
      {visibleMessages.map((message, index) => (
        <div
          key={message.id}
          className={`
            max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-lg border-l-4 p-4 cursor-pointer
            transform transition-all duration-300 ease-in-out
            ${getMessageColor(message.type)}
            ${animatingOut.has(message.id) ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
          `}
          style={{
            animationDelay: `${index * 100}ms`,
          }}
          onClick={() => handleMessageClick(message)}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-2xl">{getMessageIcon(message.type)}</span>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-semibold">
                {message.title}
              </p>
              <p className="text-sm mt-1">
                {message.message}
              </p>
              <p className="text-xs mt-2 opacity-75">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMessageClick(message);
              }}
              className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {/* Unread count indicator */}
      {unreadCount > maxVisible && (
        <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg">
          +{unreadCount - maxVisible}
        </div>
      )}
    </div>
  );
};

export default RealTimeNotifications;