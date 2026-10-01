/**
 * NearShare Connection Stability Estimator
 *
 * Evaluates connection health based on concrete protocol events (retransmissions,
 * disconnects, reconnects, latency variance, and chunk failures) rather than
 * artificial percentages.
 */

import type { ConnectionStabilityStatus } from './TelemetryTypes';

export interface StabilityReport {
  readonly status: ConnectionStabilityStatus;
  readonly stabilityScore: number; // 0-100 heuristic
  readonly reconnectCount: number;
  readonly reconnectAttempts: number;
  readonly consecutiveSuccesses: number;
  readonly totalRetries: number;
  readonly totalFailures: number;
  readonly reason?: string;
}

export class StabilityEstimator {
  private status: ConnectionStabilityStatus = 'stable';
  private score = 100;
  private reconnectCount = 0;
  private reconnectAttempts = 0;
  private consecutiveSuccesses = 0;
  private totalRetries = 0;
  private totalFailures = 0;
  private lastRtt: number | null = null;
  private lastReason?: string;

  /**
   * Records a successfully acknowledged chunk or frame.
   */
  public recordSuccess(): StabilityReport {
    this.consecutiveSuccesses += 1;

    if (this.status === 'reconnecting') {
      this.status = 'stable';
      this.reconnectAttempts = 0;
    }

    // Heuristic recovery: Every 5 consecutive successes gradually restore score by +2 up to 100
    if (this.consecutiveSuccesses % 5 === 0 && this.score < 100) {
      this.score = Math.min(100, this.score + 2);
    }

    // Update status based on score thresholds
    this.updateStatusFromScore();
    return this.getReport();
  }

  /**
   * Records a chunk retransmission / retry.
   */
  public recordRetry(reason?: string): StabilityReport {
    this.consecutiveSuccesses = 0;
    this.totalRetries += 1;
    this.lastReason = reason || 'Chunk retransmission required';

    // Penalty of -5 per retry
    this.score = Math.max(0, this.score - 5);
    this.updateStatusFromScore();
    return this.getReport();
  }

  /**
   * Records a failed chunk or frame integrity failure.
   */
  public recordFailure(reason?: string): StabilityReport {
    this.consecutiveSuccesses = 0;
    this.totalFailures += 1;
    this.lastReason = reason || 'Chunk transmission failed';

    // Heavy penalty of -15 per failure
    this.score = Math.max(0, this.score - 15);
    this.updateStatusFromScore();
    return this.getReport();
  }

  /**
   * Records a reconnect event or attempt.
   */
  public recordReconnectAttempt(): StabilityReport {
    this.status = 'reconnecting';
    this.reconnectAttempts += 1;
    this.consecutiveSuccesses = 0;
    this.score = Math.max(0, this.score - 20);
    this.lastReason = `Reconnecting attempt #${this.reconnectAttempts}`;
    return this.getReport();
  }

  /**
   * Records a successful reconnection.
   */
  public recordReconnectSuccess(): StabilityReport {
    this.status = 'degraded';
    this.reconnectCount += 1;
    this.reconnectAttempts = 0;
    this.consecutiveSuccesses = 1;
    this.score = Math.max(40, this.score);
    this.lastReason = 'Reconnected successfully; evaluating link stability';
    return this.getReport();
  }

  /**
   * Records a complete disconnect.
   */
  public recordDisconnect(reason = 'Connection closed'): StabilityReport {
    this.status = 'disconnected';
    this.score = 0;
    this.lastReason = reason;
    return this.getReport();
  }

  /**
   * Records an unrecoverable failure.
   */
  public recordFatalFailure(reason = 'Unrecoverable transport failure'): StabilityReport {
    this.status = 'failed';
    this.score = 0;
    this.lastReason = reason;
    return this.getReport();
  }

  /**
   * Observes latency for jitter calculation.
   */
  public recordLatency(rttMs: number): void {
    if (this.lastRtt !== null) {
      const jitter = Math.abs(rttMs - this.lastRtt);
      if (jitter > 80) {
        // Latency spike / high jitter penalty
        this.score = Math.max(0, this.score - 3);
        this.updateStatusFromScore();
      }
    }
    this.lastRtt = rttMs;
  }

  /**
   * Returns current stability assessment.
   */
  public getReport(): StabilityReport {
    return {
      status: this.status,
      stabilityScore: this.score,
      reconnectCount: this.reconnectCount,
      reconnectAttempts: this.reconnectAttempts,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalRetries: this.totalRetries,
      totalFailures: this.totalFailures,
      reason: this.lastReason,
    };
  }

  /**
   * Resets estimator state.
   */
  public reset(): void {
    this.status = 'stable';
    this.score = 100;
    this.reconnectCount = 0;
    this.reconnectAttempts = 0;
    this.consecutiveSuccesses = 0;
    this.totalRetries = 0;
    this.totalFailures = 0;
    this.lastRtt = null;
    this.lastReason = undefined;
  }

  private updateStatusFromScore(): void {
    if (
      this.status === 'reconnecting' ||
      this.status === 'disconnected' ||
      this.status === 'failed'
    ) {
      return;
    }

    if (this.score >= 80) {
      this.status = 'stable';
    } else if (this.score >= 50) {
      this.status = 'degraded';
    } else {
      this.status = 'unstable';
    }
  }
}
