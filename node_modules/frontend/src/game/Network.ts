import { errorHandler } from './ErrorHandler';
import { Socket } from 'socket.io-client';
import { metricsCollector } from './MetricsCollector';
import { getSkinById } from './ProfileManager';

type Vec2 = { x: number; y: number };

type Pellet = {
  id: string | number;
  x: number;
  y: number;
  [key: string]: unknown;
};

type Snapshot = {
  time: number;
  players: Record<string, { [key: string]: unknown }>;
  pellets?: Record<string, Pellet>;
  bounds: { width: number; height: number };
  [key: string]: unknown;
};

type KillEvent = {
  killerId?: string;
  [key: string]: unknown;
};

type ServerErrorEvent = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type RoomStatus = {
  state: string;
  minPlayers?: number;
  maxPlayers?: number;
  playerCount?: number;
  readyCount?: number;
  countdownRemainingMs?: number;
  resetRemainingMs?: number;
  players?: Array<{ id: string; name: string; ready: boolean }>;
  [key: string]: unknown;
};

type ServerMatchSummary = {
  xpEarned?: number;
  matchKills?: number;
  maxMass?: number;
  mode?: string;
  deathCause?: string;
  killerName?: string;
  [key: string]: unknown;
};

function normalizeLatencySample(sampleMs: number) {
  if (!Number.isFinite(sampleMs)) {
    return 0;
  }

  return Math.max(0, Math.min(2000, sampleMs));
}

type NetworkGameManager = {
  socket: Socket;
  profile: Record<string, unknown>;
  myId: string | null;
  state: { bounds: { width: number; height: number }; pellets?: Record<string, Pellet> };
  stateBuffer: Snapshot[];
  snapshotIntervals: number[];
  lastSnapshotTime: number | null;
  audio?: {
    playEat?: () => void;
    playKill?: () => void;
    playDeath?: () => void;
  };
  hasSyncedClock: boolean;
  serverClockOffset: number;
  currentLag: number;
  killFeed: Array<{ time: number; [key: string]: unknown }>;
  screenShake: number;
  activeEmotes: Record<string, { emoteId: string; time: number }>;
  deathParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    life: number;
    effect?: string;
    secondaryColor?: string;
  }>;
  onMutationOffer?: (choices: unknown) => void;
  onGameOver?: (summary: {
    xpEarned: number;
    matchKills: number;
    maxMass: number;
    mode?: string;
    deathCause?: string;
    killerName?: string;
  }) => void;
  cleanup: () => void;
  resetNetworkState: () => void;
  updateAdaptiveRenderDelay: () => void;
  registerKillFeedback?: () => void;
  triggerHaptic?: (pattern: number | number[], minInterval?: number) => void;
  serverMetrics?: Record<string, unknown>;
  roomStatus?: RoomStatus | null;
  io?: { emit: (event: string, payload: unknown) => void };
};

