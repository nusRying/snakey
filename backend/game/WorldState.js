class WorldState {
  constructor(options = {}) {
    this.config = {
      bounds: { width: 3000, height: 3000 },
      blackHoleCount: 3,
      wormholePairs: 2,
      pelletSpawnCount: 500,
      ...options,
      bounds: {
        width: 3000,
        height: 3000,
        ...((options && options.bounds) || {}),
      },
    };
    this.players = {};
    this.pellets = {};
    this.bounds = { ...this.config.bounds };
    this.pelletIdCounter = 0;
    this.obstacles = this.generateObstacles(this.config.obstacles || []);

    // Hazards
    this.blackHoles = this.generateBlackHoles(this.config.blackHoleCount);
    this.wormholes = this.generateWormholes(this.config.wormholePairs);
    this.powerUps = {};
    this.powerUpIdCounter = 0;

    this.pelletUpdates = { added: [], removed: [], moved: [] };
    this.movedPelletIds = new Set();
  }

  generateObstacles(obstacles) {
    return (obstacles || []).map((obstacle, index) => ({
      id: obstacle.id || `obstacle_${index}`,
      x: obstacle.x,
      y: obstacle.y,
      width: obstacle.width,
      height: obstacle.height,
      style: obstacle.style || 'maze_wall',
    }));
  }

  isCircleCollidingObstacle(position, radius = 0, obstacle, padding = 0) {
    const nearestX = Math.max(obstacle.x - padding, Math.min(position.x, obstacle.x + obstacle.width + padding));
    const nearestY = Math.max(obstacle.y - padding, Math.min(position.y, obstacle.y + obstacle.height + padding));
    const dx = position.x - nearestX;
    const dy = position.y - nearestY;
    return dx * dx + dy * dy < (radius + padding) * (radius + padding);
  }

  isPositionBlocked(position, radius = 0, padding = 0, extraCircles = []) {
    for (const obstacle of this.obstacles) {
      if (this.isCircleCollidingObstacle(position, radius, obstacle, padding)) {
        return true;
      }
    }

    const circles = [
      ...(this.blackHoles || []).map((bh) => ({ x: bh.x, y: bh.y, radius: bh.radius + 120 })),
      ...(this.wormholes || []).map((wh) => ({ x: wh.x, y: wh.y, radius: wh.radius + 80 })),
      ...extraCircles,
    ];

    return circles.some((circle) => {
      const dx = position.x - circle.x;
      const dy = position.y - circle.y;
      const totalRadius = radius + circle.radius + padding;
      return dx * dx + dy * dy < totalRadius * totalRadius;
    });
  }

  getSafeSpawnPosition(radius = 12, margin = 180, extraCircles = []) {
    const minX = margin;
    const maxX = Math.max(margin + 1, this.bounds.width - margin);
    const minY = margin;
    const maxY = Math.max(margin + 1, this.bounds.height - margin);

    for (let attempt = 0; attempt < 40; attempt++) {
      const position = {
        x: Math.random() * (maxX - minX) + minX,
        y: Math.random() * (maxY - minY) + minY,
      };

      if (!this.isPositionBlocked(position, radius, 24, extraCircles)) {
        return position;
      }
    }

    const step = Math.max(90, radius * 4);
    for (let y = minY; y <= maxY; y += step) {
      for (let x = minX; x <= maxX; x += step) {
        const position = { x, y };
        if (!this.isPositionBlocked(position, radius, 24, extraCircles)) {
          return position;
        }
      }
    }

    return {
      x: Math.max(minX, Math.min(maxX, margin + radius)),
      y: Math.max(minY, Math.min(maxY, margin + radius)),
    };
  }

  generateBlackHoles(count) {
    const bh = [];
    for (let i = 0; i < count; i++) {
      const position = this.getSafeSpawnPosition(40, 260, bh.map((hole) => ({ x: hole.x, y: hole.y, radius: hole.pullRadius })));
      bh.push({
        x: position.x,
        y: position.y,
        radius: 40,
        pullRadius: 300,
        pullStrength: 150, // Pull speed per second
      });
    }
    return bh;
  }

  generateWormholes(pairs) {
    const wh = [];
    for (let i = 0; i < pairs; i++) {
      const firstPosition = this.getSafeSpawnPosition(40, 180, wh.map((entry) => ({ x: entry.x, y: entry.y, radius: 220 })));
      const w1 = {
        id: `wh_${i}_A`,
        x: firstPosition.x,
        y: firstPosition.y,
        radius: 40,
        targetId: `wh_${i}_B`,
        color: `hsl(${~~(Math.random() * 360)}, 100%, 60%)`,
      };
      const secondPosition = this.getSafeSpawnPosition(40, 180, [
        ...wh.map((entry) => ({ x: entry.x, y: entry.y, radius: 220 })),
        { x: w1.x, y: w1.y, radius: 260 },
      ]);
      const w2 = {
        id: `wh_${i}_B`,
        x: secondPosition.x,
        y: secondPosition.y,
        radius: 40,
        targetId: `wh_${i}_A`,
        color: w1.color,
      };
      wh.push(w1, w2);
    }
    return wh;
  }

  addPlayer(id, profile = {}) {
    // Random safe spawn position
    const spawnPosition = this.getSafeSpawnPosition(12, 220);
    const spawnShieldMs = Number(profile.spawnShieldMs) > 0 ? Number(profile.spawnShieldMs) : 0;
    this.players[id] = {
      id,
      name: profile.name || 'Snek',
      skin: profile.selectedSkin || 'default',
      position: spawnPosition,
      velocity: { x: 0, y: 0 },
      mass: 50, // Base mass
      radius: 12, // Starting radius for collision
      segments: [],
      score: 0,
      maxMassReached: 50,
      isBoosting: false,
      color: profile.baseColor || `hsl(${~~(Math.random() * 360)}, 100%, 60%)`,
      performancePreset: profile.performancePreset === 'ultra' ? 'ultra' : 'adaptive',
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
        active: [],
      },
      mutationPoints: 0,
      lastMilestone: 0,
      activePowerUps: {}, // { type: timeRemaining }
      spawnedAt: Date.now(),
      spawnShieldUntil: spawnShieldMs > 0 ? Date.now() + spawnShieldMs : 0,
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
      const position = this.getSafeSpawnPosition(4, 60);
      const p = {
        id,
        x: position.x,
        y: position.y,
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

  markPelletMoved(pellet) {
    if (!this.movedPelletIds.has(pellet.id)) {
      this.movedPelletIds.add(pellet.id);
      this.pelletUpdates.moved.push({ id: pellet.id, x: pellet.x, y: pellet.y });
    }
  }

  getPelletUpdate() {
    const update = {
      added: this.pelletUpdates.added.map((pellet) => this.serializePellet(pellet)),
      removed: [...this.pelletUpdates.removed],
      moved: this.pelletUpdates.moved.map((pellet) => ({
        id: pellet.id,
        x: this.roundNumber(pellet.x),
        y: this.roundNumber(pellet.y),
      })),
    };
    this.pelletUpdates = { added: [], removed: [], moved: [] }; // Reset
    this.movedPelletIds.clear();
    return update;
  }

  roundNumber(value, decimals = 1) {
    const precision = 10 ** decimals;
    return Math.round(value * precision) / precision;
  }

  serializePellet(pellet) {
    return {
      id: pellet.id,
      x: this.roundNumber(pellet.x),
      y: this.roundNumber(pellet.y),
      value: this.roundNumber(pellet.value, 0),
      color: pellet.color,
    };
  }

  serializeAbility(ability, detailed = true) {
    return {
      type: ability.type,
      isActive: detailed ? Boolean(ability.isActive) : false,
      cooldown: detailed ? this.roundNumber(ability.cooldown, 0) : 0,
      maxCooldown: this.roundNumber(ability.maxCooldown, 0),
      duration: detailed ? this.roundNumber(ability.duration, 0) : 0,
      maxDuration: this.roundNumber(ability.maxDuration, 0),
    };
  }

  isWithinRadius(origin, target, radius) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    return dx * dx + dy * dy <= radius * radius;
  }

  filterArrayByDistance(items, origin, radius, extraRadius = 0) {
    if (!origin) return items;
    return items.filter((item) => this.isWithinRadius(origin, item, radius + extraRadius));
  }

  serializePowerUps() {
    const powerUps = {};
    for (const id in this.powerUps) {
      const powerUp = this.powerUps[id];
      powerUps[id] = {
        id: powerUp.id,
        type: powerUp.type,
        x: this.roundNumber(powerUp.x),
        y: this.roundNumber(powerUp.y),
        radius: this.roundNumber(powerUp.radius, 0),
        color: powerUp.color,
      };
    }
    return powerUps;
  }

  serializeSegments(segments = [], limit = 0) {
    if (!Array.isArray(segments) || segments.length === 0 || limit <= 0) {
      return [];
    }

    if (segments.length <= limit) {
      return segments.map((segment) => ({
        x: this.roundNumber(segment.x),
        y: this.roundNumber(segment.y),
      }));
    }

    const sampled = [];
    const lastIndex = segments.length - 1;
    const step = lastIndex / Math.max(1, limit - 1);
    let previousIndex = -1;

    for (let i = 0; i < limit; i++) {
      const index = i === limit - 1 ? lastIndex : Math.round(i * step);
      if (index === previousIndex) continue;

      const segment = segments[index];
      if (!segment) continue;

      sampled.push({
        x: this.roundNumber(segment.x),
        y: this.roundNumber(segment.y),
      });
      previousIndex = index;
    }

    return sampled;
  }

  serializePlayer(player, options = {}) {
    const detailed = options.detailed !== false;
    const segmentLimit = detailed ? options.segmentLimit || 18 : 0;
    const spawnShieldRemaining = Math.max(0, (player.spawnShieldUntil || 0) - Date.now());
    const serializedPlayer = {
      id: player.id,
      name: player.name,
      skin: player.skin || 'default',
      team: player.team,
      position: {
        x: this.roundNumber(player.position.x),
        y: this.roundNumber(player.position.y),
      },
      velocity: {
        x: this.roundNumber(player.velocity.x),
        y: this.roundNumber(player.velocity.y),
      },
      mass: this.roundNumber(player.mass),
      radius: this.roundNumber(player.radius),
      segments: this.serializeSegments(player.segments, segmentLimit),
      isBoosting: Boolean(player.isBoosting),
      color: player.color,
      ability: this.serializeAbility(player.ability, detailed),
      activePowerUps: detailed
        ? Object.fromEntries(
            Object.entries(player.activePowerUps || {}).map(([type, remaining]) => [
              type,
              this.roundNumber(remaining, 0),
            ])
          )
        : {},
    };

    if (spawnShieldRemaining > 0) {
      serializedPlayer.spawnShieldMs = this.roundNumber(spawnShieldRemaining, 0);
    }

    return serializedPlayer;
  }

  serializePlayers() {
    const players = {};
    for (const id in this.players) {
      players[id] = this.serializePlayer(this.players[id]);
    }
    return players;
  }

  serializePlayersForViewer(viewerId, options = {}) {
    const viewer = this.players[viewerId];
    if (!viewer) {
      return this.serializePlayers();
    }

    const detailRadius = options.detailRadius || 950;
    const selfSegmentLimit = options.selfSegmentLimit || 24;
    const kingSegmentLimit = options.kingSegmentLimit || 20;
    const nearbySegmentLimit = options.nearbySegmentLimit || 12;

    const players = {};
    for (const id in this.players) {
      const player = this.players[id];
      const detailed =
        id === viewerId || id === this.kingId || this.isWithinRadius(viewer.position, player.position, detailRadius);
      const segmentLimit = id === viewerId ? selfSegmentLimit : id === this.kingId ? kingSegmentLimit : nearbySegmentLimit;
      players[id] = this.serializePlayer(player, { detailed, segmentLimit });
    }

    return players;
  }

  serializePowerUpsForViewer(viewerId, radius = 1600) {
    const viewer = this.players[viewerId];
    if (!viewer) {
      return this.serializePowerUps();
    }

    const powerUps = {};
    for (const id in this.powerUps) {
      const powerUp = this.powerUps[id];
      if (!this.isWithinRadius(viewer.position, powerUp, radius)) continue;

      powerUps[id] = {
        id: powerUp.id,
        type: powerUp.type,
        x: this.roundNumber(powerUp.x),
        y: this.roundNumber(powerUp.y),
        radius: this.roundNumber(powerUp.radius, 0),
        color: powerUp.color,
      };
    }

    return powerUps;
  }

  getSnapshot() {
    return {
      time: Date.now(),
      players: this.serializePlayers(),
      bounds: this.bounds,
      stormRadius: this.stormRadius,
      stormCenter: this.stormCenter,
      teamScores: this.teamScores,
      kingId: this.kingId,
      powerUps: this.serializePowerUps(),
      roomState: this.roomState,
      roomStatus: this.roomStatus,
    };
  }

  getSnapshotForPlayer(viewerId, options = {}) {
    const viewer = this.players[viewerId];
    if (!viewer) {
      return this.getSnapshot();
    }

    return {
      time: Date.now(),
      players: this.serializePlayersForViewer(viewerId, options),
      bounds: this.bounds,
      stormRadius: this.stormRadius,
      stormCenter: this.stormCenter,
      teamScores: this.teamScores,
      kingId: this.kingId,
      powerUps: this.serializePowerUpsForViewer(viewerId),
      roomState: this.roomState,
      roomStatus: this.roomStatus,
    };
  }

  getFullSnapshot() {
    return {
      ...this.getSnapshot(),
      pellets: Object.fromEntries(
        Object.entries(this.pellets).map(([id, pellet]) => [id, this.serializePellet(pellet)])
      ),
    };
  }

  getFullSnapshotForPlayer(viewerId, options = {}) {
    return {
      ...this.getSnapshotForPlayer(viewerId, options),
      pellets: Object.fromEntries(
        Object.entries(this.pellets).map(([id, pellet]) => [id, this.serializePellet(pellet)])
      ),
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
      isActive: false,
      cooldown: 0,
      maxCooldown: 5000,
      duration: 0,
      maxDuration: 2000,
    };
    this.mutations = {
      speed: 1,
      magnetRadius: 1,
      massGain: 1,
      turnSpeed: 1,
      active: [],
    };
    this.mutationPoints = 0;
    this.lastMilestone = 0;
    this.activePowerUps = {};
    for (let i = 0; i < 5; i++) this.segments.push({ x: this.position.x, y: this.position.y });
  }
}

module.exports = { WorldState, Player };
