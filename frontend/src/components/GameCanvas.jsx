import React, { useEffect, useRef, useState } from 'react';
import { GameManager } from '../game/GameManager';
import MutationOverlay from './MutationOverlay';

const GameCanvas = ({ profile, onGameOver }) => {
  const canvasRef = useRef(null);
  const gameManagerRef = useRef(null);
  const [mutationChoices, setMutationChoices] = useState([]);

  useEffect(() => {
    if (!canvasRef.current || !profile) return;

    // Initialize the GameManager which handles Socket & requestAnimationFrame loop purely through vanilla JS
    gameManagerRef.current = new GameManager(
      canvasRef.current, 
      profile, 
      onGameOver,
      (choices) => setMutationChoices(choices) // onMutationOffer callback
    );
    gameManagerRef.current.start();

    return () => {
      if (gameManagerRef.current) {
        gameManagerRef.current.cleanup();
      }
    };
  }, []);

  const handleSelectMutation = (id) => {
    if (gameManagerRef.current) {
        gameManagerRef.current.selectMutation(id);
    }
    setMutationChoices([]);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <canvas 
        ref={canvasRef} 
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          backgroundColor: '#0a0a0a',
          cursor: 'crosshair',
          touchAction: 'none' // Prevent mobile scrolling
        }}
      />
      
      {mutationChoices.length > 0 && (
        <MutationOverlay 
          choices={mutationChoices} 
          onSelect={handleSelectMutation} 
        />
      )}
    </div>
  );
};

export default GameCanvas;
