import React, { useMemo, useState } from 'react';
import { ProfileManager, SKINS, getSkinById, getSkinUnlockRequirementText } from '../game/ProfileManager';

type Profile = {
  name: string;
  xp: number;
  level: number;
  selectedSkin: string;
  unlockedSkins: string[];
  completedChallenges?: string[];
  challengeProgress?: Record<string, number>;
  performancePreset?: 'adaptive' | 'ultra';
  dailyRewards?: {
    lastClaimDate: string | null;
    streak: number;
    bestStreak: number;
    totalClaims: number;
  };
  mode?: string;
};

type SkinDefinition = {
  id: string;
  name: string;
  line: string;
  tagline: string;
  rarity: string;
  baseColor: string;
  secondaryColor: string;
  accentColor: string;
  trailColor: string;
  pattern: string;
  trailStyle: string;
  deathEffect: string;
};

type SkinLabScreenProps = {
  onBack: () => void;
};

function toSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

function getRarityTone(rarity: string) {
  return `tone-${toSlug(rarity)}`;
}

function renderSkinMotif(skin: SkinDefinition, size: number) {
  const accentOpacity = skin.pattern === 'ethereal' ? 0.45 : 0.72;

  switch (skin.pattern) {
    case 'stripe':
      return (
        <>
          <path d={`M ${size * 0.12} ${size * 0.72} L ${size * 0.72} ${size * 0.12}`} stroke={skin.accentColor} strokeWidth={size * 0.08} strokeLinecap="round" opacity={accentOpacity} />
          <path d={`M ${size * 0.26} ${size * 0.88} L ${size * 0.88} ${size * 0.26}`} stroke={skin.secondaryColor} strokeWidth={size * 0.08} strokeLinecap="round" opacity={0.5} />
        </>
      );
    case 'ethereal':
      return (
        <>
          <circle cx={size * 0.3} cy={size * 0.3} r={size * 0.15} fill={skin.accentColor} opacity={0.42} />
          <circle cx={size * 0.68} cy={size * 0.58} r={size * 0.11} fill="#ffffff" opacity={0.32} />
        </>
      );
    case 'royal':
      return (
        <>
          <path d={`M ${size * 0.24} ${size * 0.72} L ${size * 0.5} ${size * 0.18} L ${size * 0.76} ${size * 0.72}`} fill="none" stroke={skin.accentColor} strokeWidth={size * 0.08} strokeLinecap="round" opacity={0.62} />
          <circle cx={size * 0.5} cy={size * 0.2} r={size * 0.08} fill={skin.accentColor} opacity={0.85} />
        </>
      );
    case 'frost':
      return (
        <>
          <path d={`M ${size * 0.5} ${size * 0.16} L ${size * 0.5} ${size * 0.84}`} stroke="#ffffff" strokeWidth={size * 0.06} opacity={0.54} />
          <path d={`M ${size * 0.22} ${size * 0.34} L ${size * 0.78} ${size * 0.66}`} stroke={skin.accentColor} strokeWidth={size * 0.05} opacity={0.42} />
          <path d={`M ${size * 0.22} ${size * 0.66} L ${size * 0.78} ${size * 0.34}`} stroke={skin.secondaryColor} strokeWidth={size * 0.05} opacity={0.42} />
        </>
      );
    case 'venom':
      return (
        <>
          <circle cx={size * 0.32} cy={size * 0.34} r={size * 0.14} fill={skin.secondaryColor} opacity={0.55} />
          <circle cx={size * 0.68} cy={size * 0.62} r={size * 0.12} fill={skin.secondaryColor} opacity={0.48} />
        </>
      );
    case 'cosmic':
      return (
        <>
          <circle cx={size * 0.22} cy={size * 0.28} r={size * 0.05} fill={skin.accentColor} />
          <circle cx={size * 0.58} cy={size * 0.24} r={size * 0.04} fill="#ffffff" opacity={0.92} />
          <circle cx={size * 0.7} cy={size * 0.64} r={size * 0.06} fill="#ffffff" opacity={0.62} />
        </>
      );
    case 'prism':
      return <path d={`M ${size * 0.2} ${size * 0.74} L ${size * 0.5} ${size * 0.2} L ${size * 0.8} ${size * 0.74} Z`} fill="none" stroke="#ffffff" strokeWidth={size * 0.07} opacity={0.46} />;
    case 'neon':
      return <path d={`M ${size * 0.2} ${size * 0.52} L ${size * 0.44} ${size * 0.28} L ${size * 0.58} ${size * 0.52} L ${size * 0.8} ${size * 0.24}`} stroke={skin.accentColor} strokeWidth={size * 0.08} strokeLinecap="round" fill="none" opacity={0.74} />;
    default:
      return <circle cx={size * 0.32} cy={size * 0.32} r={size * 0.14} fill={skin.accentColor} opacity={0.38} />;
  }
}

