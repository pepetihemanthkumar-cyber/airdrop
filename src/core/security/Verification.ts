/**
 * NearShare Verification Model
 *
 * Defines the contract for out-of-band identity validation (PIN verification, QR verification, peer confirmation).
 *
 * NOTE: For simulation, PIN values are deterministic test values.
 * Must NOT be claimed as real mathematical cryptography.
 */

export type VerificationType = 'pin' | 'qr' | 'confirmation';

export interface VerificationRequest {
  pairingId: string;
  type: VerificationType;
  displayCode?: string;
  payload?: string;
  expiresAt: number;
}

export interface VerificationResult {
  success: boolean;
  pairingId: string;
  verifiedAt: number;
  error?: string;
}
