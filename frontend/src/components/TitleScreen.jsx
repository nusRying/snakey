import React, { useEffect, useRef } from 'react';

const TitleScreen = ({ onPlay, onOptions, onHelp }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Background Particles
    const particles = [];
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        color: Math.random() < 0.5 ? '#00f2ff' : '#ff003c'
      });
    }

    const render = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.3;
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="title-screen">
      <canvas ref={canvasRef} className="title-bg-canvas" />
      
      <div className="title-content">
        <h1 className="main-logo animate-float">SNAKEY.IO</h1>
        <p className="subtitle">The Ultimate Neon Survival</p>
        
        <div className="menu-buttons">
          <button className="menu-btn play-btn highlight" onClick={() => onPlay('offline')}>
            <span className="btn-glow"></span>
            OFFLINE MODE
          </button>

          <button className="menu-btn play-btn" onClick={() => onPlay('online')}>
            <span className="btn-glow"></span>
            MULTIPLAYER
          </button>
          
          <div className="secondary-btns">
            <button className="menu-btn secondary" onClick={onOptions}>OPTIONS</button>
            <button className="menu-btn secondary" onClick={onHelp}>HELP</button>
          </div>
        </div>
      </div>
      
      <div className="footer-credits">
        v1.2.0 • AGENTIC POISH PREVIEW
      </div>
    </div>
  );
};

export default TitleScreen;
