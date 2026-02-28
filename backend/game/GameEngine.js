const { WorldState } = require('./WorldState');
const { QuadTree } = require('./QuadTree');
const { BotController } = require('./BotController');
const Database = require('./Database');

const MUTATIONS = {
    'WINGED': { name: 'Winged', description: '+15% Speed', bonus: { type: 'speed', value: 1.15 } },
    'MAGNETIC': { name: 'Magnetic', description: '+100% Magnet Range', bonus: { type: 'magnetRadius', value: 2.0 } },
    'GLUTTON': { name: 'Glutton', description: '+25% Mass from Pellets', bonus: { type: 'massGain', value: 1.25 } },
    'THICK_SKIN': { name: 'Thick Skin', description: '-30% Boost Drain', bonus: { type: 'boostEfficiency', value: 0.7 } },
    'HUNTER': { name: 'Hunter', description: '+50% Mass from Kills', bonus: { type: 'killBonus', value: 1.5 } }
};

const POWER_UPS = {
    'SHIELD': { name: 'Invincibility', color: '#00ffff', duration: 10000 },
    'MAGNET': { name: 'Super Magnet', color: '#ff00ff', duration: 12000 },
    'FRENZY': { name: 'Frenzy Mode', color: '#ff0000', duration: 8000 },
    'GHOST': { name: 'Ghost Mode', color: '#ffffff', duration: 10000 }
};

class GameEngine {
  constructor(io, roomId) {
    this.io = io;
    this.roomId = roomId; // Make emit localized to room name
    this.world = new WorldState();
    this.tickRate = 20; // Server tick rate (20Hz)
    this.tickInterval = 1000 / this.tickRate;
    this.lastTick = Date.now();
    this.inputs = {}; // Stores latest player inputs
    this.botController = new BotController(this);
    
    // Battle Royale specific State
    this.isBattleRoyale = (roomId === 'BATTLE_ROYALE');
    this.matchState = this.isBattleRoyale ? 'PLAYING' : 'FFA'; // WAITING, PLAYING, FINISHED
    this.stormRadius = 2500; // Starts big
    this.stormCenter = { x: this.world.bounds.width / 2, y: this.world.bounds.height / 2 };
    
    // Team Match specific State
    this.isTeamMatch = (roomId === 'TEAM_MATCH');
    this.teamScores = { 'RED': 0, 'BLUE': 0 };
    
    // Initial pellet cluster
    this.world.spawnPellets(500);
    
    this.powerUpSpawnTimer = 0;
  }

  start() {
    setInterval(() => this.tick(), this.tickInterval);
  }

  async addPlayer(socket, profile) {
        const p = profile || {};
        
        // Load stats from DB
        let dbUser = { xp: 0, level: 1, total_kills: 0, max_mass: 0 };
        try {
            await Database.ensureUser(p.name || 'Snek');
            const row = await Database.getUser(p.name || 'Snek');
            if (row) dbUser = row;
        } catch (err) {
            console.error('DB Error on join:', err);
        }

        // Attach DB stats to world player
        p.dbStats = dbUser;
        // Resolve baseColor from skin ID
        const skinMap = {
            'default': '#00ffcc',
            'neon_pink': '#ff00ff',
            'tiger': '#ff8800',
            'ghost': '#ffffff',
            'gold': '#ffd700'
        };
        p.baseColor = skinMap[p.selectedSkin] || '#00ffcc';
        
        this.world.addPlayer(socket.id, p);
        console.log(`Spawned player ${p.name}`);
        
        socket.on('evolve', (mutationId) => {
          this.handleEvolve(socket.id, mutationId);
        });

        socket.on('emote', (emoteId) => {
          this.io.to(this.roomId).emit('emote', { playerId: socket.id, emoteId });
        });

        socket.on('disconnect', () => {
          this.removePlayer(socket.id);
        });
        
        socket.emit('init', {
          id: socket.id,
          bounds: this.world.bounds,
          state: this.world.getFullSnapshot()
        });
  }

