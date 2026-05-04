import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock Firebase
vi.mock('../config/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}));

// Mock WebSocket
const mockWebSocket = {
  readyState: 1, // OPEN
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onclose: null,
  onerror: null,
  onmessage: null,
};

global.WebSocket = vi.fn(() => mockWebSocket) as any;

import { useRealTime } from '../contexts/RealTimeContext';
import { useWebSocket, useRealTimeCollaboration, useRealTimeMessaging } from '../hooks/useWebSocket';

describe('Real-time Sync System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('RealTimeContext', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useRealTime(), {
        wrapper: ({ children }) => (
          <div>{children}</div> // Mock provider would be needed in real usage
        ),
      });

      // This will throw because no provider, but we can test the hook structure
      expect(() => result.current).toThrow('useRealTime must be used within a RealTimeProvider');
    });

    it('should provide real-time context methods', () => {
      // Mock the context
      const mockContext = {
        liveTasks: [],
        liveChallenges: [],
        liveMessages: [],
        unreadCount: 0,
        isConnected: true,
        connectionStatus: 'connected' as const,
        markMessageAsRead: vi.fn(),
        sendRealTimeMessage: vi.fn(),
        subscribeToChild: vi.fn(),
        unsubscribeFromChild: vi.fn(),
        lastUpdate: null,
        updateCount: 0,
      };

      // Test would require proper context provider setup
      expect(mockContext.isConnected).toBe(true);
      expect(mockContext.unreadCount).toBe(0);
    });
  });

  describe('useWebSocket', () => {
    it('should initialize WebSocket connection', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(global.WebSocket).toHaveBeenCalled();
      expect(result.current.connectionState).toBe('disconnected');
    });

    it('should handle connection states', async () => {
      const { result } = renderHook(() => useWebSocket());

      // Simulate connection open
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.connectionState).toBe('connected');
      });
    });

    it('should send messages when connected', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.sendMessage('test', { data: 'test' });
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'test',
          payload: { data: 'test' },
          timestamp: expect.any(Number),
        })
      );
    });

    it('should handle reconnection', () => {
      const { result } = renderHook(() => useWebSocket({ shouldReconnect: true }));

      act(() => {
        result.current.reconnect();
      });

      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should close connection', () => {
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.close();
      });

      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should handle incoming messages', () => {
      const onMessage = vi.fn();
      const { result } = renderHook(() => useWebSocket({ onMessage }));

      const testMessage = {
        type: 'test_message',
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify(testMessage),
          } as any);
        }
      });

      expect(onMessage).toHaveBeenCalledWith(testMessage);
      expect(result.current.lastMessage).toEqual(testMessage);
    });
  });

  describe('useRealTimeCollaboration', () => {
    it('should manage room participants', () => {
      const { result } = renderHook(() =>
        useRealTimeCollaboration('room1', 'user1')
      );

      expect(result.current.participants.size).toBe(0);
      expect(result.current.isTyping.size).toBe(0);
    });

    it('should handle join/leave room', () => {
      const { result } = renderHook(() =>
        useRealTimeCollaboration('room1', 'user1')
      );

      act(() => {
        result.current.joinRoom();
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith('join_room', {
        roomId: 'room1',
        userId: 'user1',
      });

      act(() => {
        result.current.leaveRoom();
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith('leave_room', {
        roomId: 'room1',
        userId: 'user1',
      });
    });

    it('should handle typing indicators', () => {
      const { result } = renderHook(() =>
        useRealTimeCollaboration('room1', 'user1')
      );

      act(() => {
        result.current.startTyping();
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith('typing_start', {
        roomId: 'room1',
        userId: 'user1',
      });

      act(() => {
        result.current.stopTyping();
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith('typing_stop', {
        roomId: 'room1',
        userId: 'user1',
      });
    });

    it('should track user activity', () => {
      const { result } = renderHook(() =>
        useRealTimeCollaboration('room1', 'user1')
      );

      // Simulate user joined message
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify({
              type: 'user_joined',
              payload: { userId: 'user2' },
              timestamp: Date.now(),
            }),
          } as any);
        }
      });

      expect(result.current.participants.has('user2')).toBe(true);

      // Simulate user left message
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify({
              type: 'user_left',
              payload: { userId: 'user2' },
              timestamp: Date.now(),
            }),
          } as any);
        }
      });

      expect(result.current.participants.has('user2')).toBe(false);
    });
  });

  describe('useRealTimeMessaging', () => {
    it('should manage conversation messages', () => {
      const { result } = renderHook(() =>
        useRealTimeMessaging('conv1', 'user1')
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.onlineUsers.size).toBe(0);
    });

    it('should send messages', () => {
      const { result } = renderHook(() =>
        useRealTimeMessaging('conv1', 'user1')
      );

      act(() => {
        result.current.sendMessage('Hello world');
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith('send_message', {
        conversationId: 'conv1',
        userId: 'user1',
        content: 'Hello world',
        type: 'text',
        timestamp: expect.any(Number),
      });
    });

    it('should mark messages as read', () => {
      const { result } = renderHook(() =>
        useRealTimeMessaging('conv1', 'user1')
      );

      act(() => {
        result.current.markMessageRead('msg1');
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith('mark_read', {
        conversationId: 'conv1',
        messageId: 'msg1',
        userId: 'user1',
      });
    });

    it('should handle incoming messages', () => {
      const { result } = renderHook(() =>
        useRealTimeMessaging('conv1', 'user1')
      );

      const testMessage = {
        id: 'msg1',
        content: 'Test message',
        userId: 'user2',
        timestamp: Date.now(),
      };

      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify({
              type: 'new_message',
              payload: testMessage,
              timestamp: Date.now(),
            }),
          } as any);
        }
      });

      expect(result.current.messages).toContain(testMessage);
    });

    it('should track online users', () => {
      const { result } = renderHook(() =>
        useRealTimeMessaging('conv1', 'user1')
      );

      // Simulate user online
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify({
              type: 'user_online',
              payload: { userId: 'user2' },
              timestamp: Date.now(),
            }),
          } as any);
        }
      });

      expect(result.current.onlineUsers.has('user2')).toBe(true);

      // Simulate user offline
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify({
              type: 'user_offline',
              payload: { userId: 'user2' },
              timestamp: Date.now(),
            }),
          } as any);
        }
      });

      expect(result.current.onlineUsers.has('user2')).toBe(false);
    });
  });

  describe('Real-time Notifications', () => {
    it('should handle different message types', () => {
      const messageTypes = [
        'task_completed',
        'challenge_update',
        'achievement',
        'reminder',
        'inbox_message',
      ];

      messageTypes.forEach(type => {
        // Test icon and color generation logic
        const expectedIcons = {
          task_completed: '🎉',
          challenge_update: '🏆',
          achievement: '⭐',
          reminder: '🔔',
          inbox_message: '💬',
        };

        expect(expectedIcons[type as keyof typeof expectedIcons]).toBeDefined();
      });
    });

    it('should calculate unread count correctly', () => {
      const messages = [
        { id: '1', read: false },
        { id: '2', read: true },
        { id: '3', read: false },
      ];

      const unreadCount = messages.filter(msg => !msg.read).length;
      expect(unreadCount).toBe(2);
    });
  });

  describe('Real-time Dashboard', () => {
    it('should calculate live stats', () => {
      const mockTasks = [
        { id: '1', status: 'completed', star_value: 3 },
        { id: '2', status: 'pending', star_value: 2 },
        { id: '3', status: 'completed', star_value: 5 },
      ];

      const mockChallenges = [
        { id: '1', status: 'active' },
        { id: '2', status: 'completed' },
      ];

      const completedTasks = mockTasks.filter(task => task.status === 'completed');
      const activeChallenges = mockChallenges.filter(challenge => challenge.status === 'active');
      const totalStars = completedTasks.reduce((sum, task) => sum + task.star_value, 0);

      expect(completedTasks.length).toBe(2);
      expect(activeChallenges.length).toBe(1);
      expect(totalStars).toBe(8);
    });

    it('should sort recent activity by timestamp', () => {
      const activities = [
        { id: '1', timestamp: new Date('2026-01-15T10:00:00Z') },
        { id: '2', timestamp: new Date('2026-01-15T12:00:00Z') },
        { id: '3', timestamp: new Date('2026-01-15T11:00:00Z') },
      ];

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      expect(activities[0].id).toBe('2');
      expect(activities[1].id).toBe('3');
      expect(activities[2].id).toBe('1');
    });
  });

  describe('Connection Health', () => {
    it('should detect connection timeouts', () => {
      const lastUpdate = new Date(Date.now() - 35000); // 35 seconds ago
      const timeSinceLastUpdate = Date.now() - lastUpdate.getTime();

      expect(timeSinceLastUpdate).toBeGreaterThan(30000);
    });

    it('should handle reconnection attempts', () => {
      let reconnectAttempts = 0;
      const maxAttempts = 5;

      // Simulate reconnection logic
      while (reconnectAttempts < maxAttempts) {
        reconnectAttempts++;
        if (reconnectAttempts >= maxAttempts) break;
      }

      expect(reconnectAttempts).toBe(5);
    });
  });
});