/**
 * NearShare Network Latency (RTT) Estimator
 *
 * Tracks network round-trip times derived from protocol heartbeats and
 * chunk acknowledgements with exponential smoothing and bounded memory.
 */

import type { LatencySample } from './TelemetryTypes';

export interface LatencyMetrics {
  readonly latestLatencyMs: number | null;
  readonly rollingLatencyMs: number | null;
  readonly minLatencyMs: number | null;
  readonly maxLatencyMs: number | null;
  readonly averageLatencyMs: number | null;
  readonly samplesCount: number;
}

export class LatencyEstimator {
  private readonly maxSamples: number;
  private readonly smoothingFactor: number;
  private samples: LatencySample[] = [];
  private rollingRtt: number | null = null;
  private minRtt: number | null = null;
  private maxRtt: number | null = null;
  private totalRttSum = 0;
  private totalSamplesRecorded = 0;

  /**
   * @param maxSamples Maximum raw RTT samples to retain (default: 30)
   * @param smoothingFactor Exponential smoothing factor alpha between 0 and 1 (default: 0.25)
   */
  constructor(maxSamples = 30, smoothingFactor = 0.25) {
    this.maxSamples = Math.max(5, maxSamples);
    this.smoothingFactor = Math.min(1, Math.max(0.01, smoothingFactor));
  }

  /**
   * Records an observed network RTT measurement from a protocol acknowledgement or heartbeat.
   *
   * @param rttMs Round trip time in milliseconds
   * @param source Source of measurement ('heartbeat' | 'ack' | 'probe')
   * @param timestamp Observation timestamp
   */
  public recordSample(
    rttMs: number,
    source: 'heartbeat' | 'ack' | 'probe' = 'ack',
    timestamp = Date.now()
  ): LatencyMetrics {
    const safeRtt = Math.max(0, Math.round(rttMs * 100) / 100);

    this.samples.push({
      timestamp,
      rttMs: safeRtt,
      source,
    });

    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    // Update min/max
    if (this.minRtt === null || safeRtt < this.minRtt) {
      this.minRtt = safeRtt;
    }
    if (this.maxRtt === null || safeRtt > this.maxRtt) {
      this.maxRtt = safeRtt;
    }

    // Cumulative average tracking
    this.totalRttSum += safeRtt;
    this.totalSamplesRecorded += 1;

    // Exponential Moving Average (EMA) for rolling RTT
    if (this.rollingRtt === null) {
      this.rollingRtt = safeRtt;
    } else {
      this.rollingRtt =
        this.smoothingFactor * safeRtt + (1 - this.smoothingFactor) * this.rollingRtt;
    }

    return this.getMetrics();
  }

  /**
   * Returns current latency metrics.
   */
  public getMetrics(): LatencyMetrics {
    if (this.samples.length === 0) {
      return {
        latestLatencyMs: null,
        rollingLatencyMs: null,
        minLatencyMs: null,
        maxLatencyMs: null,
        averageLatencyMs: null,
        samplesCount: 0,
      };
    }

    const latest = this.samples[this.samples.length - 1].rttMs;
    const avg =
      this.totalSamplesRecorded > 0 ? this.totalRttSum / this.totalSamplesRecorded : null;

    return {
      latestLatencyMs: Math.round(latest * 10) / 10,
      rollingLatencyMs:
        this.rollingRtt !== null ? Math.round(this.rollingRtt * 10) / 10 : null,
      minLatencyMs: this.minRtt !== null ? Math.round(this.minRtt * 10) / 10 : null,
      maxLatencyMs: this.maxRtt !== null ? Math.round(this.maxRtt * 10) / 10 : null,
      averageLatencyMs: avg !== null ? Math.round(avg * 10) / 10 : null,
      samplesCount: this.totalSamplesRecorded,
    };
  }

  /**
   * Resets all internal latency statistics.
   */
  public reset(): void {
    this.samples = [];
    this.rollingRtt = null;
    this.minRtt = null;
    this.maxRtt = null;
    this.totalRttSum = 0;
    this.totalSamplesRecorded = 0;
  }
}
