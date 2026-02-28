class WorldState {
  constructor() {
    this.players = {};
    this.pellets = {};
    this.bounds = { width: 3000, height: 3000 };
    this.pelletIdCounter = 0;
    
    // Hazards
    this.blackHoles = this.generateBlackHoles(3);
    this.wormholes = this.generateWormholes(2); // 2 pairs
    this.powerUps = {};
    this.powerUpIdCounter = 0;
    
    this.pelletUpdates = { added: [], removed: [] };
  }

  generateBlackHoles(count) {
      const bh = [];
      for (let i = 0; i < count; i++) {
          bh.push({
              x: Math.random() * (this.bounds.width - 400) + 200,
              y: Math.random() * (this.bounds.height - 400) + 200,
              radius: 40,
              pullRadius: 300,
              pullStrength: 150 // Pull speed per second
          });
      }
      return bh;
  }
  
  generateWormholes(pairs) {
      const wh = [];
      for (let i = 0; i < pairs; i++) {
          const w1 = {
              id: `wh_${i}_A`,
              x: Math.random() * (this.bounds.width - 200) + 100,
              y: Math.random() * (this.bounds.height - 200) + 100,
              radius: 40,
              targetId: `wh_${i}_B`,
              color: `hsl(${~~(Math.random() * 360)}, 100%, 60%)`
          };
          const w2 = {
              id: `wh_${i}_B`,
              x: Math.random() * (this.bounds.width - 200) + 100,
              y: Math.random() * (this.bounds.height - 200) + 100,
              radius: 40,
              targetId: `wh_${i}_A`,
              color: w1.color
          };
          wh.push(w1, w2);
      }
      return wh;
  }

  addPlayer(id, profile = {}) {
    // Random safe spawn position
    this.players[id] = {
      id,
      name: profile.name || 'Snek',
      skin: profile.selectedSkin || 'default',
      position: {
        x: Math.random() * this.bounds.width,
        y: Math.random() * this.bounds.height,
      },
      velocity: { x: 0, y: 0 },
      mass: 50, // Base mass
      radius: 12, // Starting radius for collision
      segments: [],
      score: 0,
      isBoosting: false,
      color: profile.baseColor || `hsl(${~~(Math.random() * 360)}, 100%, 60%)`,
      ability: {
        type: ['DASH', 'SHIELD', 'MAGNET'][Math.floor(Math.random() * 3)],
        isActive: false,
        cooldown: 0,
        maxCooldown: 5000,
        duration: 0,
        maxDuration: 2000,
      },
      mutations: {
        speed: 1, // multiplier
        magnetRadius: 1, // multiplier
        massGain: 1, // multiplier
        turnSpeed: 1, // multiplier
        active: []
      },
      mutationPoints: 0,
      lastMilestone: 0,
      activePowerUps: {} // { type: timeRemaining }
    };

    // Initialize default body segments
    const p = this.players[id];
    for (let i = 0; i < 5; i++) {
      p.segments.push({ x: p.position.x, y: p.position.y });
    }
  }

  removePlayer(id) {
    delete this.players[id];
  }

  spawnPellets(count) {
    for (let i = 0; i < count; i++) {
      const id = this.pelletIdCounter++;
        const p = {
          id,
          x: Math.random() * this.bounds.width,
          y: Math.random() * this.bounds.height,
          value: 2,
          color: `hsl(${~~(Math.random() * 360)}, 100%, 75%)`,
        };
        this.pellets[id] = p;
        this.pelletUpdates.added.push(p);
      }
    }
  
    removePellet(id) {
      if (this.pellets[id]) {
          this.pelletUpdates.removed.push(id);
          delete this.pellets[id];
      }
    }

    getPelletUpdate() {
        const update = { ...this.pelletUpdates };
        this.pelletUpdates = { added: [], removed: [] }; // Reset
        return update;
    }
  
    getSnapshot() {
      return {
      time: Date.now(),
      players: this.players,
      bounds: this.bounds,
      blackHoles: this.blackHoles,
      wormholes: this.wormholes,
      kingId: this.kingId,
      powerUps: this.powerUps
    };
  }

  getFullSnapshot() {
      return {
          ...this.getSnapshot(),
          pellets: this.pellets
      };
  }
}

class Player {
    constructor(id, bounds) {
       this.id = id;
       this.name = 'Bot';
       this.skin = 'default';
       this.position = { x: Math.random() * bounds.width, y: Math.random() * bounds.height };
       this.velocity = { x: 0, y: 0 };
       this.mass = 50;
       this.radius = 12;
       this.segments = [];
       this.score = 0;
       this.isBoosting = false;
       this.color = `hsl(${~~(Math.random() * 360)}, 100%, 60%)`;
       this.angle = Math.random() * Math.PI * 2;
       this.ability = {
         type: ['DASH', 'SHIELD', 'MAGNET'][Math.floor(Math.random() * 3)],
          isActive: false, cooldown: 0, maxCooldown: 5000, duration: 0, maxDuration: 2000
        };
        this.mutations = {
          speed: 1,
          magnetRadius: 1,
          massGain: 1,
          turnSpeed: 1,
          active: []
        };
        this.mutationPoints = 0;
        this.lastMilestone = 0;
        this.activePowerUps = {};
        for (let i=0; i<5; i++) this.segments.push({x: this.position.x, y: this.position.y});
    }
}

module.exports = { WorldState, Player };
