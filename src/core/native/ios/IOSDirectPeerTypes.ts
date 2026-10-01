/**
 * NearShare iOS Direct Native Peer Types
 *
 * Defines the opaque, strongly-typed domain model and event envelopes
 * for the iOS/iPadOS native MultipeerConnectivity peer-to-peer transport.
 */

export type IOSDirectSessionState =
  | 'idle'
  | 'browsing'
  | 'advertising'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface IOSDirectPeerInfo {
  /** Opaque MCPeerID display/hash identifier (UUID or MCPeerID string representation) */
  readonly peerId: string;
  /** Human-readable advertised device name (e.g., iPhone 15 Pro, sanitized) */
  readonly displayName: string;
  /** Service type advertised (e.g., nearshare-p2p) */
  readonly serviceType: string;
  /** Discovery timestamp in epoch milliseconds */
  readonly discoveredAt: number;
  /** Optional discovery metadata dictionary (e.g. protocol version, profile ID) */
  readonly discoveryInfo?: Record<string, string>;
  /** Estimated proximity distance clamped to 1-30m UX boundary */
  readonly estimatedDistanceMeters: number;
  /** Current connection state with this peer */
  readonly state: 'discovered' | 'connecting' | 'connected' | 'disconnected';
}

export interface IOSDirectConnectionInfo {
  readonly connectionId: string;
  readonly peerId: string;
  readonly establishedAt: number;
  readonly channelType: 'multipeer_stream' | 'nwconnection';
  readonly isEncryptedTransport: boolean;
  readonly sessionSecurity: 'none' | 'required';
}

export type IOSDirectEvent =
  | { type: 'discoveryStarted'; serviceType: string; timestamp: number }
  | { type: 'discoveryStopped'; timestamp: number }
  | { type: 'advertisingStarted'; serviceType: string; timestamp: number }
  | { type: 'advertisingStopped'; timestamp: number }
  | { type: 'peerDiscovered'; peer: IOSDirectPeerInfo; timestamp: number }
  | { type: 'peerLost'; peerId: string; timestamp: number }
  | { type: 'invitationReceived'; invitationId: string; peerId: string; displayName: string; timestamp: number }
  | { type: 'connectionStarted'; peerId: string; timestamp: number }
  | { type: 'connectionEstablished'; connection: IOSDirectConnectionInfo; timestamp: number }
  | { type: 'connectionFailed'; peerId: string; reason: string; timestamp: number }
  | { type: 'connectionLost'; peerId: string; timestamp: number }
  | { type: 'disconnected'; connectionId: string; peerId: string; reason?: string; timestamp: number }
  | { type: 'streamOpened'; connectionId: string; peerId: string; streamName: string; timestamp: number }
  | { type: 'streamClosed'; connectionId: string; timestamp: number }
  | { type: 'bytesReceived'; connectionId: string; peerId: string; payloadBase64: string; byteLength: number; timestamp: number }
  | { type: 'sendCompleted'; connectionId: string; bytesWritten: number; timestamp: number }
  | { type: 'nativeError'; code: string; message: string; timestamp: number };

export type IOSDirectEventListener = (event: IOSDirectEvent) => void;

export interface IOSDirectDiscoveryOptions {
  readonly serviceType?: string;
  readonly timeoutMs?: number;
  readonly filterBlocked?: boolean;
}
