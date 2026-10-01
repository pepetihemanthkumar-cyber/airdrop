/**
 * NearShare Native Direct Transport Types & Contracts
 *
 * Defines discovery descriptors, native connection records, transport sessions,
 * binary streaming frames, and telemetry metrics.
 *
 * MODE SEMANTICS:
 * DIRECT MODE:
 * - Does not require an existing Wi-Fi network/router/internet.
 * - Product boundary is ~30m (UX product guideline, not physical radio guarantee).
 * - Never means "Wi-Fi radio is turned off".
 *
 * WI-FI MODE:
 * - Uses the local network / LAN.
 * - Internet is not required.
 * - No artificial 30m boundary.
 */

import type { TransportMode } from '../types';

export type NativeConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export type NativeSessionState =
  | 'creating'
  | 'active'
  | 'closing'
  | 'closed'
  | 'failed';

export interface NativeDiscoveryDevice {
  deviceId: string;
  profileId: string;
  deviceName: string;
  platform: string;
  mode: TransportMode;
  connectionQuality?: 'Excellent' | 'Good' | 'Fair' | 'Weak';
  approximateDistance?: number; // In meters (optional estimate, never fabricated)
  trustState: 'trusted' | 'paired' | 'unknown';
}

export interface NativeConnection {
  id: string;
  deviceId: string;
  mode: TransportMode;
  state: NativeConnectionState;
  createdAt: number;
  lastActivityAt: number;
}

export interface NativeTransportSession {
  id: string;
  connectionId: string;
  protocolVersion: string;
  securitySessionId?: string;
  createdAt: number;
  state: NativeSessionState;
}

export interface NativeTransportChunk {
  transferId: string;
  fileId: string;
  chunkIndex: number;
  offset: number;
  data: Uint8Array | string;
  isFinal: boolean;
}

export interface NativeConnectionMetrics {
  latency: number; // in milliseconds
  throughput: number; // in bytes per second
  signalQuality: 'Excellent' | 'Good' | 'Fair' | 'Weak';
  stability: number; // 0.0 to 1.0 score
  reconnectCount: number;
  bytesSent: number;
  bytesReceived: number;
  lastPacketAt: number;
  approximateDistance?: number;
}