  removePlayer(id) {
    this.world.removePlayer(id);
    delete this.inputs[id];
  }

  handleInput(id, data) {
    this.inputs[id] = data;
  }

  die(id, killerId) {
    const player = this.world.players[id];
    if (!player) return;

    // Drop mass as pellets (Reduced to 15% for performance)
    const dropCount = Math.floor(player.mass / 6); 
    const pelletLifetime = 30000; // 30 seconds
    const expiresAt = Date.now() + pelletLifetime;

    for (let i = 0; i < dropCount; i++) {
        let spawnPos = player.position;
        if (player.segments.length > 0) {
            spawnPos = player.segments[Math.floor(Math.random() * player.segments.length)];
        }
        
        const pelletId = this.world.pelletIdCounter++;
        this.world.pellets[pelletId] = {
            id: pelletId,
            x: spawnPos.x + (Math.random() * 60 - 30),
            y: spawnPos.y + (Math.random() * 60 - 30),
            value: 5, 
            color: player.color,
            expiresAt: expiresAt // Add expiration
        };
        this.world.pelletUpdates.added.push(this.world.pellets[pelletId]);
    }

    if (killerId && this.world.players[killerId]) {
        // Check if the victim was the King
        const victimWasKing = this.world.kingId === id;
        const killBonus = victimWasKing ? 1000 : 500;
        const massBonus = victimWasKing ? 100 : 0;
        
        let multiplier = 1.0;
        if (this.world.players[killerId].mutations && this.world.players[killerId].mutations.killBonus) {
            multiplier = this.world.players[killerId].mutations.killBonus;
        }

        this.world.players[killerId].score += Math.floor(killBonus * multiplier);
        this.world.players[killerId].mass += Math.floor(massBonus * multiplier);

        this.io.to(this.roomId).emit('kill_event', { 
            killerId: killerId, 
            victimId: id,
            killerName: this.world.players[killerId].name, // Pass names
            victimName: victimWasKing ? "THE KING" : player.name,
            killerMass: Math.floor(this.world.players[killerId].mass),
            victimMass: Math.floor(player.mass)
        });
        
        // Track kill for the database
        this.world.players[killerId].matchKills = (this.world.players[killerId].matchKills || 0) + 1;
    }

    // Broadcast death location for particles
    this.io.to(this.roomId).emit('player_death', {
        id: id,
        x: player.position.x,
        y: player.position.y,
        color: player.color
    });

    // 1 mass = 1 XP, plus overall score accumulation
    const xpEarned = Math.floor(player.score + player.mass);
    const matchKills = player.matchKills || 0;
    
    // Save to Database asynchronously for REAL PLAYERS (Not bots)
    if (!id.startsWith('bot_') && player.name) {
       Database.saveMatchData(player.name, xpEarned, matchKills, Math.floor(player.mass))
           .then(({newXp, newLevel}) => {
                this.io.to(id).emit('died', { xpEarned, dbXp: newXp, dbLevel: newLevel });
           })
           .catch(err => {
               console.error("Failed to save match data", err);
               this.io.to(id).emit('died', { xpEarned });
           });
    } else {
       this.io.to(id).emit('died', { xpEarned });
    }
    
    this.removePlayer(id);
  }

  handleEvolve(id, mutationId) {
      const player = this.world.players[id];
      if (!player || player.mutationPoints <= 0) return;
      
      const mutation = MUTATIONS[mutationId];
      if (!mutation) return;
      
      // Apply mutation
      player.mutationPoints--;
      player.mutations.active.push(mutationId);
      
      const bonus = mutation.bonus;
      if (bonus.type === 'speed') player.mutations.speed *= bonus.value;
      if (bonus.type === 'magnetRadius') player.mutations.magnetRadius *= bonus.value;
      if (bonus.type === 'massGain') player.mutations.massGain *= bonus.value;
      if (bonus.type === 'boostEfficiency') player.mutations.boostEfficiency = (player.mutations.boostEfficiency || 1) * bonus.value;
      if (bonus.type === 'killBonus') player.mutations.killBonus = (player.mutations.killBonus || 1) * bonus.value;
      
      console.log(`Player ${player.name} evolved: ${mutationId}`);
  }

