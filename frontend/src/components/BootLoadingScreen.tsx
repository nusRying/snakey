import React from 'react';
import type { BootState } from '../game/BootLoader';

type BootLoadingScreenProps = {
  bootState: BootState;
};

const BootLoadingScreen = ({ bootState }: BootLoadingScreenProps) => {
  const activeStep =
    bootState.steps.find((step) => step.status === 'loading') ||
    bootState.steps.find((step) => step.status === 'pending') ||
    bootState.steps[bootState.steps.length - 1];

  return (
    <div className="loading-overlay loading-overlay-app">
      <div className="loading-card glass-panel boot-loading-card">
        <div className="spinner"></div>
        <div className="loading-kicker">Snakey Boot Sequence</div>
        <p className="loading-message">Loading deployed experience…</p>
        <p className="loading-copy">
          Preparing the shell, title art, live broadcast data, and arena packs before the first screen unlocks.
        </p>
        <progress className="boot-progress-shell" value={bootState.progress} max={100} />
        <p className="loading-target">Progress: {bootState.progress}%</p>
        {activeStep && <p className="loading-target">Current step: {activeStep.label}</p>}
        <div className="boot-step-list">
          {bootState.steps.map((step) => (
            <div key={step.id} className={`boot-step-row is-${step.status}`}>
              <span className="boot-step-dot" aria-hidden="true" />
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BootLoadingScreen;