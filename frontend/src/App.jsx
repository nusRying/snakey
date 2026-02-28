import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import Lobby from './components/Lobby';
import { ProfileManager } from './game/ProfileManager';
import { AudioEngine } from './game/AudioEngine';
import TitleScreen from './components/TitleScreen';
import OptionsScreen from './components/OptionsScreen';
import HelpScreen from './components/HelpScreen';
import './index.css';

// Singleton audio engine shared across screens
const audioEngine = new AudioEngine();

function App() {
  const [screen, setScreen] = useState('title');
  const [profile, setProfile] = useState(null);
  const [lastMatchStats, setLastMatchStats] = useState(null);

  const handlePlayFromTitle = (mode) => {
    audioEngine.resume();
    audioEngine.startAmbient();
    if (mode === 'offline') {
        // Jump straight to game with offline profile
        const offlineProfile = ProfileManager.getProfile();
        offlineProfile.mode = 'OFFLINE';
        setProfile(offlineProfile);
        setScreen('game');
    } else {
        setScreen('lobby');
    }
  };

  const handlePlayFromLobby = (loadedProfile) => {
    console.log('App: handlePlay triggered with profile:', loadedProfile);
    loadedProfile.mode = 'FFA'; // Multiplayer default
    setProfile(loadedProfile);
    setLastMatchStats(null);
    setScreen('game');
  };

  const handleGameOver = (xpEarned) => {
     const result = ProfileManager.addXP(xpEarned);
     setProfile(null);
     setLastMatchStats({
        xpEarned,
        leveledUp: result.leveledUp,
        newLevel: result.newLevel
     });
     setScreen('lobby');
  };

  return (
    <div className="game-container">
      {screen === 'title' && (
        <TitleScreen 
          onPlay={handlePlayFromTitle} 
          onOptions={() => setScreen('options')} 
          onHelp={() => setScreen('help')} 
        />
      )}
      
      {screen === 'options' && (
        <OptionsScreen 
          audio={audioEngine} 
          onBack={() => setScreen('title')} 
        />
      )}
      
      {screen === 'help' && (
        <HelpScreen 
          onBack={() => setScreen('title')} 
        />
      )}

      {screen === 'lobby' && (
         <Lobby onPlay={handlePlayFromLobby} lastMatchStats={lastMatchStats} />
      )}
      
      {screen === 'game' && profile && (
         <GameCanvas profile={profile} onGameOver={handleGameOver} />
      )}
    </div>
  );
}


export default App;
