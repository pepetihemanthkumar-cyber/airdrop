/**
 * NearShare Secure Pairing & Session Types
 *
 * Defines the platform-agnostic types for pairing lifecycles, trust levels,
 * verification methods, and active transfer sessions.
 *
 * IMPORTANT: Secrets, cryptographic keys, or proprietary hashes must never be stored
 * in UI or client state.
 */

export type PairingState =
  | 'none'
  | 'requested'
  | 'awaitingVerification'
  | 'verifying'
  | 'paired'
  | 'rejected'
  | 'expired'
  | 'failed';

export type TrustState =
  | 'unknown'
  | 'paired'
  | 'trusted'
  | 'favorite'
  | 'blocked';

export type PairingMethod =
  | 'qr'
  | 'pin'
  | 'manual'
  | 'remembered';

export interface PairingSession {
  id: string;
  deviceId: string;
  profileId: string;
  state: PairingState;
  method: PairingMethod;
  startedAt: number;
  expiresAt?: number;
  verifiedAt?: number;
  trustState: TrustState;
  connectionId?: string;
  sessionId?: string;
  lastUpdatedAt: number;
}