  spawnPowerUp() {
      const types = Object.keys(POWER_UPS);
      const type = types[Math.floor(Math.random() * types.length)];
      const id = this.world.powerUpIdCounter++;
      this.world.powerUps[id] = {
          id,
          type,
          x: Math.random() * (this.world.bounds.width - 200) + 100,
          y: Math.random() * (this.world.bounds.height - 200) + 100,
          radius: 25,
          color: POWER_UPS[type].color
      };
  }

  tick() {
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    const playerCount = Object.keys(this.world.players).length;
    if (playerCount > 0 && Math.random() < 0.01) {
        console.log(`[DEBUG] Tick running. Room: ${this.roomId}, Players: ${playerCount}, Pellets: ${Object.keys(this.world.pellets).length}`);
    }

    // 1. Build QuadTrees
    const qBounds = { x: 0, y: 0, width: this.world.bounds.width, height: this.world.bounds.height };
    const pelletTree = new QuadTree(qBounds, 10);
    const bodyTree = new QuadTree(qBounds, 10);

    for (const id in this.world.pellets) {
        const p = this.world.pellets[id];
        pelletTree.insert({ x: p.x, y: p.y, pelletId: id, radius: p.value });
    }

    for (const id in this.world.players) {
        const p = this.world.players[id];
        for (const seg of p.segments) {
            bodyTree.insert({ x: seg.x, y: seg.y, playerId: id, radius: p.radius });
        }
    }

    // 2. AI Controllers make their moves (Now with awareness of the world trees)
    this.botController.update(pelletTree, bodyTree);

    const deadPlayers = [];

    // Process players
    for (const id in this.world.players) {
      const player = this.world.players[id];
      const input = this.inputs[id] || { angle: 0, isBoosting: false, useAbility: false };

      // Ability logic
      if (player.ability.cooldown > 0) {
         player.ability.cooldown -= dt * 1000;
      }
      if (player.ability.isActive && player.ability.duration > 0) {
         player.ability.duration -= dt * 1000;
         if (player.ability.duration <= 0) {
            player.ability.isActive = false;
         }
      }

      if (input.useAbility && player.ability.cooldown <= 0) {
         player.ability.isActive = true;
         player.ability.duration = player.ability.maxDuration;
         player.ability.cooldown = player.ability.maxCooldown;
      }

      // Update Power-Up Timers
      for (const type in player.activePowerUps) {
          player.activePowerUps[type] -= dt * 1000;
          if (player.activePowerUps[type] <= 0) {
              delete player.activePowerUps[type];
          }
      }

      let currentSpeed = 150; // base speed
      
      // Mutations and King logic
      if (player.mutations) {
          currentSpeed *= player.mutations.speed || 1.0;
      }
      if (player.activePowerUps['FRENZY']) {
          currentSpeed *= 1.5;
      }
      if (this.world.kingId === id) {
          currentSpeed *= 0.9; // 10% slower
      }
      
      // Handle Boost and Dash
      if (player.ability.isActive && player.ability.type === 'DASH') {
        currentSpeed = 450;
        player.isBoosting = true;
        // Dash doesn't drain mass, it's a cooldown ability
      } else if (input.isBoosting && player.mass > 50) {
        currentSpeed = 300;
        player.isBoosting = true;
        const drain = 10 * dt * (player.mutations.boostEfficiency || 1.0);
        player.mass -= drain; 
        player.score += drain / 2; // small pity score for boosting 
        
        if (Math.random() < 0.2 && player.segments.length > 0) {
           const tail = player.segments[player.segments.length - 1];
           const pelletId = this.world.pelletIdCounter++;
           this.world.pellets[pelletId] = {
             id: pelletId,
             x: tail.x + (Math.random() * 20 - 10),
             y: tail.y + (Math.random() * 20 - 10),
             value: 3,
             color: player.color
           };
        }
      } else {
        player.isBoosting = false;
      }

      // Handle Steering (Turn Rate Limit)
      // Base turn speed: ~5 radians per second (generous)
      // Larger snakes turn slower: base / (1 + mass/500)
      const baseTurnSpeed = 5 * (player.mutations.turnSpeed || 1.0);
      const massTurnFactor = 1 + (player.mass - 50) / 1000;
      const maxTurnDelta = (baseTurnSpeed / massTurnFactor) * dt;
      
      let angleDiff = input.angle - (player.angle || 0);
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      
      const actualTurn = Math.max(-maxTurnDelta, Math.min(maxTurnDelta, angleDiff));
      player.angle = (player.angle || 0) + actualTurn;
      
      // Update velocity based on limited angle
      player.velocity.x = Math.cos(player.angle) * currentSpeed;
      player.velocity.y = Math.sin(player.angle) * currentSpeed;

      player.position.x += player.velocity.x * dt;
      player.position.y += player.velocity.y * dt;

      // Hard Boundary collisions (die if hit wall)
      if (
        player.position.x <= player.radius || 
        player.position.x >= this.world.bounds.width - player.radius ||
        player.position.y <= player.radius || 
        player.position.y >= this.world.bounds.height - player.radius
      ) {
         console.log(`[DEBUG] Player ${player.name} (${id}) DIED: Hit wall at ${Math.round(player.position.x)},${Math.round(player.position.y)}`);
         deadPlayers.push({ id, killerId: null });
         continue; 
      }

      // Battle Royale Storm Damage
      if (this.isBattleRoyale) {
          const distToCenter = Math.sqrt(Math.pow(player.position.x - this.stormCenter.x, 2) + Math.pow(player.position.y - this.stormCenter.y, 2));
          if (distToCenter > this.stormRadius) {
              player.mass -= 20 * dt; // Rapidly lose mass in the storm
              if (player.mass <= 10) {
                 deadPlayers.push({ id, killerId: null }); // Storm killed them
                 continue; // Skip rest of loop for this dead player
              }
          }
      }
      
      // King passive pellet drop
      if (this.world.kingId === id && Math.random() < 0.05) {
          const dropPos = player.segments.length > 0 ? player.segments[player.segments.length - 1] : player.position;
          const pelletId = this.world.pelletIdCounter++;
          this.world.pellets[pelletId] = {
             id: pelletId,
             x: dropPos.x + (Math.random() * 20 - 10),
             y: dropPos.y + (Math.random() * 20 - 10),
             value: 8, // Very high
             color: '#FFD700' // Gold
          };
      }
      
      // Black Hole Physics
      let suckedIn = false;
      for (const bh of this.world.blackHoles) {
          const dx = bh.x - player.position.x;
          const dy = bh.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < bh.radius + player.radius) {
              // Destroy player
              deadPlayers.push({ id, killerId: null });
              suckedIn = true;
              break;
          } else if (dist < bh.pullRadius) {
              // Pull player in
              const pullFactor = 1 - (dist / bh.pullRadius);
              player.position.x += (dx / dist) * bh.pullStrength * pullFactor * dt;
              player.position.y += (dy / dist) * bh.pullStrength * pullFactor * dt;
          }
      }
      if (suckedIn) continue;
      
      // Wormhole Teleportation
      for (const wh of this.world.wormholes) {
          const dx = wh.x - player.position.x;
          const dy = wh.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < wh.radius + player.radius) {
              // Only teleport if cooldown allows (prevent infinite ping-pong)
              if (!player.lastTeleport || Date.now() - player.lastTeleport > 2000) {
                  const targetWH = this.world.wormholes.find(w => w.id === wh.targetId);
                  if (targetWH) {
                      player.position.x = targetWH.x;
                      player.position.y = targetWH.y;
                      player.lastTeleport = Date.now();
                      
                      // Also move head segments roughly
                      if (player.segments.length > 0) {
                         player.segments[0].x = targetWH.x;
                         player.segments[0].y = targetWH.y;
                      }
                  }
              }
          }
      }

