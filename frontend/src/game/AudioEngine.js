export class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Default values
    this.enabled = true;
    this.sfxVolume = 1.0;
    this.masterVolume = 0.3;
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    
    this.loadSettings();

    this.ambientOsc = null;
    this.ambientGain = null;
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('snakey_audio_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.enabled = settings.enabled ?? true;
        this.sfxVolume = settings.sfxVolume ?? 1.0;
        this.masterVolume = settings.masterVolume ?? 0.3;
        this.masterGain.gain.value = this.masterVolume;
      } else {
        this.masterGain.gain.value = this.masterVolume;
      }
    } catch (e) {
      console.warn('AudioEngine: Failed to load settings', e);
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  saveSettings() {
    try {
      localStorage.setItem('snakey_audio_settings', JSON.stringify({
        enabled: this.enabled,
        sfxVolume: this.sfxVolume,
        masterVolume: this.masterVolume
      }));
    } catch (e) {
      console.warn('AudioEngine: Failed to save settings', e);
    }
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playEat() {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.5 * this.sfxVolume, this.ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playBoost() {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(0.1 * this.sfxVolume, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playAbility() {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, this.ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playKill() {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.8 * this.sfxVolume, this.ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  playDeath() {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.8);
    
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.6 * this.sfxVolume, this.ctx.currentTime + 0.1);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.8);
  }

  playPowerUp() {
    if (!this.enabled) return;
    const now = this.ctx.currentTime;
    
    // Arpeggio effect
    [600, 800, 1200].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0, now + i * 0.05);
        gain.gain.linearRampToValueAtTime(0.3 * this.sfxVolume, now + i * 0.05 + 0.02);
        gain.gain.linearRampToValueAtTime(0, now + i * 0.05 + 0.2);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.2);
    });
  }

  startAmbient() {
    if (this.ambientOsc) return;
    this.ambientOsc = this.ctx.createOscillator();
    this.ambientGain = this.ctx.createGain();
    
    this.ambientOsc.type = 'triangle';
    this.ambientOsc.frequency.setValueAtTime(50, this.ctx.currentTime);
    
    this.ambientGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.ambientGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 2);
    
    this.ambientOsc.connect(this.ambientGain);
    this.ambientGain.connect(this.masterGain);
    
    this.ambientOsc.start();
  }

  stopAmbient() {
    if (this.ambientGain) {
        this.ambientGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
        setTimeout(() => {
            if (this.ambientOsc) {
                this.ambientOsc.stop();
                this.ambientOsc = null;
                this.ambientGain = null;
            }
        }, 1100);
    }
  }

  setMasterVolume(v) {
    this.masterVolume = v;
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    this.saveSettings();
  }

  setSfxVolume(v) {
    this.sfxVolume = v;
    this.saveSettings();
  }

  setEnabled(bool) {
    this.enabled = bool;
    if (!bool) this.stopAmbient();
    else if (this.ctx.state === 'running') this.startAmbient();
    this.saveSettings();
  }

  cleanup() {
    this.stopAmbient();
    setTimeout(() => {
        if (this.ctx && this.ctx.state !== 'closed') {
            this.ctx.close();
        }
    }, 1200);
  }
}

