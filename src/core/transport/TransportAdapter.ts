/**
 * NearShare Transport Adapter Interface Contract
 *
 * Defines the standard adapter contract that every native or simulated transport
 * (Direct Nearby, Local Wi-Fi) must implement.
 *
 * Direct Mode Semantics:
 * - "No existing Wi-Fi network/router/internet is required."
 * - Does NOT mean "Wi-Fi radio is disabled."
 * - 30m is a NearShare product design boundary, not a guaranteed physical hardware limit.
 *
 * Wi-Fi Mode Semantics:
 * - "Uses an existing local network."
 * - Internet connectivity is not required.
 * - No artificial 30m product boundary.
 */

import type {
  TransportDevice,
  TransportConnection,
  TransportCapability,
  TransportState,
} from './types';
import type { TransferPayload } from '../transfer/types';
import type { TransportEventListener } from './events';

export interface TransportAdapter {
  readonly mode: 'direct' | 'wifi';

  /**
   * Discovers nearby reachable devices compatible with this transport mode.
   */
  discover(): Promise<TransportDevice[]>;

  /**
   * Establishes a logical or physical peer session with the specified target device.
   */
  connect(device: TransportDevice): Promise<TransportConnection>;

  /**
   * Closes an active connection session.
   */
  disconnect(connectionId: string): Promise<void>;

  /**
   * Initiates sending a payload over the established connection.
   */
  send(payload: TransferPayload, connection: TransportConnection): Promise<void>;

  /**
   * Pauses an active in-flight payload transmission.
   */
  pause(transferId: string): Promise<void>;

  /**
   * Resumes a paused payload transmission.
   */
  resume(transferId: string): Promise<void>;

  /**
   * Aborts an active payload transmission.
   */
  cancel(transferId: string): Promise<void>;

  /**
   * Reports capabilities supported by this adapter (resume, streaming, pause, etc.).
   */
  getCapabilities(): TransportCapability;

  /**
   * Inspects current connection state for a given connection or default session.
   */
  getConnectionState(connectionId?: string): TransportState;

  /**
   * Registers an event listener for lifecycle and transfer streaming updates.
   * @returns Unsubscribe cleanup callback.
   */
  onEvent(callback: TransportEventListener): () => void;

  /**
   * Releases allocated resources and cancels pending adapter operations.
   */
  destroy(): void;
}
