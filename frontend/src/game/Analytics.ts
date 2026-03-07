import { getBackendUrl } from '../platform/backend';
import { logFirebaseEvent } from '../platform/growthBridge';
import { trackThirdPartyEvent } from '../platform/thirdPartyAnalytics';

type AnalyticsEvent = {
  name: string;
  payload: Record<string, unknown>;
  sessionId: string;
  createdAt: string;
};

function createSessionId() {
  return `snk-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

class AnalyticsClient {
  private queue: AnalyticsEvent[] = [];
  private readonly storageKey = 'snakey.analytics.queue';
  private readonly sessionKey = 'snakey.analytics.session';
  private sessionId = '';
  private flushTimer: number | null = null;
  private initialized = false;

  init() {
    if (this.initialized || typeof window === 'undefined') {
      return;
    }

    this.initialized = true;
    this.sessionId = this.getOrCreateSessionId();
    this.queue = this.readQueue();
    this.track('app_open', {
      platform: navigator.userAgent,
      language: navigator.language,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  dispose() {
    if (typeof window === 'undefined') {
      return;
    }

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  track(name: string, payload: Record<string, unknown> = {}) {
    if (!this.initialized) {
      this.init();
    }

    this.queue.push({
      name,
      payload,
      sessionId: this.sessionId,
      createdAt: new Date().toISOString(),
    });

    trackThirdPartyEvent(name, payload);
    void logFirebaseEvent(name, payload);

    if (this.queue.length > 200) {
      this.queue.splice(0, this.queue.length - 200);
    }

    this.persistQueue();
    this.scheduleFlush();
  }

  async flush() {
    if (!this.queue.length) {
      return;
    }

    const batch = [...this.queue];
    try {
      const response = await fetch(getBackendUrl('/api/analytics/batch'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error(`Analytics flush failed with status ${response.status}`);
      }

      this.queue.splice(0, batch.length);
      this.persistQueue();
    } catch (error) {
      console.warn('Analytics: flush failed', error);
    }
  }

  private getOrCreateSessionId() {
    try {
      const existing = window.sessionStorage.getItem(this.sessionKey);
      if (existing) {
        return existing;
      }
      const sessionId = createSessionId();
      window.sessionStorage.setItem(this.sessionKey, sessionId);
      return sessionId;
    } catch {
      return createSessionId();
    }
  }

  private readQueue() {
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persistQueue() {
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch {
      // Best effort queue persistence.
    }
  }

  private scheduleFlush() {
    if (this.flushTimer !== null) {
      return;
    }

    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 3000);
  }

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      void this.flush();
    }
  };

  private handleBeforeUnload = () => {
    void this.flush();
  };
}

export const analyticsClient = new AnalyticsClient();