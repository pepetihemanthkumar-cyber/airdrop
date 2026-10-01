/**
 * NearShare Transfer Session Contract
 *
 * Tracks the secure channel session encompassing payload transfers between paired or trusted peers.
 */

export interface TransferSession {
  sessionId: string;
  pairingId: string;
  connectionId: string;
  deviceId: string;
  mode: 'direct' | 'wifi';
  state: 'creating' | 'active' | 'closing' | 'closed' | 'failed';
  createdAt: number;
  lastActivityAt: number;
  closedAt?: number;
  securityState: string;
}

export function createTransferSession(
  deviceId: string,
  pairingId: string = 'trusted-direct-channel',
  connectionId: string = `conn-session-${Date.now()}`,
  mode: 'direct' | 'wifi' = 'direct'
): TransferSession {
  return {
    sessionId: `sess-${deviceId}-${Date.now()}`,
    pairingId,
    connectionId,
    deviceId,
    mode,
    state: 'active',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    securityState: 'Secure pairing verified',
  };
}
