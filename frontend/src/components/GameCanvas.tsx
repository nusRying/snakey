import React, { useEffect, useRef, useState } from 'react';
import { GameManager } from '../game/GameManager';
import { metricsCollector } from '../game/MetricsCollector';
import { isManagedMode } from '../game/ModeThemes';
import { getBackendDisplayTarget, probeBackendHealth } from '../platform/backend';
import MutationOverlay from './MutationOverlay';
import LoadingScreen from './LoadingScreen';

type Profile = {
  name: string;
  selectedSkin: string;
  mode?: string;
  performancePreset?: 'adaptive' | 'ultra';
  [key: string]: unknown;
};

type MutationChoice = {
  id: string;
  name: string;
  description: string;
};

type ServerMetrics = {
  lastTickMs?: number;
  avgTickMs?: number;
  players?: number;
};

type RoomStatus = {
  state: string;
  minPlayers?: number;
  playerCount?: number;
  readyCount?: number;
  countdownRemainingMs?: number;
  resetRemainingMs?: number;
  players?: Array<{ id: string; name: string; ready: boolean }>;
};

type MatchSummary = {
  xpEarned: number;
  matchKills?: number;
  maxMass?: number;
  mode?: string;
  deathCause?: string;
  killerName?: string;
};

type GameCanvasProps = {
  profile: Profile;
  onGameOver?: (summary: MatchSummary) => void;
  onConnectionLost?: () => void;
};

