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

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const waitingQueue = [];
const gameRooms = new Map(); 

function rowColToSquare(row, col) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  return files[col] + ranks[row];
}

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

  socket.on('join_waiting', (data) => {
    const nickname = data?.nickname || `Player_${socket.id.slice(0, 6)}`;
    
    if (waitingQueue.find(p => p.socketId === socket.id)) {
      socket.emit('error', { message: 'Already in waiting queue' });
      return;
    }

    waitingQueue.push({ socketId: socket.id, nickname });
    console.log(`Player ${nickname} (${socket.id}) joined waiting queue. Queue size: ${waitingQueue.length}`);

    if (waitingQueue.length >= 2) {
      const player1 = waitingQueue.shift();
      const player2 = waitingQueue.shift();

      const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2,11)}`;
      
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

      io.sockets.sockets.get(player1.socketId)?.join(roomId);
      io.sockets.sockets.get(player2.socketId)?.join(roomId);

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
    
    if ((chess.turn() === 'w' && playerColor !== 'white') || 
        (chess.turn() === 'b' && playerColor !== 'black')) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    const [fromRow, fromCol] = from;
    const [toRow, toCol] = to;
    const fromSquare = rowColToSquare(fromRow, fromCol);
    const toSquare = rowColToSquare(toRow, toCol);

    const moveObj = {
      from: fromSquare,
      to: toSquare
    };
    

    if (promotion) {
      moveObj.promotion = promotion;
    }

    try {
      const move = chess.move(moveObj);
      
      if (!move) {
        socket.emit('error', { message: 'Invalid move' });
        return;
      }

      room.currentTurn = chess.turn() === 'w' ? 'white' : 'black';

      const board = chessBoardToArray(chess.board());

      const gameStatus = {
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isStalemate: chess.isStalemate(),
        isDraw: chess.isDraw(),
        isGameOver: chess.isGameOver()
      };

      const opponentId = room.players.find(id => id !== socket.id);
      io.to(opponentId).emit('opponent_move', {
        from,
        to,
        board: board,
        fen: chess.fen(),
        currentTurn: room.currentTurn,
        gameStatus: gameStatus
      });

      socket.emit('move_confirmed', {
        board: board,
        fen: chess.fen(),
        currentTurn: room.currentTurn,
        gameStatus: gameStatus
      });

      if (gameStatus.isGameOver) {
        let winner = null;
        if (gameStatus.isCheckmate) {

          winner = socket.id;
        } else if (gameStatus.isStalemate || gameStatus.isDraw) {

          winner = null;
        }

        io.to(roomId).emit('game_over', {
          winner: winner,
          reason: gameStatus.isCheckmate ? 'checkmate' : 
                  gameStatus.isStalemate ? 'stalemate' : 'draw',
          gameStatus: gameStatus
        });

        setTimeout(() => {
          gameRooms.delete(roomId);
        }, 5000);
      }
    } catch (error) {
      socket.emit('error', { message: error.message || 'Invalid move' });
    }
  });

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


    gameRooms.delete(roomId);
    console.log(`Game in room ${roomId} ended by resignation`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const queueIndex = waitingQueue.findIndex(p => p.socketId === socket.id);
    if (queueIndex !== -1) {
      waitingQueue.splice(queueIndex, 1);
      console.log(`Removed ${socket.id} from waiting queue`);
    }

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

