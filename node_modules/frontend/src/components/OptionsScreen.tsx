import React, { useState } from 'react';

type AudioLike = {
  masterVolume: number;
  sfxVolume: number;
  enabled: boolean;
  voiceEnabled?: boolean;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setEnabled: (enabled: boolean) => void;
  setVoiceEnabled?: (enabled: boolean) => void;
  playEat: () => void;
  announce?: (text: string) => void;
};

type OptionsScreenProps = {
  audio: AudioLike;
  performancePreset: 'adaptive' | 'ultra';
  onPerformancePresetChange: (preset: 'adaptive' | 'ultra') => void;
  onBack: () => void;
};

const OptionsScreen = ({ audio, performancePreset, onPerformancePresetChange, onBack }: OptionsScreenProps) => {
  const [masterVol, setMasterVol] = useState(Math.round(audio.masterVolume * 100));
  const [sfxVol, setSfxVol] = useState(Math.round(audio.sfxVolume * 100));
  const [enabled, setEnabled] = useState(audio.enabled);
  const [voiceEnabled, setVoiceEnabled] = useState(Boolean(audio.voiceEnabled ?? true));
  const soundStateLabel = enabled ? 'Enabled' : 'Muted';
  const ultraSmoothEnabled = performancePreset === 'ultra';

  const handleMasterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    setMasterVol(v);
    audio.setMasterVolume(v / 100);
  };

  const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    setSfxVol(v);
    audio.setSfxVolume(v / 100);
    audio.playEat();
  };

  const handleToggle = () => {
    const newState = !enabled;
    setEnabled(newState);
    audio.setEnabled(newState);
  };

  const handleVoiceToggle = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    audio.setVoiceEnabled?.(next);
    if (next) {
      audio.announce?.('Voice system online.');
    }
  };

  const handlePerformanceToggle = () => {
    const nextPreset = ultraSmoothEnabled ? 'adaptive' : 'ultra';
    onPerformancePresetChange(nextPreset);
    audio.announce?.(
      nextPreset === 'ultra' ? 'Ultra smooth mobile enabled.' : 'Adaptive visuals restored.'
    );
  };

  return (
    <div className="menu-screen options-screen">
      <div className="glass-card options-card">
        <div className="screen-kicker">System Tuning</div>
        <h2>OPTIONS</h2>
        <p className="options-intro">
          Dial in the mix before you drop. These settings affect the current session immediately.
        </p>

        <div className="options-status-bar">
          <div className="options-status-pill">
            <span>Master</span>
            <strong>{masterVol}%</strong>
          </div>
          <div className="options-status-pill">
            <span>SFX</span>
            <strong>{sfxVol}%</strong>
          </div>
          <div className={`options-status-pill ${enabled ? 'is-live' : 'is-muted'}`}>
            <span>System</span>
            <strong>{soundStateLabel}</strong>
          </div>
          <div className={`options-status-pill ${voiceEnabled ? 'is-live' : 'is-muted'}`}>
            <span>Voice</span>
            <strong>{voiceEnabled ? 'Active' : 'Off'}</strong>
          </div>
          <div className={`options-status-pill ${ultraSmoothEnabled ? 'is-live' : 'is-muted'}`}>
            <span>Render</span>
            <strong>{ultraSmoothEnabled ? 'Ultra Smooth' : 'Adaptive'}</strong>
          </div>
        </div>

        <div className="option-row">
          <label>MASTER VOLUME</label>
          <input type="range" min="0" max="100" value={masterVol} onChange={handleMasterChange} aria-label="Master Volume" />
          <span>{masterVol}%</span>
        </div>

        <div className="option-row">
          <label>SFX VOLUME</label>
          <input type="range" min="0" max="100" value={sfxVol} onChange={handleSfxChange} aria-label="SFX Volume" />
          <span>{sfxVol}%</span>
        </div>

        <div className="option-row toggle-row">
          <label className="option-label-emphasis">SOUND SYSTEM</label>
          <button className={`toggle-btn ${enabled ? 'on' : 'off'}`} onClick={handleToggle}>
            {enabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        <div className="option-row toggle-row">
          <label className="option-label-emphasis">ANNOUNCER VOICE</label>
          <button className={`toggle-btn ${voiceEnabled ? 'on' : 'off'}`} onClick={handleVoiceToggle}>
            {voiceEnabled ? 'ACTIVE' : 'DISABLED'}
          </button>
        </div>

        <div className="option-row toggle-row">
          <label className="option-label-emphasis">ULTRA SMOOTH MOBILE</label>
          <button className={`toggle-btn ${ultraSmoothEnabled ? 'on' : 'off'}`} onClick={handlePerformanceToggle}>
            {ultraSmoothEnabled ? 'LOCKED' : 'ADAPTIVE'}
          </button>
        </div>

        <p className="options-intro">
          Ultra Smooth forces the lightest mobile render path and tighter network detail capping for dense bot matches.
        </p>

        <button className="menu-btn secondary back-btn" onClick={onBack}>
          BACK
        </button>
      </div>
    </div>
  );
};

export default OptionsScreen;