// attach socket event handlers to the provided game manager instance
export function setupNetwork(game: NetworkGameManager): void {
  const isMobileClient =
    window.innerWidth < 1000 || window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  const emitJoinGame = () => {
    console.log('Network: emitting join_game');
    game.socket.emit('join_game', game.profile);
  };

  game.socket.on('connect', emitJoinGame);
  if (game.socket.connected) {
    emitJoinGame();
  }

  game.socket.on('init', (data: { id: string; bounds: { width: number; height: number }; state?: Snapshot }) => {
    console.log('GameManager: received init event, myId:', data.id);
    game.resetNetworkState();
    game.myId = data.id;
    game.state.bounds = data.bounds;
    if (data.state) {
      data.state.time = data.state.time || Date.now();
      game.stateBuffer.push(data.state);
      if (data.state.pellets) {
        game.state.pellets = data.state.pellets;
      }
    }
  });

  game.socket.on('pellet_update', ({ added, removed, moved }: { added?: Pellet[]; removed?: Array<string | number>; moved?: Pellet[] }) => {
    if (added) {
      added.forEach((p: Pellet) => {
        game.state.pellets![p.id] = p;
      });
    }
    if (removed) {
      let playedEat = false;
      removed.forEach((id: string | number) => {
        if (game.state.pellets![id] && !playedEat) {
          if (game.audio) game.audio.playEat?.();
          playedEat = true;
        }
        delete game.state.pellets![id];
      });
    }
    if (moved) {
      moved.forEach((p: Pellet) => {
        if (game.state.pellets![p.id]) {
          game.state.pellets![p.id].x = p.x;
          game.state.pellets![p.id].y = p.y;
        }
      });
    }
  });

  game.socket.on('state', (snapshot: Snapshot) => {
    const now = Date.now();
    const observedOffset = now - snapshot.time;
    if (!game.hasSyncedClock) {
      game.serverClockOffset = observedOffset;
      game.hasSyncedClock = true;
      console.log('GameManager: Synced clock, offset:', game.serverClockOffset);
    } else {
      const offsetDelta = observedOffset - game.serverClockOffset;
      if (Math.abs(offsetDelta) > 250) {
        // Snap quickly after tab resume/device stall instead of carrying a stale offset.
        game.serverClockOffset = observedOffset;
      } else {
        // Smooth minor jitter so the displayed latency remains stable on mobile networks.
        game.serverClockOffset += offsetDelta * 0.08;
      }
    }
    game.currentLag = normalizeLatencySample(observedOffset - game.serverClockOffset);
    metricsCollector.recordRTT(game.currentLag);
    if (game.lastSnapshotTime !== null) {
      const interval = snapshot.time - game.lastSnapshotTime;
      if (interval > 0) {
        game.snapshotIntervals.push(interval);
        if (game.snapshotIntervals.length > 20) game.snapshotIntervals.shift();
      }
    }
    game.lastSnapshotTime = snapshot.time;
    if (game.stateBuffer.length === 0) {
      const samplePlayer = Object.values(snapshot.players)[0];
      console.log(
        'GameManager: Received first snapshot. Player count:',
        Object.keys(snapshot.players).length,
        'Sample player:',
        samplePlayer
      );
    }
    game.stateBuffer.push(snapshot);
    if (game.stateBuffer.length > 50) game.stateBuffer.shift();
    game.updateAdaptiveRenderDelay();
  });

  game.socket.on('kill_event', (eventData: KillEvent) => {
    game.killFeed.push({ ...eventData, time: Date.now() });
    if (game.killFeed.length > 5) game.killFeed.shift();
    if (eventData.killerId === game.myId) {
      if (typeof (game as NetworkGameManager & { localMatchKills?: number }).localMatchKills === 'number') {
        (game as NetworkGameManager & { localMatchKills: number }).localMatchKills += 1;
      }
      game.registerKillFeedback?.();
      game.screenShake = Math.max(game.screenShake, 15);
    } else {
      game.screenShake = 5;
    }
  });

  game.socket.on('mutation_offer', (choices: unknown) => {
    if (game.onMutationOffer) game.onMutationOffer(choices);
  });

  game.socket.on('emote', ({ playerId, emoteId }: { playerId: string; emoteId: string }) => {
    game.activeEmotes[playerId] = { emoteId, time: Date.now() };
  });

  game.socket.on('player_death', (data: Vec2 & { color?: string; skin?: string }) => {
    const skin = getSkinById(data.skin);
    const count = isMobileClient
      ? skin.deathEffect === 'supernova'
        ? 12
        : skin.deathEffect === 'warp'
          ? 10
          : 8
      : skin.deathEffect === 'supernova'
        ? 28
        : skin.deathEffect === 'warp'
          ? 24
          : 18;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 220 + 60;
      game.deathParticles.push({
        x: data.x,
        y: data.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: skin.baseColor || data.color || '#ff0055',
        life: 1.0,
        effect: skin.deathEffect,
        secondaryColor: skin.accentColor,
      });
    }
    if (game.deathParticles.length > (isMobileClient ? 36 : 96)) {
      game.deathParticles.splice(0, game.deathParticles.length - (isMobileClient ? 36 : 96));
    }
    if (game.audio && game.audio.playDeath) {
      game.audio.playDeath();
    }
  });

  game.socket.on('died', (stats: ServerMatchSummary) => {
    game.triggerHaptic?.([30, 40, 20], 160);
    setTimeout(() => {
      game.cleanup();
      if (game.onGameOver) {
        game.onGameOver({
          xpEarned: stats.xpEarned || 0,
          matchKills: stats.matchKills || 0,
          maxMass: stats.maxMass || 0,
          mode: typeof stats.mode === 'string' ? stats.mode : undefined,
          deathCause: typeof stats.deathCause === 'string' ? stats.deathCause : undefined,
          killerName: typeof stats.killerName === 'string' ? stats.killerName : undefined,
        });
      }
    }, 1500);
  });

  game.socket.on('room_status', (status: RoomStatus) => {
    game.roomStatus = status;
  });

  game.socket.on('room_countdown_start', (payload: { duration: number }) => {
    game.roomStatus = {
      ...(game.roomStatus || {}),
      state: 'COUNTDOWN',
      countdownRemainingMs: payload.duration,
    };
  });

  game.socket.on('room_countdown_cancelled', () => {
    game.roomStatus = {
      ...(game.roomStatus || {}),
      state: 'LOBBY',
      countdownRemainingMs: 0,
    };
  });

  game.socket.on('room_game_start', () => {
    game.roomStatus = {
      ...(game.roomStatus || {}),
      state: 'PLAYING',
      countdownRemainingMs: 0,
    };
  });

  game.socket.on('room_game_finished', () => {
    game.roomStatus = {
      ...(game.roomStatus || {}),
      state: 'FINISHED',
      countdownRemainingMs: 0,
    };
  });

  game.socket.on('room_reset', () => {
    game.roomStatus = {
      ...(game.roomStatus || {}),
      state: 'LOBBY',
      countdownRemainingMs: 0,
    };
  });

  // server metrics listener
  game.socket.on('server_metrics', (m: Record<string, unknown>) => {
    game.serverMetrics = m;
  });

  // server error forwarded to client UI
  game.socket.on('server_error', (err: ServerErrorEvent) => {
    console.error('Server error event:', err);
    errorHandler.error('SERVER_ERROR', `Server error: ${err.message || err.code}`, {
      code: err.code,
    });
    try {
      if (game.io && game.io.emit) {
        game.io.emit('client_log', { level: 'error', msg: err.message });
      }
    } catch (emitErr: unknown) {
      const message = emitErr instanceof Error ? emitErr.message : String(emitErr);
      errorHandler.warn('CLIENT_LOG_EMIT_FAIL', `Failed to emit client_log: ${message}`);
    }
  });
}
