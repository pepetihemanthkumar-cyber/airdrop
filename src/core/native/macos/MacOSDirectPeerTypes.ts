/**
 * NearShare macOS Direct Native Peer Types
 *
 * Defines the opaque, strongly-typed domain model and event envelopes
 * for the macOS native peer-to-peer direct transport spike.
 */

export type MacOSDirectSessionState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface MacOSDirectPeerInfo {
  /** Opaque platform-assigned peer identifier */
  readonly peerId: string;
  /** Human-readable advertised device name (sanitized) */
  readonly displayName: string;
  /** Service type advertised / discovered */
  readonly serviceType: string;
  /** Discovery timestamp in epoch milliseconds */
  readonly discoveredAt: number;
  /** Optional estimated signal RSSI in dBm */
  readonly rssi?: number;
  /** Estimated proximity distance clamped to 1-30m UX boundary */
  readonly estimatedDistanceMeters: number;
  /** Current connection state with this peer */
  readonly state: 'discovered' | 'connecting' | 'connected' | 'disconnected';
}

export interface MacOSDirectConnectionInfo {
  readonly connectionId: string;
  readonly peerId: string;
  readonly establishedAt: number;
  readonly channelType: 'stream' | 'datagram';
  readonly isEncryptedTransport: boolean;
}

export type MacOSDirectEvent =
  | { type: 'discoveryStarted'; serviceType: string; timestamp: number }
  | { type: 'discoveryStopped'; timestamp: number }
  | { type: 'peerDiscovered'; peer: MacOSDirectPeerInfo; timestamp: number }
  | { type: 'peerLost'; peerId: string; timestamp: number }
  | { type: 'connected'; connection: MacOSDirectConnectionInfo; timestamp: number }
  | { type: 'disconnected'; connectionId: string; peerId: string; reason?: string; timestamp: number }
  | { type: 'dataReceived'; connectionId: string; peerId: string; payloadBase64: string; byteLength: number; timestamp: number }
  | { type: 'error'; code: string; message: string; timestamp: number };

export type MacOSDirectEventListener = (event: MacOSDirectEvent) => void;

export interface MacOSDirectDiscoveryOptions {
  readonly serviceType?: string;
  readonly timeoutMs?: number;
  readonly filterBlocked?: boolean;
}

export interface MacOSDirectSelfTestResult {
  readonly success: boolean;
  readonly nativeImplementation: string;
  readonly framework: string;
  readonly streamTransport: string;
  readonly physicalPeer: boolean;
  readonly physicalValidation: string;
}

