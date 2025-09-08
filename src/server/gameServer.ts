import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

export interface Player {
  id: string;
  name: string;
  rating: number;
  socket: any;
}

export interface GameState {
  id: string;
  white: Player;
  black: Player;
  board: (string | null)[][];
  currentPlayer: 'white' | 'black';
  moves: Move[];
  status: 'playing' | 'check' | 'checkmate' | 'draw' | 'resigned' | 'time_out' | 'disconnected';
  whiteTime: number;
  blackTime: number;
  lastMoveTime: number;
  spectators: Set<string>;
}

export interface Move {
  from: [number, number];
  to: [number, number];
  piece: string;
  captured?: string | null;
  timestamp: number;
  player: 'white' | 'black';
}

class Game implements GameState {
  id: string;
  white: Player;
  black: Player;
  board: (string | null)[][];
  currentPlayer: 'white' | 'black';
  moves: Move[];
  status: 'playing' | 'check' | 'checkmate' | 'draw' | 'resigned' | 'time_out' | 'disconnected';
  whiteTime: number;
  blackTime: number;
  lastMoveTime: number;
  spectators: Set<string>;

  constructor(id: string, white: Player, black: Player) {
    this.id = id;
    this.white = white;
    this.black = black;
    this.board = this.getInitialBoard();
    this.currentPlayer = 'white';
    this.moves = [];
    this.status = 'playing';
    this.whiteTime = 15 * 60 * 1000; // 15 minutes in ms
    this.blackTime = 15 * 60 * 1000; // 15 minutes in ms
    this.lastMoveTime = Date.now();
    this.spectators = new Set();
  }

  private getInitialBoard(): (string | null)[][] {
    return [
      ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
      ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
      ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
    ];
  }

  makeMove(fromRow: number, fromCol: number, toRow: number, toCol: number, playerId: string): Move | false {
    // Validate turn
    const isWhitePlayer = this.white.id === playerId;
    const isBlackPlayer = this.black.id === playerId;
    
    if (!isWhitePlayer && !isBlackPlayer) return false;
    
    const expectedPlayer = this.currentPlayer;
    if ((expectedPlayer === 'white' && !isWhitePlayer) || 
        (expectedPlayer === 'black' && !isBlackPlayer)) {
      return false;
    }

    // Basic move validation
    if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7 ||
        toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) {
      return false;
    }

    const piece = this.board[fromRow][fromCol];
    if (!piece) return false;

    // Check if piece belongs to current player
    const isWhitePiece = '♔♕♖♗♘♙'.includes(piece);
    const isBlackPiece = '♚♛♜♝♞♟'.includes(piece);
    
    if ((this.currentPlayer === 'white' && !isWhitePiece) ||
        (this.currentPlayer === 'black' && !isBlackPiece)) {
      return false;
    }

    // Update time
    const now = Date.now();
    const timeDiff = now - this.lastMoveTime;
    
    if (this.currentPlayer === 'white') {
      this.whiteTime -= timeDiff;
    } else {
      this.blackTime -= timeDiff;
    }
    
    this.lastMoveTime = now;

    // Make the move
    const capturedPiece = this.board[toRow][toCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    // Record move
    const move: Move = {
      from: [fromRow, fromCol],
      to: [toRow, toCol],
      piece,
      captured: capturedPiece,
      timestamp: now,
      player: this.currentPlayer
    };
    
    this.moves.push(move);

    // Switch players
    this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';

    return move;
  }

  getGameState() {
    return {
      id: this.id,
      board: this.board,
      currentPlayer: this.currentPlayer,
      status: this.status,
      whiteTime: this.whiteTime,
      blackTime: this.blackTime,
      moves: this.moves,
      white: {
        id: this.white.id,
        name: this.white.name,
        rating: this.white.rating
      },
      black: {
        id: this.black.id,
        name: this.black.name,
        rating: this.black.rating
      },
      spectators: this.spectators.size
    };
  }
}

