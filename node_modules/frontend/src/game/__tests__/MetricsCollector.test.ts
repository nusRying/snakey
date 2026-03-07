import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsCollector, metricsCollector } from '../MetricsCollector';

describe('MetricsCollector (Frontend)', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('records frame metrics', () => {
    collector.recordFrame();
    collector.recordFrame();
    collector.recordFrame();

    const summary = collector.getSummary();
    expect(summary.frameCount).toBeGreaterThan(0);
  });

  it('tracks FPS over time', () => {
    vi.useFakeTimers();
    try {
      // Record multiple frames
      for (let i = 0; i < 60; i++) {
        collector.recordFrame();
        // Simulate 16ms per frame (60 FPS)
        vi.advanceTimersByTime(16);
      }

      const fps = collector.getFPS();
      expect(fps).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('records RTT metrics', () => {
    collector.recordRTT(50);
    collector.recordRTT(45);
    collector.recordRTT(55);

    const snapshot = collector.getSnapshot();
    expect(snapshot.rttMetrics.length).toBe(3);
    expect(snapshot.averageRTT).toBeCloseTo(50, 0);
  });

  it('records custom metrics', () => {
    collector.recordMetric('custom_event', 100);
    collector.recordMetric('custom_event', 150);

    const snapshot = collector.getSnapshot();
    expect(snapshot.customMetrics.length).toBe(2);
    expect(snapshot.customMetrics[0].name).toBe('custom_event');
    expect(snapshot.customMetrics[0].value).toBe(100);
  });

  it('maintains max metrics limit', () => {
    (collector as any).maxMetrics = 10;

    for (let i = 0; i < 20; i++) {
      collector.recordRTT(50);
    }

    const snapshot = collector.getSnapshot();
    expect(snapshot.rttMetrics.length).toBeLessThanOrEqual(10);
  });

  it('calculates averages correctly', () => {
    collector.recordRTT(10);
    collector.recordRTT(20);
    collector.recordRTT(30);

    const snapshot = collector.getSnapshot();
    expect(snapshot.averageRTT).toBe(20);
  });

  it('handles empty metrics gracefully', () => {
    const snapshot = collector.getSnapshot();
    expect(snapshot.averageFPS).toBe(0);
    expect(snapshot.averageRTT).toBe(0);
  });

  it('clears all metrics', () => {
    collector.recordFrame();
    collector.recordRTT(50);
    collector.recordMetric('test', 100);

    collector.clear();

    const snapshot = collector.getSnapshot();
    expect(snapshot.frameMetrics.length).toBe(0);
    expect(snapshot.rttMetrics.length).toBe(0);
    expect(snapshot.customMetrics.length).toBe(0);
  });

  it('singleton instance is accessible', () => {
    expect(metricsCollector).toBeDefined();
    expect(metricsCollector).toBeInstanceOf(MetricsCollector);
  });

  it('provides summary with all metrics', () => {
    collector.recordFrame();
    collector.recordRTT(45);

    const summary = collector.getSummary();
    expect(summary).toHaveProperty('fps');
    expect(summary).toHaveProperty('avgRTT');
    expect(summary).toHaveProperty('frameCount');
    expect(summary).toHaveProperty('customCount');
  });
});
