import React, { useState } from 'react';

const OptionsScreen = ({ audio, onBack }) => {
  const [masterVol, setMasterVol] = useState(Math.round(audio.masterVolume * 100));
  const [sfxVol, setSfxVol] = useState(Math.round(audio.sfxVolume * 100));
  const [enabled, setEnabled] = useState(audio.enabled);

  const handleMasterChange = (e) => {
    const v = parseInt(e.target.value);
    setMasterVol(v);
    audio.setMasterVolume(v / 100);
  };

  const handleSfxChange = (e) => {
    const v = parseInt(e.target.value);
    setSfxVol(v);
    audio.setSfxVolume(v / 100);
    audio.playEat(); // Feedback
  };

  const handleToggle = () => {
    const newState = !enabled;
    setEnabled(newState);
    audio.setEnabled(newState);
  };

  return (
    <div className="menu-screen options-screen">
      <div className="glass-card">
        <h2>OPTIONS</h2>
        
        <div className="option-row">
          <label>MASTER VOLUME</label>
          <input 
            type="range" 
            min="0" max="100" 
            value={masterVol} 
            onChange={handleMasterChange} 
          />
          <span>{masterVol}%</span>
        </div>
        
        <div className="option-row">
          <label>SFX VOLUME</label>
          <input 
            type="range" 
            min="0" max="100" 
            value={sfxVol} 
            onChange={handleSfxChange} 
          />
          <span>{sfxVol}%</span>
        </div>
        
        <div className="option-row toggle-row">
          <label>SOUND ENABLED</label>
          <button 
            className={`toggle-btn ${enabled ? 'on' : 'off'}`} 
            onClick={handleToggle}
          >
            {enabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>
        
        <button className="menu-btn secondary back-btn" onClick={onBack}>BACK</button>
      </div>
    </div>
  );
};

export default OptionsScreen;
