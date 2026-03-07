import React, { useEffect, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import Lobby from './components/Lobby';
import { ProfileManager } from './game/ProfileManager';
import { AudioEngine } from './game/AudioEngine';
import { analyticsClient } from './game/Analytics';
import {
  enableCrashReporting,
  getInstallReferrerData,
  hideLobbyBanner,
  initializeGrowthSdk,
  recordNativeNonFatal,
  registerNativePushNotifications,
  setFirebaseIdentity,
  setFirebaseUserProperty,
  showPlacementInterstitial,
  syncSavedPushToken,
} from './platform/growthBridge';
import { initThirdPartyAnalytics } from './platform/thirdPartyAnalytics';
import TitleScreen from './components/TitleScreen';
import OptionsScreen from './components/OptionsScreen';
import HelpScreen from './components/HelpScreen';
import IntroCinematic from './components/IntroCinematic';
import SkinLabScreen from './components/SkinLabScreen';
import './index.css';
import { isNativeAndroid } from './platform/android';

type Screen = 'intro' | 'title' | 'options' | 'help' | 'skins' | 'lobby' | 'game';

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

type MatchSummary = {
  xpEarned: number;
  matchKills?: number;
  maxMass?: number;
  mode?: string;
  deathCause?: string;
  killerName?: string;
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

type TitlePlayMode = 'practice' | 'multiplayer';

type AudioController = {
  masterVolume: number;
  sfxVolume: number;
  enabled: boolean;
  voiceEnabled?: boolean;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setEnabled: (enabled: boolean) => void;
  setVoiceEnabled?: (enabled: boolean) => void;
  playEat: () => void;
  resume: () => void;
  startAmbient: (state?: string) => void;
  setMusicState?: (state: string) => void;
  announce?: (text: string, options?: Record<string, unknown>) => void;
  playCinematicSting?: () => void;
};

const fallbackAudio: AudioController = {
  masterVolume: 0.3,
  sfxVolume: 1,
  enabled: false,
  voiceEnabled: false,
  setMasterVolume: () => {},
  setSfxVolume: () => {},
  setEnabled: () => {},
  setVoiceEnabled: () => {},
  playEat: () => {},
  resume: () => {},
  startAmbient: () => {},
  setMusicState: () => {},
  announce: () => {},
  playCinematicSting: () => {},
};

function App() {
  const [audioEngine] = useState<AudioController>(() => {
    try {
      return new AudioEngine() as unknown as AudioController;
    } catch (err) {
      console.error('AudioEngine initialization failed, continuing with silent mode.', err);
      return fallbackAudio;
    }
  });

  const [screen, setScreen] = useState<Screen>('intro');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lastMatchStats, setLastMatchStats] = useState<MatchStats | null>(null);
  const [skinLabReturnScreen, setSkinLabReturnScreen] = useState<'title' | 'lobby'>('title');
  const [performancePreset, setPerformancePreset] = useState<'adaptive' | 'ultra'>(
    () => ((ProfileManager.getProfile() as Profile).performancePreset === 'ultra' ? 'ultra' : 'adaptive')
  );

  useEffect(() => {
    initThirdPartyAnalytics();
    analyticsClient.init();
    void initializeGrowthSdk();
    void enableCrashReporting(true);
    void registerNativePushNotifications().then((result) => {
      if (result.token) {
        analyticsClient.track('push_notifications_ready', { provider: 'fcm' });
      }
    });
    void getInstallReferrerData().then((referrer) => {
      if (referrer) {
        analyticsClient.track('install_referrer', referrer as Record<string, unknown>);
      }
    });

    const handleError = (event: ErrorEvent) => {
      void recordNativeNonFatal(event.error || event.message, 'window_error');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      void recordNativeNonFatal(event.reason, 'unhandled_rejection');
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      analyticsClient.dispose();
    };
  }, []);

  useEffect(() => {
    analyticsClient.track('screen_view', { screen });
    void setFirebaseUserProperty('current_screen', screen);
    if (screen === 'intro') {
      audioEngine.setMusicState?.('briefing');
      audioEngine.playCinematicSting?.();
    } else if (screen === 'title' || screen === 'options' || screen === 'help' || screen === 'skins' || screen === 'lobby') {
      audioEngine.setMusicState?.('menu');
    } else if (screen === 'game') {
      audioEngine.setMusicState?.('combat');
    }

    if (screen !== 'lobby') {
      void hideLobbyBanner();
    }
  }, [audioEngine, screen]);

  useEffect(() => {
    void setFirebaseIdentity(profile?.name || null);
    void syncSavedPushToken(profile?.name || null);
  }, [profile?.name]);

  useEffect(() => {
    if (!isNativeAndroid()) {
      return;
    }

    let removeListener: (() => void) | undefined;

    const attachBackHandler = async () => {
      try {
        const { App: CapacitorApp } = await import('@capacitor/app');
        const listener = await CapacitorApp.addListener('backButton', () => {
          if (screen === 'game') {
            setProfile(null);
            setLastMatchStats(null);
            setScreen('lobby');
            return;
          }

          if (screen === 'options' || screen === 'help') {
            setScreen('title');
            return;
          }

          if (screen === 'skins') {
            setScreen(skinLabReturnScreen);
            return;
          }

          if (screen === 'lobby') {
            setScreen('title');
            return;
          }

          CapacitorApp.exitApp();
        });

        removeListener = () => {
          void listener.remove();
        };
      } catch (error) {
        console.warn('Android back handler setup failed', error);
      }
    };

    void attachBackHandler();

    return () => {
      removeListener?.();
    };
  }, [screen, skinLabReturnScreen]);

  const handleOpenSkinsFromTitle = () => {
    setSkinLabReturnScreen('title');
    setScreen('skins');
  };

  const handleOpenSkinsFromLobby = () => {
    setSkinLabReturnScreen('lobby');
    setScreen('skins');
  };

  const handlePlayFromTitle = (mode: TitlePlayMode) => {
    audioEngine.resume();
    audioEngine.startAmbient('combat');
    analyticsClient.track('play_selected', { mode });
    if (mode === 'practice') {
      audioEngine.announce?.('Private practice arena armed.', { interrupt: true });
      const offlineProfile = ProfileManager.getProfile() as Profile;
      offlineProfile.mode = 'OFFLINE';
      offlineProfile.performancePreset = performancePreset;
      setProfile(offlineProfile);
      setLastMatchStats(null);
      setScreen('game');
    } else {
      audioEngine.announce?.('Multiplayer lobby open.', { interrupt: true });
      setScreen('lobby');
    }
  };

  const handlePlayFromLobby = (loadedProfile: Profile) => {
    const nextProfile = {
      ...loadedProfile,
      performancePreset,
      mode: loadedProfile.mode || 'FFA',
    };
    analyticsClient.track('match_start', {
      mode: nextProfile.mode,
      playerName: nextProfile.name,
      level: nextProfile.level,
    });
    audioEngine.announce?.(`${nextProfile.mode || 'Free for all'} arena deploying.`, { interrupt: true });
    setProfile(nextProfile);
    setLastMatchStats(null);
    setScreen('game');
  };

  const handleGameOver = (summary: MatchSummary) => {
    const previousProfile = ProfileManager.getProfile() as Profile;
    const result = ProfileManager.addXP(summary.xpEarned, summary) as {
      leveledUp: boolean;
      newLevel: number;
      newUnlocks: string[];
      newChallenges: string[];
      profile: Profile;
    };
    analyticsClient.track('match_end', {
      mode: summary.mode || 'FFA',
      xpEarned: summary.xpEarned,
      matchKills: summary.matchKills || 0,
      maxMass: summary.maxMass || 0,
      deathCause: summary.deathCause || 'unknown',
    });
    audioEngine.setMusicState?.('results');
    if ((summary.matchKills || 0) >= 3) {
      audioEngine.announce?.(`Run complete. ${summary.matchKills} eliminations confirmed.`, { interrupt: true });
    }
    setProfile(null);
    setLastMatchStats({
      xpEarned: summary.xpEarned,
      leveledUp: result.leveledUp,
      newLevel: result.newLevel,
      newUnlocks: result.newUnlocks || [],
      newChallenges: result.newChallenges || [],
      matchKills: summary.matchKills || 0,
      maxMass: summary.maxMass || 0,
      previousLevel: previousProfile.level,
      previousXp: previousProfile.xp,
      mode: summary.mode,
      deathCause: summary.deathCause,
      killerName: summary.killerName,
      profile: result.profile,
    });
    setScreen('lobby');
    void showPlacementInterstitial();
  };

  const handleConnectionLost = () => {
    analyticsClient.track('connection_lost', { screen, profileName: profile?.name || null });
    audioEngine.announce?.('Connection lost. Returning to lobby.', { interrupt: true });
    setProfile(null);
    setLastMatchStats(null);
    setScreen('lobby');
    alert('Connection to server lost. Returning to lobby.');
  };

  const handleIntroComplete = () => {
    analyticsClient.track('intro_complete');
    audioEngine.resume();
    audioEngine.startAmbient('menu');
    audioEngine.announce?.('Welcome to Snakey I O.', { interrupt: true, force: true });
    setScreen('title');
  };

  const handleIntroSkip = () => {
    analyticsClient.track('intro_skipped');
    audioEngine.resume();
    audioEngine.startAmbient('menu');
    setScreen('title');
  };

  const handlePerformancePresetChange = (nextPreset: 'adaptive' | 'ultra') => {
    const storedProfile = ProfileManager.getProfile() as Profile;
    const updatedProfile = {
      ...storedProfile,
      performancePreset: nextPreset,
    };

    ProfileManager.saveProfile(updatedProfile);
    setPerformancePreset(nextPreset);

    if (profile) {
      setProfile({ ...profile, performancePreset: nextPreset });
    }

    if (lastMatchStats?.profile) {
      setLastMatchStats({
        ...lastMatchStats,
        profile: {
          ...lastMatchStats.profile,
          performancePreset: nextPreset,
        },
      });
    }
  };

  return (
    <div className="game-container">
      {screen === 'intro' && <IntroCinematic onComplete={handleIntroComplete} onSkip={handleIntroSkip} />}

      {screen === 'title' && (
        <TitleScreen
          onPlay={handlePlayFromTitle}
          onSkins={handleOpenSkinsFromTitle}
          onOptions={() => setScreen('options')}
          onHelp={() => setScreen('help')}
        />
      )}

      {screen === 'options' && (
        <OptionsScreen
          audio={audioEngine}
          performancePreset={performancePreset}
          onPerformancePresetChange={handlePerformancePresetChange}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'help' && <HelpScreen onBack={() => setScreen('title')} />}

      {screen === 'skins' && <SkinLabScreen onBack={() => setScreen(skinLabReturnScreen)} />}

      {screen === 'lobby' && (
        <Lobby onPlay={handlePlayFromLobby} onOpenSkins={handleOpenSkinsFromLobby} lastMatchStats={lastMatchStats} />
      )}

      {screen === 'game' && profile && (
        <GameCanvas
          profile={profile}
          onGameOver={handleGameOver}
          onConnectionLost={handleConnectionLost}
        />
      )}
    </div>
  );
}

export default App;
