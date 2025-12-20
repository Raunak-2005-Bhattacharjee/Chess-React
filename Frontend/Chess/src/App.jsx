import { useState } from 'react';
import { WaitingRoom, GameBoard } from './components';
import './App.css';

function App() {
  const [gameData, setGameData] = useState(null);

  const handleMatchFound = (data) => {
    setGameData(data);
  };

  const handleGameEnd = () => {
    setGameData(null);
  };

  return (
    <div className="app">
      {!gameData ? (
        <WaitingRoom onMatchFound={handleMatchFound} />
      ) : (
        <GameBoard gameData={gameData} onGameEnd={handleGameEnd} />
      )}
    </div>
  );
}

export default App;
