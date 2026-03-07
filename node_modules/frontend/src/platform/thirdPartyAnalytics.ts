import { getRuntimeConfig } from './backend';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

function getMeasurementId() {
  const value = (getRuntimeConfig().firebaseMeasurementId || '').trim();
  return value && !value.startsWith('%VITE_') ? value : '';
}

export function initThirdPartyAnalytics() {
  if (typeof document === 'undefined' || initialized) {
    return;
  }

  const measurementId = getMeasurementId();
  if (!measurementId) {
    return;
  }

  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

export function trackThirdPartyEvent(name: string, payload: Record<string, unknown> = {}) {
  if (!initialized || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', name, payload);
}