export class GameServer {
  private io: SocketIOServer;
  private games = new Map<string, Game>();
  private waitingPlayers: Player[] = [];
  private players = new Map<string, Player>();
  private timeUpdateInterval: NodeJS.Timeout | null = null;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
    this.startTimeUpdates();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`🎮 Player connected: ${socket.id}`);

      // Handle player registration
      socket.on('register', (playerData: { name: string; rating: number }) => {
        const player: Player = {
          id: socket.id,
          name: playerData.name || `Игрок_${socket.id.slice(-4)}`,
          rating: playerData.rating || 1500,
          socket: socket
        };
        
        this.players.set(socket.id, player);
        console.log(`✅ Player registered: ${player.name} (${player.rating})`);
        
        socket.emit('registered', { 
          playerId: socket.id,
          playerName: player.name,
          playerRating: player.rating
        });

        // Send current games list
        this.sendGamesList(socket);
      });

      // Handle matchmaking
      socket.on('findMatch', (preferences: { ratingRange?: number } = {}) => {
        this.handleMatchmaking(socket, preferences);
      });

      // Handle game moves
      socket.on('makeMove', ({ gameId, fromRow, fromCol, toRow, toCol }) => {
        this.handleMove(socket, gameId, fromRow, fromCol, toRow, toCol);
      });

      // Handle spectating
      socket.on('spectateGame', (gameId: string) => {
        this.handleSpectate(socket, gameId);
      });

      // Handle resignation
      socket.on('resign', (gameId: string) => {
        this.handleResign(socket, gameId);
      });

      // Handle draw offers
      socket.on('offerDraw', (gameId: string) => {
        this.handleDrawOffer(socket, gameId);
      });

      socket.on('acceptDraw', (gameId: string) => {
        this.handleDrawAccept(socket, gameId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private sendGamesList(socket: any) {
    const gamesList = Array.from(this.games.values()).map(game => ({
      id: game.id,
      white: game.white.name,
      whiteRating: game.white.rating,
      black: game.black.name,
      blackRating: game.black.rating,
      status: game.status,
      spectators: game.spectators.size,
      currentPlayer: game.currentPlayer
    }));
    
    socket.emit('gamesList', gamesList);
  }

  private handleMatchmaking(socket: any, preferences: { ratingRange?: number }) {
    const player = this.players.get(socket.id);
    if (!player) return;

    console.log(`🔍 ${player.name} looking for match...`);

    // Remove from waiting list if already there
    const existingIndex = this.waitingPlayers.findIndex(p => p.id === socket.id);
    if (existingIndex >= 0) {
      this.waitingPlayers.splice(existingIndex, 1);
    }

    // Try to find a match
    const ratingRange = preferences.ratingRange || 200;
    const matchIndex = this.waitingPlayers.findIndex(waitingPlayer => {
      const ratingDiff = Math.abs(waitingPlayer.rating - player.rating);
      return ratingDiff <= ratingRange;
    });

    if (matchIndex >= 0) {
      // Found a match!
      const opponent = this.waitingPlayers.splice(matchIndex, 1)[0];
      
      // Randomly assign colors
      const isPlayerWhite = Math.random() > 0.5;
      const white = isPlayerWhite ? player : opponent;
      const black = isPlayerWhite ? opponent : player;

      // Create game
      const gameId = uuidv4();
      const game = new Game(gameId, white, black);
      this.games.set(gameId, game);

      console.log(`🎯 Game created: ${white.name} (white) vs ${black.name} (black)`);

      // Join players to game room
      white.socket.join(gameId);
      black.socket.join(gameId);

      // Notify players
      white.socket.emit('gameFound', {
        gameId,
        color: 'white',
        opponent: { name: black.name, rating: black.rating },
        gameState: game.getGameState()
      });

      black.socket.emit('gameFound', {
        gameId,
        color: 'black',
        opponent: { name: white.name, rating: white.rating },
        gameState: game.getGameState()
      });

      // Broadcast new game to all players
      this.io.emit('gameCreated', {
        id: game.id,
        white: game.white.name,
        whiteRating: game.white.rating,
        black: game.black.name,
        blackRating: game.black.rating,
        status: game.status,
        spectators: game.spectators.size
      });

    } else {
      // Add to waiting list
      this.waitingPlayers.push(player);
      socket.emit('waitingForMatch', { 
        position: this.waitingPlayers.length,
        estimatedWait: this.waitingPlayers.length * 30 // seconds
      });
      console.log(`⏳ ${player.name} added to waiting list (position: ${this.waitingPlayers.length})`);
    }
  }

  private handleMove(socket: any, gameId: string, fromRow: number, fromCol: number, toRow: number, toCol: number) {
    const game = this.games.get(gameId);
    const player = this.players.get(socket.id);
    
    if (!game || !player) {
      socket.emit('moveError', { message: 'Игра или игрок не найдены' });
      return;
    }

    const move = game.makeMove(fromRow, fromCol, toRow, toCol, socket.id);
    
    if (!move) {
      socket.emit('moveError', { message: 'Недопустимый ход' });
      return;
    }

    console.log(`♟️ Move made in game ${gameId}: ${move.piece} ${move.from} -> ${move.to}`);

    // Broadcast move to all players in game
    this.io.to(gameId).emit('moveMade', {
      move,
      gameState: game.getGameState()
    });

    // Check for game end conditions
    if (game.whiteTime <= 0) {
      game.status = 'time_out';
      this.io.to(gameId).emit('gameEnded', {
        result: 'black_wins',
        reason: 'Время белых истекло',
        gameState: game.getGameState()
      });
    } else if (game.blackTime <= 0) {
      game.status = 'time_out';
      this.io.to(gameId).emit('gameEnded', {
        result: 'white_wins',
        reason: 'Время черных истекло',
        gameState: game.getGameState()
      });
    }
  }

  private handleSpectate(socket: any, gameId: string) {
    const game = this.games.get(gameId);
    if (!game) {
      socket.emit('spectateError', { message: 'Игра не найдена' });
      return;
    }

    socket.join(gameId);
    game.spectators.add(socket.id);
    
    socket.emit('spectatingStarted', {
      gameId,
      gameState: game.getGameState()
    });

    console.log(`👀 ${socket.id} started spectating game ${gameId}`);
  }

  private handleResign(socket: any, gameId: string) {
    const game = this.games.get(gameId);
    const player = this.players.get(socket.id);
    
    if (!game || !player) return;

    const isWhite = game.white.id === socket.id;
    const isBlack = game.black.id === socket.id;
    
    if (!isWhite && !isBlack) return;

    game.status = 'resigned';
    
    this.io.to(gameId).emit('gameEnded', {
      result: isWhite ? 'black_wins' : 'white_wins',
      reason: `${player.name} сдался`,
      gameState: game.getGameState()
    });

    console.log(`🏳️ ${player.name} resigned from game ${gameId}`);
  }

  private handleDrawOffer(socket: any, gameId: string) {
    const game = this.games.get(gameId);
    const player = this.players.get(socket.id);
    
    if (!game || !player) return;

    const isWhite = game.white.id === socket.id;
    const opponent = isWhite ? game.black : game.white;

    opponent.socket.emit('drawOffered', {
      gameId,
      from: player.name
    });

    console.log(`🤝 ${player.name} offered draw in game ${gameId}`);
  }

  private handleDrawAccept(socket: any, gameId: string) {
    const game = this.games.get(gameId);
    if (!game) return;

    game.status = 'draw';
    
    this.io.to(gameId).emit('gameEnded', {
      result: 'draw',
      reason: 'Ничья по соглашению',
      gameState: game.getGameState()
    });

    console.log(`🤝 Draw accepted in game ${gameId}`);
  }

  private handleDisconnect(socket: any) {
    console.log(`💔 Player disconnected: ${socket.id}`);

    // Remove from waiting list
    const waitingIndex = this.waitingPlayers.findIndex(p => p.id === socket.id);
    if (waitingIndex >= 0) {
      this.waitingPlayers.splice(waitingIndex, 1);
    }

    // Handle game disconnection
    for (const [gameId, game] of this.games) {
      if (game.white.id === socket.id || game.black.id === socket.id) {
        // Player disconnected from active game
        const player = this.players.get(socket.id);
        if (player) {
          this.io.to(gameId).emit('playerDisconnected', {
            playerName: player.name,
            gameState: game.getGameState()
          });
        }
        
        // Give some time for reconnection, then end game
        setTimeout(() => {
          if (this.games.has(gameId)) {
            const disconnectedPlayer = game.white.id === socket.id ? game.white : game.black;
            const winner = game.white.id === socket.id ? 'black_wins' : 'white_wins';
            
            game.status = 'disconnected';
            this.io.to(gameId).emit('gameEnded', {
              result: winner,
              reason: `${disconnectedPlayer.name} отключился`,
              gameState: game.getGameState()
            });
            
            this.games.delete(gameId);
          }
        }, 30000); // 30 seconds timeout
      }
      
      // Remove from spectators
      game.spectators.delete(socket.id);
    }

    this.players.delete(socket.id);
  }

  private startTimeUpdates() {
    this.timeUpdateInterval = setInterval(() => {
      for (const [gameId, game] of this.games) {
        if (game.status === 'playing') {
          const now = Date.now();
          const timeDiff = now - game.lastMoveTime;
          
          if (game.currentPlayer === 'white') {
            game.whiteTime = Math.max(0, game.whiteTime - timeDiff);
          } else {
            game.blackTime = Math.max(0, game.blackTime - timeDiff);
          }
          
          game.lastMoveTime = now;
          
          // Check for time out
          if (game.whiteTime <= 0 || game.blackTime <= 0) {
            const winner = game.whiteTime <= 0 ? 'black_wins' : 'white_wins';
            const reason = game.whiteTime <= 0 ? 'Время белых истекло' : 'Время черных истекло';
            
            game.status = 'time_out';
            this.io.to(gameId).emit('gameEnded', {
              result: winner,
              reason,
              gameState: game.getGameState()
            });
          } else {
            // Send time update
            this.io.to(gameId).emit('timeUpdate', {
              whiteTime: game.whiteTime,
              blackTime: game.blackTime
            });
          }
        }
      }
    }, 1000); // Update every second
  }

  destroy() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }
  }
}