       // 3. Hazard & PowerUp Collisions
       // Hazards handled earlier in loop
       
       // PowerUps
       for (const puId in this.world.powerUps) {
           const pu = this.world.powerUps[puId];
           const dx = pu.x - player.position.x;
           const dy = pu.y - player.position.y;
           const dist = Math.sqrt(dx * dx + dy * dy);
           if (dist < player.radius + pu.radius) {
               player.activePowerUps[pu.type] = POWER_UPS[pu.type].duration;
               delete this.world.powerUps[puId];
               this.io.to(id).emit('powerup_pickup', pu.type);
           }
       }

      this.updateSegments(player);
      
      const targetSegments = Math.floor(player.mass / 5);
      if (player.segments.length < targetSegments) {
         const tail = player.segments.length > 0 ? player.segments[player.segments.length - 1] : player.position;
         player.segments.push({ x: tail.x, y: tail.y });
      } else if (player.segments.length > targetSegments && player.segments.length > 5) {
         player.segments.pop();
      }

      // Update player radius slightly based on mass (caps at 30)
       player.radius = Math.min(30, 10 + Math.sqrt(player.mass));

       // Check Mutation Milestones (Every 100 mass)
       const nextMilestone = player.lastMilestone + 100;
       if (player.mass >= nextMilestone) {
           player.lastMilestone = nextMilestone;
           player.mutationPoints++;
           
           if (!id.startsWith('bot_')) {
               // Send 3 random choices to the player
               const keys = Object.keys(MUTATIONS);
               const shuffled = keys.sort(() => 0.5 - Math.random());
               const choices = shuffled.slice(0, 3).map(k => ({ id: k, ...MUTATIONS[k] }));
               this.io.to(id).emit('mutation_offer', choices);
           } else {
               // Auto-evolve bots
               const keys = Object.keys(MUTATIONS);
               const randomKey = keys[Math.floor(Math.random() * keys.length)];
               this.handleEvolve(id, randomKey);
           }
       }

