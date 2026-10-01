/**
 * NearShare Direct Peer Representation Contract
 *
 * Models a discovered or connected peer device in off-grid Direct Mode.
 * Distance is explicitly modeled as an estimated product UX metric, NOT
 * an exact physical radio distance measurement.
 */

import type { PlatformType } from '../../platform/PlatformAdapter';
import type { DirectTransportCapabilities } from './DirectTransportCapabilities';

export type DirectDiscoveryMethod =
  | 'ble'
  | 'wifi_direct'
  | 'awdl'
  | 'wifi_aware'
  | 'manual_code'
  | 'mock';

export type DirectConnectionMethod =
  | 'wifi_direct_socket'
  | 'awdl_channel'
  | 'soft_ap_tcp'
  | 'wifi_aware_socket'
  | 'mock_loopback';

export type DirectSignalQuality = 'Excellent' | 'Good' | 'Fair' | 'Weak';

export type DirectPeerConnectionState =
  | 'discovered'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected';

export type DirectPeerSecurityState =
  | 'unpaired'
  | 'pairing_required'
  | 'paired'
  | 'trusted'
  | 'blocked';

export interface DirectPeer {
  /** Unique permanent or ephemeral device hardware/crypto identifier */
  readonly deviceId: string;

  /** NearShare profile ID (e.g. NS-HEMANTH-8492) */
  readonly profileId: string;

  /** Operating system platform of the peer */
  readonly platform: PlatformType;

  /** Human-readable device name (e.g. "Hemanth's MacBook Air") */
  readonly deviceName: string;

  /** Account or owner name */
  readonly ownerName: string;

  /** User handle (e.g. "@hemanth") */
  readonly username: string;

  /** Avatar text / glyph indicator */
  readonly avatar?: string;

  /** Direct capability set advertised or resolved for this peer */
  readonly capabilities: DirectTransportCapabilities;

  /** How this peer was initially discovered */
  readonly discoveryMethod: DirectDiscoveryMethod;

  /** Candidate peer-to-peer connection link mechanism */
  readonly connectionMethod: DirectConnectionMethod;

  /**
   * Estimated proximity in meters for UI representation (e.g. 6m, 14m, 28m).
   * IMPORTANT: This is a product/UX estimate derived from signal strength or RSSI,
   * NOT an exact calibrated physical measurement.
   */
  readonly distanceEstimateMeters: number;

  /** Qualitative signal strength indicator */
  readonly signalQuality: DirectSignalQuality;

  /** Current connection lifecycle state */
  readonly connectionState: DirectPeerConnectionState;

  /** Trust and cryptographic pairing state */
  readonly securityState: DirectPeerSecurityState;

  /** Epoch millisecond timestamp of last beacon / advertisement received */
  readonly lastSeenTimestamp: number;

  /** Optional direct socket endpoint (IP/port or peer handle) when connected */
  readonly endpoint?: {
    readonly host: string;
    readonly port: number;
  };
}

/**
 * Normalizes a raw distance reading into the NearShare 30m product UX scale.
 */
export function clampDirectDistanceEstimate(meters: number): number {
  if (isNaN(meters) || meters < 1) return 1;
  if (meters > 30) return 30;
  return Math.round(meters);
}
