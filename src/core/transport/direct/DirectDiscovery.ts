/**
 * NearShare Direct Discovery Engine Contract
 *
 * Manages off-grid peer discovery across native wireless radios (BLE, Wi-Fi Direct, Multipeer).
 * Strict separation: Discovery identifies candidates; Connection establishes the data link.
 * Integrates with DeviceTrust to automatically filter blocked devices and tag favorites.
 */

import type { DirectPeer } from './DirectPeer';
import type { DirectTransportError } from './DirectTransportErrors';

export type DirectDiscoveryEvent =
  | { type: 'started'; timestamp: number; mode: 'direct' }
  | { type: 'peerDiscovered'; peer: DirectPeer; timestamp: number }
  | { type: 'peerUpdated'; peer: DirectPeer; timestamp: number }
  | { type: 'peerLost'; deviceId: string; timestamp: number }
  | { type: 'stopped'; timestamp: number }
  | { type: 'error'; error: DirectTransportError; timestamp: number };

export type DirectDiscoveryEventListener = (event: DirectDiscoveryEvent) => void;

export interface DirectDiscoveryOptions {
  /** Service type / identifier for native radio discovery */
  readonly serviceType?: string;
  /** Filter out blocked devices from discovery events */
  readonly filterBlockedDevices?: boolean;
  /** Lookup function to verify if a device ID is blocked */
  readonly isDeviceBlocked?: (deviceId: string) => boolean;
  /** Lookup function to verify if a device ID is trusted */
  readonly isDeviceTrusted?: (deviceId: string) => boolean;
  /** Lookup function to verify if a device ID is marked favorite */
  readonly isDeviceFavorite?: (deviceId: string) => boolean;
  /** Discovery timeout in milliseconds (0 for continuous scanning) */
  readonly timeoutMs?: number;
}

export interface DirectDiscoveryProvider {
  readonly isScanning: boolean;
  
  /**
   * Starts active discovery on native radios (BLE / Wi-Fi Direct / AWDL).
   */
  startDiscovery(options?: DirectDiscoveryOptions): Promise<void>;

  /**
   * Stops active discovery broadcasts and listeners.
   */
  stopDiscovery(): Promise<void>;

  /**
   * Returns current list of visible, unblocked direct peers.
   */
  getDiscoveredPeers(): DirectPeer[];

  /**
   * Subscribes to typed discovery events.
   * @returns Unsubscribe cleanup callback.
   */
  onEvent(listener: DirectDiscoveryEventListener): () => void;

  /**
   * Cleans up all listeners and native timers.
   */
  destroy(): void;
}
