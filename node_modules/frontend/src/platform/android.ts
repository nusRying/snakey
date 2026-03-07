import { Capacitor } from '@capacitor/core';

type WakeLockHandle = {
  release?: () => Promise<void> | void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockHandle>;
  };
};

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'portrait') => Promise<void>;
};

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function configureAndroidShell() {
  if (!isNativeAndroid()) {
    return () => {};
  }

  document.documentElement.classList.add('native-android');

  let wakeLock: WakeLockHandle | null = null;

  const requestWakeLock = async () => {
    try {
      const nav = navigator as WakeLockNavigator;
      if (!nav.wakeLock?.request) return;

      wakeLock = await nav.wakeLock.request('screen');
    } catch (error) {
      console.warn('Android shell: wake lock unavailable', error);
    }
  };

  const releaseWakeLock = async () => {
    try {
      await wakeLock?.release?.();
    } catch (error) {
      console.warn('Android shell: wake lock release failed', error);
    } finally {
      wakeLock = null;
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#050505' });
  } catch (error) {
    console.warn('Android shell: status bar setup failed', error);
  }

  const lockableOrientation = screen.orientation as LockableOrientation | undefined;
  if (lockableOrientation?.lock) {
    lockableOrientation.lock('portrait').catch(() => {});
  }

  void requestWakeLock();

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    void releaseWakeLock();
  };
}