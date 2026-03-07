import React, { useEffect, useState } from 'react';
import {
  getModeDefinition,
  getModeOptions,
  registerDownloadedModes,
  type ArenaPreview,
  type ModeDefinition,
} from '../game/ModeThemes';
import {
  CHALLENGES,
  ProfileManager,
  SKINS,
  getDailyRewardStatus,
  getSkinById,
  getSkinUnlockRequirementText,
} from '../game/ProfileManager';
import { analyticsClient } from '../game/Analytics';
import { fetchArenaPacks, getCachedArenaPacks, type DownloadableArenaPack } from '../game/LiveOps';
import {
  areAdsEnabled,
  getGoogleAuthUser,
  hideLobbyBanner,
  showLobbyBanner,
  showRewardedPlacement,
  signInWithGoogle,
  signOutGoogle,
  supportsGoogleIdentity,
  type GoogleAuthUser,
} from '../platform/growthBridge';
import { getBackendUrl } from '../platform/backend';
import ShaderBackdrop from './ShaderBackdrop';

type Profile = {
  name: string;
  xp: number;
  level: number;
  performancePreset?: 'adaptive' | 'ultra';
  selectedSkin: string;
  unlockedSkins: string[];
  completedChallenges?: string[];
  challengeProgress?: Record<string, number>;
  dailyRewards?: {
    lastClaimDate: string | null;
    streak: number;
    bestStreak: number;
    totalClaims: number;
  };
  mode?: string;
};

type MatchStats = {
  xpEarned: number;
  leveledUp: boolean;
  newLevel: number;
  newUnlocks: string[];
  newChallenges: string[];
  matchKills: number;
  maxMass: number;
  previousLevel: number;
  previousXp: number;
  mode?: string;
  deathCause?: string;
  killerName?: string;
  profile: Profile;
};

type SkinDefinition = {
  id: string;
  name: string;
  line: string;
  tagline: string;
  rarity: string;
  requiredLevel: number;
  baseColor: string;
  secondaryColor: string;
  accentColor: string;
  trailColor: string;
  pattern: string;
  trailStyle: string;
  deathEffect: string;
};

type ChallengeDefinition = {
  id: string;
  name: string;
  description: string;
  target: number;
};

type LeaderboardRow = {
  name: string;
  level: number;
  xp: number;
};

type LevelProgress = {
  currentLevel: number;
  percent: number;
  xpIntoLevel: number;
  xpRequired: number;
};

type LobbyProps = {
  onPlay: (profile: Profile) => void;
  onOpenSkins: () => void;
  lastMatchStats: MatchStats | null;
};

