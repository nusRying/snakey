import { io } from 'socket.io-client';
import { Renderer } from './Renderer';
import { AudioEngine } from './AudioEngine';

export class GameManager {
  constructor(canvas, profile, onGameOver) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new Renderer(this.ctx);
    this.audio = new AudioEngine();
    
    this.profile = profile || { name: 'Player', selectedSkin: 'default' };
    this.onGameOver = onGameOver;
    this.onMutationOffer = arguments[3] || null; // Can be passed as 4th arg or improved constructor
    
    const serverUrl = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' 
      ? 'http://localhost:3000' 
      : window.location.origin);
    
    this.socket = io(serverUrl);
    
    this.state = {
      players: {},
      pellets: {},
      bounds: { width: 3000, height: 3000 }
    };
    
    this.killFeed = []; // Array of kill events
    this.activeEmotes = {}; // { playerId: { emoteId, time } }
    
    this.stateBuffer = []; // Buffer for interpolation
    this.renderDelay = 100; // Render 100ms in the past
    
    this.myId = null;
    this.input = { angle: 0, isBoosting: false, useAbility: false };
    
    this.lastTime = performance.now();
    this.animationFrameId = null;
    
    this.joystick = {
      active: false,
      baseX: 0,
      baseY: 0,
      stickX: 0,
      stickY: 0,
      radius: 60,
      identifier: null
    };

    this.abilityBtn = {
      x: 0, y: 0, radius: 40, active: false, identifier: null
    };

    this.boostBtn = {
      x: 0, y: 0, radius: 40, active: false, identifier: null
    };

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    
    this.setupNetwork();
    this.setupInput();
    this.handleResize();
  }
  
  setupNetwork() {
    // Send our chosen profile immediately
    this.socket.emit('join_game', this.profile);

    this.socket.on('init', (data) => {
      this.myId = data.id;
      this.state.bounds = data.bounds;
      if (data.state) {
        // Assume server time if not provided initially
        data.state.time = data.state.time || Date.now();
        this.stateBuffer.push(data.state);
      }
    });

    this.socket.on('state', (snapshot) => {
      // Ensure time exists
      snapshot.time = snapshot.time || Date.now();
      
      this.stateBuffer.push(snapshot);
      
      // Keep only recent snapshots to save memory
      if (this.stateBuffer.length > 10) {
         this.stateBuffer.shift();
      }
    });

    this.socket.on('kill_event', (eventData) => {
      this.killFeed.push({ ...eventData, time: Date.now() });
      if (this.killFeed.length > 5) {
        this.killFeed.shift(); // Keep only last 5 kills
      }
      if (eventData.killerId === this.myId) {
         if (this.audio) this.audio.play('kill');
      }
    });

    this.socket.on('mutation_offer', (choices) => {
        if (this.onMutationOffer) {
            this.onMutationOffer(choices);
        }
    });

    this.socket.on('emote', ({ playerId, emoteId }) => {
        this.activeEmotes[playerId] = { emoteId, time: Date.now() };
    });

    this.socket.on('died', (stats) => {
        this.audio.playKill(); // Sad sound for death
        setTimeout(() => {
            this.cleanup();
            if (this.onGameOver) this.onGameOver(stats.xpEarned || 0);
        }, 1500);
    });
  }
  
  setupInput() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            if (!this.input.useAbility) this.audio.playAbility();
            this.input.useAbility = true;
            this.socket.emit('input', this.input);
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            this.input.useAbility = false;
            this.socket.emit('input', this.input);
        }
    });
    
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    window.addEventListener('mousedown', () => { this.audio.resume(); this.handleMouseDown(); });
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('resize', this.handleResize);

    // Mobile touch controls
    this.canvas.addEventListener('touchstart', (e) => { this.audio.resume(); this.handleTouchStart(e); }, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
    window.addEventListener('keydown', this.handleKeyDown);
  }
  
  cleanup() {
    this.audio.cleanup();
    this.socket.disconnect();
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  selectMutation(mutationId) {
      if (this.socket) {
          this.socket.emit('evolve', mutationId);
      }
  }

  sendEmote(emoteId) {
      if (this.socket) {
          this.socket.emit('emote', emoteId);
      }
  }

  handleResize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Position mobile buttons
    this.abilityBtn.x = this.canvas.width - 160;
    this.abilityBtn.y = this.canvas.height - 80;

    this.boostBtn.x = this.canvas.width - 70;
    this.boostBtn.y = this.canvas.height - 130;
  }

  handleMouseMove(e) {
    if (!this.myId || !this.state.players[this.myId]) return;
    
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    
    this.input.angle = Math.atan2(dy, dx);
    this.socket.emit('input', this.input);
  }

  handleMouseDown() {
    this.input.isBoosting = true;
    this.socket.emit('input', this.input);
  }

  handleMouseUp() {
    this.input.isBoosting = false;
    this.socket.emit('input', this.input);
  }

  handleTouchStart(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      
      // Check if touch is on Boost button
      const dxB = touch.clientX - this.boostBtn.x;
      const dyB = touch.clientY - this.boostBtn.y;
      if (Math.sqrt(dxB*dxB + dyB*dyB) < this.boostBtn.radius * 1.5) {
          this.boostBtn.active = true;
          this.boostBtn.identifier = touch.identifier;
          this.input.isBoosting = true;
          this.socket.emit('input', this.input);
          continue;
      }
      
      // Check if touch is on Ability button
      const dxA = touch.clientX - this.abilityBtn.x;
      const dyA = touch.clientY - this.abilityBtn.y;
      if (Math.sqrt(dxA*dxA + dyA*dyA) < this.abilityBtn.radius * 1.5) {
          if (!this.abilityBtn.active) this.audio.playAbility();
          this.abilityBtn.active = true;
          this.abilityBtn.identifier = touch.identifier;
          this.input.useAbility = true;
          this.socket.emit('input', this.input);
          continue;
      }

      // Otherwise it's a joystick touch (left side or anywhere else if unassigned)
      if (!this.joystick.active && touch.clientX < this.canvas.width / 2) {
         this.joystick.active = true;
         this.joystick.identifier = touch.identifier;
         this.joystick.baseX = touch.clientX;
         this.joystick.baseY = touch.clientY;
         this.joystick.stickX = touch.clientX;
         this.joystick.stickY = touch.clientY;
      }
    }
  }

  handleKeyDown(e) {
      const emoteKeys = {
          '1': 'COOL',
          '2': 'LOL',
          '3': 'GG',
          '4': 'ANGRY',
          '5': 'SAD',
          '6': 'LOVE'
      };
      
      if (emoteKeys[e.key]) {
          this.sendEmote(emoteKeys[e.key]);
      }
      
      if (e.code === 'Space') {
          this.input.useAbility = true;
          this.socket.emit('input', this.input);
          setTimeout(() => {
              this.input.useAbility = false;
              this.socket.emit('input', this.input);
          }, 100);
      }
  }

  handleTouchMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (this.joystick.active && touch.identifier === this.joystick.identifier) {
            let dx = touch.clientX - this.joystick.baseX;
            let dy = touch.clientY - this.joystick.baseY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > this.joystick.radius) {
                dx = (dx / dist) * this.joystick.radius;
                dy = (dy / dist) * this.joystick.radius;
            }
            
            this.joystick.stickX = this.joystick.baseX + dx;
            this.joystick.stickY = this.joystick.baseY + dy;
            
            this.input.angle = Math.atan2(dy, dx);
            this.socket.emit('input', this.input);
        }
    }
  }

  handleTouchEnd(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        
        if (this.joystick.active && touch.identifier === this.joystick.identifier) {
            this.joystick.active = false;
            this.joystick.identifier = null;
        }
        if (this.boostBtn.active && touch.identifier === this.boostBtn.identifier) {
            this.boostBtn.active = false;
            this.boostBtn.identifier = null;
            this.input.isBoosting = false;
            this.socket.emit('input', this.input);
        }
        if (this.abilityBtn.active && touch.identifier === this.abilityBtn.identifier) {
            this.abilityBtn.active = false;
            this.abilityBtn.identifier = null;
            this.input.useAbility = false;
            this.socket.emit('input', this.input);
        }
    }
  }
  
  start() {
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }
  
  interpolateState() {
     const renderTime = Date.now() - this.renderDelay;
     
     let s0 = null;
     let s1 = null;
     
     // Find the two snapshots wrapping the render time
     for (let i = 0; i < this.stateBuffer.length - 1; i++) {
        if (this.stateBuffer[i].time <= renderTime && this.stateBuffer[i+1].time >= renderTime) {
           s0 = this.stateBuffer[i];
           s1 = this.stateBuffer[i+1];
           break;
        }
     }
     
     if (!s0 && this.stateBuffer.length > 0) {
        // Fallback to latest
        s0 = this.stateBuffer[this.stateBuffer.length - 1];
        s1 = s0;
     }
     
     if (s0 && s1) {
        let t = 0;
        if (s1.time !== s0.time) {
            t = (renderTime - s0.time) / (s1.time - s0.time);
        }
        
        // Cap t just in case
        t = Math.max(0, Math.min(1, t));

        this.state.pellets = s0.pellets;
        
        // Pass BR props
        this.state.stormRadius = s0.stormRadius;
        this.state.stormCenter = s0.stormCenter;
        
        // Pass Team props
        this.state.teamScores = s0.teamScores;
        
        // Pass Hazards
        this.state.blackHoles = s0.blackHoles;
        this.state.wormholes = s0.wormholes;
        
        // Pass King
        this.state.kingId = s0.kingId;

        // Pass PowerUps
        this.state.powerUps = s0.powerUps;
        
        const interpolatedPlayers = {};
        for (const id in s0.players) {
            const p0 = s0.players[id];
            const p1 = s1.players[id];
            
            if (!p1) {
                interpolatedPlayers[id] = p0;
                continue;
            }
            
            // Deep copy to avoid mutating buffer
            const interpPlayer = JSON.parse(JSON.stringify(p0));
            
            interpPlayer.position.x = p0.position.x + (p1.position.x - p0.position.x) * t;
            interpPlayer.position.y = p0.position.y + (p1.position.y - p0.position.y) * t;
            
            for (let j = 0; j < p0.segments.length; j++) {
                if (p1.segments[j]) {
                    interpPlayer.segments[j].x = p0.segments[j].x + (p1.segments[j].x - p0.segments[j].x) * t;
                    interpPlayer.segments[j].y = p0.segments[j].y + (p1.segments[j].y - p0.segments[j].y) * t;
                }
            }
            
            interpolatedPlayers[id] = interpPlayer;
        }
        this.state.players = interpolatedPlayers;
     }
  }

  loop(time) {
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    
    this.interpolateState();

    // Clear the screen (Black background)
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Smooth camera trailing towards the player
    let cameraX = this.state.bounds.width / 2;
    let cameraY = this.state.bounds.height / 2;
    const myPlayer = this.state.players[this.myId];
    
    if (myPlayer) {
       cameraX = myPlayer.position.x;
       cameraY = myPlayer.position.y;
    }
    
    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2 - cameraX, this.canvas.height / 2 - cameraY);
    
    // Render World
    this.renderer.drawGrid(this.state.bounds, cameraX, cameraY, this.canvas.width, this.canvas.height);
    this.renderer.drawBounds(this.state.bounds);
    
    // If storm exists (Battle Royale), draw it
    if (this.state.stormRadius) {
       this.renderer.drawStorm(this.state.stormCenter, this.state.stormRadius, this.state.bounds);
    }
    
    // Draw Environment Hazards
    this.renderer.drawBlackHoles(this.state.blackHoles, time);
    this.renderer.drawWormholes(this.state.wormholes, time);
    
    // Draw Power-Ups
    this.renderer.drawPowerUps(this.state.powerUps, time);
    
    this.renderer.drawPellets(this.state.pellets);
    this.renderer.drawPlayers(this.state.players, this.myId, this.state.kingId, this.activeEmotes);
    
    this.ctx.restore();
    
    if (myPlayer) {
       this.renderer.drawHUD(myPlayer, this.canvas.width, this.canvas.height);
    }
    
    // Clean up old kill feed messages (e.g., > 3 seconds old)
    const now = Date.now();
    this.killFeed = this.killFeed.filter(k => now - k.time < 3000);
    
    // Clean up old emotes (> 2 seconds old)
    for (const pid in this.activeEmotes) {
        if (now - this.activeEmotes[pid].time > 2000) {
            delete this.activeEmotes[pid];
        }
    }

    this.renderer.drawLeaderboard(this.state.players, this.myId);
    
    if (this.state.teamScores) {
        this.renderer.drawTeamScores(this.state.teamScores, this.canvas.width);
    }
    
    this.renderer.drawKillFeed(this.killFeed, this.canvas.width);
    this.renderer.drawMinimap(this.state.players, this.myId, this.state.bounds, this.canvas.width, this.canvas.height);
    
    // Draw Mobile UI if touch is used (Checking if window.matchMedia('(pointer: coarse)').matches could also work, but we'll always draw if joystick active or buttons needed on small screens)
    if (window.innerWidth < 1000) {
        this.renderer.drawMobileUI(this.joystick, this.boostBtn, this.abilityBtn);
    }

    this.animationFrameId = requestAnimationFrame(this.loop);
  }
}
