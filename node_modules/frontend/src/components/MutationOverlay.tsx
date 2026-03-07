import React from 'react';

type MutationChoice = {
  id: string;
  name: string;
  description: string;
};

type MutationOverlayProps = {
  choices: MutationChoice[];
  onSelect: (id: string) => void;
};

const MutationOverlay = ({ choices, onSelect }: MutationOverlayProps) => {
  if (!choices || choices.length === 0) return null;

  const toneClassNames = ['tone-velocity', 'tone-control', 'tone-harvest'];

  return (
    <div className="mutation-overlay">
      <div className="mutation-shell glass-panel">
        <div className="screen-kicker">Evolution Draft</div>
        <h1 className="mutation-title">EVOLVE</h1>
        <p className="mutation-copy">Select a passive mutation to shape the next phase of your run.</p>

        <div className="mutation-choice-grid">
        {choices.map((choice, index) => (
          <div
            key={choice.id}
            className={`mutation-choice-card ${toneClassNames[index % toneClassNames.length]}`}
            onClick={() => onSelect(choice.id)}
          >
            <div className="mutation-choice-head">
              <span className="mutation-choice-index">0{index + 1}</span>
              <h2>{choice.name}</h2>
            </div>
            <p className="mutation-choice-description">{choice.description}</p>
            <button className="mutation-choice-button">Select</button>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
};

export default MutationOverlay;
