import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { db } from '../config/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type { Task, Challenge } from '../types/schema';

interface RealTimeMessage {
  id: string;
  type: 'task_completed' | 'challenge_update' | 'inbox_message' | 'achievement' | 'reminder';
  title: string;
  message: string;
  data?: any;
  timestamp: Date;
  read: boolean;
}

interface RealTimeContextType {
  // Real-time data
  liveTasks: Task[];
  liveChallenges: Challenge[];
  liveMessages: RealTimeMessage[];
  unreadCount: number;

  // Connection status
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';

  // Actions
  markMessageAsRead: (messageId: string) => Promise<void>;
  sendRealTimeMessage: (type: RealTimeMessage['type'], title: string, message: string, data?: any) => Promise<void>;
  subscribeToChild: (childId: string) => void;
  unsubscribeFromChild: () => void;

  // Performance metrics
  lastUpdate: Date | null;
  updateCount: number;
}

const RealTimeContext = createContext<RealTimeContextType | undefined>(undefined);

interface RealTimeProviderProps {
  children: ReactNode;
  userId: string;
  userRole: 'parent_admin' | 'child_user';
  childId?: string; // For child-specific subscriptions
}

export const RealTimeProvider: React.FC<RealTimeProviderProps> = ({
  children,
  userId,
  userRole,
  childId,
}) => {
  const [liveTasks, setLiveTasks] = useState<Task[]>([]);
  const [liveChallenges, setLiveChallenges] = useState<Challenge[]>([]);
  const [liveMessages, setLiveMessages] = useState<RealTimeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  // Unsubscribe functions
  const [taskUnsubscribe, setTaskUnsubscribe] = useState<(() => void) | null>(null);
  const [challengeUnsubscribe, setChallengeUnsubscribe] = useState<(() => void) | null>(null);
  const [messageUnsubscribe, setMessageUnsubscribe] = useState<(() => void) | null>(null);

  // Calculate unread messages count
  const unreadCount = liveMessages.filter(msg => !msg.read).length;

  // Mark message as read
  const markMessageAsRead = useCallback(async (messageId: string) => {
    try {
      const messageRef = doc(db, 'realtime_messages', messageId);
      await updateDoc(messageRef, {
        read: true,
        read_at: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, []);

  // Send real-time message
  const sendRealTimeMessage = useCallback(async (
    type: RealTimeMessage['type'],
    title: string,
    message: string,
    data?: any
  ) => {
    try {
      await addDoc(collection(db, 'realtime_messages'), {
        type,
        title,
        message,
        data,
        timestamp: serverTimestamp(),
        read: false,
        user_id: userId,
        user_role: userRole,
        child_id: childId,
      });
    } catch (error) {
      console.error('Error sending real-time message:', error);
    }
  }, [userId, userRole, childId]);

  // Subscribe to tasks
  const subscribeToTasks = useCallback((targetChildId: string) => {
    if (taskUnsubscribe) {
      taskUnsubscribe();
    }

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('child_id', '==', targetChildId),
      orderBy('created_at', 'desc'),
      // Limit to recent tasks for performance
    );

    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Task));

        setLiveTasks(tasks);
        setLastUpdate(new Date());
        setUpdateCount(prev => prev + 1);
        setIsConnected(true);
        setConnectionStatus('connected');
      },
      (error) => {
        console.error('Tasks subscription error:', error);
        setConnectionStatus('error');
        setIsConnected(false);
      }
    );

    setTaskUnsubscribe(() => unsubscribe);
  }, [taskUnsubscribe]);

  // Subscribe to challenges
  const subscribeToChallenges = useCallback((targetChildId: string) => {
    if (challengeUnsubscribe) {
      challengeUnsubscribe();
    }

    const challengesQuery = query(
      collection(db, 'challenges'),
      where(userRole === 'parent_admin' ? 'parent_id' : 'child_id', '==', userId),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      challengesQuery,
      (snapshot) => {
        const challenges = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Challenge));

        setLiveChallenges(challenges);
        setLastUpdate(new Date());
        setUpdateCount(prev => prev + 1);
      },
      (error) => {
        console.error('Challenges subscription error:', error);
        setConnectionStatus('error');
      }
    );

    setChallengeUnsubscribe(() => unsubscribe);
  }, [challengeUnsubscribe, userId, userRole]);

  // Subscribe to real-time messages
  const subscribeToMessages = useCallback(() => {
    if (messageUnsubscribe) {
      messageUnsubscribe();
    }

    let messagesQuery;
    if (userRole === 'parent_admin') {
      // Parents see messages for all their children
      messagesQuery = query(
        collection(db, 'realtime_messages'),
        where('user_id', '==', userId),
        orderBy('timestamp', 'desc')
      );
    } else {
      // Children see their own messages
      messagesQuery = query(
        collection(db, 'realtime_messages'),
        where('child_id', '==', childId),
        orderBy('timestamp', 'desc')
      );
    }

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type,
            title: data.title,
            message: data.message,
            data: data.data,
            timestamp: data.timestamp?.toDate() || new Date(),
            read: data.read || false,
          } as RealTimeMessage;
        });

        setLiveMessages(messages);
        setLastUpdate(new Date());
        setUpdateCount(prev => prev + 1);
      },
      (error) => {
        console.error('Messages subscription error:', error);
        setConnectionStatus('error');
      }
    );

    setMessageUnsubscribe(() => unsubscribe);
  }, [messageUnsubscribe, userId, userRole, childId]);

  // Subscribe to specific child
  const subscribeToChild = useCallback((targetChildId: string) => {
    setConnectionStatus('connecting');
    setIsConnected(false);

    subscribeToTasks(targetChildId);
    subscribeToChallenges(targetChildId);
    subscribeToMessages();

    setIsConnected(true);
    setConnectionStatus('connected');
  }, [subscribeToTasks, subscribeToChallenges, subscribeToMessages]);

  // Unsubscribe from child
  const unsubscribeFromChild = useCallback(() => {
    if (taskUnsubscribe) {
      taskUnsubscribe();
      setTaskUnsubscribe(null);
    }
    if (challengeUnsubscribe) {
      challengeUnsubscribe();
      setChallengeUnsubscribe(null);
    }
    if (messageUnsubscribe) {
      messageUnsubscribe();
      setMessageUnsubscribe(null);
    }

    setLiveTasks([]);
    setLiveChallenges([]);
    setLiveMessages([]);
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, [taskUnsubscribe, challengeUnsubscribe, messageUnsubscribe]);

  // Auto-subscribe on mount if childId provided
  useEffect(() => {
    if (childId) {
      subscribeToChild(childId);
    }

    return () => {
      unsubscribeFromChild();
    };
  }, [childId, subscribeToChild, unsubscribeFromChild]);

  // Connection health check
  useEffect(() => {
    const healthCheck = setInterval(() => {
      if (isConnected && lastUpdate) {
        const timeSinceLastUpdate = Date.now() - lastUpdate.getTime();
        if (timeSinceLastUpdate > 30000) { // 30 seconds
          setConnectionStatus('disconnected');
          setIsConnected(false);
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(healthCheck);
  }, [isConnected, lastUpdate]);

  const contextValue: RealTimeContextType = {
    liveTasks,
    liveChallenges,
    liveMessages,
    unreadCount,
    isConnected,
    connectionStatus,
    markMessageAsRead,
    sendRealTimeMessage,
    subscribeToChild,
    unsubscribeFromChild,
    lastUpdate,
    updateCount,
  };

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  );
};

export const useRealTime = (): RealTimeContextType => {
  const context = useContext(RealTimeContext);
  if (context === undefined) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
};

// Hook for sending automated real-time notifications
export const useRealTimeNotifications = () => {
  const { sendRealTimeMessage } = useRealTime();

  const notifyTaskCompleted = useCallback(async (task: Task, childName: string) => {
    await sendRealTimeMessage(
      'task_completed',
      '🎉 Task Completed!',
      `${childName} completed "${task.title}" and earned ${task.star_value} stars!`,
      { task_id: task.id, stars_earned: task.star_value }
    );
  }, [sendRealTimeMessage]);

  const notifyChallengeUpdate = useCallback(async (challenge: Challenge, childName: string) => {
    const statusMessage = challenge.status === 'completed' ? 'completed' : 'updated';
    await sendRealTimeMessage(
      'challenge_update',
      '🏆 Challenge Update',
      `${childName} ${statusMessage} the challenge "${challenge.title}"!`,
      { challenge_id: challenge.id, status: challenge.status }
    );
  }, [sendRealTimeMessage]);

  const notifyAchievement = useCallback(async (achievement: string, childName: string, data?: any) => {
    await sendRealTimeMessage(
      'achievement',
      '⭐ Achievement Unlocked!',
      `${childName} unlocked: ${achievement}`,
      data
    );
  }, [sendRealTimeMessage]);

  const notifyReminder = useCallback(async (reminderTitle: string, childName: string) => {
    await sendRealTimeMessage(
      'reminder',
      '🔔 Reminder',
      reminderTitle,
      { child_name: childName }
    );
  }, [sendRealTimeMessage]);

  return {
    notifyTaskCompleted,
    notifyChallengeUpdate,
    notifyAchievement,
    notifyReminder,
  };
};
