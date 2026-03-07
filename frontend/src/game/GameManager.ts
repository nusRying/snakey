import { io } from 'socket.io-client';
import { Renderer } from './Renderer';
import { AudioEngine } from './AudioEngine';
import { setupNetwork } from './Network';
import { setupInput, cleanupInput } from './InputHandler';
import { errorHandler } from './ErrorHandler';
import { metricsCollector } from './MetricsCollector';
import { CHALLENGES, SKINS, getSkinById } from './ProfileManager';
import { getModeDefinition, resolveThemeId } from './ModeThemes';
import { getBackendBaseUrl } from '../platform/backend';

type GameProfile = {
  name: string;
  selectedSkin: string;
  performancePreset?: 'adaptive' | 'ultra';
  level?: number;
  stats?: {
    totalKills?: number;
    totalMatches?: number;
  };
  completedChallenges?: string[];
  [key: string]: unknown;
};

type ChallengeDefinition = {
  id: string;
  name: string;
  description: string;
  target: number;
  metric: string;
};

type ProgressToast = {
  id: string;
  title: string;
  detail: string;
  accent: string;
  createdAt: number;
  duration: number;
};

type ConnectionStatusCallback = (status: string) => void;
type MutationOfferCallback = (choices: unknown) => void;
type GameOverCallback = (summary: MatchSummary) => void;

type MatchSummary = {
  xpEarned: number;
  matchKills?: number;
  maxMass?: number;
  mode?: string;
  deathCause?: string;
  killerName?: string;
};

type Vec2 = { x: number; y: number };

type QualityTier = 'performance' | 'balanced' | 'quality';
type PerformancePreset = 'adaptive' | 'ultra';

type Segment = Vec2;

type PlayerState = {
  position: Vec2;
  segments: Segment[];
  mass: number;
  skin?: string;
  color?: string;
  isBoosting?: boolean;
  score?: number;
  radius?: number;
  spawnShieldMs?: number;
  pulse?: number;
  [key: string]: unknown;
};

type PelletState = {
  id: string | number;
  x: number;
  y: number;
  [key: string]: unknown;
};

type PowerUpState = {
  x: number;
  y: number;
  type?: string;
  [key: string]: unknown;
};

type ObstacleState = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: string;
  [key: string]: unknown;
};

type SnapshotState = {
  time: number;
  players: Record<string, PlayerState>;
  pellets?: Record<string, PelletState>;
  bounds: { width: number; height: number };
  stormRadius?: number;
  stormCenter?: Vec2;
  teamScores?: unknown;
  obstacles?: ObstacleState[];
  blackHoles?: unknown;
  wormholes?: unknown;
  kingId?: string;
  powerUps?: Record<string, PowerUpState>;
  roomState?: string;
  roomStatus?: RoomStatus;
  [key: string]: unknown;
};

type KillFeedEntry = {
  time: number;
  killerId?: string;
  [key: string]: unknown;
};

type ActiveEmote = { emoteId: string; time: number };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size?: number;
  effect?: string;
  secondaryColor?: string;
};

type DeathParticle = Particle & { size: number };

