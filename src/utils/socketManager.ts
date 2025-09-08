import { Server as SocketIOServer } from 'socket.io';
import { GameServer } from '../server/gameServer';

let globalSocketServer: SocketIOServer | null = null;
let gameServerInstance: GameServer | null = null;

export const initializeSocketServer = (): Promise<{ io: SocketIOServer; gameServer: GameServer }> => {
  return new Promise((resolve, reject) => {
    try {
      if (globalSocketServer && gameServerInstance) {
        resolve({ io: globalSocketServer, gameServer: gameServerInstance });
        return;
      }

      // Check if we're in a browser environment that supports WebSockets
      if (typeof window !== 'undefined') {
        // In production, we'll use the existing connection infrastructure
        console.log('🌐 Using browser WebSocket connection');
        
        // Create a mock server interface for browser
        const mockIO = {
          on: () => {},
          emit: () => {},
          to: () => ({ emit: () => {} })
        } as any;

        const mockGameServer = {
          destroy: () => {}
        } as any;

        resolve({ io: mockIO, gameServer: mockGameServer });
        return;
      }

      // For Node.js environment (development)
      import('http').then(({ createServer }) => {
        import('socket.io').then(({ Server }) => {
          const httpServer = createServer();
          const io = new Server(httpServer, {
            cors: {
              origin: ['*'],
              methods: ['GET', 'POST'],
              credentials: true
            },
            transports: ['websocket', 'polling']
          });

          gameServerInstance = new GameServer(io);
          globalSocketServer = io;

          const PORT = process.env.PORT ? parseInt(process.env.PORT) + 1 : 3001;
          
          httpServer.listen(PORT, () => {
            console.log(`🚀 Chess WebSocket Server running on port ${PORT}`);
            resolve({ io, gameServer: gameServerInstance! });
          });

          httpServer.on('error', (error) => {
            console.error('❌ WebSocket server error:', error);
            reject(error);
          });
        });
      });

    } catch (error) {
      console.error('❌ Failed to initialize socket server:', error);
      reject(error);
    }
  });
};

export const getSocketServer = () => {
  return { io: globalSocketServer, gameServer: gameServerInstance };
};

export const destroySocketServer = () => {
  if (gameServerInstance) {
    gameServerInstance.destroy();
    gameServerInstance = null;
  }
  
  if (globalSocketServer) {
    globalSocketServer.close();
    globalSocketServer = null;
  }
};