import React, { useEffect, useRef } from 'react';
import { fetchLiveOpsPack, getCachedLiveOpsPack, type LiveOpsPack } from '../game/LiveOps';
import ShaderBackdrop from './ShaderBackdrop';

interface TitleScreenProps {
  onPlay: (mode: 'practice' | 'multiplayer') => void;
  onOptions: () => void;
  onSkins: () => void;
  onHelp: () => void;
}

const TitleScreen: React.FC<TitleScreenProps> = ({ onPlay, onOptions, onSkins, onHelp }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [liveOps, setLiveOps] = React.useState<LiveOpsPack | null>(() => getCachedLiveOpsPack());
  const featureHighlights = [
    { label: 'Arcade glow', value: 'Brighter menu, bolder buttons, playful energy' },
    { label: 'High refresh', value: 'Render loop unlocked for 120Hz and 144Hz panels' },
    { label: 'Mobile first', value: 'Thumb controls, safe-area HUD, smooth practice mode' },
  ];

  useEffect(() => {
    let active = true;
    void fetchLiveOpsPack().then((pack) => {
      if (active && pack) {
        setLiveOps(pack);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;
    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = 1;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', resize);
    resize();

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
    }> = [];
    const ambientSnakes: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      phase: number;
      amplitude: number;
      color: string;
      length: number;
      thickness: number;
    }> = [];

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 3 + 1.5,
        color: ['#8df85a', '#55f3ff', '#ffd84d', '#ff6db4'][i % 4],
      });
    }

    for (let i = 0; i < 6; i++) {
      ambientSnakes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0.45 + Math.random() * 0.35,
        vy: (Math.random() - 0.5) * 0.08,
        phase: Math.random() * Math.PI * 2,
        amplitude: 14 + Math.random() * 12,
        color: ['#ff5d73', '#7dff61', '#51d9ff', '#ffbf47', '#d67aff', '#ff8d42'][i],
        length: 12 + Math.floor(Math.random() * 6),
        thickness: 8 + Math.random() * 6,
      });
    }

    const render = (time = 0) => {
      if (!ctx) return;
      const background = ctx.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#79e38d');
      background.addColorStop(0.28, '#4ec9a5');
      background.addColorStop(0.62, '#2f9d90');
      background.addColorStop(1, '#163b49');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      const orbGradient = ctx.createRadialGradient(width * 0.72, height * 0.24, 30, width * 0.72, height * 0.24, width * 0.35);
      orbGradient.addColorStop(0, 'rgba(255,255,255,0.34)');
      orbGradient.addColorStop(0.35, 'rgba(121,227,141,0.22)');
      orbGradient.addColorStop(1, 'rgba(121,227,141,0)');
      ctx.fillStyle = orbGradient;
      ctx.fillRect(0, 0, width, height);

      ambientSnakes.forEach((snake, snakeIndex) => {
        snake.x += snake.vx;
        snake.y += snake.vy;
        snake.phase += 0.032;
        if (snake.x - snake.length * 18 > width + 80) {
          snake.x = -120;
          snake.y = 90 + Math.random() * (height - 180);
        }

        for (let segmentIndex = snake.length - 1; segmentIndex >= 0; segmentIndex--) {
          const offset = segmentIndex * 16;
          const px = snake.x - offset;
          const py = snake.y + Math.sin(snake.phase + segmentIndex * 0.46 + snakeIndex) * snake.amplitude;
          const radius = Math.max(4, snake.thickness - segmentIndex * 0.34);

          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fillStyle = snake.color;
          ctx.globalAlpha = segmentIndex === 0 ? 0.98 : Math.max(0.18, 0.9 - segmentIndex * 0.05);
          ctx.fill();

          if (segmentIndex === 0) {
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(px - radius * 0.24, py - radius * 0.18, 1.8, 0, Math.PI * 2);
            ctx.arc(px + radius * 0.24, py - radius * 0.18, 1.8, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(px - radius * 0.22, py - radius * 0.22, 0.8, 0, Math.PI * 2);
            ctx.arc(px + radius * 0.22, py - radius * 0.22, 0.8, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
        }
      });

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.24 + Math.sin(time * 0.001 + p.x * 0.01) * 0.08;
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
      <ShaderBackdrop variant="title" />
      <canvas ref={canvasRef} className="title-bg-canvas" />
      <div className="title-atmosphere" />

      <div className="title-content">
        <div className="title-shell glass-panel">
          <div className="title-copy-column">
            <div className="title-badge-row">
              <span className="title-badge">Arcade garden</span>
              <span className="title-badge title-badge-accent">High refresh ready</span>
              <span className="title-badge title-badge-warm">Vibrant mobile</span>
            </div>
            <div className="title-brand-lockup animate-float">
              <img
                src="/snakey-logo.svg"
                alt=""
                aria-hidden="true"
                className="snakey-brand-mark snakey-brand-mark-hero"
              />
              <h1 className="main-logo">SNAKEY.IO</h1>
            </div>
            <p className="subtitle">Bright, Fast, Elastic Snake Battles</p>
            <p className="title-supporting-copy">
              A more colorful front door, glossy arcade buttons, fast online drop-ins, and private practice built for touch screens and high-refresh displays.
            </p>

            <div className="title-status-strip">
              <span className="title-status-pill">Unlocked render loop</span>
              <span className="title-status-pill">Solo practice with 25 bots</span>
              <span className="title-status-pill">Cute skin lab</span>
            </div>

            <div className="menu-buttons title-menu-buttons">
              <button className="menu-btn play-btn highlight title-main-cta" onClick={() => onPlay('practice')}>
                <span className="btn-glow"></span>
                PLAY SOLO PRACTICE
              </button>

              <button className="menu-btn play-btn title-main-cta title-online-cta" onClick={() => onPlay('multiplayer')}>
                <span className="btn-glow"></span>
                PLAY ONLINE
              </button>

              <p className="title-mode-note">
                Solo Practice fills a private server room with up to 25 bots for dense touch testing and fast warmups.
              </p>

              <div className="secondary-btns">
                <button className="menu-btn secondary" onClick={onSkins}>
                  Change Skin
                </button>
                <button className="menu-btn secondary" onClick={onOptions}>
                  Settings
                </button>
                <button className="menu-btn secondary" onClick={onHelp}>
                  Help
                </button>
              </div>
            </div>
          </div>

          <div className="title-panel-column">
            <div className="title-feature-stack">
              {featureHighlights.map((feature) => (
                <div key={feature.label} className="title-feature-card">
                  <span className="title-feature-label">{feature.label}</span>
                  <strong>{feature.value}</strong>
                </div>
              ))}
            </div>

            <div className="title-preview-panel">
              <div className="title-preview-grid" aria-hidden="true">
                <span className="title-preview-node is-primary" />
                <span className="title-preview-node" />
                <span className="title-preview-node is-accent" />
                <span className="title-preview-node" />
                <span className="title-preview-node is-primary" />
                <span className="title-preview-node" />
              </div>
              <div className="title-preview-copy">
                <span className="title-feature-label">Current build</span>
                <strong>Ready-up managed rooms, mobile-safe HUD, faster rendering</strong>
              </div>
            </div>

            {liveOps && (
              <div className="title-liveops-panel">
                <span className="title-feature-label">Cached live content</span>
                <strong>{liveOps.headline}</strong>
                <p>{liveOps.briefing}</p>
                <div className="title-liveops-season">{liveOps.season}</div>
                <div className="title-liveops-pack-list">
                  {liveOps.arenaPacks.map((pack) => (
                    <div key={pack.id} className="title-liveops-pack">
                      <span>{pack.name}</span>
                      <strong>{pack.status}</strong>
                      <p>{pack.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="footer-credits">v1.2.0 • AGENTIC POLISH PREVIEW</div>
    </div>
  );
};

export default TitleScreen;