type LobbyToast = {
  id: string;
  title: string;
  detail: string;
  tone: string;
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

function getDeathSummary(stats: MatchStats, modeName: string) {
  switch (stats.deathCause) {
    case 'player':
      return {
        title: stats.killerName ? `Taken out by ${stats.killerName}.` : 'Taken out by another snake.',
        detail: `Your ${modeName} run ended in a player collision. The progression gains from that round have been banked below.`,
      };
    case 'wall':
      return {
        title: 'You hit the arena wall.',
        detail: `That ${modeName} run ended on a boundary impact. Your XP, challenge progress, and vault updates still counted.`,
      };
    case 'obstacle':
      return {
        title: 'You clipped a map blocker.',
        detail: `One of the themed survival obstacles ended the run. Review the layout preview and jump back in with the updated unlocks below.`,
      };
    case 'storm':
      return {
        title: 'The storm closed on you.',
        detail: `Battle Royale pressure finished the round. Your match rewards have still been applied to progression.`,
      };
    case 'blackhole':
      return {
        title: 'A black hole swallowed the run.',
        detail: `Hazard control broke down, but the round still advanced your skins, challenges, and XP path.`,
      };
    default:
      return {
        title: `${modeName} complete.`,
        detail: `You banked the run rewards successfully. Review the changes below and redeploy when ready.`,
      };
  }
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
    case 'magma':
      return (
        <path d={`M ${size * 0.2} ${size * 0.76} C ${size * 0.34} ${size * 0.32}, ${size * 0.54} ${size * 0.88}, ${size * 0.78} ${size * 0.22}`} stroke={skin.accentColor} strokeWidth={size * 0.09} strokeLinecap="round" fill="none" opacity={0.54} />
      );
    case 'prism':
      return (
        <path d={`M ${size * 0.2} ${size * 0.74} L ${size * 0.5} ${size * 0.2} L ${size * 0.8} ${size * 0.74} Z`} fill="none" stroke="#ffffff" strokeWidth={size * 0.07} opacity={0.46} />
      );
    case 'neon':
      return (
        <path d={`M ${size * 0.2} ${size * 0.52} L ${size * 0.44} ${size * 0.28} L ${size * 0.58} ${size * 0.52} L ${size * 0.8} ${size * 0.24}`} stroke={skin.accentColor} strokeWidth={size * 0.08} strokeLinecap="round" fill="none" opacity={0.74} />
      );
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

function ModeArenaPreview({ mode }: { mode: ModeDefinition }) {
  const themeClass = mode.themeId ? `theme-${mode.themeId}` : 'theme-level-reactive';
  const preview = mode.preview as ArenaPreview;

  return (
    <div className={cx('mode-preview', themeClass)}>
      <svg className="mode-preview-svg" viewBox={`0 0 ${preview.width} ${preview.height}`} role="img" aria-label={`${mode.name} arena preview`}>
        <rect className="mode-preview-bounds" x="3" y="3" width={preview.width - 6} height={preview.height - 6} rx="12" />
        <path className="mode-preview-grid" d={`M ${preview.width / 2} 8 V ${preview.height - 8} M 8 ${preview.height / 2} H ${preview.width - 8}`} />
        {(preview.obstacles || []).map((obstacle, index) => (
          <rect
            key={`${mode.id}-obstacle-${index}`}
            className="mode-preview-obstacle"
            x={obstacle.x}
            y={obstacle.y}
            width={obstacle.width}
            height={obstacle.height}
            rx="4"
          />
        ))}
        {(preview.hazards || []).map((hazard, index) => (
          <circle
            key={`${mode.id}-hazard-${index}`}
            className="mode-preview-hazard"
            cx={hazard.x}
            cy={hazard.y}
            r="5"
          />
        ))}
        {(preview.portals || []).map((portal, index) => (
          <circle
            key={`${mode.id}-portal-${index}`}
            className="mode-preview-portal"
            cx={portal.x}
            cy={portal.y}
            r="5.5"
          />
        ))}
      </svg>
      <div className="mode-preview-caption">
        <span>Layout preview</span>
        <span>{preview.obstacles?.length || 0} blockers</span>
      </div>
    </div>
  );
}

const Lobby = ({ onPlay, onOpenSkins, lastMatchStats }: LobbyProps) => {
  const initialProfile = (lastMatchStats?.profile || ProfileManager.getProfile()) as Profile;
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [nameInput, setNameInput] = useState(initialProfile.name);
  const [modeInput, setModeInput] = useState(
    initialProfile.mode && initialProfile.mode !== 'OFFLINE' ? initialProfile.mode : 'FFA'
  );
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardRow[]>([]);
  const [dailyRewardMessage, setDailyRewardMessage] = useState('');
  const [lobbyToasts, setLobbyToasts] = useState<LobbyToast[]>([]);
  const [availableModes, setAvailableModes] = useState<ModeDefinition[]>(() => getModeOptions());
  const [downloadedPacks, setDownloadedPacks] = useState<DownloadableArenaPack[]>(() => getCachedArenaPacks());
  const [rewardBusy, setRewardBusy] = useState(false);
  const [googleIdentity, setGoogleIdentity] = useState<GoogleAuthUser>({ signedIn: false });
  const [googleBusy, setGoogleBusy] = useState(false);
  const selectedSkin = getSkinById(profile.selectedSkin) as SkinDefinition;
  const unlockedCount = profile.unlockedSkins.length;
  const unlockedSkinNames = (lastMatchStats?.newUnlocks || []).map(
    (skinId) => (getSkinById(skinId) as SkinDefinition).name
  );
  const unlockedSkins = (lastMatchStats?.newUnlocks || []).map(
    (skinId) => getSkinById(skinId) as SkinDefinition
  );
  const unlockedChallengeNames = (lastMatchStats?.newChallenges || []).map(
    (challengeId) => CHALLENGES.find((challenge) => challenge.id === challengeId)?.name || challengeId
  );
  const dailyStatus = getDailyRewardStatus(profile);
  const selectedMode = getModeDefinition(modeInput) as ModeDefinition;
  const lastMatchMode = getModeDefinition(lastMatchStats?.mode || modeInput) as ModeDefinition;
  const performancePresetLabel = profile.performancePreset === 'ultra' ? 'Ultra Smooth' : 'Adaptive';
  const isTouchDevice =
    typeof window !== 'undefined' &&
    (window.innerWidth < 1000 || window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  const nextChallenge = CHALLENGES
    .map((challenge) => ({
      ...challenge,
      progressValue: profile.challengeProgress?.[challenge.id] || 0,
      completed: (profile.completedChallenges || []).includes(challenge.id),
    }))
    .filter((challenge) => !challenge.completed)
    .sort((a, b) => {
      const aRatio = a.progressValue / a.target;
      const bRatio = b.progressValue / b.target;
      return bRatio - aRatio;
    })[0];
  const xpProgressDelta = lastMatchStats
    ? Math.max(0, profile.xp - (lastMatchStats.previousXp || 0))
    : 0;
  const deathSummary = lastMatchStats ? getDeathSummary(lastMatchStats, lastMatchMode.name) : null;

  const enqueueLobbyToast = (title: string, detail: string, tone = 'info') => {
    const id = `${title}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLobbyToasts((current) => [...current, { id, title, detail, tone }].slice(-4));
    window.setTimeout(() => {
      setLobbyToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  };

  useEffect(() => {
    fetch(getBackendUrl('/api/leaderboard'))
      .then((res) => res.json())
      .then((data: LeaderboardRow[]) => setGlobalLeaderboard(data))
      .catch((err) => console.error('Failed to fetch leaderboard', err));
  }, []);

  useEffect(() => {
    void showLobbyBanner();
    return () => {
      void hideLobbyBanner();
    };
  }, []);

  useEffect(() => {
    registerDownloadedModes(downloadedPacks.map((pack) => pack.mode));
    setAvailableModes(getModeOptions());
  }, [downloadedPacks]);

  useEffect(() => {
    let active = true;
    void fetchArenaPacks().then((packs) => {
      if (!active) return;
      setDownloadedPacks(packs);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lastMatchStats?.profile) return;

    setProfile(lastMatchStats.profile);
    setNameInput(lastMatchStats.profile.name);
    setModeInput(
      lastMatchStats.profile.mode && lastMatchStats.profile.mode !== 'OFFLINE'
        ? lastMatchStats.profile.mode
        : 'FFA'
    );
  }, [lastMatchStats]);

  useEffect(() => {
    if (!supportsGoogleIdentity()) {
      return;
    }

    let active = true;
    void getGoogleAuthUser().then((identity: GoogleAuthUser) => {
      if (!active) return;
      setGoogleIdentity(identity);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lastMatchStats) return;

    if (lastMatchStats.newUnlocks.length > 0) {
      lastMatchStats.newUnlocks.forEach((skinId) => {
        const skin = getSkinById(skinId) as SkinDefinition;
        enqueueLobbyToast('Skin Unlocked', `${skin.name} is now available in your vault.`, toSlug(skin.rarity));
      });
    }

    if (lastMatchStats.newChallenges.length > 0) {
      lastMatchStats.newChallenges.forEach((challengeId) => {
        const challenge = CHALLENGES.find((entry) => entry.id === challengeId);
        enqueueLobbyToast('Challenge Cleared', challenge ? challenge.name : challengeId, 'challenge');
      });
    }
  }, [lastMatchStats]);

  if (!profile) {
    return (
      <div className="lobby-fallback lobby-fallback-warning">
        LOBBY: UNABLE TO LOAD PROFILE. Try clearing localStorage and reloading.
      </div>
    );
  }

  let progress: LevelProgress = { currentLevel: 0, percent: 0, xpIntoLevel: 0, xpRequired: 0 };
  try {
    progress = ProfileManager.getLevelProgress(profile.xp || 0) as LevelProgress;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return <div className="lobby-fallback lobby-fallback-error">CRASH IN XP CALC: {message}</div>;
  }

  const handlePlay = async () => {
    const updatedProfile: Profile = {
      ...profile,
      name: nameInput || 'Snek',
      mode: modeInput,
    };
    ProfileManager.saveProfile(updatedProfile);
    setProfile(updatedProfile);
    analyticsClient.track('lobby_deploy', { mode: modeInput, name: updatedProfile.name });
    onPlay(updatedProfile);
  };

  const handleRewardedBonus = async () => {
    if (rewardBusy) return;

    setRewardBusy(true);
    analyticsClient.track('rewarded_requested', { mode: modeInput });

    const reward = await showRewardedPlacement();
    if (reward.rewarded) {
      const bonus = ProfileManager.grantBonusXP(250, 'rewarded_ad') as {
        profile: Profile;
        xpGranted: number;
      };
      setProfile(bonus.profile);
      setNameInput(bonus.profile.name);
      enqueueLobbyToast('Rewarded Cache', `Bonus ${bonus.xpGranted} XP credited to your profile.`, 'challenge');
      analyticsClient.track('rewarded_completed', { xpGranted: bonus.xpGranted, mode: modeInput });
    } else {
      enqueueLobbyToast('Reward Cancelled', 'No bonus was granted because the ad did not complete.', 'warning');
      analyticsClient.track('rewarded_cancelled', { mode: modeInput });
    }

    setRewardBusy(false);
  };

  const handleSkinSelect = (skinId: string) => {
    if (!profile.unlockedSkins.includes(skinId)) return;

    const updatedProfile: Profile = { ...profile, selectedSkin: skinId };
    ProfileManager.saveProfile(updatedProfile);
    setProfile(updatedProfile);
  };

  const syncGoogleAccountLink = async (identity: GoogleAuthUser, profileName: string) => {
    if (!identity.signedIn || !identity.uid || !profileName) {
      return false;
    }

    const response = await fetch(getBackendUrl('/api/account/link-google'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: profileName,
        googleUid: identity.uid,
        googleEmail: identity.email || null,
        googlePhotoUrl: identity.photoUrl || null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Google account sync failed with status ${response.status}`);
    }

    return true;
  };

  useEffect(() => {
    if (!googleIdentity.signedIn || !googleIdentity.uid) {
      return;
    }

    void syncGoogleAccountLink(googleIdentity, profile.name).catch((error) => {
      console.warn('Lobby: Google account sync failed', error);
    });
  }, [googleIdentity.email, googleIdentity.signedIn, googleIdentity.uid, googleIdentity.photoUrl, profile.name]);

  const handleGoogleSignIn = async () => {
    if (googleBusy) return;

    setGoogleBusy(true);
    try {
      const identity = await signInWithGoogle();
      setGoogleIdentity(identity);
      if (identity.signedIn) {
        await syncGoogleAccountLink(identity, identity.displayName?.substring(0, 15) || profile.name);
        analyticsClient.track('google_sign_in', { email: identity.email || null });
        enqueueLobbyToast('Google Connected', identity.email || identity.displayName || 'Signed in successfully.', 'reward');

        if (identity.displayName) {
          const updatedProfile: Profile = {
            ...profile,
            name: identity.displayName.substring(0, 15),
          };
          ProfileManager.saveProfile(updatedProfile);
          setProfile(updatedProfile);
          setNameInput(updatedProfile.name);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      enqueueLobbyToast('Google Sign-In Failed', message, 'warning');
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGoogleSignOut = async () => {
    if (googleBusy) return;

    setGoogleBusy(true);
    try {
      await signOutGoogle();
      setGoogleIdentity({ signedIn: false });
      analyticsClient.track('google_sign_out');
      enqueueLobbyToast('Google Disconnected', 'You are back on a local-only profile session.', 'muted');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      enqueueLobbyToast('Google Sign-Out Failed', message, 'warning');
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <div className="lobby-root">
      <ShaderBackdrop variant="lobby" className="lobby-shader-backdrop" />
      {lobbyToasts.length > 0 && (
        <div className="lobby-toast-stack" aria-live="polite">
          {lobbyToasts.map((toast) => (
            <div key={toast.id} className={cx('lobby-toast', `tone-${toast.tone}`)}>
              <strong>{toast.title}</strong>
              <span>{toast.detail}</span>
            </div>
          ))}
        </div>
      )}

      <div className="glass-panel lobby-shell">
        <div className="lobby-brand-lockup">
          <img src="/snakey-logo.svg" alt="" aria-hidden="true" className="snakey-brand-mark snakey-brand-mark-lobby" />
          <h1 className="lobby-title">SNAKEY.IO</h1>
        </div>

        <section className="lobby-auth-strip glass-panel">
          <div className="lobby-auth-copy">
            <div className="lobby-post-match-kicker">Account</div>
            {supportsGoogleIdentity() ? (
              googleIdentity.signedIn ? (
                <>
                  <strong>{googleIdentity.displayName || 'Google account linked'}</strong>
                  <span>{googleIdentity.email || 'Firebase-authenticated Android session'}</span>
                </>
              ) : (
                <>
                  <strong>Connect Google</strong>
                  <span>Back up your profile identity and unlock authenticated Firebase sign-in on Android.</span>
                </>
              )
            ) : (
              <>
                <strong>Google Sign-In is Android-only right now</strong>
                <span>Use the installed Android app to attach a Google account to this profile.</span>
              </>
            )}
          </div>
          <div className="lobby-auth-actions">
            {googleIdentity.signedIn && googleIdentity.photoUrl ? (
              <img src={googleIdentity.photoUrl} alt="Google profile" className="lobby-auth-avatar" />
            ) : (
              <div className="lobby-auth-avatar lobby-auth-avatar-placeholder">G</div>
            )}
            {googleIdentity.signedIn ? (
              <button className="menu-btn secondary lobby-auth-btn" onClick={handleGoogleSignOut} disabled={googleBusy}>
                {googleBusy ? 'DISCONNECTING...' : 'SIGN OUT GOOGLE'}
              </button>
            ) : (
              <button className="menu-btn secondary lobby-auth-btn" onClick={handleGoogleSignIn} disabled={googleBusy || !supportsGoogleIdentity()}>
                {googleBusy ? 'CONNECTING...' : supportsGoogleIdentity() ? 'SIGN IN WITH GOOGLE' : 'ANDROID APP REQUIRED'}
              </button>
            )}
          </div>
        </section>

        {downloadedPacks.length > 0 && (
          <section className="lobby-live-pack-strip glass-panel">
            <div>
              <div className="lobby-post-match-kicker">Downloaded arena packs</div>
              <strong>{downloadedPacks.length} live modes synced from the backend</strong>
            </div>
            <div className="lobby-live-pack-list">
              {downloadedPacks.map((pack) => (
                <div key={pack.id} className="lobby-live-pack-card">
                  <span>{pack.mode.name}</span>
                  <strong>{pack.mode.themeLabel}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {lastMatchStats && (
          <section className="lobby-post-match-hero glass-panel">
            <div className="lobby-post-match-header">
              <div>
                <div className="lobby-post-match-kicker">Run Ended</div>
                <h2 className="lobby-post-match-title">
                  {lastMatchStats.leveledUp ? `Level ${lastMatchStats.newLevel} reached.` : deathSummary?.title}
                </h2>
                <p className="lobby-post-match-copy">
                  {deathSummary?.detail} You banked {lastMatchStats.xpEarned} XP and pushed your peak mass to{' '}
                  {Math.floor(lastMatchStats.maxMass || 0)}.
                </p>
              </div>
              <button className="menu-btn play-btn highlight lobby-post-match-btn" onClick={handlePlay}>
                Deploy Again
              </button>
            </div>

            <div className="lobby-post-match-grid">
              <div className="lobby-post-match-panel">
                <div className="lobby-post-match-stat-grid">
                  <div className="lobby-post-match-stat-card">
                    <span className="lobby-post-match-stat-label">XP gained</span>
                    <strong className="lobby-post-match-stat-value">+{lastMatchStats.xpEarned}</strong>
                  </div>
                  <div className="lobby-post-match-stat-card">
                    <span className="lobby-post-match-stat-label">Kills</span>
                    <strong className="lobby-post-match-stat-value">{lastMatchStats.matchKills}</strong>
                  </div>
                  <div className="lobby-post-match-stat-card">
                    <span className="lobby-post-match-stat-label">Peak mass</span>
                    <strong className="lobby-post-match-stat-value">{Math.floor(lastMatchStats.maxMass || 0)}</strong>
                  </div>
                  <div className="lobby-post-match-stat-card">
                    <span className="lobby-post-match-stat-label">Mode</span>
                    <strong className="lobby-post-match-stat-value">{lastMatchMode.themeLabel}</strong>
                  </div>
                </div>

                <div className="lobby-post-match-progress-card">
                  <div className="lobby-post-match-progress-copy">
                    <span>Profile XP moved</span>
                    <strong>+{xpProgressDelta}</strong>
                  </div>
                  <svg className="lobby-progress-track lobby-progress-track-post-match" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                    <rect className="lobby-progress-bg" x="0" y="0" width="100" height="10" rx="5" />
                    <rect className="lobby-progress-fill" x="0" y="0" width={progress.percent} height="10" rx="5" />
                  </svg>
                  <div className="lobby-post-match-progress-meta">
                    <span>
                      Lv {lastMatchStats.previousLevel} to Lv {progress.currentLevel}
                    </span>
                    <span>{Math.floor(progress.xpIntoLevel)} / {progress.xpRequired} XP</span>
                  </div>
                </div>
              </div>

              <div className="lobby-post-match-panel lobby-post-match-rewards">
                <div className="lobby-post-match-section-header">
                  <h3 className="lobby-panel-title">What changed</h3>
                  <span className="lobby-chip lobby-chip-strong">
                    {lastMatchStats.newUnlocks.length + lastMatchStats.newChallenges.length} updates
                  </span>
                </div>

                {(unlockedSkins.length > 0 || unlockedChallengeNames.length > 0 || lastMatchStats.leveledUp) ? (
                  <div className="lobby-post-match-update-list">
                    {lastMatchStats.leveledUp && (
                      <div className="lobby-post-match-update-card tone-levelup">
                        <strong>Level up</strong>
                        <span>You unlocked new progression at level {lastMatchStats.newLevel}.</span>
                      </div>
                    )}
                    {unlockedSkins.map((skin) => (
                      <div key={skin.id} className={cx('lobby-post-match-update-card', getRarityTone(skin.rarity))}>
                        <strong>{skin.name}</strong>
                        <span>{skin.tagline}</span>
                      </div>
                    ))}
                    {unlockedChallengeNames.map((challengeName) => (
                      <div key={challengeName} className="lobby-post-match-update-card tone-challenge">
                        <strong>{challengeName}</strong>
                        <span>Challenge complete.</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="lobby-post-match-empty">
                    <strong>No unlock this round.</strong>
                    <span>That run still counted toward your long-term skin and challenge progression.</span>
                  </div>
                )}

                {nextChallenge && (
                  <div className="lobby-post-match-next-goal">
                    <div className="lobby-post-match-section-header">
                      <h3 className="lobby-panel-title">Next best objective</h3>
                      <span className="lobby-chip">{Math.floor((nextChallenge.progressValue / nextChallenge.target) * 100)}%</span>
                    </div>
                    <p className="lobby-panel-copy">{nextChallenge.name}: {nextChallenge.description}</p>
                    <svg className="lobby-meter" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
                      <rect className="lobby-meter-track" x="0" y="0" width="100" height="8" rx="4" />
                      <rect className="lobby-meter-fill" x="0" y="0" width={Math.min(100, (nextChallenge.progressValue / nextChallenge.target) * 100)} height="8" rx="4" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="lobby-level-panel">
          <p className="lobby-level-copy">
            Level <strong className="lobby-level-value">{progress.currentLevel}</strong>
          </p>
          <svg className="lobby-progress-track" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
            <rect className="lobby-progress-bg" x="0" y="0" width="100" height="10" rx="5" />
            <rect className="lobby-progress-fill" x="0" y="0" width={progress.percent} height="10" rx="5" />
          </svg>
          <p className="lobby-progress-copy">
            {Math.floor(progress.xpIntoLevel)} / {progress.xpRequired} XP to next level
          </p>
        </div>

        <input
          type="text"
          value={nameInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNameInput(e.target.value.substring(0, 15))}
          placeholder="Enter Nickname"
          className="name-input lobby-name-input"
        />

        <button
          onClick={() => {
            const fresh = ProfileManager.resetProfile() as Profile;
            setProfile(fresh);
            setNameInput(fresh.name);
            setModeInput('FFA');
            setDailyRewardMessage('');
          }}
          className="lobby-reset-btn"
        >
          Reset Profile
        </button>

        <select
          value={modeInput}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModeInput(e.target.value)}
          className="name-input mode-select"
          aria-label="Select game mode"
        >
          {availableModes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.name}
            </option>
          ))}
        </select>

        <div className="lobby-mode-card glass-panel">
          <div className="lobby-mode-card-header">
            <div>
              <h3 className="lobby-card-title">{selectedMode.name}</h3>
              <p className="lobby-card-copy lobby-card-copy-lead">{selectedMode.shortDescription}</p>
              <p className="lobby-card-copy">{selectedMode.ruleSummary}</p>
            </div>
            <div>
              <div className="lobby-chip">Theme: {selectedMode.themeLabel}</div>
              <div className="lobby-chip">Render: {performancePresetLabel}</div>
            </div>
          </div>
          <div className="lobby-mode-flow-strip">
            <div className="lobby-mode-flow-card">
              <span className="lobby-mode-flow-label">Queue flow</span>
              <strong>{selectedMode.managedRoom ? 'Join room, then ready up in-match' : 'Instant drop-in matchmaking'}</strong>
            </div>
            <div className="lobby-mode-flow-card">
              <span className="lobby-mode-flow-label">Round style</span>
              <strong>{selectedMode.managedRoom ? 'Countdown + rematch staging' : 'Continuous growth loop'}</strong>
            </div>
          </div>
          {isTouchDevice && (
            <div className="lobby-mobile-brief" role="note" aria-label="Mobile controls summary">
              <span className="lobby-mobile-brief-kicker">Mobile brief</span>
              <span className="lobby-mobile-brief-copy">
                Left thumb steers. Right buttons trigger boost and skill. Managed rounds ask you to tap Ready once you enter the arena.
              </span>
            </div>
          )}
          <ModeArenaPreview mode={selectedMode} />
        </div>

        <div className="lobby-skin-section">
          <div className="lobby-section-header">
            <div>
              <h3 className="lobby-section-title">Skin Lab</h3>
              <p className="lobby-section-copy">
                Customization now lives on its own page. Preview your current look here, then open the lab to swap skins.
              </p>
            </div>
            <div className="lobby-chip lobby-chip-strong">Unlocked {unlockedCount}/{SKINS.length}</div>
          </div>

          <div className="lobby-skin-showcase glass-panel">
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
                  Your equipped skin is ready. Open the dedicated skin page to browse the full vault, including the new cute animal line.
                </p>
                <div className="lobby-selected-meta">
                  <span className="lobby-meta-pill">Trail: {selectedSkin.trailStyle}</span>
                  <span className="lobby-meta-pill">KO burst: {selectedSkin.deathEffect}</span>
                </div>
                <button className="menu-btn secondary skin-lab-launch-btn" onClick={onOpenSkins}>
                  OPEN SKIN LAB
                </button>
              </div>
            </div>
          </div>
        </div>

        <button className="menu-btn play-btn highlight lobby-deploy-btn" onClick={handlePlay}>
          {selectedMode.managedRoom ? 'ENTER STAGING ROOM' : 'DEPLOY SNAKE'}
        </button>

        {areAdsEnabled() && (
          <button className="menu-btn secondary lobby-reward-btn" onClick={handleRewardedBonus} disabled={rewardBusy}>
            {rewardBusy ? 'LOADING REWARD...' : 'WATCH REWARDED AD FOR +250 XP'}
          </button>
        )}

        {globalLeaderboard.length > 0 && (
          <div className="glass-panel lobby-leaderboard">
            <h3 className="lobby-leaderboard-title">Global Top 10 Hunters</h3>
            <div className="lobby-leaderboard-row lobby-leaderboard-head">
              <span>Rank</span>
              <span>Name</span>
              <span>Level</span>
              <span className="lobby-align-right">Total XP</span>
            </div>
            {globalLeaderboard.map((lb, idx) => (
              <div key={idx} className="lobby-leaderboard-row">
                <span className={cx('lobby-rank', idx < 3 && 'is-top')}>#{idx + 1}</span>
                <span className={cx('lobby-player-name', lb.name === profile.name && 'is-self')}>{lb.name}</span>
                <span>Lv {lb.level}</span>
                <span className="lobby-align-right">{lb.xp.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Lobby;
