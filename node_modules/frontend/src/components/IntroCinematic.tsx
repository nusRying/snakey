import React, { useEffect, useMemo, useState } from 'react';
import ShaderBackdrop from './ShaderBackdrop';

type IntroCinematicProps = {
  onComplete: () => void;
  onSkip: () => void;
};

const INTRO_BEATS = [
  {
    kicker: 'Signal acquired',
    title: 'The neon arena is waking up.',
    body: 'Serpents, drones, and managed rooms are spooling into the grid for the next cycle.',
  },
  {
    kicker: 'Broadcast',
    title: 'Mutation drafts are live.',
    body: 'Every run can branch into sharper offense, stronger survival, or faster traversal pressure.',
  },
  {
    kicker: 'Final brief',
    title: 'Touch controls are armed for mobile combat.',
    body: 'Enter solo for bot pressure or jump into multiplayer rooms and fight for map control.',
  },
];

const IntroCinematic = ({ onComplete, onSkip }: IntroCinematicProps) => {
  const [beatIndex, setBeatIndex] = useState(0);
  const beat = useMemo(() => INTRO_BEATS[Math.min(beatIndex, INTRO_BEATS.length - 1)], [beatIndex]);

  useEffect(() => {
    if (beatIndex >= INTRO_BEATS.length) {
      onComplete();
      return;
    }

    const timer = window.setTimeout(() => {
      setBeatIndex((current) => current + 1);
    }, 1900);

    return () => window.clearTimeout(timer);
  }, [beatIndex, onComplete]);

  return (
    <div className="intro-cinematic">
      <ShaderBackdrop variant="intro" />
      <div className="intro-cinematic-orbit intro-cinematic-orbit-a" />
      <div className="intro-cinematic-orbit intro-cinematic-orbit-b" />
      <div className="intro-cinematic-panel glass-panel">
        <div className="intro-cinematic-kicker">{beat.kicker}</div>
        <h1 className="intro-cinematic-title">{beat.title}</h1>
        <p className="intro-cinematic-copy">{beat.body}</p>

        <div className="intro-cinematic-progress" aria-hidden="true">
          {INTRO_BEATS.map((_, index) => (
            <span key={index} className={index <= beatIndex ? 'is-active' : ''} />
          ))}
        </div>

        <div className="intro-cinematic-actions">
          <button className="menu-btn play-btn highlight" onClick={onComplete}>
            Enter arena
          </button>
          <button className="menu-btn secondary" onClick={onSkip}>
            Skip briefing
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroCinematic;