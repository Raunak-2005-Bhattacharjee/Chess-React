import { useState, useEffect } from 'react';
import socket from '../socket';
import bgVideo from '../assets/Bg1.mp4';
import './WaitingRoom.css';

function WaitingRoom({ onMatchFound }) {
  const [nickname, setNickname] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [status, setStatus] = useState('');
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.on('match_found', (data) => {
      setIsWaiting(false);
      setStatus('');
      onMatchFound(data);
    });

    socket.on('waiting', (data) => {
      setStatus(data.message);
    });

    socket.on('error', (data) => {
      setStatus(`Error: ${data.message}`);
      setIsWaiting(false);
    });

    return () => {
      socket.off('match_found');
      socket.off('waiting');
      socket.off('error');
    };
  }, [onMatchFound]);

  const handleFindGame = () => {
    if (isWaiting) return;
    
    setIsWaiting(true);
    setStatus('Connecting...');
    
    socket.emit('join_waiting', {
      nickname: nickname || undefined
    });
  };

  return (
    <div className="waiting-room">
      <video 
        className="waiting-room-bg-video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onError={() => setVideoError(true)}
      >
        <source src={bgVideo} type="video/mp4" />
      </video>
      <div className="waiting-room-overlay"></div>
      <h1>Chess Game</h1>
      <div className="waiting-room-content">
        <div className="input-group">
          <label htmlFor="nickname">Nickname:</label>
          <input
            id="nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your nickname"
            disabled={isWaiting}
          />
        </div>
        <button 
          onClick={handleFindGame} 
          disabled={isWaiting}
          className="find-game-btn"
        >
          {isWaiting ? 'Finding Game...' : 'Find Game'}
        </button>
        {status && (
          <div className="status-message">
            {status}
          </div>
        )}
        {isWaiting && (
          <div className="spinner">⏳</div>
        )}
      </div>
    </div>
  );
}

export default WaitingRoom;

