/**
 * NearShare Telemetry & Diagnostics Domain Types
 *
 * Defines transport-independent data models, event envelopes, and diagnostic
 * status enumerations for real-time transfer telemetry.
 */

export type TelemetryTransportMode = 'direct' | 'wifi';

export type ConnectionStabilityStatus =
  | 'stable'
  | 'degraded'
  | 'unstable'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface ThroughputSample {
  readonly timestamp: number;
  readonly bytesDelta: number;
  readonly instantaneousSpeedBps: number;
}

export interface LatencySample {
  readonly timestamp: number;
  readonly rttMs: number;
  readonly source: 'heartbeat' | 'ack' | 'probe';
}

export interface ChunkTelemetryRecord {
  readonly chunkIndex: number;
  readonly transferFileId: string;
  readonly sizeBytes: number;
  readonly sentAt: number;
  acknowledgedAt?: number;
  retries: number;
  failed: boolean;
  duplicate: boolean;
  outOfOrder: boolean;
}

export interface TransferTelemetrySnapshot {
  readonly connectionId: string;
  readonly transferId: string;
  readonly transferFileId?: string;
  readonly transportMode: TelemetryTransportMode;
  readonly platform: string;
  readonly timestamp: number;

  // Byte counters
  readonly bytesSent: number;
  readonly bytesReceived: number;
  readonly bytesAcknowledged: number;
  readonly totalBytes: number;
  readonly completedBytes: number;

  // Throughput metrics (Bytes per second)
  readonly instantaneousSpeedBps: number;
  readonly averageSpeedBps: number;
  readonly peakSpeedBps: number;

  // Latency metrics (Milliseconds)
  readonly latestLatencyMs: number | null;
  readonly rollingLatencyMs: number | null;
  readonly minLatencyMs: number | null;
  readonly maxLatencyMs: number | null;
  readonly latencySamplesCount: number;

  // Progress & ETA
  readonly progressRatio: number;
  readonly estimatedRemainingMs: number | null;

  // Reliability & Chunk counters
  readonly chunkCount: number;
  readonly chunksCompleted: number;
  readonly chunksFailed: number;
  readonly chunksRetried: number;
  readonly duplicateChunks: number;
  readonly outOfOrderChunks: number;
  readonly integrityFailures: number;

  // Connection health
  readonly connectionState: ConnectionStabilityStatus;
  readonly stabilityScore: number; // 0-100 heuristic
  readonly reconnectCount: number;
  readonly reconnectAttempts: number;
}

export interface AggregatedTransferSummary {
  readonly transferId: string;
  readonly transportMode: TelemetryTransportMode;
  readonly durationMs: number;
  readonly totalBytes: number;
  readonly averageSpeedBps: number;
  readonly peakSpeedBps: number;
  readonly averageLatencyMs: number | null;
  readonly reconnectCount: number;
  readonly retryCount: number;
  readonly integrityFailures: number;
  readonly finalStabilityState: ConnectionStabilityStatus;
  readonly completedAt: number;
}

export interface RecoveryTelemetryRecord {
  readonly transferId: string;
  readonly interruptionTimestamp: number;
  readonly resumeTimestamp: number;
  readonly bytesCompletedAtInterruption: number;
  readonly reconnectAttempts: number;
  readonly recoveryDurationMs: number;
}
