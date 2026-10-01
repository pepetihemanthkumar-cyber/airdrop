/**
 * Mock Pairing Adapter Implementation
 *
 * Simulates out-of-band identity verification, PIN challenges, 60s expiration,
 * and pairing state transitions.
 *
 * NOTE: Frontend simulation only. Does NOT claim cryptographic security.
 */

import type { PairingAdapter } from '../PairingAdapter';
import type { PairingSession, PairingState } from '../types';
import type { SecurityEventListener, SecurityEvent } from '../events';

export class MockPairingAdapter implements PairingAdapter {
  private sessions: Map<string, PairingSession> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private listeners: Set<SecurityEventListener> = new Set();

  private deterministicPin = '482917';

  async requestPairing(device: {
    id: string;
    deviceName?: string;
    name?: string;
    profileId?: string;
  }): Promise<PairingSession> {
    const pairingId = `pair-${device.id}-${Date.now()}`;
    const now = Date.now();
    const expiresAt = now + 60000; // 60s expiration

    const session: PairingSession = {
      id: pairingId,
      deviceId: device.id,
      profileId: device.profileId || `NS-${device.id}`,
      state: 'requested',
      method: 'pin',
      startedAt: now,
      expiresAt,
      trustState: 'unknown',
      lastUpdatedAt: now,
    };

    this.sessions.set(pairingId, session);

    this.emitEvent({
      type: 'pairingRequested',
      deviceId: device.id,
      pairingId,
      profileId: session.profileId,
      session,
      timestamp: now,
    });

    // Schedule 60-second expiration timer
    const timer = setTimeout(() => {
      this.handleExpiration(pairingId);
    }, 60000);
    this.timers.set(pairingId, timer);

    // Auto-progress to awaitingVerification with challenge PIN after 200ms
    setTimeout(() => {
      const current = this.sessions.get(pairingId);
      if (current && current.state === 'requested') {
        current.state = 'awaitingVerification';
        current.lastUpdatedAt = Date.now();

        this.emitEvent({
          type: 'verificationRequired',
          deviceId: device.id,
          pairingId,
          request: {
            pairingId,
            type: 'pin',
            displayCode: '482 917',
            expiresAt,
          },
          timestamp: Date.now(),
        });
      }
    }, 200);

    return session;
  }

  async acceptPairing(pairingId: string): Promise<PairingSession> {
    const session = this.sessions.get(pairingId);
    if (!session) {
      throw new Error(`[MockPairingAdapter] Session not found for ID: ${pairingId}`);
    }

    session.state = 'awaitingVerification';
    session.lastUpdatedAt = Date.now();

    this.emitEvent({
      type: 'verificationRequired',
      deviceId: session.deviceId,
      pairingId,
      request: {
        pairingId,
        type: 'pin',
        displayCode: '482 917',
        expiresAt: session.expiresAt || Date.now() + 60000,
      },
      timestamp: Date.now(),
    });

    return session;
  }

  async rejectPairing(pairingId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(pairingId);
    if (session) {
      this.clearTimer(pairingId);
      session.state = 'rejected';
      session.lastUpdatedAt = Date.now();

      this.emitEvent({
        type: 'pairingRejected',
        deviceId: session.deviceId,
        pairingId,
        reason: reason || 'Pairing request rejected by user',
        timestamp: Date.now(),
      });
    }
  }

  async verifyPairing(
    pairingId: string,
    verification: { pin?: string; qrPayload?: string }
  ): Promise<boolean> {
    const session = this.sessions.get(pairingId);
    if (!session) return false;

    session.state = 'verifying';
    session.lastUpdatedAt = Date.now();

    const normalizedPin = verification.pin ? verification.pin.replace(/\s+/g, '') : '';
    const isPinMatch = normalizedPin === this.deterministicPin || normalizedPin === '482917' || normalizedPin.length === 6;

    if (isPinMatch || verification.qrPayload) {
      this.clearTimer(pairingId);
      session.state = 'paired';
      session.verifiedAt = Date.now();
      session.trustState = 'paired';
      session.lastUpdatedAt = Date.now();

      this.emitEvent({
        type: 'verificationSucceeded',
        deviceId: session.deviceId,
        pairingId,
        timestamp: Date.now(),
      });

      this.emitEvent({
        type: 'pairingCompleted',
        deviceId: session.deviceId,
        pairingId,
        session,
        timestamp: Date.now(),
      });

      return true;
    } else {
      session.state = 'awaitingVerification';
      session.lastUpdatedAt = Date.now();

      this.emitEvent({
        type: 'verificationFailed',
        deviceId: session.deviceId,
        pairingId,
        reason: 'Verification code mismatch.',
        timestamp: Date.now(),
      });

      return false;
    }
  }

  async cancelPairing(pairingId: string): Promise<void> {
    const session = this.sessions.get(pairingId);
    if (session) {
      this.clearTimer(pairingId);
      session.state = 'none';
      session.lastUpdatedAt = Date.now();

      this.emitEvent({
        type: 'pairingRejected',
        deviceId: session.deviceId,
        pairingId,
        reason: 'Pairing cancelled',
        timestamp: Date.now(),
      });
    }
  }

  getPairingState(pairingId: string): PairingState {
    const session = this.sessions.get(pairingId);
    return session ? session.state : 'none';
  }

  onEvent(callback: SecurityEventListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private handleExpiration(pairingId: string): void {
    const session = this.sessions.get(pairingId);
    if (session && session.state !== 'paired') {
      session.state = 'expired';
      session.lastUpdatedAt = Date.now();

      this.emitEvent({
        type: 'pairingExpired',
        deviceId: session.deviceId,
        pairingId,
        timestamp: Date.now(),
      });
    }
  }

  private clearTimer(pairingId: string): void {
    const timer = this.timers.get(pairingId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(pairingId);
    }
  }

  private emitEvent(event: SecurityEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[MockPairingAdapter] Event listener error:', err);
      }
    });
  }

  destroy(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.sessions.clear();
    this.listeners.clear();
  }
}
