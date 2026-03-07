import { Capacitor, registerPlugin } from '@capacitor/core';
import { getBackendUrl, getRuntimeConfig } from './backend';

type GrowthBridgePlugin = {
  initializeAds: (options?: { appId?: string }) => Promise<{ ok: boolean }>;
  showBanner: (options: { adUnitId: string }) => Promise<{ ok: boolean }>;
  hideBanner: () => Promise<{ ok: boolean }>;
  preloadInterstitial: (options: { adUnitId: string }) => Promise<{ ok: boolean }>;
  showInterstitial: () => Promise<{ shown: boolean }>;
  preloadRewarded: (options: { adUnitId: string }) => Promise<{ ok: boolean }>;
  showRewarded: () => Promise<{ rewarded: boolean; amount?: number; type?: string }>;
  getInstallReferrer: () => Promise<{
    installReferrer?: string;
    referrerClickTimestampSeconds?: number;
    installBeginTimestampSeconds?: number;
    installVersion?: string;
    googlePlayInstant?: boolean;
  }>;
  logAnalyticsEvent: (options: { name: string; params?: Record<string, unknown> }) => Promise<{ ok: boolean }>;
  setAnalyticsUserId: (options: { userId?: string | null }) => Promise<{ ok: boolean }>;
  setAnalyticsUserProperty: (options: { name: string; value?: string | null }) => Promise<{ ok: boolean }>;
  setCrashlyticsCollectionEnabled: (options: { enabled: boolean }) => Promise<{ ok: boolean }>;
  setCrashlyticsUserId: (options: { userId?: string | null }) => Promise<{ ok: boolean }>;
  recordNonFatal: (options: { message: string; reason?: string; stack?: string }) => Promise<{ ok: boolean }>;
  requestNotificationPermission: () => Promise<{ granted: boolean }>;
  registerForPushNotifications: () => Promise<{ granted: boolean; token?: string }>;
  getLastPushToken: () => Promise<{ token?: string | null }>;
  getGoogleAuthUser: () => Promise<{
    signedIn: boolean;
    uid?: string;
    displayName?: string;
    email?: string;
    photoUrl?: string;
    isAnonymous?: boolean;
  }>;
  signInWithGoogle: () => Promise<{
    signedIn: boolean;
    uid?: string;
    displayName?: string;
    email?: string;
    photoUrl?: string;
    isAnonymous?: boolean;
  }>;
  signOutGoogle: () => Promise<{ ok: boolean }>;
};

export type GoogleAuthUser = {
  signedIn: boolean;
  uid?: string;
  displayName?: string;
  email?: string;
  photoUrl?: string;
  isAnonymous?: boolean;
};

const GrowthBridge = registerPlugin<GrowthBridgePlugin>('GrowthBridge');

const TEST_IDS = {
  appId: 'ca-app-pub-3940256099942544~3347511713',
  bannerId: 'ca-app-pub-3940256099942544/6300978111',
  interstitialId: 'ca-app-pub-3940256099942544/1033173712',
  rewardedId: 'ca-app-pub-3940256099942544/5224354917',
};

const ADS_ENABLED = false;

export function areAdsEnabled() {
  return ADS_ENABLED;
}

function normalizeValue(value: string | undefined) {
  const trimmed = (value || '').trim();
  return trimmed && !trimmed.startsWith('%VITE_') ? trimmed : '';
}

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function supportsGoogleIdentity() {
  return isNativeAndroid();
}

function getConfig() {
  const runtime = getRuntimeConfig();
  return {
    appId: normalizeValue(runtime.admobAppIdAndroid) || TEST_IDS.appId,
    bannerId: normalizeValue(runtime.admobBannerIdAndroid) || TEST_IDS.bannerId,
    interstitialId: normalizeValue(runtime.admobInterstitialIdAndroid) || TEST_IDS.interstitialId,
    rewardedId: normalizeValue(runtime.admobRewardedIdAndroid) || TEST_IDS.rewardedId,
  };
}

let adsInitialized = false;

export async function initializeGrowthSdk() {
  if (!ADS_ENABLED || !isNativeAndroid() || adsInitialized) {
    return;
  }

  adsInitialized = true;
  try {
    await GrowthBridge.initializeAds({ appId: getConfig().appId });
  } catch (error) {
    adsInitialized = false;
    console.warn('GrowthBridge: ad initialization failed', error);
  }
}

export async function showLobbyBanner() {
  if (!ADS_ENABLED || !isNativeAndroid()) {
    return;
  }

  await initializeGrowthSdk();
  try {
    await GrowthBridge.showBanner({ adUnitId: getConfig().bannerId });
  } catch (error) {
    console.warn('GrowthBridge: banner show failed', error);
  }
}

export async function hideLobbyBanner() {
  if (!ADS_ENABLED || !isNativeAndroid()) {
    return;
  }

  try {
    await GrowthBridge.hideBanner();
  } catch (error) {
    console.warn('GrowthBridge: banner hide failed', error);
  }
}

