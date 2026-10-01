/**
 * NearShare Transfer Telemetry Session
 *
 * Coordinates throughput, latency, and stability estimators for an active transfer.
 */

import type {
  TransferTelemetrySnapshot,
  AggregatedTransferSummary,
  TelemetryTransportMode,
} from './TelemetryTypes';
import { ThroughputEstimator } from './ThroughputEstimator';
import { LatencyEstimator } from './LatencyEstimator';
import { StabilityEstimator } from './StabilityEstimator';

export interface TransferTelemetryInit {
  readonly connectionId: string;
  readonly transferId: string;
  readonly transferFileId?: string;
  readonly transportMode: TelemetryTransportMode;
  readonly platform?: string;
  readonly totalBytes: number;
  readonly initialBytesCompleted?: number;
  readonly startTime?: number;
}

export class TransferTelemetry {
  public readonly connectionId: string;
  public readonly transferId: string;
  public readonly transferFileId?: string;
  public readonly transportMode: TelemetryTransportMode;
  public readonly platform: string;
  public readonly totalBytes: number;
  public readonly startTime: number;

  private bytesSent = 0;
  private bytesReceived = 0;
  private bytesAcknowledged = 0;
  private completedBytes = 0;

  private chunkCount = 0;
  private chunksCompleted = 0;
  private chunksFailed = 0;
  private chunksRetried = 0;
  private duplicateChunks = 0;
  private outOfOrderChunks = 0;
  private integrityFailures = 0;

  public readonly throughput: ThroughputEstimator;
  public readonly latency: LatencyEstimator;
  public readonly stability: StabilityEstimator;

  constructor(init: TransferTelemetryInit) {
    this.connectionId = init.connectionId;
    this.transferId = init.transferId;
    this.transferFileId = init.transferFileId;
    this.transportMode = init.transportMode;
    this.platform = init.platform || 'Unknown';
    this.totalBytes = Math.max(0, init.totalBytes);
    this.completedBytes = Math.min(this.totalBytes, Math.max(0, init.initialBytesCompleted ?? 0));
    this.startTime = init.startTime ?? Date.now();

    this.throughput = new ThroughputEstimator();
    this.latency = new LatencyEstimator();
    this.stability = new StabilityEstimator();

    if (this.completedBytes > 0) {
      this.throughput.recordProgress(this.completedBytes, this.startTime);
    }
  }

  /**
   * Records chunk progress / acknowledgment.
   */
  public recordChunkProgress(bytesTransferred: number, _chunkIndex: number, now = Date.now()): void {
    this.completedBytes = Math.min(this.totalBytes, this.completedBytes + Math.max(0, bytesTransferred));
    this.chunksCompleted += 1;
    this.throughput.recordProgress(this.completedBytes, now);
    this.stability.recordSuccess();
  }

  /**
   * Records raw bytes sent over wire.
   */
  public recordBytesSent(bytes: number, now = Date.now()): void {
    this.bytesSent += Math.max(0, bytes);
    this.throughput.recordProgress(this.bytesSent, now);
  }

  /**
   * Records raw bytes received from wire.
   */
  public recordBytesReceived(bytes: number, now = Date.now()): void {
    this.bytesReceived += Math.max(0, bytes);
    this.completedBytes = Math.min(this.totalBytes, this.bytesReceived);
    this.throughput.recordProgress(this.bytesReceived, now);
  }

  /**
   * Records bytes acknowledged by receiver.
   */
  public recordBytesAcknowledged(bytes: number): void {
    this.bytesAcknowledged += Math.max(0, bytes);
  }

  /**
   * Sets total planned chunk count.
   */
  public setChunkCount(count: number): void {
    this.chunkCount = Math.max(0, count);
  }

  /**
   * Records a chunk retry.
   */
  public recordChunkRetry(reason?: string): void {
    this.chunksRetried += 1;
    this.stability.recordRetry(reason);
  }

  /**
   * Records a chunk transmission failure.
   */
  public recordChunkFailure(reason?: string): void {
    this.chunksFailed += 1;
    this.stability.recordFailure(reason);
  }

  /**
   * Records duplicate chunk received.
   */
  public recordDuplicateChunk(): void {
    this.duplicateChunks += 1;
  }

