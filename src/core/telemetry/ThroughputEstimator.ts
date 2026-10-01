/**
 * NearShare Sliding-Window Throughput Estimator
 *
 * Calculates instantaneous, rolling average, and peak transfer speeds
 * over a bounded sliding time window without manufacturing artificial metrics.
 */

import type { ThroughputSample } from './TelemetryTypes';

export interface ThroughputMetrics {
  readonly instantaneousSpeedBps: number;
  readonly rollingAverageSpeedBps: number;
  readonly peakSpeedBps: number;
  readonly totalBytesProcessed: number;
  readonly elapsedTimeMs: number;
}

export class ThroughputEstimator {
  private readonly windowDurationMs: number;
  private readonly maxSamples: number;
  private samples: ThroughputSample[] = [];
  private totalBytesProcessed = 0;
  private peakSpeedBps = 0;
  private initialTimestamp: number | null = null;
  private lastSampleTimestamp: number | null = null;
  private lastTotalBytes = 0;

  /**
   * @param windowDurationMs Time window for rolling average (default: 5000ms = 5s)
   * @param maxSamples Maximum raw samples to retain in memory (default: 50)
   */
  constructor(windowDurationMs = 5000, maxSamples = 50) {
    this.windowDurationMs = Math.max(1000, windowDurationMs);
    this.maxSamples = Math.max(5, maxSamples);
  }

  /**
   * Records a chunk or byte progress observation at a specific timestamp.
   *
   * @param cumulativeBytes Total bytes transferred up to this moment
   * @param timestamp Epoch timestamp in ms (defaults to Date.now())
   */
  public recordProgress(cumulativeBytes: number, timestamp = Date.now()): ThroughputMetrics {
    const safeBytes = Math.max(0, cumulativeBytes);

    if (this.initialTimestamp === null) {
      this.initialTimestamp = timestamp;
      this.lastSampleTimestamp = timestamp;
      this.lastTotalBytes = safeBytes;
      this.totalBytesProcessed = safeBytes;
      return this.getMetrics(timestamp);
    }

    const timeDeltaMs = timestamp - (this.lastSampleTimestamp ?? timestamp);
    const bytesDelta = safeBytes - this.lastTotalBytes;

    if (timeDeltaMs > 0 && bytesDelta >= 0) {
      const instantaneousSpeedBps = (bytesDelta / timeDeltaMs) * 1000;

      this.samples.push({
        timestamp,
        bytesDelta,
        instantaneousSpeedBps,
      });

      if (instantaneousSpeedBps > this.peakSpeedBps) {
        this.peakSpeedBps = instantaneousSpeedBps;
      }

      this.lastSampleTimestamp = timestamp;
      this.lastTotalBytes = safeBytes;
      this.totalBytesProcessed = safeBytes;

      // Prune samples older than the sliding window or exceeding max sample count
      this.pruneSamples(timestamp);
    }

    return this.getMetrics(timestamp);
  }

  /**
   * Computes current throughput metrics based on active sliding window.
   */
  public getMetrics(now = Date.now()): ThroughputMetrics {
    if (this.initialTimestamp === null || this.samples.length === 0) {
      return {
        instantaneousSpeedBps: 0,
        rollingAverageSpeedBps: 0,
        peakSpeedBps: this.peakSpeedBps,
        totalBytesProcessed: this.totalBytesProcessed,
        elapsedTimeMs: 0,
      };
    }

    this.pruneSamples(now);

    const latestSample = this.samples[this.samples.length - 1];
    // If the latest sample is too old (> 2x window), instantaneous speed decays to 0
    const timeSinceLastSample = now - (this.lastSampleTimestamp ?? now);
    const instantaneousSpeedBps =
      timeSinceLastSample > this.windowDurationMs ? 0 : (latestSample?.instantaneousSpeedBps ?? 0);

    // Calculate rolling average from current active window
    let windowBytes = 0;
    let windowTimeMs = 0;

    if (this.samples.length > 0) {
      for (const s of this.samples) {
        windowBytes += s.bytesDelta;
      }
      const elapsedSinceStart = Math.max(1, now - (this.initialTimestamp ?? now));
      windowTimeMs = Math.min(this.windowDurationMs, elapsedSinceStart);
    }

    const rollingAverageSpeedBps = windowTimeMs > 0 ? (windowBytes / windowTimeMs) * 1000 : 0;
    const elapsedTimeMs = Math.max(0, now - this.initialTimestamp);

    return {
      instantaneousSpeedBps: Math.round(instantaneousSpeedBps * 100) / 100,
      rollingAverageSpeedBps: Math.round(rollingAverageSpeedBps * 100) / 100,
      peakSpeedBps: Math.round(this.peakSpeedBps * 100) / 100,
      totalBytesProcessed: this.totalBytesProcessed,
      elapsedTimeMs,
    };
  }

  /**
   * Resets all internal counters and samples.
   */
  public reset(): void {
    this.samples = [];
    this.totalBytesProcessed = 0;
    this.peakSpeedBps = 0;
    this.initialTimestamp = null;
    this.lastSampleTimestamp = null;
    this.lastTotalBytes = 0;
  }

  private pruneSamples(now: number): void {
    const cutoff = now - this.windowDurationMs;
    this.samples = this.samples.filter((s) => s.timestamp >= cutoff);

    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }
  }
}
