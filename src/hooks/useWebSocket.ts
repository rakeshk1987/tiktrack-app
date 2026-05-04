import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

interface UseWebSocketOptions {
  url?: string;
  protocols?: string | string[];
  shouldReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
}

interface UseWebSocketReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastMessage: WebSocketMessage | null;
  sendMessage: (type: string, payload: any) => void;
  reconnect: () => void;
  close: () => void;
  reconnectAttempts: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}): UseWebSocketReturn => {
  const {
    url = `wss://${process.env.REACT_APP_FIREBASE_PROJECT_ID}.firebaseapp.com/ws`,
    protocols,
    shouldReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onOpen,
    onClose,
    onError,
    onMessage,
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(shouldReconnect);

  // Create WebSocket connection
  const createConnection = useCallback(() => {
    try {
      setConnectionState('connecting');
      const ws = new WebSocket(url, protocols);

      ws.onopen = (event) => {
        console.log('WebSocket connected');
        setSocket(ws);
        setIsConnected(true);
        setConnectionState('connected');
        setReconnectAttempts(0);
        onOpen?.(event);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setSocket(null);
        setIsConnected(false);
        setConnectionState('disconnected');
        onClose?.(event);

        // Attempt reconnection if enabled
        if (shouldReconnectRef.current && reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            createConnection();
          }, reconnectInterval);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setConnectionState('error');
        onError?.(event);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      return ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionState('error');
      return null;
    }
  }, [url, protocols, reconnectAttempts, maxReconnectAttempts, reconnectInterval, onOpen, onClose, onError, onMessage]);

  // Send message
  const sendMessage = useCallback((type: string, payload: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type,
        payload,
        timestamp: Date.now(),
      };
      socket.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Message not sent:', type, payload);
    }
  }, [socket]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setReconnectAttempts(0);
    createConnection();
  }, [createConnection]);

  // Close connection
  const close = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.close();
    }
  }, [socket]);

  // Initialize connection on mount
  useEffect(() => {
    const ws = createConnection();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [createConnection]);

  // Update shouldReconnect ref
  useEffect(() => {
    shouldReconnectRef.current = shouldReconnect;
  }, [shouldReconnect]);

  return {
    socket,
    isConnected,
    connectionState,
    lastMessage,
    sendMessage,
    reconnect,
    close,
    reconnectAttempts,
  };
};

// Hook for real-time collaboration features
export const useRealTimeCollaboration = (roomId: string, userId: string) => {
  const [participants, setParticipants] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState<Set<string>>(new Set());
  const [lastActivity, setLastActivity] = useState<Map<string, number>>(new Map());

  const { sendMessage, isConnected } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'user_joined':
          setParticipants(prev => new Set([...prev, message.payload.userId]));
          setLastActivity(prev => new Map(prev.set(message.payload.userId, Date.now())));
          break;

        case 'user_left':
          setParticipants(prev => {
            const newSet = new Set(prev);
            newSet.delete(message.payload.userId);
            return newSet;
          });
          break;

        case 'typing_start':
          setIsTyping(prev => new Set([...prev, message.payload.userId]));
          break;

        case 'typing_stop':
          setIsTyping(prev => {
            const newSet = new Set(prev);
            newSet.delete(message.payload.userId);
            return newSet;
          });
          break;

        case 'activity':
          setLastActivity(prev => new Map(prev.set(message.payload.userId, Date.now())));
          break;
      }
    },
  });

  // Join room
  const joinRoom = useCallback(() => {
    sendMessage('join_room', { roomId, userId });
  }, [sendMessage, roomId, userId]);

  // Leave room
  const leaveRoom = useCallback(() => {
    sendMessage('leave_room', { roomId, userId });
  }, [sendMessage, roomId, userId]);

  // Send typing indicator
  const startTyping = useCallback(() => {
    sendMessage('typing_start', { roomId, userId });
  }, [sendMessage, roomId, userId]);

  const stopTyping = useCallback(() => {
    sendMessage('typing_stop', { roomId, userId });
  }, [sendMessage, roomId, userId]);

  // Send activity ping
  const pingActivity = useCallback(() => {
    sendMessage('activity', { roomId, userId });
  }, [sendMessage, roomId, userId]);

  // Auto-ping activity every 30 seconds
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(pingActivity, 30000);
    return () => clearInterval(interval);
  }, [isConnected, pingActivity]);

  return {
    participants,
    isTyping,
    lastActivity,
    joinRoom,
    leaveRoom,
    startTyping,
    stopTyping,
    isConnected,
  };
};

// Hook for real-time messaging
export const useRealTimeMessaging = (conversationId: string, userId: string) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const { sendMessage, isConnected } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'new_message':
          setMessages(prev => [...prev, message.payload]);
          break;

        case 'user_online':
          setOnlineUsers(prev => new Set([...prev, message.payload.userId]));
          break;

        case 'user_offline':
          setOnlineUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(message.payload.userId);
            return newSet;
          });
          break;

        case 'message_read':
          setMessages(prev =>
            prev.map(msg =>
              msg.id === message.payload.messageId
                ? { ...msg, read: true }
                : msg
            )
          );
          break;
      }
    },
  });

  // Send message
  const sendMessageToConversation = useCallback((content: string, type: 'text' | 'image' | 'file' = 'text') => {
    sendMessage('send_message', {
      conversationId,
      userId,
      content,
      type,
      timestamp: Date.now(),
    });
  }, [sendMessage, conversationId, userId]);

  // Mark message as read
  const markMessageRead = useCallback((messageId: string) => {
    sendMessage('mark_read', {
      conversationId,
      messageId,
      userId,
    });
  }, [sendMessage, conversationId, userId]);

  return {
    messages,
    onlineUsers,
    sendMessage: sendMessageToConversation,
    markMessageRead,
    isConnected,
  };
};