  /**
   * Records out of order chunk received.
   */
  public recordOutOfOrderChunk(): void {
    this.outOfOrderChunks += 1;
  }

  /**
   * Records integrity verification failure.
   */
  public recordIntegrityFailure(reason?: string): void {
    this.integrityFailures += 1;
    this.stability.recordFailure(reason || 'Whole-file SHA-256 integrity failure');
  }

  /**
   * Records an RTT latency sample from a protocol ACK or heartbeat.
   */
  public recordLatencySample(rttMs: number, source: 'heartbeat' | 'ack' | 'probe' = 'ack', now = Date.now()): void {
    this.latency.recordSample(rttMs, source, now);
    this.stability.recordLatency(rttMs);
  }

  /**
   * Returns a snapshot of current transfer telemetry metrics.
   */
  public getSnapshot(now = Date.now()): TransferTelemetrySnapshot {
    const tpMetrics = this.throughput.getMetrics(now);
    const latMetrics = this.latency.getMetrics();
    const stabReport = this.stability.getReport();

    const progressRatio = this.totalBytes > 0 ? Math.min(1, Math.max(0, this.completedBytes / this.totalBytes)) : 1;

    // Smoothed ETA calculation
    let estimatedRemainingMs: number | null = null;
    if (this.completedBytes >= this.totalBytes) {
      estimatedRemainingMs = 0;
    } else if (tpMetrics.rollingAverageSpeedBps > 0) {
      const remainingBytes = this.totalBytes - this.completedBytes;
      estimatedRemainingMs = Math.round((remainingBytes / tpMetrics.rollingAverageSpeedBps) * 1000);
    }

    return {
      connectionId: this.connectionId,
      transferId: this.transferId,
      transferFileId: this.transferFileId,
      transportMode: this.transportMode,
      platform: this.platform,
      timestamp: now,
      bytesSent: this.bytesSent,
      bytesReceived: this.bytesReceived,
      bytesAcknowledged: this.bytesAcknowledged,
      totalBytes: this.totalBytes,
      completedBytes: this.completedBytes,
      instantaneousSpeedBps: tpMetrics.instantaneousSpeedBps,
      averageSpeedBps: tpMetrics.rollingAverageSpeedBps,
      peakSpeedBps: tpMetrics.peakSpeedBps,
      latestLatencyMs: latMetrics.latestLatencyMs,
      rollingLatencyMs: latMetrics.rollingLatencyMs,
      minLatencyMs: latMetrics.minLatencyMs,
      maxLatencyMs: latMetrics.maxLatencyMs,
      latencySamplesCount: latMetrics.samplesCount,
      progressRatio,
      estimatedRemainingMs,
      chunkCount: this.chunkCount,
      chunksCompleted: this.chunksCompleted,
      chunksFailed: this.chunksFailed,
      chunksRetried: this.chunksRetried,
      duplicateChunks: this.duplicateChunks,
      outOfOrderChunks: this.outOfOrderChunks,
      integrityFailures: this.integrityFailures,
      connectionState: stabReport.status,
      stabilityScore: stabReport.stabilityScore,
      reconnectCount: stabReport.reconnectCount,
      reconnectAttempts: stabReport.reconnectAttempts,
    };
  }

  /**
   * Produces a lightweight aggregated summary for storage in transfer history.
   */
  public toAggregatedSummary(completedAt = Date.now()): AggregatedTransferSummary {
    const tpMetrics = this.throughput.getMetrics(completedAt);
    const latMetrics = this.latency.getMetrics();
    const stabReport = this.stability.getReport();
    const durationMs = Math.max(1, completedAt - this.startTime);

    // Compute overall true average speed across entire transfer duration
    const overallAverageBps = durationMs > 0 ? (this.completedBytes / durationMs) * 1000 : 0;

    return {
      transferId: this.transferId,
      transportMode: this.transportMode,
      durationMs,
      totalBytes: this.totalBytes,
      averageSpeedBps: Math.round(overallAverageBps * 100) / 100,
      peakSpeedBps: tpMetrics.peakSpeedBps,
      averageLatencyMs: latMetrics.averageLatencyMs,
      reconnectCount: stabReport.reconnectCount,
      retryCount: this.chunksRetried,
      integrityFailures: this.integrityFailures,
      finalStabilityState: stabReport.status,
      completedAt,
    };
  }
}
