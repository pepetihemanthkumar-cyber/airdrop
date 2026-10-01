/**
 * NearShare Telemetry Event Definitions
 *
 * Strongly-typed event payloads emitted throughout the diagnostics pipeline.
 */

import type {
  TransferTelemetrySnapshot,
  AggregatedTransferSummary,
  RecoveryTelemetryRecord,
  TelemetryTransportMode,
} from './TelemetryTypes';

export type TelemetryEvent =
  | {
      type: 'telemetryStarted';
      connectionId: string;
      transferId: string;
      transportMode: TelemetryTransportMode;
      totalBytes: number;
      timestamp: number;
    }
  | {
      type: 'telemetryUpdated';
      snapshot: TransferTelemetrySnapshot;
      timestamp: number;
    }
  | {
      type: 'heartbeatSent';
      connectionId: string;
      sequence: number;
      timestamp: number;
    }
  | {
      type: 'heartbeatReceived';
      connectionId: string;
      sequence: number;
      rttMs: number;
      timestamp: number;
    }
  | {
      type: 'latencyUpdated';
      connectionId: string;
      latestRttMs: number;
      rollingRttMs: number;
      timestamp: number;
    }
  | {
      type: 'throughputUpdated';
      transferId: string;
      instantaneousSpeedBps: number;
      averageSpeedBps: number;
      peakSpeedBps: number;
      timestamp: number;
    }
  | {
      type: 'chunkRetried';
      transferId: string;
      transferFileId: string;
      chunkIndex: number;
      retryCount: number;
      reason: string;
      timestamp: number;
    }
  | {
      type: 'integrityFailure';
      transferId: string;
      transferFileId?: string;
      chunkIndex?: number;
      reason: string;
      timestamp: number;
    }
  | {
      type: 'connectionDegraded';
      connectionId: string;
      reason: string;
      stabilityScore: number;
      timestamp: number;
    }
  | {
      type: 'connectionRecovered';
      connectionId: string;
      stabilityScore: number;
      timestamp: number;
    }
  | {
      type: 'connectionLost';
      connectionId: string;
      reason: string;
      timestamp: number;
    }
  | {
      type: 'transferCompleted';
      summary: AggregatedTransferSummary;
      timestamp: number;
    }
  | {
      type: 'transferFailed';
      transferId: string;
      reason: string;
      category: 'transport' | 'protocol' | 'security' | 'integrity' | 'filesystem';
      timestamp: number;
    }
  | {
      type: 'recoveryRecorded';
      record: RecoveryTelemetryRecord;
      timestamp: number;
    };

export type TelemetryEventListener = (event: TelemetryEvent) => void;
