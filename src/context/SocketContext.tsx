import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { socketService, SocketConnectionStatus, SocketEventHandler } from '../services/socket.js';

interface SocketContextValue {
  socketConnected: boolean;
  connectionStatus: SocketConnectionStatus;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  sendEvent: (event: string, data?: any) => boolean;
  subscribe: (event: string, handler: SocketEventHandler) => () => void;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<SocketConnectionStatus>(
    socketService.getStatus()
  );
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(
    socketService.getReconnectAttempts()
  );

  useEffect(() => {
    const unsubscribe = socketService.onStatusChange((status) => {
      setConnectionStatus(status);
      setReconnectAttempts(socketService.getReconnectAttempts());
    });
    return unsubscribe;
  }, []);

  const sendEvent = useCallback((event: string, data?: any) => {
    return socketService.send(event, data);
  }, []);

  const subscribe = useCallback((event: string, handler: SocketEventHandler) => {
    return socketService.on(event, handler);
  }, []);

  const reconnect = useCallback(() => {
    socketService.retryNow();
  }, []);

  const value: SocketContextValue = {
    socketConnected: connectionStatus === 'connected',
    connectionStatus,
    reconnectAttempts,
    maxReconnectAttempts: socketService.getMaxReconnectAttempts(),
    sendEvent,
    subscribe,
    reconnect,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