       // 1. Pellet Collisions & Magnet Ability
       const magnetMult = (player.mutations.magnetRadius || 1.0) * (player.activePowerUps['MAGNET'] ? 3.0 : 1.0);
       const queryRange = { 
           x: player.position.x, 
           y: player.position.y, 
           radius: player.radius + (player.ability.isActive && player.ability.type === 'MAGNET' ? 150 * magnetMult : 10 * magnetMult) 
       };
       const nearbyPellets = pelletTree.query(queryRange);
       
       for (const p of nearbyPellets) {
           const pellet = this.world.pellets[p.pelletId];
           if (!pellet) continue;

           const dx = pellet.x - player.position.x;
           const dy = pellet.y - player.position.y;
           const dist = Math.sqrt(dx * dx + dy * dy);
           
           if (dist < player.radius + p.radius) {
              console.log(`[DEBUG] Player ${player.name} EATING pellet ${p.pelletId}. New Mass: ${player.mass + pellet.value}`);
              let gain = pellet.value * (player.mutations.massGain || 1.0);
              if (player.activePowerUps['FRENZY']) gain *= 1.5;
              player.mass += gain;
              player.score += gain;
              this.world.removePellet(p.pelletId);
           } else if (player.ability.isActive && player.ability.type === 'MAGNET') {
              // Pull pellet towards player
              pellet.x -= (dx / dist) * 200 * dt;
              pellet.y -= (dy / dist) * 200 * dt;
              this.world.markPelletMoved(pellet);
           }
       }

      // 2. Body Collisions (Head against other players' bodies)
      const nearbyBodies = bodyTree.query(queryRange);
      let hit = false;
      let killerId = null;
      
      const isShielded = (player.ability.isActive && player.ability.type === 'SHIELD') || player.activePowerUps['SHIELD'];
      const isGhost = player.activePowerUps['GHOST'];