type PowerUpPickup = {
  x: number;
  y: number;
  color: string;
  startTime: number;
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

type InterpolatedState = {
  players: Record<string, PlayerState>;
  pellets: Record<string, PelletState>;
  bounds: { width: number; height: number };
  stormRadius?: number;
  stormCenter?: Vec2;
  teamScores?: unknown;
  obstacles?: ObstacleState[];
  blackHoles?: unknown;
  wormholes?: unknown;
  kingId?: string;
  powerUps?: Record<string, PowerUpState>;
  roomState?: string;
  roomStatus?: RoomStatus;
  [key: string]: unknown;
};

type JoystickState = {
  active: boolean;
  baseX: number;
  baseY: number;
  stickX: number;
  stickY: number;
  radius: number;
  identifier: number | null;
};

type TouchButtonState = {
  x: number;
  y: number;
  radius: number;
  active: boolean;
  identifier: number | null;
};

export class GameManager {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderer: Renderer;
  audio: AudioEngine;
  isMobileClient: boolean;
  isAndroidClient: boolean;
  isOfflinePracticeMode: boolean;
  performancePreset: PerformancePreset;
  maxTrailParticles: number;
  maxDeathParticles: number;
  showDiagnostics: boolean;
  lastProgressToastUpdate: number;
  cameraScale: number;
  viewportWidth: number;
  viewportHeight: number;
  deviceScale: number;
  qualityTier: QualityTier;
  lowFpsStreak: number;
  highFpsStreak: number;
  lastQualityAdjustAt: number;
  canVibrate: boolean;
  lastHapticAt: number;
  killStreak: number;
  lastKillAt: number;

  profile: GameProfile;
  onGameOver?: GameOverCallback;
  onMutationOffer?: MutationOfferCallback;
  onConnectionStatus: ConnectionStatusCallback;

  socket: ReturnType<typeof io>;
  io?: { emit: (event: string, payload: unknown) => void };
  connStatus: string;
  updateConnStatus: (status: string) => void;
  lastConnectionError: string | null;

  state: InterpolatedState;
  killFeed: KillFeedEntry[];
  activeEmotes: Record<string, ActiveEmote>;
  screenShake: number;
  particles: Particle[];
  deathParticles: DeathParticle[];
  powerUpPickups: PowerUpPickup[];
  toasts: ProgressToast[];
  toastKeys: Set<string>;
  modeDefinition: ReturnType<typeof getModeDefinition>;
  themeId: string;
  localMatchKills: number;
  localPeakMass: number;

  stateBuffer: SnapshotState[];
  snapshotIntervals: number[];
  lastSnapshotTime: number | null;
  renderDelay: number;
  serverClockOffset: number;
  hasSyncedClock: boolean;
  currentLag: number;
  serverMetrics?: Record<string, unknown>;
  roomStatus: RoomStatus | null;

  myId: string | null;
  input: { angle: number; isBoosting: boolean; useAbility: boolean };
  inputDirty: boolean;
  lastInputEmit: number;

  lastTime: number;
  animationFrameId: number | null;
  loopCount: number;
  loopError: Error | null;

  joystick: JoystickState;
  abilityBtn: TouchButtonState;
  boostBtn: TouchButtonState;

  _keydownHandler?: (e: KeyboardEvent) => void;
  _keyupHandler?: (e: KeyboardEvent) => void;
  _mousedownHandler?: (e: MouseEvent) => void;
  _touchstartHandler?: (e: TouchEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    profile: GameProfile,
    onGameOver?: GameOverCallback,
    onMutationOffer?: MutationOfferCallback,
    onConnectionStatus?: ConnectionStatusCallback
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) {
      throw new Error('2D canvas context is required');
    }
    this.ctx = context;
    this.renderer = new Renderer(this.ctx);
    this.audio = new AudioEngine();
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    this.isMobileClient =
      window.innerWidth < 1000 ||
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window;
    this.isAndroidClient = /Android/i.test(navigator.userAgent);
    this.showDiagnostics = isLocalHost && !this.isMobileClient;
    this.cameraScale = this.isMobileClient ? 0.94 : 1;
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.deviceScale = 1;
    this.lowFpsStreak = 0;
    this.highFpsStreak = 0;
    this.lastQualityAdjustAt = 0;
    this.canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    this.lastHapticAt = 0;
    this.killStreak = 0;
    this.lastKillAt = 0;

    this.profile = profile || { name: 'Player', selectedSkin: 'default' };
    this.performancePreset = this.profile.performancePreset === 'ultra' ? 'ultra' : 'adaptive';
    this.isOfflinePracticeMode = (this.profile.mode as string) === 'OFFLINE';
    this.qualityTier = this.performancePreset === 'ultra' ? 'performance' : this.isMobileClient ? 'performance' : 'quality';
    this.maxTrailParticles = 0;
    this.maxDeathParticles = 0;
    this.onGameOver = onGameOver;
    this.onMutationOffer = onMutationOffer;
    this.onConnectionStatus = onConnectionStatus || (() => {});
    this.modeDefinition = getModeDefinition((this.profile.mode as string) || 'FFA');
    this.themeId = resolveThemeId({
      mode: (this.profile.mode as string) || 'FFA',
      level: Number(this.profile.level) || 1,
    });
    if (this.performancePreset === 'ultra') {
      this.cameraScale = this.isMobileClient ? 0.9 : 0.96;
    }
    this.applyQualityTierSettings(this.qualityTier);

    const serverUrl = getBackendBaseUrl();

    console.log('GameManager: Connecting to backend at', serverUrl);
    this.socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.connStatus = 'connecting';
    this.lastConnectionError = null;
    this.updateConnStatus = (status: string) => {
      this.connStatus = status;
      try {
        this.onConnectionStatus(status);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errorHandler.warn('CONN_STATUS_CB_ERROR', `Connection status callback failed: ${message}`);
      }
    };

    this.socket.on('connect', () => {
      console.log('GameManager: Socket connected, ID:', this.socket.id);
      this.lastConnectionError = null;
      this.updateConnStatus('connected');
    });
    this.socket.on('disconnect', (reason: string) => {
      console.warn('GameManager: Socket disconnected, reason:', reason);
      this.updateConnStatus('disconnected');
    });
    this.socket.on('reconnect_attempt', (attempt: number) => {
      console.log('GameManager: reconnect attempt', attempt);
      this.updateConnStatus('reconnecting');
    });
    this.socket.on('reconnect', (attempt: number) => {
      console.log('GameManager: reconnected on attempt', attempt);
      this.updateConnStatus('connected');
    });
    this.socket.on('reconnect_failed', () => {
      console.error('GameManager: reconnect failed');
      this.updateConnStatus('failed');
    });
    this.socket.on('connect_error', (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      this.lastConnectionError = msg;
      errorHandler.warn('SOCKET_CONN_ERROR', `Connection error: ${msg}`);
      console.error('GameManager: Socket connection error:', error);
    });

    this.state = {
      players: {},
      pellets: {},
      bounds: { width: 3000, height: 3000 },
    };

    this.killFeed = [];
    this.activeEmotes = {};
    this.screenShake = 0;
    this.particles = [];
    this.deathParticles = [];
    this.powerUpPickups = [];
    this.toasts = [];
    this.toastKeys = new Set();
    this.localMatchKills = 0;
    this.localPeakMass = 50;

    this.stateBuffer = [];
    this.snapshotIntervals = [];
    this.lastSnapshotTime = null;
    this.renderDelay = this.isMobileClient ? 110 : 125;
    this.serverClockOffset = 0;
    this.hasSyncedClock = false;
    this.currentLag = 0;
    this.roomStatus = null;

    this.myId = null;
    this.input = { angle: 0, isBoosting: false, useAbility: false };
    this.inputDirty = false;
    this.lastInputEmit = 0;

    this.lastTime = performance.now();
    this.animationFrameId = null;
    this.loopCount = 0;
    this.loopError = null;
    this.lastProgressToastUpdate = 0;

    this.joystick = {
      active: false,
      baseX: 0,
      baseY: 0,
      stickX: 0,
      stickY: 0,
      radius: 60,
      identifier: null,
    };

    this.abilityBtn = {
      x: 0,
      y: 0,
      radius: 40,
      active: false,
      identifier: null,
    };

    this.boostBtn = {
      x: 0,
      y: 0,
      radius: 40,
      active: false,
      identifier: null,
    };

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    setupNetwork(this);
    setupInput(this);
    this.handleResize();
  }

  cleanup() {
    if (this.audio) this.audio.cleanup();
    if (this.socket) this.socket.disconnect();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    cleanupInput(this);
  }

  selectMutation(mutationId: string) {
    if (this.socket) {
      try {
        this.socket.emit('evolve', mutationId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errorHandler.error('MUTATION_EMIT_ERROR', `Failed to select mutation: ${message}`);
      }
    }
  }

  setReadyState(ready: boolean) {
    if (!this.socket) return;

    try {
      this.socket.emit('player_ready', { ready });
      if (this.myId && this.roomStatus?.players) {
        const nextPlayers = this.roomStatus.players.map((player) =>
          player.id === this.myId ? { ...player, ready } : player
        );
        this.roomStatus = {
          ...this.roomStatus,
          players: nextPlayers,
          readyCount: nextPlayers.reduce((count, player) => count + (player.ready ? 1 : 0), 0),
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errorHandler.warn('READY_EMIT_ERROR', `Failed to update ready state: ${message}`);
    }
  }

  sendEmote(emoteId: string) {
    if (this.socket) {
      try {
        this.socket.emit('emote', emoteId);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errorHandler.error('EMOTE_EMIT_ERROR', `Failed to send emote: ${message}`);
      }
    }
  }

  handleResize() {
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.deviceScale = this.getCanvasResolutionScale();

    this.canvas.style.width = `${this.viewportWidth}px`;
    this.canvas.style.height = `${this.viewportHeight}px`;
    this.canvas.width = Math.max(1, Math.floor(this.viewportWidth * this.deviceScale));
    this.canvas.height = Math.max(1, Math.floor(this.viewportHeight * this.deviceScale));
    this.ctx.setTransform(this.deviceScale, 0, 0, this.deviceScale, 0, 0);

    const rootStyles = window.getComputedStyle(document.documentElement);
    const safeRight = Number.parseFloat(rootStyles.getPropertyValue('--safe-area-right')) || 0;
    const safeBottom = Number.parseFloat(rootStyles.getPropertyValue('--safe-area-bottom')) || 0;
    const actionRadius = this.isMobileClient ? 52 : 40;
    const joystickRadius = this.isMobileClient ? 74 : 60;
    const bottomInset = safeBottom + (this.isMobileClient ? 26 : 0);
    const rightInset = safeRight + (this.isMobileClient ? 18 : 0);

    this.joystick.radius = joystickRadius;
    this.abilityBtn.radius = actionRadius;
    this.boostBtn.radius = actionRadius;

    this.abilityBtn.x = this.viewportWidth - (this.isMobileClient ? 176 : 160) - rightInset;
    this.abilityBtn.y = this.viewportHeight - (this.isMobileClient ? 92 : 80) - bottomInset;
    this.boostBtn.x = this.viewportWidth - (this.isMobileClient ? 76 : 70) - rightInset;
    this.boostBtn.y = this.viewportHeight - (this.isMobileClient ? 154 : 130) - bottomInset;
  }

  getCanvasResolutionScale() {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const deviceMemory = nav.deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 6;
    const rawDpr = Math.max(1, window.devicePixelRatio || 1);
    const cappedDpr = Math.min(rawDpr, this.isAndroidClient ? 2 : 1.85);

    let factor = 1;
    if (this.qualityTier === 'performance') factor -= 0.18;
    if (this.qualityTier === 'quality') factor += this.isAndroidClient ? 0.08 : 0.04;
    if (this.performancePreset === 'ultra') factor -= this.isMobileClient ? 0.22 : 0.1;
    if (this.isOfflinePracticeMode) factor -= this.isMobileClient ? 0.08 : 0.03;
    if (deviceMemory <= 4 || cores <= 6) factor -= 0.08;
    if (deviceMemory <= 2 || cores <= 4) factor -= 0.12;

    const minScale =
      this.performancePreset === 'ultra'
        ? this.isMobileClient
          ? 0.58
          : 0.82
        : this.isMobileClient
          ? 0.72
          : 0.9;
    return Math.max(minScale, Math.min(cappedDpr, cappedDpr * factor));
  }

  applyQualityTierSettings(nextTier: QualityTier) {
    this.qualityTier = nextTier;

    if (this.performancePreset === 'ultra') {
      this.renderer.lowEffects = true;
      this.maxTrailParticles = this.isMobileClient ? 10 : 64;
      this.maxDeathParticles = this.isMobileClient ? 6 : 28;
      return;
    }

    if (nextTier === 'performance') {
      this.renderer.lowEffects = true;
      this.maxTrailParticles = this.isMobileClient ? (this.isOfflinePracticeMode ? 18 : 24) : 120;
      this.maxDeathParticles = this.isMobileClient ? (this.isOfflinePracticeMode ? 10 : 12) : 54;
    } else if (nextTier === 'balanced') {
      this.renderer.lowEffects = this.isMobileClient;
      this.maxTrailParticles = this.isMobileClient ? (this.isOfflinePracticeMode ? 36 : 48) : 180;
      this.maxDeathParticles = this.isMobileClient ? (this.isOfflinePracticeMode ? 14 : 18) : 72;
    } else {
      this.renderer.lowEffects = false;
      this.maxTrailParticles = this.isMobileClient ? 72 : 240;
      this.maxDeathParticles = this.isMobileClient ? 24 : 110;
    }
  }

  handleMouseMove(e: MouseEvent) {
    if (!this.myId || !this.state.players[this.myId]) return;

    const centerX = this.viewportWidth / 2;
    const centerY = this.viewportHeight / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    this.input.angle = Math.atan2(dy, dx);
    this.inputDirty = true;
  }

  handleMouseDown() {
    this.setBoostState(true);
  }

  handleMouseUp() {
    this.setBoostState(false);
  }

  handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      const dxB = touch.clientX - this.boostBtn.x;
      const dyB = touch.clientY - this.boostBtn.y;
      if (Math.sqrt(dxB * dxB + dyB * dyB) < this.boostBtn.radius * 1.5) {
        this.boostBtn.active = true;
        this.boostBtn.identifier = touch.identifier;
        this.setBoostState(true);
        continue;
      }

      const dxA = touch.clientX - this.abilityBtn.x;
      const dyA = touch.clientY - this.abilityBtn.y;
      if (Math.sqrt(dxA * dxA + dyA * dyA) < this.abilityBtn.radius * 1.5) {
        this.abilityBtn.active = true;
        this.abilityBtn.identifier = touch.identifier;
        this.activateAbilityInput();
        continue;
      }

      if (!this.joystick.active && touch.clientX < this.viewportWidth / 2) {
        this.joystick.active = true;
        this.joystick.identifier = touch.identifier;
        this.joystick.baseX = touch.clientX;
        this.joystick.baseY = touch.clientY;
        this.joystick.stickX = touch.clientX;
        this.joystick.stickY = touch.clientY;
      }
    }
  }

  handleKeyDown(e: KeyboardEvent) {
    const emoteKeys: Record<string, string> = {
      1: 'COOL',
      2: 'LOL',
      3: 'GG',
      4: 'ANGRY',
      5: 'SAD',
      6: 'LOVE',
    };

    if (emoteKeys[e.key]) {
      this.sendEmote(emoteKeys[e.key]);
    }

    if (e.code === 'Space') {
      this.activateAbilityInput();
      setTimeout(() => {
        this.input.useAbility = false;
        this.socket.emit('input', this.input);
      }, 100);
    }
  }

  setBoostState(isBoosting: boolean) {
    if (this.input.isBoosting === isBoosting) return;

    this.input.isBoosting = isBoosting;
    this.inputDirty = true;

    if (isBoosting) {
      this.audio.playBoost();
      this.triggerHaptic([18], 90);
    }
  }

  activateAbilityInput() {
    if (!this.input.useAbility) {
      this.audio.playAbility();
      this.triggerHaptic([10, 22], 110);
    }

    this.input.useAbility = true;
    this.inputDirty = true;

    if (this.socket) {
      this.socket.emit('input', this.input);
    }
  }

  triggerHaptic(pattern: number | number[], minInterval = 60) {
    if (!this.canVibrate) return;

    const now = performance.now();
    if (now - this.lastHapticAt < minInterval) return;

    this.lastHapticAt = now;
    navigator.vibrate(pattern);
  }

  registerKillFeedback() {
    const now = performance.now();
    this.killStreak = now - this.lastKillAt < 4200 ? this.killStreak + 1 : 1;
    this.lastKillAt = now;
    this.audio.playKill(this.killStreak);
    if (this.killStreak === 2) {
      this.audio.announce?.('Double elimination.', { interrupt: true });
    }
    this.triggerHaptic(this.killStreak > 1 ? [18, 30, 18] : [26], 140);
    this.screenShake = Math.max(this.screenShake, Math.min(24, 12 + this.killStreak * 2.5));

    if (this.killStreak > 1) {
      this.enqueueToast(
        `streak-${this.killStreak}`,
        `${this.killStreak}x streak`,
        this.killStreak >= 4 ? 'Arena pressure is yours. Keep the chain alive.' : 'Momentum building. Push the advantage.',
        this.killStreak >= 4 ? '#fde68a' : '#7dd3fc',
        2200
      );
    }
  }

  applyAdaptiveQuality(time: number) {
    if (this.performancePreset === 'ultra') {
      this.applyQualityTierSettings('performance');
      this.trimEffectBuffers();
      return;
    }

    if (time - this.lastQualityAdjustAt < 1800) return;

    this.lastQualityAdjustAt = time;
    const fps = metricsCollector.getFPS();
    const networkPressure = this.currentLag > 130 || this.renderDelay > 170;

    if (fps < 52 || networkPressure) {
      this.lowFpsStreak += 1;
      this.highFpsStreak = 0;
    } else if (fps > 58 && this.currentLag < 90) {
      this.highFpsStreak += 1;
      this.lowFpsStreak = 0;
    } else {
      this.lowFpsStreak = 0;
      this.highFpsStreak = 0;
    }

    let nextTier = this.qualityTier;
    if (this.lowFpsStreak >= 2) {
      nextTier = this.qualityTier === 'quality' ? 'balanced' : 'performance';
      this.lowFpsStreak = 0;
    } else if (this.highFpsStreak >= 3) {
      nextTier = this.qualityTier === 'performance' ? 'balanced' : 'quality';
      this.highFpsStreak = 0;
    }

    if (nextTier === this.qualityTier) return;

    this.applyQualityTierSettings(nextTier);

    metricsCollector.recordMetric(
      'adaptive_quality_tier',
      nextTier === 'performance' ? 1 : nextTier === 'balanced' ? 2 : 3
    );
    this.handleResize();
    this.trimEffectBuffers();
  }

  handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (this.joystick.active && touch.identifier === this.joystick.identifier) {
        let dx = touch.clientX - this.joystick.baseX;
        let dy = touch.clientY - this.joystick.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const deadzone = this.joystick.radius * 0.12;
        const edgeFollowThreshold = this.joystick.radius * 0.78;

        if (dist > this.joystick.radius) {
          dx = (dx / dist) * this.joystick.radius;
          dy = (dy / dist) * this.joystick.radius;
        } else if (dist > edgeFollowThreshold) {
          const follow = (dist - edgeFollowThreshold) * 0.32;
          const nx = dist > 0 ? dx / dist : 0;
          const ny = dist > 0 ? dy / dist : 0;
          this.joystick.baseX += nx * follow;
          this.joystick.baseY += ny * follow;
        }

        this.joystick.stickX = this.joystick.baseX + dx;
        this.joystick.stickY = this.joystick.baseY + dy;

        if (dist >= deadzone) {
          const angle = Math.atan2(dy, dx);
          this.input.angle = angle;
          this.inputDirty = true;
        }
      }
    }
  }

  handleTouchEnd(e: TouchEvent) {
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
        this.setBoostState(false);
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

  resetNetworkState() {
    this.state.players = {};
    this.state.pellets = {};
    this.stateBuffer = [];
    this.snapshotIntervals = [];
    this.lastSnapshotTime = null;
    this.hasSyncedClock = false;
    this.serverClockOffset = 0;
    this.currentLag = 0;
    this.killFeed = [];
    this.activeEmotes = {};
    this.roomStatus = null;
    this.toasts = [];
    this.toastKeys.clear();
    this.localMatchKills = 0;
    this.localPeakMass = 50;
    this.killStreak = 0;
    this.lastKillAt = 0;
  }

  getChallengeMetricValue(metric: string) {
    if (metric === 'matchKills') return this.localMatchKills;
    if (metric === 'maxMass') return this.localPeakMass;
    if (metric === 'totalKills') return (this.profile.stats?.totalKills || 0) + this.localMatchKills;
    return 0;
  }

  enqueueToast(key: string, title: string, detail: string, accent = '#7dd3fc', duration = 4400) {
    if (this.toastKeys.has(key)) return;

    this.toastKeys.add(key);
    this.toasts.push({
      id: `${key}-${Date.now()}`,
      title,
      detail,
      accent,
      createdAt: Date.now(),
      duration,
    });
  }

  trimEffectBuffers() {
    if (this.particles.length > this.maxTrailParticles) {
      this.particles.splice(0, this.particles.length - this.maxTrailParticles);
    }

    if (this.deathParticles.length > this.maxDeathParticles) {
      this.deathParticles.splice(0, this.deathParticles.length - this.maxDeathParticles);
    }
  }

  updateTransientEffects(
    now: number,
    deltaSeconds: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ) {
    const frameScale = Math.max(0.7, Math.min(2, deltaSeconds / 0.016));

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.life -=
        particle.x < minX || particle.x > maxX || particle.y < minY || particle.y > maxY
          ? 0.06 * frameScale
          : 0.035 * frameScale;
      particle.size = Math.max(0.8, (particle.size || 2) * Math.pow(0.985, frameScale));

      if (particle.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const particle = this.deathParticles[i];
      particle.x += particle.vx * deltaSeconds;
      particle.y += particle.vy * deltaSeconds;
      particle.vx *= Math.pow(0.98, frameScale);
      particle.vy *= Math.pow(0.98, frameScale);
      particle.life -= 0.02 * frameScale;

      if (particle.life <= 0) {
        this.deathParticles.splice(i, 1);
      }
    }

    this.powerUpPickups = this.powerUpPickups.filter((pu) => now - pu.startTime < 500);
    this.trimEffectBuffers();
  }

  updateProgressToasts() {
    const completedChallenges = new Set(this.profile.completedChallenges || []);

    CHALLENGES.forEach((challenge: ChallengeDefinition) => {
      if (completedChallenges.has(challenge.id)) return;
      if (challenge.metric === 'totalMatches' || challenge.metric === 'dailyClaims') return;

      const value = this.getChallengeMetricValue(challenge.metric);
      if (value < challenge.target) return;

      const unlockedSkin = SKINS.find(
        (skin) => skin.unlock?.type === 'challenge' && skin.unlock.challengeId === challenge.id
      );
      const detail = unlockedSkin
        ? `${challenge.description} Unlock queued: ${unlockedSkin.name}.`
        : challenge.description;

      this.enqueueToast(
        `challenge-${challenge.id}`,
        `Challenge Complete: ${challenge.name}`,
        detail,
        unlockedSkin?.accentColor || '#7dd3fc'
      );
    });
  }

  updateAdaptiveRenderDelay() {
    if (this.snapshotIntervals.length < 3) return;

    const recentIntervals = this.snapshotIntervals.slice(-8);
    const averageInterval =
      recentIntervals.reduce((sum, value) => sum + value, 0) / recentIntervals.length;
    const averageJitter =
      recentIntervals.reduce((sum, value) => sum + Math.abs(value - averageInterval), 0) /
      recentIntervals.length;

    const targetDelay = Math.max(
      this.isMobileClient ? 72 : 78,
      Math.min(180, averageInterval * 1.55 + averageJitter * 1.8 + this.currentLag * 0.16 + 12)
    );

    this.renderDelay += (targetDelay - this.renderDelay) * 0.15;
  }

  getCameraScale(player?: PlayerState | null) {
    if (!player) {
      return this.isMobileClient ? 0.94 : 1;
    }

    const mass = Math.max(50, Number(player.mass) || 50);
    const zoomOut = Math.min(0.24, Math.log2(mass / 50 + 1) * 0.075);
    const baseScale = this.isMobileClient ? 0.96 : 1.02;
    const minScale = this.isMobileClient ? 0.72 : 0.78;
    return Math.max(minScale, baseScale - zoomOut);
  }

  getPlacement() {
    if (!this.myId || !this.state.players[this.myId]) {
      return 0;
    }

    const rankedPlayers = Object.values(this.state.players).sort(
      (a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)
    );

    return rankedPlayers.findIndex((player) => player === this.state.players[this.myId!]) + 1;
  }

  applyLocalPrediction(player: PlayerState, referencePlayer: PlayerState) {
    if (!this.myId || !player || !referencePlayer) return;

    const velocity = (referencePlayer.velocity as Vec2 | undefined) || { x: 0, y: 0 };
    let vx = velocity.x || 0;
    let vy = velocity.y || 0;

    if (vx === 0 && vy === 0) {
      const speed = referencePlayer.isBoosting ? 300 : 150;
      vx = Math.cos(this.input.angle) * speed;
      vy = Math.sin(this.input.angle) * speed;
    }

    const predictionMs = Math.max(14, Math.min(56, this.renderDelay * 0.22 + this.currentLag * 0.12));
    const leadSeconds = predictionMs / 1000;
    const dx = vx * leadSeconds;
    const dy = vy * leadSeconds;

    player.position.x = Math.max(0, Math.min(this.state.bounds.width, player.position.x + dx));
    player.position.y = Math.max(0, Math.min(this.state.bounds.height, player.position.y + dy));
    player.segments = player.segments.map((segment: Segment) => ({
      x: Math.max(0, Math.min(this.state.bounds.width, segment.x + dx)),
      y: Math.max(0, Math.min(this.state.bounds.height, segment.y + dy)),
    }));
  }

  reconcileLocalPlayer(targetPlayer: PlayerState, previousPlayer?: PlayerState) {
    if (!previousPlayer) return;

    const dx = targetPlayer.position.x - previousPlayer.position.x;
    const dy = targetPlayer.position.y - previousPlayer.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Preserve hard corrections for teleports, round resets, or death respawns.
    if (distance > 220) {
      return;
    }

    const blendFactor = distance > 120 ? 0.42 : distance > 45 ? 0.58 : 0.74;

    targetPlayer.position = {
      x: previousPlayer.position.x + dx * blendFactor,
      y: previousPlayer.position.y + dy * blendFactor,
    };

    targetPlayer.segments = targetPlayer.segments.map((segment: Segment, idx: number) => {
      const previousSegment = previousPlayer.segments[idx];
      if (!previousSegment) return segment;

      return {
        x: previousSegment.x + (segment.x - previousSegment.x) * blendFactor,
        y: previousSegment.y + (segment.y - previousSegment.y) * blendFactor,
      };
    });
  }

  interpolateState() {
    if (this.stateBuffer.length < 2) return;

    const renderTime = Date.now() - this.serverClockOffset - this.renderDelay;

    let s0: SnapshotState | null = null;
    let s1: SnapshotState | null = null;

    for (let i = 0; i < this.stateBuffer.length - 1; i++) {
      if (this.stateBuffer[i].time <= renderTime && this.stateBuffer[i + 1].time >= renderTime) {
        s0 = this.stateBuffer[i];
        s1 = this.stateBuffer[i + 1];
        break;
      }
    }

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

      if (s0.pellets) this.state.pellets = s0.pellets;
      if (typeof s0.stormRadius !== 'undefined') this.state.stormRadius = s0.stormRadius;
      if (typeof s0.stormCenter !== 'undefined') this.state.stormCenter = s0.stormCenter;
      if (typeof s0.teamScores !== 'undefined') this.state.teamScores = s0.teamScores;
      if (typeof s0.obstacles !== 'undefined') this.state.obstacles = s0.obstacles;
      if (typeof s0.blackHoles !== 'undefined') this.state.blackHoles = s0.blackHoles;
      if (typeof s0.wormholes !== 'undefined') this.state.wormholes = s0.wormholes;
      if (typeof s0.kingId !== 'undefined') this.state.kingId = s0.kingId;
      if (typeof s0.powerUps !== 'undefined') this.state.powerUps = s0.powerUps;
      if (typeof s0.roomState !== 'undefined') this.state.roomState = s0.roomState;
      if (typeof s0.roomStatus !== 'undefined') this.state.roomStatus = s0.roomStatus;
      if (typeof s0.bounds !== 'undefined') this.state.bounds = s0.bounds;

      const interpolatedPlayers: Record<string, PlayerState> = {};
      for (const id in s0.players) {
        const p0 = s0.players[id];
        const p1 = s1.players[id];

        if (!p1) {
          interpolatedPlayers[id] = p0;
          continue;
        }

        const oldPlayer = this.state.players[id];
        let pulse = oldPlayer ? oldPlayer.pulse || 0 : 0;
        if (oldPlayer && p0.mass > oldPlayer.mass) {
          pulse = 1.0;
        }
        pulse *= 0.9;
        if (pulse < 0.01) pulse = 0;

        const interpPlayer = {
          ...p0,
          pulse: pulse,
          position: {
            x: p0.position.x + (p1.position.x - p0.position.x) * t,
            y: p0.position.y + (p1.position.y - p0.position.y) * t,
          },
          segments: p0.segments.map((seg: Segment, idx: number) => {
            const nextSeg = p1.segments[idx];
            if (nextSeg) {
              return {
                x: seg.x + (nextSeg.x - seg.x) * t,
                y: seg.y + (nextSeg.y - seg.y) * t,
              };
            }
            return seg;
          }),
        };

        if (id === this.myId) {
          this.applyLocalPrediction(interpPlayer, p1);
          this.reconcileLocalPlayer(interpPlayer, oldPlayer);
        }

        interpolatedPlayers[id] = interpPlayer;

        const shouldSpawnBoostTrails = !(this.isMobileClient && this.qualityTier === 'performance');
        if (shouldSpawnBoostTrails && p0.isBoosting && Math.random() < (this.isMobileClient ? 0.05 : 0.12)) {
          const skin = getSkinById((p0.skin as string) || 'default');
          const tail = p0.segments[p0.segments.length - 1] || p0.position;
          this.particles.push({
            x: tail.x,
            y: tail.y,
            vx: (Math.random() - 0.5) * 70,
            vy: (Math.random() - 0.5) * 70,
            life: 1.0,
            color: skin.trailColor || (p0.color as string) || '#ffffff',
            size: skin.trailStyle === 'heroic' ? 3.5 : 2.4,
            effect: skin.trailStyle,
            secondaryColor: skin.accentColor,
          });

          this.trimEffectBuffers();
        }
      }

      this.state.players = interpolatedPlayers;

      if (s0.powerUps && this.state.powerUps) {
        for (const id in this.state.powerUps) {
          if (!s0.powerUps[id]) {
            const pu = this.state.powerUps[id];
            this.powerUpPickups.push({
              x: pu.x,
              y: pu.y,
              color:
                pu.type === 'MAGNET' ? '#00f2ff' : pu.type === 'SHIELD' ? '#ffdf00' : '#ff003c',
              startTime: Date.now(),
            });
            if (this.audio && typeof this.audio.playPowerUp === 'function') {
              this.audio.playPowerUp(typeof pu.type === 'string' ? pu.type : 'POWER');
            }
            this.triggerHaptic([14, 18], 120);
          }
        }
      }

    }
  }

  loop(time: number) {
    try {
      metricsCollector.recordFrame();
      this.applyAdaptiveQuality(time);

      this.loopCount++;
      const deltaMs = Math.min(40, Math.max(8, time - this.lastTime || 16.67));
      const deltaSeconds = deltaMs / 1000;
      this.lastTime = time;

      const inputEmitInterval = this.isMobileClient ? 33 : 25;
      if (this.inputDirty && time - this.lastInputEmit > inputEmitInterval) {
        if (this.socket) {
          try {
            this.socket.emit('input', this.input);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            errorHandler.warn('SOCKET_EMIT_ERROR', `Failed to emit input: ${message}`);
          }
        }
        this.inputDirty = false;
        this.lastInputEmit = time;
      }

      this.interpolateState();

      const myPlayer = this.myId ? this.state.players[this.myId] : null;
      const camX = myPlayer ? myPlayer.position.x : this.state.bounds.width / 2;
      const camY = myPlayer ? myPlayer.position.y : this.state.bounds.height / 2;
      const targetCameraScale = this.getCameraScale(myPlayer);
      const cameraLerp = 1 - Math.exp(-deltaSeconds * 10);
      this.cameraScale += (targetCameraScale - this.cameraScale) * cameraLerp;
      const viewportWidth = this.viewportWidth / this.cameraScale;
      const viewportHeight = this.viewportHeight / this.cameraScale;
      const placement = this.getPlacement();

      if (myPlayer) {
        this.localPeakMass = Math.max(this.localPeakMass, Number(myPlayer.mass) || 0);
        if (time - this.lastProgressToastUpdate > 250) {
          this.updateProgressToasts();
          this.lastProgressToastUpdate = time;
        }
      }

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.setTransform(this.deviceScale, 0, 0, this.deviceScale, 0, 0);
      this.ctx.save();

      if (this.screenShake > 0) {
        const sx = (Math.random() - 0.5) * this.screenShake;
        const sy = (Math.random() - 0.5) * this.screenShake;
        this.ctx.translate(sx, sy);
        this.screenShake *= Math.pow(0.9, deltaMs / 16.67);
        if (this.screenShake < 0.1) this.screenShake = 0;
      }

      this.ctx.translate(this.viewportWidth / 2, this.viewportHeight / 2);
      this.ctx.scale(this.cameraScale, this.cameraScale);
      this.ctx.translate(-camX, -camY);

      this.renderer.drawBackground(
        this.state.bounds,
        camX,
        camY,
        viewportWidth,
        viewportHeight,
        this.themeId
      );
      if (!(this.isMobileClient && this.qualityTier === 'performance')) {
        this.renderer.drawGrid(
          this.state.bounds,
          camX,
          camY,
          viewportWidth,
          viewportHeight,
          this.themeId
        );
      }
      this.renderer.drawBounds(this.state.bounds, this.themeId);
      this.renderer.drawObstacles(this.state.obstacles, this.themeId);

      if (this.state.stormRadius) {
        this.renderer.drawStorm(this.state.stormCenter, this.state.stormRadius, this.state.bounds);
      }

      this.renderer.drawBlackHoles(this.state.blackHoles, time);
      this.renderer.drawWormholes(this.state.wormholes, time);
      this.renderer.drawPowerUps(this.state.powerUps, time);

      this.renderer.drawPellets(
        this.state.pellets,
        camX,
        camY,
        viewportWidth,
        viewportHeight
      );
      this.renderer.drawPlayers(
        this.state.players,
        this.myId,
        this.state.kingId,
        camX,
        camY,
        viewportWidth,
        viewportHeight,
        this.activeEmotes,
        time
      );

      this.renderer.drawDeathExplosion(this.deathParticles);

      const now = Date.now();
      if (performance.now() - this.lastKillAt > 4500) {
        this.killStreak = 0;
      }
      if (!(this.isMobileClient && this.qualityTier === 'performance')) {
        this.powerUpPickups.forEach((pu) => {
          const age = (now - pu.startTime) / 1000;
          this.renderer.drawPowerUpPickup(pu.x, pu.y, pu.color, age);
        });
      }
      this.powerUpPickups = this.powerUpPickups.filter((pu) => now - pu.startTime < 500);

      const margin = 100;
      const minX = camX - viewportWidth / 2 - margin;
      const maxX = camX + viewportWidth / 2 + margin;
      const minY = camY - viewportHeight / 2 - margin;
      const maxY = camY + viewportHeight / 2 + margin;

      this.updateTransientEffects(now, deltaSeconds, minX, maxX, minY, maxY);

      if (!(this.isMobileClient && this.qualityTier === 'performance')) {
        this.renderer.drawTrailParticles(this.particles);
      }
      this.ctx.globalAlpha = 1.0;

      this.ctx.restore();

      if (myPlayer) {
        this.renderer.drawHUD(
          myPlayer,
          this.viewportWidth,
          this.viewportHeight,
          placement,
          Object.keys(this.state.players).length,
          Object.keys(this.state.pellets).length,
          this.currentLag,
          this.renderDelay,
          this.modeDefinition.name,
          this.modeDefinition.themeLabel,
          Number(myPlayer.spawnShieldMs) || 0,
          this.roomStatus?.state || this.state.roomState || 'PLAYING',
          this.killStreak,
          this.qualityTier
        );

        if (this.showDiagnostics) {
          this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
          this.ctx.fillRect(10, this.viewportHeight - 60, 250, 50);
          this.ctx.fillStyle = this.stateBuffer.length < 3 ? '#ff0000' : '#00ff00';
          this.ctx.font = '12px Courier New';
          this.ctx.textAlign = 'left';
          this.ctx.fillText(
            `${this.loopCount % 2 === 0 ? '●' : '○'} LOOP: ${this.loopCount} | BUF: ${
              this.stateBuffer.length
            } | LAG: ${this.currentLag}ms`,
            20,
            this.viewportHeight - 40
          );
          this.ctx.fillText(
            `ID: ${this.myId} | POS: ${Math.round(myPlayer.position.x)},${Math.round(
              myPlayer.position.y
            )}`,
            20,
            this.viewportHeight - 25
          );
        }
      }

      this.killFeed = this.killFeed.filter((k) => now - k.time < 3000);
      this.toasts = this.toasts.filter((toast) => now - toast.createdAt < toast.duration);

      for (const pid in this.activeEmotes) {
        if (now - this.activeEmotes[pid].time > 2000) {
          delete this.activeEmotes[pid];
        }
      }

      if (!this.isMobileClient || (this.viewportWidth >= 900 && this.qualityTier !== 'performance')) {
        this.renderer.drawLeaderboard(this.state.players, this.myId);
      }

      if (this.state.teamScores) {
        this.renderer.drawTeamScores(this.state.teamScores, this.viewportWidth);
      }

      if (!(this.isMobileClient && this.qualityTier === 'performance')) {
        this.renderer.drawKillFeed(this.killFeed, this.viewportWidth);
        this.renderer.drawToastStack(this.toasts, this.viewportWidth, this.viewportHeight);
        this.renderer.drawMinimap(
          this.state.players,
          this.myId,
          this.state.bounds,
          this.viewportWidth,
          this.viewportHeight,
          camX,
          camY,
          viewportWidth,
          viewportHeight,
          this.state.kingId
        );
      }

      if (this.viewportWidth < 1000) {
        this.renderer.drawMobileUI(this.joystick, this.boostBtn, this.abilityBtn);
      }

      this.animationFrameId = requestAnimationFrame(this.loop);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('CRITICAL GAME LOOP ERROR:', error);
      this.loopError = error;
      errorHandler.critical('GAME_LOOP_ERROR', `Game loop crashed: ${error.message}`, {
        stack: error.stack,
        loopCount: this.loopCount,
      });
      this.drawErrorOverlay(error);
    }
  }

  drawErrorOverlay(err: Error) {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = 'rgba(150, 0, 0, 0.9)';
    this.ctx.fillRect(50, 50, this.viewportWidth - 100, this.viewportHeight - 100);
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 5;
    this.ctx.strokeRect(50, 50, this.viewportWidth - 100, this.viewportHeight - 100);

    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('CRITICAL LOOP ERROR!', this.viewportWidth / 2, 100);

    this.ctx.font = '16px monospace';
    this.ctx.textAlign = 'left';
    const lines = (err.stack || err.message).split('\n');
    lines.slice(0, 20).forEach((line, i) => {
      this.ctx.fillText(line, 80, 150 + i * 20);
    });
  }
}