const GameCanvas = ({ profile, onGameOver, onConnectionLost }: GameCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameManagerRef = useRef<GameManager | null>(null);

  const [mutationChoices, setMutationChoices] = useState<MutationChoice[]>([]);
  const [connStatus, setConnStatus] = useState('connecting');
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [fps, setFps] = useState(0);
  const [ping, setPing] = useState(0);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [readyPending, setReadyPending] = useState(false);
  const [connectionDetail, setConnectionDetail] = useState<string | null>(null);
  const [healthDetail, setHealthDetail] = useState<string | null>(null);
  const backendTarget = getBackendDisplayTarget();

  useEffect(() => {
    if (!canvasRef.current || !profile) return;

    let cancelled = false;

    probeBackendHealth().then((result) => {
      if (!cancelled) {
        setHealthDetail(result.message);
      }
    });

    gameManagerRef.current = new GameManager(
      canvasRef.current,
      profile,
      onGameOver,
      (choices) => setMutationChoices((choices as MutationChoice[]) || []),
      (status) => {
        console.log('GameCanvas: connection status:', status);
        setConnStatus(status);
      }
    );
    gameManagerRef.current.start();

    const metricsInterval = setInterval(() => {
      if (gameManagerRef.current) {
        setMetrics((gameManagerRef.current.serverMetrics as ServerMetrics) || null);
        setFps(Math.round(metricsCollector.getFPS() || 0));
        setPing(Math.round(gameManagerRef.current.currentLag || 0));
        setRoomStatus((gameManagerRef.current.roomStatus as RoomStatus) || null);
        setConnectionDetail(gameManagerRef.current.lastConnectionError || null);
      }
    }, 250);

    return () => {
      cancelled = true;
      if (gameManagerRef.current) {
        gameManagerRef.current.cleanup();
      }
      clearInterval(metricsInterval);
    };
  }, [profile, onGameOver]);

  const handleSelectMutation = (id: string) => {
    if (gameManagerRef.current) {
      gameManagerRef.current.selectMutation(id);
    }
    setMutationChoices([]);
  };

  const handleRetry = () => {
    if (onConnectionLost) onConnectionLost();
  };

  const countdownSeconds = roomStatus?.countdownRemainingMs
    ? Math.max(1, Math.ceil(roomStatus.countdownRemainingMs / 1000))
    : 0;
  const resetSeconds = roomStatus?.resetRemainingMs
    ? Math.max(1, Math.ceil(roomStatus.resetRemainingMs / 1000))
    : 0;

  const usesManagedRoom = isManagedMode(profile.mode as string | undefined);
  const shouldShowRoomOverlay =
    roomStatus && roomStatus.state !== 'PLAYING' && usesManagedRoom;
  const myId = gameManagerRef.current?.myId || null;
  const amReady = Boolean(roomStatus?.players?.find((player) => player.id === myId)?.ready);

  useEffect(() => {
    if (readyPending && amReady) {
      setReadyPending(false);
    }
  }, [amReady, readyPending]);

  let roomOverlayText = '';
  if (roomStatus?.state === 'LOBBY') {
    roomOverlayText = `Ready ${roomStatus.readyCount || 0}/${roomStatus.minPlayers || 1} • Players ${roomStatus.playerCount || 0}`;
  } else if (roomStatus?.state === 'COUNTDOWN') {
    roomOverlayText = `Round starts in ${countdownSeconds} • ${roomStatus.readyCount || 0} locked in`;
  } else if (roomStatus?.state === 'FINISHED') {
    roomOverlayText = `Round complete. Arena resets in ${resetSeconds}`;
  }

  const overlayTitle =
    roomStatus?.state === 'LOBBY'
      ? 'Match staging'
      : roomStatus?.state === 'COUNTDOWN'
        ? 'Countdown active'
        : roomStatus?.state === 'FINISHED'
          ? 'Round complete'
          : '';

  const handleReady = () => {
    if (!gameManagerRef.current) return;
    setReadyPending(true);
    gameManagerRef.current.setReadyState(true);
  };

  return (
    <div className="game-canvas-shell">
      <canvas
        ref={canvasRef}
        className="game-canvas-surface"
      />

      {connStatus !== 'connected' && (
        <LoadingScreen
          status={connStatus}
          onRetry={handleRetry}
          target={backendTarget}
          health={healthDetail}
          detail={connectionDetail}
        />
      )}

      {shouldShowRoomOverlay && roomOverlayText && (
        <div className="game-room-overlay">
          <div className="game-room-overlay-kicker">{overlayTitle}</div>
          <div className="game-room-overlay-title">{roomOverlayText}</div>
          <div className="game-room-overlay-copy">
            {roomStatus?.state === 'LOBBY' && 'Tap ready to lock your snake into the next managed round.'}
            {roomStatus?.state === 'COUNTDOWN' && 'All locked-in players will spawn when the countdown ends.'}
            {roomStatus?.state === 'FINISHED' && 'Queue your rematch now or wait for the arena reset.'}
          </div>
          {(roomStatus?.state === 'LOBBY' || roomStatus?.state === 'FINISHED') && (
            <button
              className="menu-btn play-btn highlight game-room-ready-btn"
              onClick={handleReady}
              disabled={amReady || readyPending}
            >
              {amReady ? 'READY LOCKED' : readyPending ? 'LOCKING IN...' : roomStatus.state === 'FINISHED' ? 'READY FOR REMATCH' : 'READY UP'}
            </button>
          )}
        </div>
      )}

      <div className="game-metrics-panel">
        <div className="game-metrics-chip">
          <span className="game-metrics-label">FPS</span>
          <strong>{fps}</strong>
        </div>
        <div className="game-metrics-chip">
          <span className="game-metrics-label">Ping</span>
          <strong>{ping} ms</strong>
        </div>
        <div className="game-metrics-chip is-wide">
          <span className="game-metrics-label">Tick</span>
          <strong>{metrics ? `${metrics.lastTickMs} ms (avg ${metrics.avgTickMs} ms)` : '—'}</strong>
        </div>
        <div className="game-metrics-chip">
          <span className="game-metrics-label">Players</span>
          <strong>{metrics ? metrics.players : '—'}</strong>
        </div>
      </div>

      {mutationChoices.length > 0 && (
        <MutationOverlay choices={mutationChoices} onSelect={handleSelectMutation} />
      )}
    </div>
  );
};

export default GameCanvas;
