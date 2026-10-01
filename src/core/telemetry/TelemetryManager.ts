/**
 * NearShare Telemetry Manager
 *
 * Primary application-level entry point and query interface for real-time
 * telemetry metrics, latency estimations, and connection stability states.
 */

import { TelemetryCollector } from './TelemetryCollector';
import type {
  TransferTelemetrySnapshot,
  AggregatedTransferSummary,
  ConnectionStabilityStatus,
  TelemetryTransportMode,
} from './TelemetryTypes';
import type { TelemetryEventListener } from './TelemetryEvents';

export class TelemetryManager {
  private static instance?: TelemetryManager;
  private collector: TelemetryCollector;
  private activeConnectionId: string | null = null;
  private activeTransferId: string | null = null;

  constructor(collector?: TelemetryCollector) {
    this.collector = collector || TelemetryCollector.getInstance();
  }

  public static getInstance(): TelemetryManager {
    if (!TelemetryManager.instance) {
      TelemetryManager.instance = new TelemetryManager();
    }
    return TelemetryManager.instance;
  }

  public setActiveTransfer(connectionId: string, transferId: string): void {
    this.activeConnectionId = connectionId;
    this.activeTransferId = transferId;
  }

  public getActiveConnectionId(): string | null {
    return this.activeConnectionId;
  }

  public getCollector(): TelemetryCollector {
    return this.collector;
  }

  /**
   * Starts a new transfer telemetry session.
   */
  public startSession(
    connectionId: string,
    transferId: string,
    totalBytes: number,
    transportMode: TelemetryTransportMode = 'direct',
    platform = 'Unknown',
    transferFileId?: string,
    initialBytesCompleted = 0
  ) {
    this.setActiveTransfer(connectionId, transferId);
    return this.collector.startTransferSession(
      connectionId,
      transferId,
      totalBytes,
      transportMode,
      platform,
      transferFileId,
      initialBytesCompleted
    );
  }

  /**
   * Gets snapshot for a given connectionId.
   */
  public getTelemetry(connectionId: string): TransferTelemetrySnapshot | null {
    const session = Array.from(this.collector['activeSessions'].values()).find(
      (s) => s.connectionId === connectionId
    );
    return session ? session.getSnapshot() : null;
  }

  /**
   * Gets snapshot for a given transferId.
   */
  public getTransferTelemetry(transferId: string): TransferTelemetrySnapshot | null {
    const session = this.collector.getSession(transferId);
    return session ? session.getSnapshot() : null;
  }

  /**
   * Returns current instantaneous speed in MB/s for the active transfer (or 0 if none).
   */
  public getCurrentSpeed(): number {
    if (!this.activeTransferId) return 0;
    const snap = this.getTransferTelemetry(this.activeTransferId);
    return snap ? Math.round((snap.instantaneousSpeedBps / (1024 * 1024)) * 10) / 10 : 0;
  }

  /**
   * Returns rolling average speed in MB/s for the active transfer.
   */
  public getAverageSpeed(): number {
    if (!this.activeTransferId) return 0;
    const snap = this.getTransferTelemetry(this.activeTransferId);
    return snap ? Math.round((snap.averageSpeedBps / (1024 * 1024)) * 10) / 10 : 0;
  }

  /**
   * Returns peak speed in MB/s observed for the active transfer.
   */
  public getPeakSpeed(): number {
    if (!this.activeTransferId) return 0;
    const snap = this.getTransferTelemetry(this.activeTransferId);
    return snap ? Math.round((snap.peakSpeedBps / (1024 * 1024)) * 10) / 10 : 0;
  }

  /**
   * Returns latest observed latency in milliseconds.
   */
  public getLatency(): number | null {
    if (this.activeTransferId) {
      const snap = this.getTransferTelemetry(this.activeTransferId);
      if (snap?.latestLatencyMs !== null) return snap?.latestLatencyMs ?? null;
    }
    return null;
  }

  /**
   * Returns current connection stability assessment.
   */
  public getStability(): ConnectionStabilityStatus {
    if (this.activeTransferId) {
      const snap = this.getTransferTelemetry(this.activeTransferId);
      if (snap) return snap.connectionState;
    }
    return 'stable';
  }

  /**
   * Returns total reconnect count for the active transfer.
   */
  public getReconnectCount(): number {
    if (!this.activeTransferId) return 0;
    const snap = this.getTransferTelemetry(this.activeTransferId);
    return snap?.reconnectCount ?? 0;
  }

  /**
   * Returns smoothed ETA in milliseconds for the active transfer.
   */
  public getETA(): number | null {
    if (!this.activeTransferId) return null;
    const snap = this.getTransferTelemetry(this.activeTransferId);
    return snap?.estimatedRemainingMs ?? null;
  }

  /**
   * Completes the active transfer and generates historical summary.
   */
  public completeSession(transferId: string): AggregatedTransferSummary | undefined {
    const summary = this.collector.completeTransfer(transferId);
    if (this.activeTransferId === transferId) {
      this.activeTransferId = null;
    }
    return summary;
  }

  /**
   * Subscribes to telemetry events.
   */
  public onEvent(listener: TelemetryEventListener): () => void {
    return this.collector.subscribe(listener);
  }

  /**
   * Resets all telemetry state.
   */
  public reset(): void {
    this.activeConnectionId = null;
    this.activeTransferId = null;
    this.collector.reset();
  }
}
