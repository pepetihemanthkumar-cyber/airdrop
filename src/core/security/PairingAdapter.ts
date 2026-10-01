/**
 * NearShare Pairing Adapter Interface Contract
 *
 * Defines the contract that native or simulated pairing engines implement.
 */

import type { PairingSession, PairingState } from './types';
import type { SecurityEventListener } from './events';

export interface PairingAdapter {
  /**
   * Dispatches an out-of-band or in-band pairing request to target device.
   */
  requestPairing(device: {
    id: string;
    deviceName?: string;
    name?: string;
    profileId?: string;
  }): Promise<PairingSession>;

  /**
   * Accepts an incoming pairing prompt.
   */
  acceptPairing(pairingId: string): Promise<PairingSession>;

  /**
   * Declines an incoming pairing request.
   */
  rejectPairing(pairingId: string, reason?: string): Promise<void>;

  /**
   * Submits peer verification (e.g. 6-digit PIN entry or scanned QR).
   */
  verifyPairing(
    pairingId: string,
    verification: { pin?: string; qrPayload?: string }
  ): Promise<boolean>;

  /**
   * Cancels an in-progress pairing request.
   */
  cancelPairing(pairingId: string): Promise<void>;

  /**
   * Queries the current status of a specific pairing session.
   */
  getPairingState(pairingId: string): PairingState;

  /**
   * Subscribes to pairing and verification events.
   * @returns Unsubscribe cleanup callback.
   */
  onEvent(callback: SecurityEventListener): () => void;

  /**
   * Cleans up pending pairing timers and listeners.
   */
  destroy(): void;
}
