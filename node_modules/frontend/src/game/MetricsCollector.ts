/**
 * MetricsCollector: gathers and reports game performance metrics
 * Tracks FPS, latency, server metrics, and custom events
 */

export interface FrameMetrics {
  timestamp: number;
  duration: number; // ms
  fps: number;
}

export interface RoundTripMetrics {
  timestamp: number;
  rtt: number; // round-trip time in ms
}

export interface CustomMetric {
  name: string;
  value: number;
  timestamp: number;
}

export interface MetricsSnapshot {
  frameMetrics: FrameMetrics[];
  rttMetrics: RoundTripMetrics[];
  customMetrics: CustomMetric[];
  averageFPS: number;
  averageRTT: number;
  pixelsRendered?: number;
  entitiesRendered?: number;
}

export class MetricsCollector {
  private frameMetrics: FrameMetrics[] = [];
  private rttMetrics: RoundTripMetrics[] = [];
  private customMetrics: CustomMetric[] = [];
  private maxMetrics = 300; // Keep last ~5 seconds at 60fps

  private lastFrameTime = performance.now();
  private frameCount = 0;
  private fpsUpdateInterval = 1000; // Update FPS every second
  private lastFpsUpdate = performance.now();
  private currentFPS = 60;

  /**
   * Record a frame render
   */
  recordFrame() {
    const now = performance.now();
    const duration = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;

    // Update FPS every second
    if (now - this.lastFpsUpdate >= this.fpsUpdateInterval) {
      this.currentFPS = (this.frameCount * this.fpsUpdateInterval) / (now - this.lastFpsUpdate);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.frameMetrics.push({
      timestamp: now,
      duration,
      fps: this.currentFPS,
    });

    if (this.frameMetrics.length > this.maxMetrics) {
      this.frameMetrics.shift();
    }
  }

  /**
   * Record network round-trip time
   */
  recordRTT(rtt: number) {
    const now = performance.now();
    this.rttMetrics.push({
      timestamp: now,
      rtt,
    });

    if (this.rttMetrics.length > this.maxMetrics) {
      this.rttMetrics.shift();
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number) {
    const now = performance.now();
    this.customMetrics.push({
      name,
      value,
      timestamp: now,
    });

    if (this.customMetrics.length > this.maxMetrics) {
      this.customMetrics.shift();
    }
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this.currentFPS;
  }

  /**
   * Calculate average metrics
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    const averageFPS = this.calculateAverage(this.frameMetrics.map((m) => m.fps));
    const averageRTT = this.calculateAverage(this.rttMetrics.map((m) => m.rtt));

    return {
      frameMetrics: [...this.frameMetrics],
      rttMetrics: [...this.rttMetrics],
      customMetrics: [...this.customMetrics],
      averageFPS,
      averageRTT,
    };
  }

  /**
   * Get summary of recent metrics
   */
  getSummary(): {
    fps: number;
    avgRTT: number;
    frameCount: number;
    customCount: number;
  } {
    return {
      fps: this.currentFPS,
      avgRTT: this.calculateAverage(this.rttMetrics.slice(-60).map((m) => m.rtt)),
      frameCount: this.frameMetrics.length,
      customCount: this.customMetrics.length,
    };
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.frameMetrics = [];
    this.rttMetrics = [];
    this.customMetrics = [];
    this.frameCount = 0;
    this.currentFPS = 60;
    this.lastFrameTime = performance.now();
    this.lastFpsUpdate = performance.now();
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();
