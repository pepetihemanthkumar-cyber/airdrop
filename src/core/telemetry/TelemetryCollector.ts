/**
 * NearShare Telemetry Collector
 *
 * Ingests events across transport, protocol, cryptographic, and file engine layers,
 * enforcing bounded memory retention and strict privacy invariants (zero payload or path retention).
 */

import type {
  TransferTelemetrySnapshot,
  AggregatedTransferSummary,
  RecoveryTelemetryRecord,
  TelemetryTransportMode,
} from './TelemetryTypes';
import type { TelemetryEvent, TelemetryEventListener } from './TelemetryEvents';
import { TransferTelemetry } from './TransferTelemetry';

export class TelemetryCollector {
  private static instance?: TelemetryCollector;

  private activeSessions: Map<string, TransferTelemetry> = new Map();
  private completedSummaries: Map<string, AggregatedTransferSummary> = new Map();
  private recoveryRecords: Map<string, RecoveryTelemetryRecord[]> = new Map();
  private recentSnapshots: Map<string, TransferTelemetrySnapshot[]> = new Map();
  private listeners: Set<TelemetryEventListener> = new Set();

  private readonly maxRetainedSummaries = 100;
  private readonly maxSnapshotsPerTransfer = 60;

  public static getInstance(): TelemetryCollector {
    if (!TelemetryCollector.instance) {
      TelemetryCollector.instance = new TelemetryCollector();
    }
    return TelemetryCollector.instance;
  }

  /**
   * Starts a new telemetry tracking session for a transfer.
   */
  public startTransferSession(
    connectionId: string,
    transferId: string,
    totalBytes: number,
    transportMode: TelemetryTransportMode = 'direct',
    platform = 'Unknown',
    transferFileId?: string,
    initialBytesCompleted = 0
  ): TransferTelemetry {
    const session = new TransferTelemetry({
      connectionId,
      transferId,
      transferFileId,
      transportMode,
      platform,
      totalBytes,
      initialBytesCompleted,
      startTime: Date.now(),
    });

    this.activeSessions.set(transferId, session);
    this.recentSnapshots.set(transferId, []);

    this.emitEvent({
      type: 'telemetryStarted',
      connectionId,
      transferId,
      transportMode,
      totalBytes,
      timestamp: Date.now(),
    });

    return session;
  }

  /**
   * Retrieves an active transfer telemetry session.
   */
  public getSession(transferId: string): TransferTelemetry | undefined {
    return this.activeSessions.get(transferId);
  }

  /**
   * Ingests a byte transmission event.
   */
  public recordBytes(transferId: string, bytesDelta: number, isSent: boolean): void {
    const session = this.activeSessions.get(transferId);
    if (!session) return;

    if (isSent) {
      session.recordBytesSent(bytesDelta);
    } else {
      session.recordBytesReceived(bytesDelta);
    }

    this.updateSnapshot(transferId);
  }

  /**
   * Ingests a chunk completion event.
   */
  public recordChunkCompleted(transferId: string, bytesTransferred: number, chunkIndex: number): void {
    const session = this.activeSessions.get(transferId);
    if (!session) return;

    session.recordChunkProgress(bytesTransferred, chunkIndex);
    this.updateSnapshot(transferId);
  }

  /**
   * Ingests a chunk retry event.
   */
  public recordChunkRetry(transferId: string, transferFileId: string, chunkIndex: number, reason: string): void {
    const session = this.activeSessions.get(transferId);
    if (session) {
      session.recordChunkRetry(reason);
      this.updateSnapshot(transferId);
    }

    this.emitEvent({
      type: 'chunkRetried',
      transferId,
      transferFileId,
      chunkIndex,
      retryCount: session?.getSnapshot().chunksRetried ?? 1,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Ingests an RTT latency sample.
   */
  public recordLatency(connectionId: string, rttMs: number, source: 'heartbeat' | 'ack' | 'probe' = 'ack'): void {
    for (const session of this.activeSessions.values()) {
      if (session.connectionId === connectionId) {
        session.recordLatencySample(rttMs, source);
      }
    }

    this.emitEvent({
      type: 'latencyUpdated',
      connectionId,
      latestRttMs: rttMs,
      rollingRttMs: rttMs,
      timestamp: Date.now(),
    });
  }

  /**
   * Ingests a whole-file or chunk integrity verification failure.
   */
  public recordIntegrityFailure(transferId: string, reason: string, transferFileId?: string, chunkIndex?: number): void {
    const session = this.activeSessions.get(transferId);
    if (session) {
      session.recordIntegrityFailure(reason);
      this.updateSnapshot(transferId);
    }

    this.emitEvent({
      type: 'integrityFailure',
      transferId,
      transferFileId,
      chunkIndex,
      reason,
      timestamp: Date.now(),
    });
  }

  /**
   * Ingests a transfer session recovery record.
   */
  public recordRecovery(record: RecoveryTelemetryRecord): void {
    const existing = this.recoveryRecords.get(record.transferId) || [];
    existing.push(record);
    this.recoveryRecords.set(record.transferId, existing);

    this.emitEvent({
      type: 'recoveryRecorded',
      record,
      timestamp: Date.now(),
    });
  }

  /**
   * Completes telemetry tracking for a transfer, storing an aggregated summary.
   */
  public completeTransfer(transferId: string): AggregatedTransferSummary | undefined {
    const session = this.activeSessions.get(transferId);
    if (!session) return undefined;

    const summary = session.toAggregatedSummary(Date.now());
    this.completedSummaries.set(transferId, summary);
    this.activeSessions.delete(transferId);

    // Enforce bounded memory retention on summaries
    if (this.completedSummaries.size > this.maxRetainedSummaries) {
      const oldestKey = this.completedSummaries.keys().next().value;
      if (oldestKey) this.completedSummaries.delete(oldestKey);
    }

    this.emitEvent({
      type: 'transferCompleted',
      summary,
      timestamp: Date.now(),
    });

    return summary;
  }

  /**
   * Retrieves an aggregated transfer summary for historical display.
   */
  public getAggregatedSummary(transferId: string): AggregatedTransferSummary | undefined {
    return this.completedSummaries.get(transferId);
  }

  /**
   * Subscribes to telemetry events.
   */
  public subscribe(listener: TelemetryEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clears all session and summary state (used in testing or explicit reset).
   */
  public reset(): void {
    this.activeSessions.clear();
    this.completedSummaries.clear();
    this.recoveryRecords.clear();
    this.recentSnapshots.clear();
    this.listeners.clear();
  }

  private updateSnapshot(transferId: string): void {
    const session = this.activeSessions.get(transferId);
    if (!session) return;

    const snapshot = session.getSnapshot();
    const snapshots = this.recentSnapshots.get(transferId) || [];
    snapshots.push(snapshot);

    if (snapshots.length > this.maxSnapshotsPerTransfer) {
      snapshots.shift();
    }
    this.recentSnapshots.set(transferId, snapshots);

    this.emitEvent({
      type: 'telemetryUpdated',
      snapshot,
      timestamp: Date.now(),
    });
  }

  private emitEvent(event: TelemetryEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[TelemetryCollector] Listener error:', err);
      }
    });
  }
}
