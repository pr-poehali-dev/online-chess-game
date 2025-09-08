import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Player {
  id: string;
  name: string;
  rating: number;
}

export interface GameState {
  id: string;
  board: (string | null)[][];
  currentPlayer: 'white' | 'black';
  status: 'playing' | 'check' | 'checkmate' | 'draw' | 'resigned' | 'time_out' | 'disconnected';
  whiteTime: number;
  blackTime: number;
  moves: Move[];
  white: Player;
  black: Player;
  spectators: number;
}

export interface Move {
  from: [number, number];
  to: [number, number];
  piece: string;
  captured?: string | null;
  timestamp: number;
  player: 'white' | 'black';
}

export interface GameListItem {
  id: string;
  white: string;
  whiteRating: number;
  black: string;
  blackRating: number;
  status: string;
  spectators: number;
  currentPlayer: 'white' | 'black';
}

interface SocketEvents {
  // Connection events
  registered: (data: { playerId: string; playerName: string; playerRating: number }) => void;
  
  // Matchmaking events  
  waitingForMatch: (data: { position: number; estimatedWait: number }) => void;
  gameFound: (data: { gameId: string; color: 'white' | 'black'; opponent: Player; gameState: GameState }) => void;
  
  // Game events
  moveMade: (data: { move: Move; gameState: GameState }) => void;
  moveError: (data: { message: string }) => void;
  gameEnded: (data: { result: string; reason: string; gameState: GameState }) => void;
  
  // Time events
  timeUpdate: (data: { whiteTime: number; blackTime: number }) => void;
  
  // Spectator events
  spectatingStarted: (data: { gameId: string; gameState: GameState }) => void;
  spectateError: (data: { message: string }) => void;
  
  // Social events
  drawOffered: (data: { gameId: string; from: string }) => void;
  playerDisconnected: (data: { playerName: string; gameState: GameState }) => void;
  
  // Lobby events
  gamesList: (games: GameListItem[]) => void;
  gameCreated: (game: GameListItem) => void;
}

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black' | null>(null);
  const [playerInfo, setPlayerInfo] = useState<Player | null>(null);
  const [gamesList, setGamesList] = useState<GameListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string>('');
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [gameEndInfo, setGameEndInfo] = useState<{ result: string; reason: string } | null>(null);

  useEffect(() => {
    // Connect to WebSocket server - auto-detect URL
    const getSocketUrl = () => {
      if (typeof window !== 'undefined') {
        // Use current host for connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}`;
      }
      return 'ws://localhost:3001'; // fallback for development
    };

    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔗 Connected to Chess Server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('💔 Disconnected from Chess Server');
      setIsConnected(false);
      setIsSearching(false);
    });

    // Registration
    socket.on('registered', (data) => {
      console.log('✅ Registered as:', data.playerName);
      setPlayerInfo({
        id: data.playerId,
        name: data.playerName,
        rating: data.playerRating
      });
    });

    // Matchmaking
    socket.on('waitingForMatch', (data) => {
      console.log(`⏳ Waiting for match... Position: ${data.position}`);
      setSearchStatus(`Поиск игры... Позиция в очереди: ${data.position}`);
    });

    socket.on('gameFound', (data) => {
      console.log('🎮 Game found!', data);
      setIsSearching(false);
      setPlayerColor(data.color);
      setCurrentGame(data.gameState);
      setSearchStatus('');
      setGameEndInfo(null);
    });

    // Game events
    socket.on('moveMade', (data) => {
      console.log('♟️ Move made:', data.move);
      setCurrentGame(data.gameState);
      setLastMove(data.move);
    });

    socket.on('moveError', (data) => {
      console.error('❌ Move error:', data.message);
      // Could show toast notification here
    });

    socket.on('gameEnded', (data) => {
      console.log('🏁 Game ended:', data);
      setGameEndInfo({ result: data.result, reason: data.reason });
      if (currentGame) {
        setCurrentGame({ ...data.gameState });
      }
    });

    // Time updates
    socket.on('timeUpdate', (data) => {
      if (currentGame) {
        setCurrentGame(prev => prev ? {
          ...prev,
          whiteTime: data.whiteTime,
          blackTime: data.blackTime
        } : null);
      }
    });

    // Draw events
    socket.on('drawOffered', (data) => {
      console.log('🤝 Draw offered by:', data.from);
      // Could show modal here
      if (window.confirm(`${data.from} предлагает ничью. Принять?`)) {
        socket.emit('acceptDraw', data.gameId);
      }
    });

    // Disconnection events
    socket.on('playerDisconnected', (data) => {
      console.log('📱 Player disconnected:', data.playerName);
      // Could show notification
    });

    // Spectator events
    socket.on('spectatingStarted', (data) => {
      console.log('👀 Started spectating game:', data.gameId);
      setCurrentGame(data.gameState);
      setPlayerColor(null); // Spectator has no color
    });

    // Lobby events
    socket.on('gamesList', (games) => {
      console.log('📋 Games list updated:', games.length, 'active games');
      setGamesList(games);
    });

    socket.on('gameCreated', (game) => {
      console.log('🆕 New game created:', game);
      setGamesList(prev => [...prev, game]);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentGame]);

  // Socket methods
  const register = (name: string, rating: number = 1500) => {
    if (socketRef.current) {
      socketRef.current.emit('register', { name, rating });
    }
  };

  const findMatch = (preferences: { ratingRange?: number } = {}) => {
    if (socketRef.current && !isSearching) {
      setIsSearching(true);
      setSearchStatus('Поиск соперника...');
      socketRef.current.emit('findMatch', preferences);
    }
  };

  const cancelSearch = () => {
    if (socketRef.current && isSearching) {
      socketRef.current.disconnect();
      socketRef.current.connect();
      setIsSearching(false);
      setSearchStatus('');
    }
  };

  const makeMove = (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    if (socketRef.current && currentGame) {
      socketRef.current.emit('makeMove', {
        gameId: currentGame.id,
        fromRow,
        fromCol,
        toRow,
        toCol
      });
    }
  };

  const resign = () => {
    if (socketRef.current && currentGame) {
      socketRef.current.emit('resign', currentGame.id);
    }
  };

  const offerDraw = () => {
    if (socketRef.current && currentGame) {
      socketRef.current.emit('offerDraw', currentGame.id);
    }
  };

  const spectateGame = (gameId: string) => {
    if (socketRef.current) {
      socketRef.current.emit('spectateGame', gameId);
    }
  };

  const leaveGame = () => {
    setCurrentGame(null);
    setPlayerColor(null);
    setLastMove(null);
    setGameEndInfo(null);
  };

  return {
    // Connection state
    isConnected,
    playerInfo,
    
    // Game state
    currentGame,
    playerColor,
    lastMove,
    gameEndInfo,
    
    // Matchmaking state
    isSearching,
    searchStatus,
    
    // Lobby state
    gamesList,
    
    // Actions
    register,
    findMatch,
    cancelSearch,
    makeMove,
    resign,
    offerDraw,
    spectateGame,
    leaveGame,
  };
};