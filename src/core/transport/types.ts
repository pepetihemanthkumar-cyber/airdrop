/**
 * NearShare Transport Engine Types
 *
 * Defines the core types for transport modes, connection states, device models,
 * connection descriptors, and transport capability flags.
 *
 * NOTE: Frontend simulation contracts. Future native adapters (macOS, Windows,
 * Android, iOS) implement these interfaces without altering the UI or application state.
 */

export type TransportMode = 'direct' | 'wifi';

export type TransportState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'connected'
  | 'transferring'
  | 'paused'
  | 'reconnecting'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'disconnected';

export interface TransportCapability {
  direct: boolean;
  wifi: boolean;
  discovery: boolean;
  resume: boolean;
  pause: boolean;
  streaming: boolean;
  folderTransfer: boolean;
  backgroundTransfer: boolean;
}

export interface TransportDevice {
  id: string;
  profileId: string;
  deviceName: string;
  platform: 'macOS' | 'Android' | 'iOS' | 'Windows' | 'Web' | string;
  username: string;
  avatar: string;
  mode: TransportMode;
  signalQuality: 'Excellent' | 'Good' | 'Fair' | 'Weak';
  distanceMeters?: number;
  trusted: boolean;
  paired: boolean;
}

export interface TransportConnection {
  connectionId: string;
  deviceId: string;
  mode: TransportMode;
  state: TransportState;
  connectedAt: number;
  lastUpdatedAt: number;
  protocolSessionId?: string;
  protocolVersion?: string;
}
