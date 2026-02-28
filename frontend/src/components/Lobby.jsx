import React, { useState, useEffect } from 'react';
import { ProfileManager, SKINS } from '../game/ProfileManager';

const Lobby = ({ onPlay, lastMatchStats }) => {
  // start with a valid profile synchronously to avoid a "stuck" loading state
  const initialProfile = ProfileManager.getProfile();
  const [profile, setProfile] = useState(initialProfile);
  const [nameInput, setNameInput] = useState(initialProfile.name);
  const [modeInput, setModeInput] = useState('FFA');
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  
  useEffect(() => {
    console.log('Lobby: useEffect triggered');
    // profile already initialized, but we may want to refresh it in case storage changed
    try {
      const loaded = ProfileManager.getProfile();
      console.log('Lobby: profile loaded in effect', loaded);
      setProfile(loaded);
      setNameInput(loaded.name);
    } catch (err) {
      console.error('Lobby: failed to load profile in effect', err);
    }

    // Fetch Global Leaderboard from SQLite API
    fetch(window.location.hostname === 'localhost' ? 'http://localhost:3000/api/leaderboard' : '/api/leaderboard')
        .then(res => res.json())
        .then(data => setGlobalLeaderboard(data))
        .catch(err => console.error("Failed to fetch leaderboard", err));
  }, []);

  // profile should never be falsy; show an error if somehow it is
  if (!profile) return (
    <div style={{
      color:'black', backgroundColor: 'yellow', padding: '20px', 
      fontSize:'32px', zIndex: 9999, position: 'fixed', top: '120px', left: '20px'
    }}>
      LOBBY: UNABLE TO LOAD PROFILE. Try clearing localStorage and reloading.
    </div>
  );


  console.log('Lobby: profile is', profile);
  let progress = { currentLevel: 0, percent: 0, xpIntoLevel: 0, xpRequired: 0 };
  try {
    if (profile) {
        progress = ProfileManager.getLevelProgress(profile.xp || 0);
    }
  } catch (err) {
    console.error("CRASH in ProfileManager.getLevelProgress:", err);
    return <div style={{color: 'red', background: 'white', padding: '50px'}}>CRASH IN XP CALC: {err.message}</div>;
  }


  const handlePlay = () => {
    profile.name = nameInput || 'Snek';
    profile.mode = modeInput; // inject chosen mode
    ProfileManager.saveProfile(profile);
    onPlay(profile);
  };

  const handleSkinSelect = (skinId) => {
    if (profile.unlockedSkins.includes(skinId)) {
        profile.selectedSkin = skinId;
        ProfileManager.saveProfile(profile);
        setProfile({...profile}); // force re-render
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: '#0a0a0a', color: 'white',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: 'rgba(20, 20, 30, 0.8)', padding: '40px', borderRadius: '15px',
        boxShadow: '0 0 30px rgba(0, 255, 204, 0.2)', textAlign: 'center', maxWidth: '500px', width: '90%'
      }}>


        <h1 style={{ color: '#00ffcc', textShadow: '0 0 10px #00ffcc', marginBottom: '10px' }}>SNAKEY.IO</h1>
        
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '5px 0' }}>Level <strong style={{ color: '#ff0055', fontSize: '1.2em' }}>{progress.currentLevel}</strong></p>
          <div style={{ width: '100%', height: '10px', background: '#333', borderRadius: '5px', overflow: 'hidden' }}>
             <div style={{ width: `${progress.percent}%`, height: '100%', background: '#00ffcc', transition: 'width 1s ease-out' }} />
          </div>
          <p style={{ fontSize: '0.8em', color: '#888', marginTop: '5px' }}>{Math.floor(progress.xpIntoLevel)} / {progress.xpRequired} XP to next level</p>
        </div>

        {lastMatchStats && (
            <div style={{ padding: '10px', background: 'rgba(0, 255, 204, 0.1)', border: '1px solid #00ffcc', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#00ffcc' }}>Match Complete!</h3>
                <p style={{ margin: 0 }}>Gained <strong style={{color: 'white'}}>+{lastMatchStats.xpEarned} XP</strong></p>
                {lastMatchStats.leveledUp && (
                   <div style={{ marginTop: '5px', color: '#ff00ff', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>LEVEL UP! Reached Lv {lastMatchStats.newLevel}</div>
                )}
            </div>
        )}

        <input 
          type="text"  
          value={nameInput} 
          onChange={(e) => setNameInput(e.target.value.substring(0, 15))}
          placeholder="Enter Nickname"
          style={{
             width: '80%', padding: '12px', fontSize: '1.1em', borderRadius: '8px',
             border: '2px solid #555', background: '#222', color: 'white',
             textAlign: 'center', marginBottom: '10px', outline: 'none'
          }}
        />
        <button
          onClick={() => {
            const fresh = ProfileManager.resetProfile();
            setProfile(fresh);
            setNameInput(fresh.name);
            setModeInput('FFA');
          }}
          style={{
            marginTop: '10px', padding: '8px 12px', fontSize: '0.9em',
            background: '#aa0000', color: 'white', border: 'none', borderRadius: '6px',
            cursor: 'pointer'
          }}
        >Reset Profile</button>

        <select 
            value={modeInput}
            onChange={(e) => setModeInput(e.target.value)}
            style={{
                width: '80%', padding: '12px', fontSize: '1.1em', borderRadius: '8px',
                border: '2px solid #ff00cc', background: '#222', color: '#ff00cc',
                textAlign: 'center', marginBottom: '20px', outline: 'none', cursor: 'pointer', appearance: 'none'
            }}
        >
            <option value="FFA">Free-For-All (Endless)</option>
            <option value="BATTLE_ROYALE">Battle Royale</option>
            <option value="TEAM_MATCH">Team Deathmatch</option>
        </select>

        <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#aaa', marginBottom: '10px' }}>Select Skin</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px'}}>
                {SKINS.map(skin => {
                    const isUnlocked = profile.unlockedSkins.includes(skin.id);
                    const isSelected = profile.selectedSkin === skin.id;
                    
                    return (
                        <div 
                           key={skin.id}
                           onClick={() => isUnlocked && handleSkinSelect(skin.id)}
                           style={{
                               padding: '10px 15px',
                               borderRadius: '8px',
                               border: `2px solid ${isSelected ? '#00ffcc' : (isUnlocked ? '#555' : '#222')}`,
                               background: isSelected ? 'rgba(0, 255, 204, 0.1)' : '#1a1a24',
                               cursor: isUnlocked ? 'pointer' : 'not-allowed',
                               opacity: isUnlocked ? 1 : 0.5,
                               transition: 'all 0.2s'
                           }}
                        >
                           <div style={{ 
                               width: '20px', height: '20px', borderRadius: '50%', background: skin.baseColor,
                               margin: '0 auto 5px auto', boxShadow: `0 0 10px ${skin.baseColor}`
                           }}></div>
                           <span style={{ fontSize: '0.8em' }}>{skin.name}</span>
                           {!isUnlocked && <div style={{ fontSize: '0.7em', color: '#ff0055', marginTop: '2px' }}>Lv {skin.requiredLevel}</div>}
                        </div>
                    );
                })}
            </div>
        </div>

        <button 
           onClick={handlePlay}
           style={{
               padding: '15px 40px', fontSize: '1.2em', fontWeight: 'bold', borderRadius: '30px',
               border: 'none', background: 'linear-gradient(45deg, #00ffcc, #0088ff)',
               color: '#fff', cursor: 'pointer', boxShadow: '0 5px 15px rgba(0, 136, 255, 0.4)',
               transition: 'transform 0.1s', marginBottom: '30px'
           }}
           onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
           onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
           PLAY
        </button>

        {globalLeaderboard.length > 0 && (
            <div style={{ width: '100%', background: 'rgba(0,0,0,0.5)', padding: '15px', borderRadius: '10px', textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#ffd700', textAlign: 'center' }}>Global Top 10 Hunters</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', borderBottom: '1px solid #444', paddingBottom: '5px', marginBottom: '5px', fontSize: '0.8em', color: '#888' }}>
                    <span>Rank</span><span>Name</span><span>Level</span><span style={{textAlign: 'right'}}>Total XP</span>
                </div>
                {globalLeaderboard.map((lb, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', padding: '3px 0', fontSize: '0.9em' }}>
                        <span style={{color: idx < 3 ? '#ffd700' : '#888'}}>#{idx + 1}</span>
                        <span style={{color: lb.name === profile.name ? '#00ffcc' : 'white'}}>{lb.name}</span>
                        <span>Lv {lb.level}</span>
                        <span style={{textAlign: 'right'}}>{lb.xp.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