function SkinPreview({ skin, large = false }: { skin: SkinDefinition; large?: boolean }) {
  const width = large ? 220 : 124;
  const height = large ? 136 : 68;
  const headSize = large ? 48 : 28;
  const segmentSizes = large ? [32, 30, 28, 26, 24, 22] : [18, 17, 16, 15];
  const previewId = `${skin.id}-${large ? 'lg' : 'sm'}`;

  return (
    <div className={cx('skin-preview', large && 'is-large')}>
      <svg className="skin-preview-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${skin.name} preview`}>
        <defs>
          <linearGradient id={`${previewId}-body`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={skin.baseColor} />
            <stop offset="100%" stopColor={skin.secondaryColor} />
          </linearGradient>
          <radialGradient id={`${previewId}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={skin.accentColor} stopOpacity="0.38" />
            <stop offset="100%" stopColor={skin.accentColor} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={width * 0.42} cy={height * 0.62} rx={width * 0.34} ry={height * 0.26} fill={`url(#${previewId}-glow)`} />
        {segmentSizes.map((size, index) => {
          const radius = size / 2;
          const x = large ? 36 + index * 23 : 18 + index * 13;
          const y = large ? 82 - index * 8 : 42 - index * 3;
          return (
            <g key={`${skin.id}-segment-${index}`}>
              <circle cx={x} cy={y} r={radius} fill={`url(#${previewId}-body)`} stroke={skin.accentColor} strokeWidth={large ? 2 : 1.5} />
              <g transform={`translate(${x - radius}, ${y - radius})`}>
                {renderSkinMotif(skin, size)}
              </g>
            </g>
          );
        })}
        <g transform={`translate(${width - headSize - (large ? 20 : 10)}, ${large ? 18 : 10})`}>
          <circle cx={headSize / 2} cy={headSize / 2} r={headSize / 2 - 1.5} fill={`url(#${previewId}-body)`} stroke={skin.accentColor} strokeWidth={large ? 2.5 : 2} />
          {renderSkinMotif(skin, headSize)}
          <circle cx={headSize * 0.34} cy={headSize * 0.38} r={large ? 4.5 : 3} fill="#111827" />
          <circle cx={headSize * 0.68} cy={headSize * 0.38} r={large ? 4.5 : 3} fill="#111827" />
          <circle cx={headSize * 0.36} cy={headSize * 0.34} r={large ? 1.8 : 1.2} fill="#ffffff" />
          <circle cx={headSize * 0.7} cy={headSize * 0.34} r={large ? 1.8 : 1.2} fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}

const SkinLabScreen = ({ onBack }: SkinLabScreenProps) => {
  const [profile, setProfile] = useState<Profile>(() => ProfileManager.getProfile() as Profile);
  const selectedSkin = getSkinById(profile.selectedSkin) as SkinDefinition;
  const featuredAnimalSkins = useMemo(
    () => SKINS.filter((skin) => skin.line === 'Animal Parade') as SkinDefinition[],
    []
  );

  const handleSkinSelect = (skinId: string) => {
    if (!profile.unlockedSkins.includes(skinId)) return;

    const updatedProfile = { ...profile, selectedSkin: skinId };
    ProfileManager.saveProfile(updatedProfile);
    setProfile(updatedProfile);
  };

  return (
    <div className="menu-screen skin-lab-screen">
      <div className="glass-card skin-lab-shell">
        <div className="screen-kicker">Skin Lab</div>
        <div className="skin-lab-header">
          <div>
            <h2>COIL CUSTOMIZER</h2>
            <p className="options-intro skin-lab-intro">
              Pick a skin loadout on its own screen, with cute animal-inspired lines mixed into the full collection.
            </p>
          </div>
          <div className="skin-lab-chip-stack">
            <span className="lobby-chip lobby-chip-strong">Unlocked {profile.unlockedSkins.length}/{SKINS.length}</span>
            <span className="lobby-chip">Equipped: {selectedSkin.name}</span>
          </div>
        </div>

        <div className="lobby-skin-showcase glass-panel skin-lab-hero">
          <div className="lobby-skin-showcase-grid">
            <div className={cx('lobby-selected-skin-stage', getRarityTone(selectedSkin.rarity))}>
              <SkinPreview skin={selectedSkin} large />
            </div>
            <div>
              <div className="lobby-selected-badges">
                <span className={cx('lobby-rarity-badge', getRarityTone(selectedSkin.rarity))}>{selectedSkin.rarity}</span>
                <span className="lobby-rarity-badge tone-equipped">Equipped</span>
              </div>
              <h2 className="lobby-selected-name">{selectedSkin.name}</h2>
              <div className="lobby-selected-line">{selectedSkin.line}</div>
              <p className={cx('lobby-selected-tagline', getRarityTone(selectedSkin.rarity))}>{selectedSkin.tagline}</p>
              <p className="lobby-selected-copy">
                Style is separate now: pick your cutest coil here, then head back to the lobby when you are ready to deploy.
              </p>
              <div className="lobby-selected-meta">
                <span className="lobby-meta-pill">Trail: {selectedSkin.trailStyle}</span>
                <span className="lobby-meta-pill">KO burst: {selectedSkin.deathEffect}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="skin-lab-feature-panel glass-panel">
          <div className="lobby-section-header">
            <div>
              <h3 className="lobby-section-title">Cute Animal Line</h3>
              <p className="lobby-section-copy">
                Softer palettes, playful names, and animal-inspired silhouettes for a friendlier mobile skin collection.
              </p>
            </div>
          </div>
          <div className="skin-lab-feature-grid">
            {featuredAnimalSkins.map((skin) => {
              const isUnlocked = profile.unlockedSkins.includes(skin.id);
              const isSelected = profile.selectedSkin === skin.id;

              return (
                <button
                  key={skin.id}
                  type="button"
                  onClick={() => handleSkinSelect(skin.id)}
                  className={cx(
                    'skin-lab-feature-card',
                    getRarityTone(skin.rarity),
                    isUnlocked ? 'is-unlocked' : 'is-locked',
                    isSelected && 'is-selected'
                  )}
                >
                  <div className="lobby-skin-card-header">
                    <span className={cx('lobby-rarity-badge', getRarityTone(skin.rarity))}>{skin.rarity}</span>
                    {isSelected && <span className="lobby-skin-equipped">Equipped</span>}
                  </div>
                  <SkinPreview skin={skin} />
                  <strong>{skin.name}</strong>
                  <span>{skin.tagline}</span>
                  {!isUnlocked && <em>{getSkinUnlockRequirementText(skin)}</em>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lobby-skin-section skin-lab-collection">
          <div className="lobby-section-header">
            <div>
              <h3 className="lobby-section-title">Full Collection</h3>
              <p className="lobby-section-copy">Tap any unlocked skin to equip it instantly.</p>
            </div>
          </div>

          <div className="lobby-skin-grid">
            {SKINS.map((skin) => {
              const typedSkin = skin as SkinDefinition;
              const isUnlocked = profile.unlockedSkins.includes(typedSkin.id);
              const isSelected = profile.selectedSkin === typedSkin.id;

              return (
                <div
                  key={typedSkin.id}
                  onClick={() => isUnlocked && handleSkinSelect(typedSkin.id)}
                  className={cx(
                    'glass-panel',
                    'lobby-skin-card',
                    getRarityTone(typedSkin.rarity),
                    isUnlocked ? 'is-unlocked' : 'is-locked',
                    isSelected && 'is-selected'
                  )}
                >
                  <div className="lobby-skin-card-header">
                    <span className={cx('lobby-rarity-badge', getRarityTone(typedSkin.rarity))}>{typedSkin.rarity}</span>
                    {isSelected && <span className="lobby-skin-equipped">Equipped</span>}
                  </div>
                  <SkinPreview skin={typedSkin} />
                  <div className="lobby-skin-name">{typedSkin.name}</div>
                  <div className="lobby-skin-line">{typedSkin.line}</div>
                  <div className="lobby-skin-copy">{typedSkin.tagline}</div>
                  {!isUnlocked && <div className="lobby-skin-lock-copy">{getSkinUnlockRequirementText(typedSkin)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        <button className="menu-btn secondary back-btn" onClick={onBack}>
          BACK
        </button>
      </div>
    </div>
  );
};

export default SkinLabScreen;