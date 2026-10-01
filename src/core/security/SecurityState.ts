/**
 * NearShare UI-Facing Security State
 *
 * Provides a clean summary of security and pairing status for UI badges and review cards.
 *
 * NOTE: UI-facing status indicator only. Does NOT claim cryptographic security guarantees.
 */

import type { PairingState, TrustState, PairingMethod } from './types';

export interface SecurityState {
  pairingState: PairingState;
  trustState: TrustState;
  verified: boolean;
  sessionEstablished: boolean;
  method: PairingMethod;
  displayStatus: string;
  updatedAt: number;
}

export function formatSecurityStatusLabel(state: SecurityState): string {
  if (state.trustState === 'blocked') return 'Blocked device';
  if (state.trustState === 'trusted' || state.trustState === 'favorite') return 'Trusted device';
  if (state.verified || state.pairingState === 'paired') return 'Secure pairing verified';
  if (state.pairingState === 'awaitingVerification' || state.pairingState === 'verifying') {
    return 'Verification required';
  }
  if (state.pairingState === 'requested') return 'Pairing requested';
  return 'Pairing required';
}
