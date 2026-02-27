import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import Lobby from './components/Lobby';
import { ProfileManager } from './game/ProfileManager';
import './index.css';

function App() {
  const [profile, setProfile] = useState(null);
  const [lastMatchStats, setLastMatchStats] = useState(null);

  const handlePlay = (loadedProfile) => {
    setProfile(loadedProfile);
    setLastMatchStats(null);
  };

  const handleGameOver = (xpEarned) => {
     const result = ProfileManager.addXP(xpEarned);
     setProfile(null);
     setLastMatchStats({
        xpEarned,
        leveledUp: result.leveledUp,
        newLevel: result.newLevel
     });
  };

  return (
    <div className="game-container">
      {!profile ? (
         <Lobby onPlay={handlePlay} lastMatchStats={lastMatchStats} />
      ) : (
         <GameCanvas profile={profile} onGameOver={handleGameOver} />
      )}
    </div>
  );
}

export default App;
