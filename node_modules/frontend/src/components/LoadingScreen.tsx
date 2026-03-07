import React from 'react';

type ConnectionStatus = 'connecting' | 'reconnecting' | 'disconnected' | 'failed' | string;

type LoadingScreenProps = {
  status: ConnectionStatus;
  onRetry: () => void;
  target?: string;
  detail?: string | null;
  health?: string | null;
};

const LoadingScreen = ({ status, onRetry, target, detail, health }: LoadingScreenProps) => {
  let message = '';
  switch (status) {
    case 'connecting':
      message = 'Connecting to server…';
      break;
    case 'reconnecting':
      message = 'Reconnecting…';
      break;
    case 'disconnected':
      message = 'Disconnected from server.';
      break;
    case 'failed':
      message = 'Unable to reconnect.';
      break;
    default:
      message = '';
  }

  return (
    <div className="loading-overlay">
      <div className="loading-card glass-panel">
        <div className="spinner"></div>
        <div className="loading-kicker">Snakey Network</div>
        <p className="loading-message">{message}</p>
        <p className="loading-copy">
          The arena is syncing the room state, player snapshots, and touch controls.
        </p>
        {target && <p className="loading-target">Target: {target}</p>}
        {health && <p className="loading-target">Probe: {health}</p>}
        {detail && <p className="loading-target">Socket: {detail}</p>}
      </div>
      {(status === 'failed' || status === 'disconnected') && (
        <button onClick={onRetry}>Return to lobby</button>
      )}
    </div>
  );
};

export default LoadingScreen;
