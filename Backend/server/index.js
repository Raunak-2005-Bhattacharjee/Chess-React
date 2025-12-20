import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Chess } from 'chess.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// In-memory storage
const waitingQueue = [];
const gameRooms = new Map(); // roomId -> { players: [socketId1, socketId2], chess: Chess instance, currentTurn: 'white'|'black' }

// Helper function to convert [row, col] to chess notation (e.g., [6, 4] -> 'e2')
function rowColToSquare(row, col) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  return files[col] + ranks[row];
}

// Helper function to convert chess notation to [row, col] (e.g., 'e2' -> [6, 4])
function squareToRowCol(square) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  const col = files.indexOf(square[0]);
  const row = ranks.indexOf(square[1]);
  return [row, col];
}

// Helper function to convert chess.js board to our format
function chessBoardToArray(chessBoard) {
  return chessBoard.map(row => 
    row.map(square => {
      if (square === null) return null;
      const piece = square.type;
      const color = square.color;
      const pieceMap = {
        'p': color === 'w' ? 'P' : 'p',
        'r': color === 'w' ? 'R' : 'r',
        'n': color === 'w' ? 'N' : 'n',
        'b': color === 'w' ? 'B' : 'b',
        'q': color === 'w' ? 'Q' : 'q',
        'k': color === 'w' ? 'K' : 'k'
      };
      return pieceMap[piece] || null;
    })
  );
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle joining waiting room
  socket.on('join_waiting', (data) => {
    const nickname = data?.nickname || `Player_${socket.id.slice(0, 6)}`;
    
    if (waitingQueue.find(p => p.socketId === socket.id)) {
      socket.emit('error', { message: 'Already in waiting queue' });
      return;
    }

    waitingQueue.push({ socketId: socket.id, nickname });
    console.log(`Player ${nickname} (${socket.id}) joined waiting queue. Queue size: ${waitingQueue.length}`);

    // If we have at least 2 players, match them
    if (waitingQueue.length >= 2) {
      const player1 = waitingQueue.shift();
      const player2 = waitingQueue.shift();

      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create game room with chess.js instance
      const chess = new Chess();
      const board = chessBoardToArray(chess.board());

      gameRooms.set(roomId, {
        players: [player1.socketId, player2.socketId],
        chess: chess,
        currentTurn: 'white',
        playerColors: {
          [player1.socketId]: 'white',
          [player2.socketId]: 'black'
        }
      });

      // Join both players to the room
      io.sockets.sockets.get(player1.socketId)?.join(roomId);
      io.sockets.sockets.get(player2.socketId)?.join(roomId);

      // Notify both players
      io.to(player1.socketId).emit('match_found', {
        roomId,
        color: 'white',
        board: board,
        fen: chess.fen(),
        opponent: player2.nickname
      });

      io.to(player2.socketId).emit('match_found', {
        roomId,
        color: 'black',
        board: board,
        fen: chess.fen(),
        opponent: player1.nickname
      });

      console.log(`Matched ${player1.nickname} (white) and ${player2.nickname} (black) in room ${roomId}`);
    } else {
      socket.emit('waiting', { message: 'Waiting for opponent...' });
    }
  });

  // Handle player move
  socket.on('player_move', (data) => {
    const { roomId, from, to, promotion } = data;
    const room = gameRooms.get(roomId);

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (!room.players.includes(socket.id)) {
      socket.emit('error', { message: 'Not in this room' });
      return;
    }

    const playerColor = room.playerColors[socket.id];
    const chess = room.chess;
    
    // Check if it's the player's turn
    if ((chess.turn() === 'w' && playerColor !== 'white') || 
        (chess.turn() === 'b' && playerColor !== 'black')) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Convert [row, col] to chess notation
    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const fromSquare = rowColToSquare(fromRow, fromCol);
    const toSquare = rowColToSquare(toRow, toCol);

    // Build move object
    const moveObj = {
      from: fromSquare,
      to: toSquare
    };
    
    // Add promotion if specified
    if (promotion) {
      moveObj.promotion = promotion;
    }

    // Validate and make move using chess.js
    try {
      const move = chess.move(moveObj);
      
      if (!move) {
        socket.emit('error', { message: 'Invalid move' });
        return;
      }

      // Update current turn
      room.currentTurn = chess.turn() === 'w' ? 'white' : 'black';

      // Convert board to array format
      const board = chessBoardToArray(chess.board());

      // Check game status
      const gameStatus = {
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isStalemate: chess.isStalemate(),
        isDraw: chess.isDraw(),
        isGameOver: chess.isGameOver()
      };

      // Broadcast move to opponent
      const opponentId = room.players.find(id => id !== socket.id);
      io.to(opponentId).emit('opponent_move', {
        from,
        to,
        board: board,
        fen: chess.fen(),
        currentTurn: room.currentTurn,
        gameStatus: gameStatus
      });

      // Confirm move to sender
      socket.emit('move_confirmed', {
        board: board,
        fen: chess.fen(),
        currentTurn: room.currentTurn,
        gameStatus: gameStatus
      });

      // Check if game is over
      if (gameStatus.isGameOver) {
        let winner = null;
        if (gameStatus.isCheckmate) {
          // The player who made the move won (opponent is in checkmate)
          winner = socket.id;
        } else if (gameStatus.isStalemate || gameStatus.isDraw) {
          // Draw - no winner
          winner = null;
        }

        io.to(roomId).emit('game_over', {
          winner: winner,
          reason: gameStatus.isCheckmate ? 'checkmate' : 
                  gameStatus.isStalemate ? 'stalemate' : 'draw',
          gameStatus: gameStatus
        });

        // Clean up room after a delay
        setTimeout(() => {
          gameRooms.delete(roomId);
        }, 5000);
      }
    } catch (error) {
      socket.emit('error', { message: error.message || 'Invalid move' });
    }
  });

  // Handle resignation
  socket.on('resign', (data) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);

    if (!room || !room.players.includes(socket.id)) {
      socket.emit('error', { message: 'Room not found or not in room' });
      return;
    }

    const opponentId = room.players.find(id => id !== socket.id);
    io.to(roomId).emit('game_over', {
      winner: opponentId,
      reason: 'resignation'
    });

    // Clean up room
    gameRooms.delete(roomId);
    console.log(`Game in room ${roomId} ended by resignation`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Remove from waiting queue
    const queueIndex = waitingQueue.findIndex(p => p.socketId === socket.id);
    if (queueIndex !== -1) {
      waitingQueue.splice(queueIndex, 1);
      console.log(`Removed ${socket.id} from waiting queue`);
    }

    // Handle if player was in a game
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.players.includes(socket.id)) {
        const opponentId = room.players.find(id => id !== socket.id);
        if (opponentId) {
          io.to(opponentId).emit('opponent_disconnected', {
            message: 'Your opponent has disconnected'
          });
        }
        gameRooms.delete(roomId);
        console.log(`Cleaned up room ${roomId} after disconnect`);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

