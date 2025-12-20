import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import socket from '../socket';
import bgVideo from '../assets/Bg2.mp4';
import './GameBoard.css';

const PIECE_SYMBOLS = {
  'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
  'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

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

function GameBoard({ gameData, onGameEnd }) {
  const [chess] = useState(() => {
    const chessInstance = new Chess();
    if (gameData.fen) {
      chessInstance.load(gameData.fen);
    }
    return chessInstance;
  });
  const [board, setBoard] = useState(() => gameData.board || chessBoardToArray(chess.board()));
  const [currentTurn, setCurrentTurn] = useState(() => chess.turn() === 'w' ? 'white' : 'black');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [gameStatus, setGameStatus] = useState('playing');
  const [gameStatusInfo, setGameStatusInfo] = useState(null);
  const { roomId, color, opponent } = gameData;

  useEffect(() => {
    socket.on('opponent_move', (data) => {
      chess.load(data.fen);
      setBoard(data.board);
      setCurrentTurn(data.currentTurn);
      setSelectedSquare(null);
      if (data.gameStatus) {
        setGameStatusInfo(data.gameStatus);
        if (data.gameStatus.isGameOver) {
          setGameStatus('ended');
        }
      }
    });

    socket.on('move_confirmed', (data) => {
      chess.load(data.fen);
      setBoard(data.board);
      setCurrentTurn(data.currentTurn);
      setSelectedSquare(null);
      if (data.gameStatus) {
        setGameStatusInfo(data.gameStatus);
        if (data.gameStatus.isGameOver) {
          setGameStatus('ended');
        }
      }
    });

    socket.on('game_over', (data) => {
      if (data.fen) {
        chess.load(data.fen);
        setBoard(chessBoardToArray(chess.board()));
      }
      setGameStatus('ended');
      if (data.winner === socket.id) {
        setGameStatus('won');
      } else if (data.winner === null) {
        setGameStatus('draw');
      } else {
        setGameStatus('lost');
      }
      if (data.gameStatus) {
        setGameStatusInfo(data.gameStatus);
      }
    });

    socket.on('opponent_disconnected', (data) => {
      setGameStatus('opponent_disconnected');
    });

    socket.on('error', (data) => {
      console.error('Game error:', data.message);
      setSelectedSquare(null);
      setBoard(chessBoardToArray(chess.board()));
    });

    return () => {
      socket.off('opponent_move');
      socket.off('move_confirmed');
      socket.off('game_over');
      socket.off('opponent_disconnected');
      socket.off('error');
    };
  }, [roomId]);

  const handleSquareClick = (displayRow, displayCol) => {
    if (gameStatus !== 'playing') return;
    if (currentTurn !== color) return;

    const [row, col] = getActualCoordinates(displayRow, displayCol);
    const piece = board[row][col];
    const isMyPiece = piece && (
      (color === 'white' && piece === piece.toUpperCase()) ||
      (color === 'black' && piece === piece.toLowerCase())
    );

    if (selectedSquare === null) {
      if (isMyPiece) {
        setSelectedSquare([row, col]);
      }
    } else {
      const [fromRow, fromCol] = selectedSquare;
      
      if (fromRow === row && fromCol === col) {
        setSelectedSquare(null);
        return;
      }

      const fromSquare = rowColToSquare(fromRow, fromCol);
      const toSquare = rowColToSquare(row, col);

      const moves = chess.moves({ square: fromSquare, verbose: true });
      const move = moves.find(m => m.to === toSquare);

      if (!move) {
        setSelectedSquare(null);
        return;
      }

      let promotion = null;
      if (move.promotion) {
        promotion = 'q';
      }

      socket.emit('player_move', {
        roomId,
        from: [fromRow, fromCol],
        to: [row, col],
        promotion: promotion
      });

      try {
        const tempChess = new Chess(chess.fen());
        tempChess.move({ from: fromSquare, to: toSquare, promotion: promotion });
        setBoard(chessBoardToArray(tempChess.board()));
        setCurrentTurn(tempChess.turn() === 'w' ? 'white' : 'black');
      } catch (e) {
        setBoard(chessBoardToArray(chess.board()));
      }
      
      setSelectedSquare(null);
    }
  };

  const handleResign = () => {
    if (window.confirm('Are you sure you want to resign?')) {
      socket.emit('resign', { roomId });
      setGameStatus('resigned');
      onGameEnd();
    }
  };

  const handleBackToLobby = () => {
    socket.disconnect();
    socket.connect();
    onGameEnd();
  };

  const flipCoordinate = (row, col) => {
    if (color === 'black') {
      return [7 - row, 7 - col];
    }
    return [row, col];
  };

  const getActualCoordinates = (displayRow, displayCol) => {
    if (color === 'black') {
      return [7 - displayRow, 7 - displayCol];
    }
    return [displayRow, displayCol];
  };

  const getSquareClass = (displayRow, displayCol) => {
    let classes = 'square';
    const [actualRow, actualCol] = getActualCoordinates(displayRow, displayCol);
    if ((actualRow + actualCol) % 2 === 0) {
      classes += ' light';
    } else {
      classes += ' dark';
    }
    if (selectedSquare) {
      const [selectedRow, selectedCol] = flipCoordinate(selectedSquare[0], selectedSquare[1]);
      if (selectedRow === displayRow && selectedCol === displayCol) {
        classes += ' selected';
      }
    }
    return classes;
  };

  const renderPiece = (piece) => {
    if (!piece) return null;
    return <span className="piece">{PIECE_SYMBOLS[piece] || piece}</span>;
  };

  return (
    <div className="game-board-container">
      <video 
        className="game-board-bg-video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      >
        <source src={bgVideo} type="video/mp4" />
      </video>
      <div className="game-board-overlay"></div>
      <div className="game-info">
        <div className="player-info">
          <div className="player-color">
            You are playing as: <strong>{color === 'white' ? 'White' : 'Black'}</strong>
          </div>
          <div className="opponent-info">
            Opponent: {opponent || 'Unknown'}
          </div>
        </div>
        <div className="turn-info">
          {gameStatus === 'playing' && (
            <>
              <div className={`turn-indicator ${currentTurn === color ? 'your-turn' : 'opponent-turn'}`}>
                {currentTurn === color ? 'Your turn' : "Opponent's turn"}
              </div>
              {gameStatusInfo?.isCheck && (
                <div className="check-indicator">⚠️ Check!</div>
              )}
            </>
          )}
          {gameStatus === 'won' && <div className="game-status won">You Won! {gameStatusInfo?.isCheckmate && '(Checkmate)'}</div>}
          {gameStatus === 'lost' && <div className="game-status lost">You Lost! {gameStatusInfo?.isCheckmate && '(Checkmate)'}</div>}
          {gameStatus === 'draw' && <div className="game-status">Draw! {gameStatusInfo?.isStalemate && '(Stalemate)'}</div>}
          {gameStatus === 'resigned' && <div className="game-status">You Resigned</div>}
          {gameStatus === 'opponent_disconnected' && <div className="game-status">Opponent Disconnected</div>}
        </div>
        <div className="game-actions">
          {gameStatus === 'playing' && (
            <button onClick={handleResign} className="resign-btn">
              Resign
            </button>
          )}
          {(gameStatus !== 'playing') && (
            <button onClick={handleBackToLobby} className="back-btn">
              Back to Lobby
            </button>
          )}
        </div>
      </div>
      <div className="board-wrapper">
        <div className="board">
          {(color === 'black' ? [...board].reverse() : board).map((row, displayRowIndex) => {
            const actualRowIndex = color === 'black' ? 7 - displayRowIndex : displayRowIndex;
            const displayRow = color === 'black' ? [...row].reverse() : row;
            return (
              <div key={displayRowIndex} className="board-row">
                {displayRow.map((piece, displayColIndex) => {
                  const actualColIndex = color === 'black' ? 7 - displayColIndex : displayColIndex;
                  return (
                    <div
                      key={displayColIndex}
                      className={getSquareClass(displayRowIndex, displayColIndex)}
                      onClick={() => handleSquareClick(displayRowIndex, displayColIndex)}
                    >
                      {renderPiece(piece)}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GameBoard;