      if (!isShielded && !isGhost) {
          for (const b of nearbyBodies) {
              if (b.playerId === id) continue; // Don't collide with self
    
              const dx = b.x - player.position.x;
              const dy = b.y - player.position.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist < player.radius + b.radius) {
                  hit = true;
                  killerId = b.playerId;
                  break; // Head hit someone else's body
              }
          }
      }

      if (hit) {
          deadPlayers.push({ id, killerId });
      }
    }

    // Process deaths
    for (const death of deadPlayers) {
        // Shield powerup prevents death from body collision (but not hazards/storm/king)
        const victim = this.world.players[death.id];
        if (victim && victim.activePowerUps['SHIELD'] && death.killerId) {
            continue; // Immune to being eaten
        }
        this.die(death.id, death.killerId);
    }

    // Replenish pellets
    if (Object.keys(this.world.pellets).length < 200) {
        this.world.spawnPellets(100);
    }

    // Pellet Cleanup (Despawn dropped pellets)
    for (const pid in this.world.pellets) {
        const p = this.world.pellets[pid];
        if (p.expiresAt && now > p.expiresAt) {
            this.world.removePellet(pid);
        }
    }

    // Spawn Power-Ups
    this.powerUpSpawnTimer += dt;
    if (this.powerUpSpawnTimer >= 15 && Object.keys(this.world.powerUps).length < 5) {
        this.spawnPowerUp();
        this.powerUpSpawnTimer = 0;
    }

    if (this.isBattleRoyale && this.matchState === 'PLAYING') {
        // Shrink storm ring over time, minimum radius 100
        this.stormRadius = Math.max(100, this.stormRadius - (5 * dt)); 
        this.world.stormRadius = this.stormRadius; // Ensure clients get it
        this.world.stormCenter = this.stormCenter;
        
        // Check for winner
        const aliveHumans = Object.values(this.world.players).filter(p => !p.id.startsWith('bot_'));
        const totalAlive = Object.keys(this.world.players).length;
        
        // If 1 or 0 humans left, and total alive is small enough, declare game over
        if (totalAlive <= 1) {
             this.matchState = 'FINISHED';
             // Boot everyone and restart room in 10 seconds
             setTimeout(() => {
                 this.stormRadius = 2500;
                 this.matchState = 'PLAYING';
                 this.world = new WorldState();
                 this.world.spawnPellets(500);
             }, 10000);
        }
    }
    
    if (this.isTeamMatch) {
       this.teamScores = { 'RED': 0, 'BLUE': 0 };
       for (const id in this.world.players) {
           const p = this.world.players[id];
           if (p.team) {
               this.teamScores[p.team] += Math.floor(p.mass);
           }
       }
       this.world.teamScores = this.teamScores;
    }
    
    // Recalculate King
    let maxMass = 0;
    let newKingId = null;
    for (const id in this.world.players) {
        if (this.world.players[id].mass > maxMass) {
            maxMass = this.world.players[id].mass;
            newKingId = id;
        }
    }
    this.world.kingId = newKingId;

    // 7. Emit State (Lag optimized - pellets omitted)
    this.io.to(this.roomId).emit('state', this.world.getSnapshot());

    // 8. Emit Pellet Deltas
    const pelletDeltas = this.world.getPelletUpdate();
    if (pelletDeltas.added.length > 0 || pelletDeltas.removed.length > 0) {
        this.io.to(this.roomId).emit('pellet_update', pelletDeltas);
    }
  }

  updateSegments(player) {
    // slightly smaller than head radius for clean overlap
    const minDistance = player.radius * 0.8; 
    let prev = player.position;

    for (let i = 0; i < player.segments.length; i++) {
      const seg = player.segments[i];
      const dx = prev.x - seg.x;
      const dy = prev.y - seg.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > minDistance) {
        const moveDist = dist - minDistance;
        const angle = Math.atan2(dy, dx);
        seg.x += Math.cos(angle) * moveDist;
        seg.y += Math.sin(angle) * moveDist;
      }
      prev = seg;
    }
  }
}

module.exports = { GameEngine };
