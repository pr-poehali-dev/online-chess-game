import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { useSocket } from '@/hooks/useSocket';

// Chess piece definitions
const INITIAL_BOARD = [
  ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
  ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
  ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖'],
];

const SAMPLE_GAMES = [
  { id: 1, white: 'Анна_К', whiteRating: 1650, black: 'Михаил_С', blackRating: 1580, status: 'Играют', time: '5+0', viewers: 12 },
  { id: 2, white: 'Елена_В', whiteRating: 1720, black: '—', blackRating: null, status: 'Ищет соперника', time: '10+5', viewers: 0 },
  { id: 3, white: 'Дмитрий_А', whiteRating: 1890, black: 'Ольга_П', blackRating: 1845, status: 'Играют', time: '3+2', viewers: 28 },
  { id: 4, white: 'Владимир_Н', whiteRating: 1455, black: '—', blackRating: null, status: 'Ищет соперника', time: '15+10', viewers: 0 },
];

const TOP_PLAYERS = [
  { rank: 1, name: 'ГроссмейстерА', rating: 2150, games: 342, wins: 251 },
  { rank: 2, name: 'Шахматист_Про', rating: 2089, games: 298, wins: 221 },
  { rank: 3, name: 'КорольДоски', rating: 2034, games: 445, wins: 312 },
  { rank: 4, name: 'Тактик_2024', rating: 1987, games: 178, wins: 134 },
  { rank: 5, name: 'Стратег_Элит', rating: 1923, games: 256, wins: 189 },
];

