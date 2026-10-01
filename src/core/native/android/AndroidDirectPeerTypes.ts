/**
 * NearShare Android Direct Native Peer Types
 *
 * Defines the opaque, strongly-typed domain model and event envelopes
 * for Android native Wi-Fi Direct (WifiP2pManager) peer-to-peer transport.
 */

export type AndroidDirectSessionState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface AndroidDirectPeerInfo {
  /** Opaque platform-assigned device MAC / unique identifier */
  readonly peerId: string;
  /** Human-readable advertised device name (sanitized) */
  readonly displayName: string;
  /** Service type / name advertised */
  readonly serviceType: string;
  /** Discovery timestamp in epoch milliseconds */
  readonly discoveredAt: number;
  /** Optional signal RSSI in dBm */
  readonly rssi?: number;
  /** Estimated proximity distance clamped to 1-30m UX boundary */
  readonly estimatedDistanceMeters: number;
  /** Current connection state with this peer */
  readonly state: 'discovered' | 'connecting' | 'connected' | 'disconnected';
  /** Whether peer is a Wi-Fi Direct Group Owner */
  readonly isGroupOwner?: boolean;
}

export interface AndroidDirectConnectionInfo {
  readonly connectionId: string;
  readonly peerId: string;
  readonly establishedAt: number;
  readonly channelType: 'stream' | 'socket';
  readonly isEncryptedTransport: boolean;
  readonly groupRole?: 'groupOwner' | 'client';
}

export type AndroidDirectEvent =
  | { type: 'discoveryStarted'; serviceType: string; timestamp: number }
  | { type: 'discoveryStopped'; timestamp: number }
  | { type: 'advertiserStarted'; serviceName: string; timestamp: number }
  | { type: 'advertiserStopped'; timestamp: number }
  | { type: 'peerDiscovered'; peer: AndroidDirectPeerInfo; timestamp: number }
  | { type: 'peerLost'; peerId: string; timestamp: number }
  | { type: 'connectionStarted'; peerId: string; timestamp: number }
  | { type: 'connectionEstablished'; connection: AndroidDirectConnectionInfo; timestamp: number }
  | { type: 'connectionFailed'; peerId: string; error?: string; timestamp: number }
  | { type: 'connectionLost'; connectionId: string; peerId: string; reason?: string; timestamp: number }
  | { type: 'connected'; connection: AndroidDirectConnectionInfo; timestamp: number }
  | { type: 'disconnected'; connectionId: string; peerId: string; reason?: string; timestamp: number }
  | { type: 'streamOpened'; connectionId: string; peerId?: string; streamName?: string; timestamp: number }
  | { type: 'streamClosed'; connectionId: string; timestamp: number }
  | { type: 'dataReceived'; connectionId: string; peerId?: string; payloadBase64: string; byteLength: number; timestamp: number }
  | { type: 'bytesReceived'; connectionId: string; peerId?: string; payloadBase64: string; byteLength: number; timestamp: number }
  | { type: 'sendCompleted'; peerId: string; bytesSent: number; timestamp: number }
  | { type: 'nativeError'; code: string; message: string; timestamp: number }
  | { type: 'error'; code: string; message: string; timestamp: number };

export type AndroidDirectEventListener = (event: AndroidDirectEvent) => void;

export interface AndroidDirectDiscoveryOptions {
  readonly serviceType?: string;
  readonly timeoutMs?: number;
  readonly filterBlocked?: boolean;
  readonly useWifiAwareIfAvailable?: boolean;
}
