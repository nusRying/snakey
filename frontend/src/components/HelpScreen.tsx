import React from 'react';

type HelpScreenProps = {
  onBack: () => void;
};

const HelpScreen = ({ onBack }: HelpScreenProps) => {
  const controlRows = [
    ['Mouse', 'Direct movement and aiming on desktop'],
    ['Left Click', 'Boost at the cost of mass'],
    ['Space', 'Trigger your equipped active ability'],
    ['Touch', 'Left-thumb joystick with right-side boost and skill'],
  ];

  const mechanics = [
    'Eat glowing pellets to extend your body and scale your score.',
    'Reach mass milestones to draft passive mutations that shape your run.',
    'Managed modes use staging, countdowns, and rematch-ready loops.',
    'Walls, hazards, and enemy bodies will end the run if you misread spacing.',
  ];

  return (
    <div className="menu-screen help-screen">
      <div className="glass-card help-card">
        <div className="screen-kicker">Field Manual</div>
        <h2>HOW TO PLAY</h2>

        <div className="help-section help-section-controls">
          <div className="help-section-head">
            <h3 className="help-heading help-heading-primary">Controls</h3>
            <span className="help-section-chip">Desktop + Mobile</span>
          </div>
          <div className="controls-grid">
            {controlRows.map(([key, description]) => (
              <div key={key} className="control-item">
                <span className="key">{key}</span>
                <span className="desc">{description}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="help-section help-section-mechanics">
          <div className="help-section-head">
            <h3 className="help-heading help-heading-accent">Mechanics</h3>
            <span className="help-section-chip">Survival loop</span>
          </div>
          <ul>
            {mechanics.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="help-tips-banner">
          <strong>Quick tip</strong>
          <span>
            In managed modes, entering the room does not instantly spawn you. Lock in with Ready once
            the arena overlay appears.
          </span>
        </div>

        <button className="menu-btn secondary back-btn" onClick={onBack}>
          BACK
        </button>
      </div>
    </div>
  );
};

export default HelpScreen;