export default function Index() {
  // Socket connection
  const {
    isConnected,
    playerInfo,
    currentGame,
    playerColor,
    lastMove: socketLastMove,
    gameEndInfo,
    isSearching,
    searchStatus,
    gamesList,
    register,
    findMatch,
    cancelSearch,
    makeMove: socketMakeMove,
    resign,
    offerDraw,
    spectateGame,
    leaveGame,
  } = useSocket();

  // Local game state (for offline play)
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<'white' | 'black'>('white');
  const [lastMove, setLastMove] = useState<[number, number, number, number] | null>(null);
  const [gameStatus, setGameStatus] = useState<'playing' | 'check' | 'checkmate' | 'draw'>('playing');

  // UI state
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [activeTab, setActiveTab] = useState('game');

  // Auto-show name dialog on first visit
  useEffect(() => {
    if (!playerInfo && !showNameDialog) {
      setShowNameDialog(true);
    }
  }, [playerInfo, showNameDialog]);

  // Update board from socket game state
  useEffect(() => {
    if (currentGame) {
      setBoard(currentGame.board);
      setCurrentPlayer(currentGame.currentPlayer);
      
      // Update last move from socket
      if (socketLastMove) {
        setLastMove([socketLastMove.from[0], socketLastMove.from[1], socketLastMove.to[0], socketLastMove.to[1]]);
      }
    }
  }, [currentGame, socketLastMove]);

  const isWhitePiece = (piece: string | null): boolean => {
    return piece ? '♔♕♖♗♘♙'.includes(piece) : false;
  };

  const isBlackPiece = (piece: string | null): boolean => {
    return piece ? '♚♛♜♝♞♟'.includes(piece) : false;
  };

  const isValidMove = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number): boolean => {
    const piece = board[fromRow][fromCol];
    if (!piece) return false;
    
    const isCurrentPlayerPiece = (currentPlayer === 'white' && isWhitePiece(piece)) || 
                                 (currentPlayer === 'black' && isBlackPiece(piece));
    
    if (!isCurrentPlayerPiece) return false;
    
    const targetPiece = board[toRow][toCol];
    if (targetPiece && 
        ((currentPlayer === 'white' && isWhitePiece(targetPiece)) || 
         (currentPlayer === 'black' && isBlackPiece(targetPiece)))) {
      return false;
    }
    
    return true;
  }, [board, currentPlayer]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (currentGame && playerColor) {
      // Online game logic
      if (selectedSquare) {
        const [selectedRow, selectedCol] = selectedSquare;
        
        if (selectedRow === row && selectedCol === col) {
          setSelectedSquare(null);
          return;
        }

        // Check if it's player's turn
        if (currentGame.currentPlayer !== playerColor) {
          setSelectedSquare(null);
          return;
        }

        // Make move via socket
        socketMakeMove(selectedRow, selectedCol, row, col);
        setSelectedSquare(null);
      } else {
        const piece = board[row][col];
        const canSelectPiece = piece && 
          ((playerColor === 'white' && isWhitePiece(piece)) || 
           (playerColor === 'black' && isBlackPiece(piece))) &&
          currentGame.currentPlayer === playerColor;
        
        if (canSelectPiece) {
          setSelectedSquare([row, col]);
        }
      }
    } else {
      // Offline game logic
      if (selectedSquare) {
        const [selectedRow, selectedCol] = selectedSquare;
        
        if (selectedRow === row && selectedCol === col) {
          setSelectedSquare(null);
          return;
        }

        if (isValidMove(selectedRow, selectedCol, row, col)) {
          const newBoard = board.map(r => [...r]);
          const movingPiece = newBoard[selectedRow][selectedCol];
          newBoard[row][col] = movingPiece;
          newBoard[selectedRow][selectedCol] = null;
          
          setBoard(newBoard);
          setLastMove([selectedRow, selectedCol, row, col]);
          setCurrentPlayer(currentPlayer === 'white' ? 'black' : 'white');
        }
        
        setSelectedSquare(null);
      } else {
        const piece = board[row][col];
        if (piece && 
            ((currentPlayer === 'white' && isWhitePiece(piece)) || 
             (currentPlayer === 'black' && isBlackPiece(piece)))) {
          setSelectedSquare([row, col]);
        }
      }
    }
  }, [selectedSquare, board, currentPlayer, currentGame, playerColor, socketMakeMove, isValidMove]);

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      register(playerName.trim());
      setShowNameDialog(false);
    }
  };

  const handleQuickMatch = () => {
    if (isSearching) {
      cancelSearch();
    } else {
      findMatch();
    }
  };

  const getSquareClass = (row: number, col: number): string => {
    let classes = 'chess-square ';
    classes += (row + col) % 2 === 0 ? 'light ' : 'dark ';
    
    if (selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col) {
      classes += 'selected ';
    }
    
    if (lastMove && 
        ((lastMove[0] === row && lastMove[1] === col) || 
         (lastMove[2] === row && lastMove[3] === col))) {
      classes += 'last-move ';
    }
    
    return classes;
  };

  const getRatingColor = (rating: number): string => {
    if (rating >= 2000) return 'bg-yellow-500';
    if (rating >= 1800) return 'bg-purple-500';
    if (rating >= 1600) return 'bg-blue-500';
    if (rating >= 1400) return 'bg-green-500';
    return 'bg-gray-500';
  };

  const getStatusColor = (status: string): string => {
    if (status === 'Играют') return 'bg-success text-success-foreground';
    if (status === 'Ищет соперника') return 'bg-warning text-warning-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="animate-fade-in">
            <h1 className="font-heading text-6xl md:text-8xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent mb-6">
              CHESS MASTER
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
              Погрузитесь в мир элегантных шахмат. Играйте онлайн с соперниками со всего мира, 
              развивайте свой рейтинг и становитесь мастером стратегии.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up">
              {playerInfo ? (
                <>
                  <Button 
                    size="lg" 
                    className="px-8 py-4 text-lg font-semibold hover:scale-105 transition-all"
                    onClick={() => setActiveTab('lobby')}
                  >
                    <Icon name="Play" className="mr-2" />
                    Начать игру
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="px-8 py-4 text-lg font-semibold hover:scale-105 transition-all"
                    onClick={() => setActiveTab('lobby')}
                  >
                    <Icon name="Users" className="mr-2" />
                    Смотреть партии
                  </Button>
                </>
              ) : (
                <Button 
                  size="lg" 
                  className="px-8 py-4 text-lg font-semibold hover:scale-105 transition-all"
                  onClick={() => setShowNameDialog(true)}
                >
                  <Icon name="Play" className="mr-2" />
                  Подключиться к игре
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-20">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-card border border-border rounded-xl p-1">
            <TabsTrigger value="game" className="text-sm md:text-base font-medium">
              <Icon name="Grid3x3" className="mr-2 h-4 w-4" />
              Игра
            </TabsTrigger>
            <TabsTrigger value="lobby" className="text-sm md:text-base font-medium">
              <Icon name="Users" className="mr-2 h-4 w-4" />
              Лобби
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="text-sm md:text-base font-medium">
              <Icon name="Trophy" className="mr-2 h-4 w-4" />
              Рейтинг
            </TabsTrigger>
            <TabsTrigger value="about" className="text-sm md:text-base font-medium">
              <Icon name="Info" className="mr-2 h-4 w-4" />
              О проекте
            </TabsTrigger>
          </TabsList>

          {/* Game Tab */}
          <TabsContent value="game" className="animate-fade-in">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Chess Board */}
              <div className="lg:col-span-2">
                <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-2">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-foreground"></div>
                        <span className="font-semibold">
                          {currentGame && playerColor !== 'black' ? currentGame.black.name : 'Игрок_Черными'}
                        </span>
                        <Badge className="rating-badge bg-blue-500 text-white">
                          {currentGame ? currentGame.black.rating : 1650}
                        </Badge>
                      </div>
                      <div className="text-2xl font-mono bg-muted px-3 py-1 rounded-lg">
                        {currentGame ? formatTime(currentGame.blackTime) : '15:00'}
                      </div>
                    </div>
                    {!isConnected && (
                      <Badge variant="destructive">Офлайн режим</Badge>
                    )}
                    {currentGame && gameEndInfo && (
                      <Badge className="bg-warning text-warning-foreground">
                        {gameEndInfo.reason}
                      </Badge>
                    )}
                  </div>

                  <div className="chess-board animate-scale-in">
                    {board.map((row, rowIndex) =>
                      row.map((piece, colIndex) => (
                        <div
                          key={`${rowIndex}-${colIndex}`}
                          className={getSquareClass(rowIndex, colIndex)}
                          onClick={() => handleSquareClick(rowIndex, colIndex)}
                        >
                          {piece && (
                            <span className="chess-piece text-3xl md:text-4xl select-none">
                              {piece}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-6">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-accent"></div>
                        <span className="font-semibold">
                          {currentGame && playerColor !== 'white' ? currentGame.white.name : 
                           playerInfo ? `${playerInfo.name} (Белыми)` : 'Вы (Белыми)'}
                        </span>
                        <Badge className="rating-badge bg-green-500 text-white">
                          {currentGame ? currentGame.white.rating : (playerInfo?.rating || 1587)}
                        </Badge>
                      </div>
                      <div className="text-2xl font-mono bg-muted px-3 py-1 rounded-lg">
                        {currentGame ? formatTime(currentGame.whiteTime) : '14:35'}
                      </div>
                    </div>
                    <Badge className={`${(currentGame ? currentGame.currentPlayer : currentPlayer) === 'white' ? 'bg-accent' : 'bg-muted'} text-sm px-3 py-1`}>
                      Ход: {(currentGame ? currentGame.currentPlayer : currentPlayer) === 'white' ? 'Белые' : 'Черные'}
                    </Badge>
                  </div>
                </Card>
              </div>

              {/* Game Info */}
              <div className="space-y-6">
                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                    <Icon name="Clock" className="h-5 w-5 text-accent" />
                    Информация о партии
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Контроль времени:</span>
                      <span className="font-medium">15+10</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Тип партии:</span>
                      <span className="font-medium">Рейтинговая</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Зрителей:</span>
                      <span className="font-medium">{currentGame?.spectators || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Статус:</span>
                      <Badge className={currentGame ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}>
                        {currentGame ? 'В игре' : 'Офлайн'}
                      </Badge>
                    </div>
                  </div>
                </Card>

                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                    <Icon name="Activity" className="h-5 w-5 text-accent" />
                    Статистика матча
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ходов сделано:</span>
                      <span className="font-medium">{currentGame?.moves.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Взятых фигур:</span>
                      <span className="font-medium">3</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Длительность:</span>
                      <span className="font-medium">8:24</span>
                    </div>
                  </div>
                </Card>

                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4">Действия</h3>
                  <div className="space-y-3">
                    {currentGame && playerColor ? (
                      <>
                        <Button variant="outline" className="w-full" onClick={offerDraw}>
                          <Icon name="Flag" className="mr-2 h-4 w-4" />
                          Предложить ничью
                        </Button>
                        <Button variant="destructive" className="w-full" onClick={resign}>
                          <Icon name="X" className="mr-2 h-4 w-4" />
                          Сдаться
                        </Button>
                        {gameEndInfo && (
                          <Button variant="outline" className="w-full" onClick={leaveGame}>
                            <Icon name="Home" className="mr-2 h-4 w-4" />
                            Вернуться в лобби
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button variant="outline" className="w-full" disabled>
                          <Icon name="Flag" className="mr-2 h-4 w-4" />
                          Предложить ничью
                        </Button>
                        <Button variant="destructive" className="w-full" disabled>
                          <Icon name="X" className="mr-2 h-4 w-4" />
                          Сдаться
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Lobby Tab */}
          <TabsContent value="lobby" className="animate-fade-in">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="font-heading text-3xl font-bold">Активные партии</h2>
                  <Button className="px-6">
                    <Icon name="Plus" className="mr-2 h-4 w-4" />
                    Создать игру
                  </Button>
                </div>

                <div className="space-y-4">
                  {gamesList.length > 0 ? gamesList.map((game) => (
                    <Card key={game.id} className="game-card">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-accent"></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{game.white}</span>
                                <Badge className={`rating-badge ${getRatingColor(game.whiteRating)} text-white text-xs`}>
                                  {game.whiteRating}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">Белые</div>
                            </div>
                          </div>

                          <div className="text-2xl font-bold text-muted-foreground">vs</div>

                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-foreground"></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{game.black}</span>
                                {game.blackRating && (
                                  <Badge className={`rating-badge ${getRatingColor(game.blackRating)} text-white text-xs`}>
                                    {game.blackRating}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">Черные</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-sm font-medium">{game.time}</div>
                            <div className="text-xs text-muted-foreground">Контроль</div>
                          </div>
                          <Badge className={getStatusColor(game.status)}>
                            {game.status}
                          </Badge>
                          {game.viewers > 0 && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Icon name="Eye" className="h-4 w-4" />
                              {game.viewers}
                            </div>
                          )}
                          <Button variant="outline" size="sm">
                            {game.status === 'Играют' ? 'Смотреть' : 'Присоединиться'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )) : SAMPLE_GAMES.map((game) => (
                    <Card key={game.id} className="game-card">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-accent"></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{game.white}</span>
                                <Badge className={`rating-badge ${getRatingColor(game.whiteRating)} text-white text-xs`}>
                                  {game.whiteRating}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">Белые</div>
                            </div>
                          </div>

                          <div className="text-2xl font-bold text-muted-foreground">vs</div>

                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-foreground"></div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{game.black}</span>
                                {game.blackRating && (
                                  <Badge className={`rating-badge ${getRatingColor(game.blackRating)} text-white text-xs`}>
                                    {game.blackRating}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">Черные</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-sm font-medium">{game.time}</div>
                            <div className="text-xs text-muted-foreground">Контроль</div>
                          </div>
                          <Badge className={getStatusColor(game.status)}>
                            {game.status}
                          </Badge>
                          {game.viewers > 0 && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Icon name="Eye" className="h-4 w-4" />
                              {game.viewers}
                            </div>
                          )}
                          <Button variant="outline" size="sm">
                            {game.status === 'Играют' ? 'Смотреть' : 'Присоединиться'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                    <Icon name="Zap" className="h-5 w-5 text-accent" />
                    Быстрая игра
                  </h3>
                  <div className="space-y-4">
                    {isConnected ? (
                      <>
                        <Button 
                          className="w-full" 
                          size="lg" 
                          onClick={handleQuickMatch}
                          disabled={!playerInfo}
                        >
                          <Icon name={isSearching ? "X" : "Play"} className="mr-2" />
                          {isSearching ? 'Отменить поиск' : 'Найти соперника'}
                        </Button>
                        {searchStatus && (
                          <div className="text-center text-sm text-muted-foreground animate-pulse">
                            {searchStatus}
                          </div>
                        )}
                      </>
                    ) : (
                      <Button className="w-full" size="lg" disabled>
                        <Icon name="Wifi" className="mr-2" />
                        Подключение...
                      </Button>
                    )}
                    <div className="text-center text-sm text-muted-foreground">
                      Средний рейтинг: 1650 ± 150
                    </div>
                  </div>
                </Card>

                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4">Настройки игры</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Контроль времени</label>
                      <select className="w-full p-2 border border-border rounded-lg bg-background">
                        <option>3+0 (Блиц)</option>
                        <option>5+0 (Блиц)</option>
                        <option>10+0 (Быстрые)</option>
                        <option>15+10 (Быстрые)</option>
                        <option>30+0 (Классические)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Рейтинговая игра</label>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="rated" defaultChecked />
                        <label htmlFor="rated" className="text-sm">Рейтинговая партия</label>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                    <Icon name="BarChart3" className="h-5 w-5 text-accent" />
                    Статистика лобби
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Игроков онлайн:</span>
                      <span className="font-medium">1,247</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Активных партий:</span>
                      <span className="font-medium">89</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">В очереди:</span>
                      <span className="font-medium">23</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="animate-fade-in">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="font-heading text-4xl font-bold mb-4">Рейтинговая таблица</h2>
                <p className="text-lg text-muted-foreground">Лучшие игроки Chess Master</p>
              </div>

              <div className="grid gap-4">
                {TOP_PLAYERS.map((player, index) => (
                  <Card key={player.rank} className={`game-card ${index === 0 ? 'bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border-yellow-500/20' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            index === 0 ? 'bg-yellow-500 text-white' : 
                            index === 1 ? 'bg-gray-400 text-white' : 
                            index === 2 ? 'bg-amber-600 text-white' : 
                            'bg-muted text-muted-foreground'
                          }`}>
                            {player.rank}
                          </div>
                          {index < 3 && (
                            <Icon name="Trophy" className={`h-6 w-6 ${
                              index === 0 ? 'text-yellow-500' : 
                              index === 1 ? 'text-gray-400' : 
                              'text-amber-600'
                            }`} />
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-lg">{player.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {player.games} игр • {Math.round((player.wins / player.games) * 100)}% побед
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <Badge className={`rating-badge ${getRatingColor(player.rating)} text-white text-lg px-4 py-2`}>
                          {player.rating}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Icon name="Swords" className="mr-2 h-4 w-4" />
                          Вызов
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid md:grid-cols-3 gap-6 mt-8">
                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                    <Icon name="TrendingUp" className="h-5 w-5 text-accent" />
                    Ваш прогресс
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Рейтинг:</span>
                      <Badge className="rating-badge bg-green-500 text-white">1587</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Позиция:</span>
                      <span className="font-medium">#2,847</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Изменение:</span>
                      <span className="font-medium text-green-500">+24</span>
                    </div>
                  </div>
                </Card>

                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                    <Icon name="Target" className="h-5 w-5 text-accent" />
                    Ваша статистика
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Игр сыграно:</span>
                      <span className="font-medium">127</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Побед:</span>
                      <span className="font-medium">74 (58%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ничьих:</span>
                      <span className="font-medium">28 (22%)</span>
                    </div>
                  </div>
                </Card>

                <Card className="stats-card">
                  <h3 className="font-heading text-xl font-semibold mb-4 flex items-center gap-2">
                    <Icon name="Calendar" className="h-5 w-5 text-accent" />
                    Активность
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Игр сегодня:</span>
                      <span className="font-medium">3</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Игр за неделю:</span>
                      <span className="font-medium">18</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Время в игре:</span>
                      <span className="font-medium">4ч 23м</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* About Tab */}
          <TabsContent value="about" className="animate-fade-in">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="font-heading text-4xl font-bold mb-6">О Chess Master</h2>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Премиальная платформа для игры в шахматы онлайн с элегантным интерфейсом, 
                  продвинутой системой рейтинга и возможностями для роста вашего мастерства.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-12">
                <Card className="stats-card">
                  <Icon name="Zap" className="h-8 w-8 text-accent mb-4" />
                  <h3 className="font-heading text-xl font-semibold mb-3">Быстрые матчи</h3>
                  <p className="text-muted-foreground">
                    Найдите соперника за секунды благодаря нашему умному алгоритму подбора 
                    по рейтингу и предпочтениям.
                  </p>
                </Card>

                <Card className="stats-card">
                  <Icon name="Trophy" className="h-8 w-8 text-accent mb-4" />
                  <h3 className="font-heading text-xl font-semibold mb-3">Рейтинговая система</h3>
                  <p className="text-muted-foreground">
                    Точная система ELO отслеживает ваш прогресс и обеспечивает 
                    честные матчи с равными по силе соперниками.
                  </p>
                </Card>

                <Card className="stats-card">
                  <Icon name="Users" className="h-8 w-8 text-accent mb-4" />
                  <h3 className="font-heading text-xl font-semibold mb-3">Режим наблюдения</h3>
                  <p className="text-muted-foreground">
                    Учитесь на партиях мастеров, наблюдая за живыми играми 
                    и анализируя стратегии лучших игроков.
                  </p>
                </Card>

                <Card className="stats-card">
                  <Icon name="Clock" className="h-8 w-8 text-accent mb-4" />
                  <h3 className="font-heading text-xl font-semibold mb-3">Контроль времени</h3>
                  <p className="text-muted-foreground">
                    Широкий выбор временных контролей: от молниеносного блица 
                    до глубоких классических партий.
                  </p>
                </Card>
              </div>

              <Card className="stats-card bg-gradient-to-r from-accent/10 to-primary/10 border-accent/20">
                <div className="text-center">
                  <h3 className="font-heading text-2xl font-semibold mb-4">Готовы начать играть?</h3>
                  <p className="text-muted-foreground mb-6">
                    Присоединяйтесь к тысячам игроков и докажите своё мастерство на шахматной доске.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button size="lg" className="px-8">
                      <Icon name="Play" className="mr-2" />
                      Начать играть
                    </Button>
                    <Button variant="outline" size="lg" className="px-8">
                      <Icon name="BookOpen" className="mr-2" />
                      Изучить правила
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Registration Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подключение к Chess Master</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playerName">Ваше имя в игре</Label>
              <Input
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Например: Мастер_Шахмат"
                onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {isConnected ? (
                <div className="flex items-center gap-2 text-success">
                  <Icon name="CheckCircle" className="h-4 w-4" />
                  Подключено к серверу
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon name="Loader2" className="h-4 w-4 animate-spin" />
                  Подключение к серверу...
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={handleNameSubmit} 
              disabled={!playerName.trim() || !isConnected}
              className="w-full"
            >
              <Icon name="Play" className="mr-2 h-4 w-4" />
              Начать игру
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}