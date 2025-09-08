import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeSocketServer } from '../utils/socketManager';

interface WebSocketContextType {
  isServerRunning: boolean;
  serverUrl: string;
  error?: string;
}

const WebSocketContext = createContext<WebSocketContextType>({
  isServerRunning: false,
  serverUrl: ''
});

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    const startServer = async () => {
      try {
        // Инициализация WebSocket сервера
        console.log('🚀 Starting Chess WebSocket Server...');
        
        const { io, gameServer } = await initializeSocketServer();
        
        // Определяем URL для подключения
        if (typeof window !== 'undefined') {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const host = window.location.host;
          const wsUrl = `${protocol}//${host}`;
          setServerUrl(wsUrl);
        } else {
          setServerUrl('ws://localhost:3001');
        }
        
        setIsServerRunning(true);
        console.log('✅ Chess WebSocket Server ready!');
      } catch (err) {
        console.error('❌ Failed to start WebSocket server:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    startServer();

    // Cleanup handled by socketManager
    return () => {
      // Cleanup will be handled by the socketManager
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isServerRunning, serverUrl, error }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};