export async function showPlacementInterstitial() {
  if (!ADS_ENABLED || !isNativeAndroid()) {
    return false;
  }

  await initializeGrowthSdk();
  try {
    await GrowthBridge.preloadInterstitial({ adUnitId: getConfig().interstitialId });
    const result = await GrowthBridge.showInterstitial();
    return Boolean(result.shown);
  } catch (error) {
    console.warn('GrowthBridge: interstitial failed', error);
    return false;
  }
}

export async function showRewardedPlacement() {
  if (!ADS_ENABLED || !isNativeAndroid()) {
    return { rewarded: false };
  }

  await initializeGrowthSdk();
  try {
    await GrowthBridge.preloadRewarded({ adUnitId: getConfig().rewardedId });
    return await GrowthBridge.showRewarded();
  } catch (error) {
    console.warn('GrowthBridge: rewarded ad failed', error);
    return { rewarded: false };
  }
}

export async function getInstallReferrerData() {
  if (!isNativeAndroid()) {
    return null;
  }

  try {
    return await GrowthBridge.getInstallReferrer();
  } catch (error) {
    console.warn('GrowthBridge: install referrer unavailable', error);
    return null;
  }
}

export async function logFirebaseEvent(name: string, params: Record<string, unknown> = {}) {
  if (!isNativeAndroid()) {
    return;
  }

  try {
    await GrowthBridge.logAnalyticsEvent({ name, params });
  } catch (error) {
    console.warn('GrowthBridge: firebase analytics event failed', error);
  }
}

export async function setFirebaseIdentity(userId?: string | null) {
  if (!isNativeAndroid()) {
    return;
  }

  try {
    await GrowthBridge.setAnalyticsUserId({ userId: userId || null });
    await GrowthBridge.setCrashlyticsUserId({ userId: userId || 'anonymous' });
  } catch (error) {
    console.warn('GrowthBridge: firebase identity failed', error);
  }
}

export async function setFirebaseUserProperty(name: string, value?: string | null) {
  if (!isNativeAndroid()) {
    return;
  }

  try {
    await GrowthBridge.setAnalyticsUserProperty({ name, value: value || null });
  } catch (error) {
    console.warn('GrowthBridge: firebase user property failed', error);
  }
}

export async function enableCrashReporting(enabled = true) {
  if (!isNativeAndroid()) {
    return;
  }

  try {
    await GrowthBridge.setCrashlyticsCollectionEnabled({ enabled });
  } catch (error) {
    console.warn('GrowthBridge: crash reporting toggle failed', error);
  }
}

export async function recordNativeNonFatal(error: unknown, reason = 'app_error') {
  if (!isNativeAndroid()) {
    return;
  }

  const normalized = error instanceof Error ? error : new Error(String(error));
  try {
    await GrowthBridge.recordNonFatal({
      message: normalized.message,
      reason,
      stack: normalized.stack,
    });
  } catch (reportError) {
    console.warn('GrowthBridge: crash report failed', reportError);
  }
}

async function persistPushToken(token: string, playerName?: string | null) {
  try {
    await fetch(getBackendUrl('/api/push/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        platform: 'android',
        playerName: playerName || null,
      }),
      keepalive: true,
    });
  } catch (error) {
    console.warn('GrowthBridge: push token persistence failed', error);
  }
}

export async function registerNativePushNotifications(playerName?: string | null) {
  if (!isNativeAndroid()) {
    return { granted: false, token: null as string | null };
  }

  try {
    const permission = await GrowthBridge.requestNotificationPermission();
    if (!permission.granted) {
      return { granted: false, token: null as string | null };
    }

    const result = await GrowthBridge.registerForPushNotifications();
    if (result.token) {
      await persistPushToken(result.token, playerName);
    }
    return { granted: result.granted, token: result.token || null };
  } catch (error) {
    console.warn('GrowthBridge: push registration failed', error);
    return { granted: false, token: null as string | null };
  }
}

export async function syncSavedPushToken(playerName?: string | null) {
  if (!isNativeAndroid()) {
    return null;
  }

  try {
    const result = await GrowthBridge.getLastPushToken();
    if (result.token) {
      await persistPushToken(result.token, playerName);
      return result.token;
    }
  } catch (error) {
    console.warn('GrowthBridge: saved push token sync failed', error);
  }

  return null;
}

export async function getGoogleAuthUser(): Promise<GoogleAuthUser> {
  if (!isNativeAndroid()) {
    return { signedIn: false };
  }

  try {
    return await GrowthBridge.getGoogleAuthUser();
  } catch (error) {
    console.warn('GrowthBridge: get google auth user failed', error);
    return { signedIn: false };
  }
}

export async function signInWithGoogle(): Promise<GoogleAuthUser> {
  if (!isNativeAndroid()) {
    return { signedIn: false };
  }

  return await GrowthBridge.signInWithGoogle();
}

export async function signOutGoogle() {
  if (!isNativeAndroid()) {
    return;
  }

  try {
    await GrowthBridge.signOutGoogle();
  } catch (error) {
    console.warn('GrowthBridge: google sign out failed', error);
  }
}