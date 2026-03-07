import { Capacitor } from '@capacitor/core';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

type SnakeyRuntimeConfig = {
  backendUrl?: string;
  firebaseMeasurementId?: string;
  admobAppIdAndroid?: string;
  admobBannerIdAndroid?: string;
  admobInterstitialIdAndroid?: string;
  admobRewardedIdAndroid?: string;
};

declare global {
  interface Window {
    __SNAKEY_CONFIG__?: SnakeyRuntimeConfig;
  }
}

function normalizeBackendUrl(url: string | undefined) {
  const value = (url || '').trim();
  if (!value || value.startsWith('%VITE_')) {
    return '';
  }

  return value.replace(/\/$/, '');
}

function getConfiguredBackendUrl() {
  if (typeof window === 'undefined') {
    return '';
  }

  const runtimeConfigUrl = normalizeBackendUrl(window.__SNAKEY_CONFIG__?.backendUrl);
  if (runtimeConfigUrl) {
    return runtimeConfigUrl;
  }

  try {
    return normalizeBackendUrl(window.localStorage.getItem('snakey.backendUrl') || '');
  } catch {
    return '';
  }
}

export function getBackendBaseUrl() {
  const configuredBackendUrl = getConfiguredBackendUrl();
  if (configuredBackendUrl) {
    return configuredBackendUrl;
  }

  if (Capacitor.isNativePlatform()) {
    if (Capacitor.getPlatform() === 'android') {
      return 'http://10.0.2.2:3000';
    }

    return 'http://localhost:3000';
  }

  return LOCAL_HOSTNAMES.has(window.location.hostname)
    ? 'http://localhost:3000'
    : window.location.origin;
}

export function getBackendDisplayTarget() {
  return getBackendBaseUrl().replace(/^https?:\/\//, '');
}

export function getBackendUrl(path = '') {
  const baseUrl = getBackendBaseUrl().replace(/\/$/, '');
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  return `${baseUrl}${normalizedPath}`;
}

type BackendProbeResult = {
  ok: boolean;
  message: string;
};

export async function probeBackendHealth(timeoutMs = 4000): Promise<BackendProbeResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(getBackendUrl('/'), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `Health check returned HTTP ${response.status}`,
      };
    }

    const payload = (await response.json()) as { status?: string; game?: string };
    return {
      ok: true,
      message: `Health check OK${payload.game ? `: ${payload.game}` : ''}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getRuntimeConfig() {
  if (typeof window === 'undefined') {
    return {} as SnakeyRuntimeConfig;
  }

  return window.__SNAKEY_CONFIG__ || {};
}