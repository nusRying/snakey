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
    
    console.log('GameManager: Connecting to backend at', serverUrl);
    this.socket = io(serverUrl, { reconnection: true, reconnectionDelay: 1000, reconnectionAttempts: 5 });
    
    // Socket connection event handlers for diagnostics
    this.socket.on('connect', () => {
      console.log('GameManager: Socket connected, ID:', this.socket.id);
    });
    this.socket.on('disconnect', (reason) => {
      console.warn('GameManager: Socket disconnected, reason:', reason);
    });
    this.socket.on('connect_error', (error) => {
      console.error('GameManager: Socket connection error:', error);
    });
    
    this.state = {
      players: {},
      pellets: {},
      bounds: { width: 3000, height: 3000 }
    };
    
    this.killFeed = []; 
    this.activeEmotes = {}; 
    this.screenShake = 0; 
    this.particles = []; // Array of {x, y, vx, vy, life, color}
    this.deathParticles = []; // Array of {x, y, vx, vy, life, color, size}
    this.powerUpPickups = []; // Array of {x, y, color, startTime}
    
    this.stateBuffer = []; 
    this.renderDelay = 150; 
    this.serverClockOffset = 0;
    this.hasSyncedClock = false;
    this.currentLag = 0;
    
    this.myId = null;
    this.input = { angle: 0, isBoosting: false, useAbility: false };
    this.inputDirty = false;
    this.lastInputEmit = 0;
    
    this.lastTime = performance.now();
    this.animationFrameId = null;
    this.loopCount = 0;
    this.loopError = null;
    
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
    console.log('GameManager: setupNetwork called, emitting join_game event');
    // Send our chosen profile immediately
    this.socket.emit('join_game', this.profile);

    this.socket.on('init', (data) => {
      console.log('GameManager: received init event, myId:', data.id);
      this.myId = data.id;
      this.state.bounds = data.bounds;
      if (data.state) {
        // Assume server time if not provided initially
        data.state.time = data.state.time || Date.now();
        this.stateBuffer.push(data.state);
        if (data.state.pellets) {
            this.state.pellets = data.state.pellets;
        }
      }
    });

    this.socket.on('pellet_update', ({ added, removed, moved }) => {
       if (added) {
           added.forEach(p => { this.state.pellets[p.id] = p; });
       }
       if (removed) {
           let playedEat = false;
           removed.forEach(id => { 
               if (this.state.pellets[id] && !playedEat) {
                   if (this.audio) this.audio.playEat();
                   playedEat = true; // Avoid overlapping sounds in same frame
               }
               delete this.state.pellets[id]; 
           });
       }
       if (moved) {
           moved.forEach(p => {
               if (this.state.pellets[p.id]) {
                   this.state.pellets[p.id].x = p.x;
                   this.state.pellets[p.id].y = p.y;
               }
           });
       }
    });

    this.socket.on('state', (snapshot) => {
      const now = Date.now();
      if (!this.hasSyncedClock) {
          this.serverClockOffset = now - snapshot.time;
          this.hasSyncedClock = true;
          console.log('GameManager: Synced clock, offset:', this.serverClockOffset);
      }
      
      // Calculate network lag for diagnostics (time since last packet)
      this.currentLag = now - (snapshot.time + this.serverClockOffset);
      
      if (this.stateBuffer.length === 0) {
          const samplePlayer = Object.values(snapshot.players)[0];
          console.log('GameManager: Received first snapshot. Player count:', Object.keys(snapshot.players).length, 'Sample player:', samplePlayer);
      }
      this.stateBuffer.push(snapshot);
      
      if (this.stateBuffer.length > 50) {
         this.stateBuffer.shift();
      }
    });

    this.socket.on('kill_event', (eventData) => {
      this.killFeed.push({ ...eventData, time: Date.now() });
      if (this.killFeed.length > 5) {
        this.killFeed.shift(); // Keep only last 5 kills
      }
      if (eventData.killerId === this.myId) {
         if (this.audio) this.audio.playKill();
         this.screenShake = 15; // Big shake for your own kills
      } else {
         this.screenShake = 5; // Smaller shake for others
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

    this.socket.on('player_death', (data) => {
        const count = 15; // Optimized count
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200 + 50;
            this.deathParticles.push({
                x: data.x,
                y: data.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 3 + 2,
                color: data.color || '#ff0055',
                life: 1.0
            });
        }
        
        // Play sound for everyone if near camera
        if (this.audio && this.audio.playDeath) {
            // Optional: Distance check could go here
            this.audio.playDeath();
        }
    });

    this.socket.on('died', (stats) => {
        // Personal game over logic only
        setTimeout(() => {
            this.cleanup();
            if (this.onGameOver) this.onGameOver(stats.xpEarned || 0);
        }, 1500);
    });
  }
  
  setupInput() {
    this._keydownHandler = (e) => {
        if (e.code === 'Space') {
            if (!this.input.useAbility) this.audio.playAbility();
            this.input.useAbility = true;
            this.socket.emit('input', this.input);
        }
        this.handleKeyDown(e);
    };
    this._keyupHandler = (e) => {
        if (e.code === 'Space') {
            this.input.useAbility = false;
            this.socket.emit('input', this.input);
        }
    };
    this._mousedownHandler = () => { this.audio.resume(); this.handleMouseDown(); };
    this._touchstartHandler = (e) => { this.audio.resume(); this.handleTouchStart(e); };

    window.addEventListener('keydown', this._keydownHandler);
    window.addEventListener('keyup', this._keyupHandler);
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    window.addEventListener('mousedown', this._mousedownHandler);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('resize', this.handleResize);

    // Mobile touch controls
    this.canvas.addEventListener('touchstart', this._touchstartHandler, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
  }
  
  cleanup() {
    if (this.audio) this.audio.cleanup();
    if (this.socket) this.socket.disconnect();
    cancelAnimationFrame(this.animationFrameId);
    
    window.removeEventListener('keydown', this._keydownHandler);
    window.removeEventListener('keyup', this._keyupHandler);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this._mousedownHandler);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('resize', this.handleResize);
    
    if (this.canvas) {
        this.canvas.removeEventListener('touchstart', this._touchstartHandler);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        this.canvas.removeEventListener('touchcancel', this.handleTouchEnd);
    }
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
    this.inputDirty = true;
  }

  handleMouseDown() {
    this.input.isBoosting = true;
    this.inputDirty = true;
  }

  handleMouseUp() {
    this.input.isBoosting = false;
    this.inputDirty = true;
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
          this.inputDirty = true;
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
          this.inputDirty = true;
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
            this.inputDirty = true;
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
            this.inputDirty = true;
        }
        if (this.abilityBtn.active && touch.identifier === this.abilityBtn.identifier) {
            this.abilityBtn.active = false;
            this.abilityBtn.identifier = null;
            this.input.useAbility = false;
            this.inputDirty = true;
        }
    }
  }
  
  start() {
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }
  
  interpolateState() {
     if (this.stateBuffer.length < 2) return;

     // Calculate the local time in "server world"
     const renderTime = (Date.now() - this.serverClockOffset) - this.renderDelay;
     
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
     
     // Fallback if we have run out of buffer (renderTime is newer than latest snapshot)
     if (!s0) {
        s0 = this.stateBuffer[this.stateBuffer.length - 1];
        s1 = s0;
     }
     
     if (s0 && s1) {
        let t = 0;
        if (s1.time !== s0.time) {
            t = (renderTime - s0.time) / (s1.time - s0.time);
        }
        t = Math.max(0, Math.min(1, t));

        // Copy primitive values directly
        if (s0.pellets) this.state.pellets = s0.pellets;
        this.state.stormRadius = s0.stormRadius;
        this.state.stormCenter = s0.stormCenter;
        this.state.teamScores = s0.teamScores;
        this.state.blackHoles = s0.blackHoles;
        this.state.wormholes = s0.wormholes;
        this.state.kingId = s0.kingId;
        this.state.powerUps = s0.powerUps;
        this.state.bounds = s0.bounds;
        
        const interpolatedPlayers = {};
        for (const id in s0.players) {
            const p0 = s0.players[id];
            const p1 = s1.players[id];
            
            if (!p1) {
                interpolatedPlayers[id] = p0;
                continue;
            }
            
            // Track growth pulse locally
            const oldPlayer = this.state.players[id];
            let pulse = oldPlayer ? (oldPlayer.pulse || 0) : 0;
            if (oldPlayer && p0.mass > oldPlayer.mass) {
                pulse = 1.0; // Trigger pulse on mass gain
            }
            pulse *= 0.9; // Fade pulse
            if (pulse < 0.01) pulse = 0;

            // Create a pseudo-deep copy for interpolation without heavy JSON calls
            const interpPlayer = { 
                ...p0,
                pulse: pulse,
                position: {
                    x: p0.position.x + (p1.position.x - p0.position.x) * t,
                    y: p0.position.y + (p1.position.y - p0.position.y) * t
                },
                segments: p0.segments.map((seg, idx) => {
                    const nextSeg = p1.segments[idx];
                    if (nextSeg) {
                        return {
                            x: seg.x + (nextSeg.x - seg.x) * t,
                            y: seg.y + (nextSeg.y - seg.y) * t
                        };
                    }
                    return seg;
                })
            };
            
            interpolatedPlayers[id] = interpPlayer;

            // Emit particles if boosting
            if (p0.isBoosting && Math.random() < 0.2) {
                this.particles.push({
                    x: p0.position.x,
                    y: p0.position.y,
                    vx: (Math.random() - 0.5) * 50,
                    vy: (Math.random() - 0.5) * 50,
                    life: 1.0,
                    color: p0.color
                });
            }
        }
        
        this.state.players = interpolatedPlayers;
        
        // Detect power-up pickups
        if (s0.powerUps && this.state.powerUps) {
            for (const id in this.state.powerUps) {
                if (!s0.powerUps[id]) {
                    const pu = this.state.powerUps[id];
                    this.powerUpPickups.push({
                        x: pu.x,
                        y: pu.y,
                        color: pu.type === 'MAGNET' ? '#00f2ff' : (pu.type === 'SHIELD' ? '#ffdf00' : '#ff003c'),
                        startTime: Date.now()
                    });
                    if (this.audio && typeof this.audio.playPowerUp === 'function') {
                        this.audio.playPowerUp();
                    }
                }
            }
        }

        // Update particles
        this.particles.forEach(p => {
            p.x += p.vx * 0.05;
            p.y += p.vy * 0.05;
            p.life -= 0.05;
        });
        this.particles = this.particles.filter(p => p.life > 0);
    }
  }

  loop(time) {
    try {
      this.loopCount++;
      const dt = (time - this.lastTime) / 1000;
      this.lastTime = time;
    
    // Throttle input emission to roughly 20Hz (every 50ms) to prevent freezing the socket map
    if (this.inputDirty && time - this.lastInputEmit > 50) {
        if (this.socket) {
            this.socket.emit('input', this.input);
        }
        this.inputDirty = false;
        this.lastInputEmit = time;
    }
    
    this.interpolateState();

    const myPlayer = this.state.players[this.myId];
    const camX = myPlayer ? myPlayer.position.x : this.state.bounds.width / 2;
    const camY = myPlayer ? myPlayer.position.y : this.state.bounds.height / 2;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    
    // --- Apply Screen Shake ---
    if (this.screenShake > 0) {
        const sx = (Math.random() - 0.5) * this.screenShake;
        const sy = (Math.random() - 0.5) * this.screenShake;
        this.ctx.translate(sx, sy);
        this.screenShake *= 0.9;
        if (this.screenShake < 0.1) this.screenShake = 0;
    }
    
    this.ctx.translate(this.canvas.width / 2 - camX, this.canvas.height / 2 - camY);
    
    // Render World
    this.renderer.drawGrid(this.state.bounds, camX, camY, this.canvas.width, this.canvas.height);
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
    
    this.renderer.drawPellets(this.state.pellets, camX, camY, this.canvas.width, this.canvas.height);
    this.renderer.drawPlayers(this.state.players, this.myId, this.state.kingId, camX, camY, this.canvas.width, this.canvas.height, this.activeEmotes);
    
    // Render Particles
    this.renderer.drawDeathExplosion(this.deathParticles);
    
    this.powerUpPickups.forEach(pu => {
        const age = (now - pu.startTime) / 1000;
        this.renderer.drawPowerUpPickup(pu.x, pu.y, pu.color, age);
    });
    this.powerUpPickups = this.powerUpPickups.filter(pu => (now - pu.startTime) < 500);

    // Boost Particles with culling
    const margin = 100;
    const minX = camX - this.canvas.width / 2 - margin;
    const maxX = camX + this.canvas.width / 2 + margin;
    const minY = camY - this.canvas.height / 2 - margin;
    const maxY = camY + this.canvas.height / 2 + margin;

    this.particles.forEach(p => {
        if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
            p.life -= 0.02; // Still age them
            return;
        }
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = p.life;
        this.ctx.fill();
        p.life -= 0.02;
    });
    this.particles = this.particles.filter(p => p.life > 0);
    this.ctx.globalAlpha = 1.0;

    // Update death particles
    this.deathParticles.forEach(p => {
        p.x += p.vx * 0.016; 
        p.y += p.vy * 0.016;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= 0.01;
    });
    this.deathParticles = this.deathParticles.filter(p => p.life > 0);

    this.ctx.restore();
    
    if (myPlayer) {
       this.renderer.drawHUD(
           myPlayer, 
           this.canvas.width, 
           this.canvas.height, 
           Object.keys(this.state.players).length, 
           Object.keys(this.state.pellets).length, 
           this.currentLag, 
           this.renderDelay
       );
       
       // Draw Diagnostics
       this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
       this.ctx.fillRect(10, this.canvas.height - 60, 250, 50);
       this.ctx.fillStyle = this.stateBuffer.length < 3 ? '#ff0000' : '#00ff00';
       this.ctx.font = '12px Courier New';
       this.ctx.textAlign = 'left';
       this.ctx.fillText(`${this.loopCount % 2 === 0 ? '●' : '○'} LOOP: ${this.loopCount} | BUF: ${this.stateBuffer.length} | LAG: ${this.currentLag}ms`, 20, this.canvas.height - 40);
       this.ctx.fillText(`ID: ${this.myId} | POS: ${Math.round(myPlayer.position.x)},${Math.round(myPlayer.position.y)}`, 20, this.canvas.height - 25);
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
    } catch (err) {
      console.error("CRITICAL GAME LOOP ERROR:", err);
      this.loopError = err;
      // Re-throw if it's non-rendering related or if we want to stop
      // but usually we want to stop and show the error on canvas
      this.drawErrorOverlay(err);
    }
  }

  drawErrorOverlay(err) {
      this.ctx.fillStyle = 'rgba(150, 0, 0, 0.9)';
      this.ctx.fillRect(50, 50, this.canvas.width - 100, this.canvas.height - 100);
      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 5;
      this.ctx.strokeRect(50, 50, this.canvas.width - 100, this.canvas.height - 100);
      
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 24px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText("CRITICAL LOOP ERROR!", this.canvas.width/2, 100);
      
      this.ctx.font = '16px monospace';
      this.ctx.textAlign = 'left';
      const lines = (err.stack || err.message).split('\n');
      lines.slice(0, 20).forEach((line, i) => {
          this.ctx.fillText(line, 80, 150 + i * 20);
      });
  }
}
