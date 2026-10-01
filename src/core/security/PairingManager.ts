/**
 * NearShare Pairing Manager
 *
 * Central coordinator for device pairing workflows, SAS verification sessions,
 * and secure transfer session lifecycle management.
 *
 * PRODUCTION: Uses ProductionPairingAdapter (cryptographic per-session SAS).
 * TESTS: Use PairingManager.createWithMockAdapter() to inject MockPairingAdapter.
 */

import type { PairingAdapter } from './PairingAdapter';
import { ProductionPairingAdapter } from './production/ProductionPairingAdapter';
import type { PairingSession, PairingState, TrustState } from './types';
import type { SecurityState } from './SecurityState';
import { formatSecurityStatusLabel } from './SecurityState';
import type { TransferSession } from './TransferSession';
import { createTransferSession } from './TransferSession';
import type { SecurityEventListener, SecurityEvent } from './events';

export class PairingManager {
  private static instance: PairingManager;
  private adapter: PairingAdapter;
  private activePairings: Map<string, PairingSession> = new Map(); // Key: deviceId
  private activeSessions: Map<string, TransferSession> = new Map(); // Key: deviceId
  private listeners: Set<SecurityEventListener> = new Set();
  private unregisterAdapterListener: () => void;

  private constructor(adapter?: PairingAdapter) {
    // Production: cryptographic SAS derivation per session.
    // Tests: inject MockPairingAdapter via createWithMockAdapter().
    this.adapter = adapter ?? new ProductionPairingAdapter();
    this.unregisterAdapterListener = this.adapter.onEvent((event: SecurityEvent) => {
      this.handleAdapterEvent(event);
    });
  }

  public static getInstance(): PairingManager {
    if (!PairingManager.instance) {
      PairingManager.instance = new PairingManager();
    }
    return PairingManager.instance;
  }

  /**
   * Creates a fresh isolated PairingManager with a caller-supplied adapter.
   * Use this in tests to inject MockPairingAdapter without touching the production singleton.
   */
  public static createWithAdapter(adapter: PairingAdapter): PairingManager {
    return new PairingManager(adapter);
  }

  private handleAdapterEvent(event: SecurityEvent): void {
    if (event.deviceId) {
      if (event.type === 'pairingCompleted') {
        this.activePairings.set(event.deviceId, event.session);
        // Automatically create a transfer session upon pairing completion
        const transferSession = createTransferSession(event.deviceId, event.pairingId);
        this.activeSessions.set(event.deviceId, transferSession);

        this.emitEvent({
          type: 'sessionCreated',
          session: transferSession,
          deviceId: event.deviceId,
          timestamp: Date.now(),
        });
      } else if (event.type === 'pairingRejected' || event.type === 'pairingExpired') {
        this.activePairings.delete(event.deviceId);
        this.activeSessions.delete(event.deviceId);
      }
    }

    this.emitEvent(event);
  }

  /**
   * Sets custom native pairing adapter when running on native runtime.
   */
  public setAdapter(adapter: PairingAdapter): void {
    this.unregisterAdapterListener();
    this.adapter.destroy();
    this.adapter = adapter;
    this.unregisterAdapterListener = this.adapter.onEvent((event) => {
      this.handleAdapterEvent(event);
    });
  }

  /**
   * Evaluates if a transfer session can be established without prompt (e.g. trusted/paired devices).
   */
  public canEstablishSession(device: {
    id: string;
    isBlocked?: boolean;
    isTrusted?: boolean;
  }): boolean {
    if (device.isBlocked) return false;
    if (device.isTrusted) return true;

    const pairing = this.activePairings.get(device.id);
    return !!pairing && pairing.state === 'paired';
  }

  public async requestPairing(device: {
    id: string;
    deviceName?: string;
    name?: string;
    profileId?: string;
  }): Promise<PairingSession> {
    // Avoid creating duplicate simultaneous pairing sessions for same device
    const existing = this.activePairings.get(device.id);
    if (existing && (existing.state === 'requested' || existing.state === 'awaitingVerification')) {
      return existing;
    }

    const session = await this.adapter.requestPairing(device);
    this.activePairings.set(device.id, session);
    return session;
  }

  public async acceptPairing(pairingId: string): Promise<PairingSession> {
    return this.adapter.acceptPairing(pairingId);
  }

  public async rejectPairing(pairingId: string, reason?: string): Promise<void> {
    await this.adapter.rejectPairing(pairingId, reason);
  }

  public async verifyPairing(
    pairingId: string,
    verification: { pin?: string; qrPayload?: string }
  ): Promise<boolean> {
    return this.adapter.verifyPairing(pairingId, verification);
  }

  public async cancelPairing(pairingId: string): Promise<void> {
    await this.adapter.cancelPairing(pairingId);
  }

  public getPairingState(deviceId: string): PairingState {
    const session = this.activePairings.get(deviceId);
    return session ? session.state : 'none';
  }

  public getSecurityState(
    deviceId: string,
    deviceMetadata?: { isTrusted?: boolean; isBlocked?: boolean; isFavorite?: boolean }
  ): SecurityState {
    const session = this.activePairings.get(deviceId);
    let trustState: TrustState = 'unknown';

    if (deviceMetadata?.isBlocked) {
      trustState = 'blocked';
    } else if (deviceMetadata?.isFavorite) {
      trustState = 'favorite';
    } else if (deviceMetadata?.isTrusted) {
      trustState = 'trusted';
    } else if (session?.state === 'paired') {
      trustState = 'paired';
    }

    const isVerified = trustState === 'trusted' || trustState === 'favorite' || session?.state === 'paired';
    const isSessionActive = this.activeSessions.has(deviceId) || isVerified;

    const stateObj: SecurityState = {
      pairingState: session ? session.state : 'none',
      trustState,
      verified: isVerified,
      sessionEstablished: isSessionActive,
      method: session ? session.method : 'pin',
      displayStatus: '',
      updatedAt: Date.now(),
    };
    stateObj.displayStatus = formatSecurityStatusLabel(stateObj);

    return stateObj;
  }

  public getActiveSession(deviceId: string): TransferSession | undefined {
    return this.activeSessions.get(deviceId);
  }

  public closeSession(deviceId: string): void {
    const session = this.activeSessions.get(deviceId);
    if (session) {
      session.state = 'closed';
      session.closedAt = Date.now();
      this.activeSessions.delete(deviceId);

      this.emitEvent({
        type: 'sessionClosed',
        sessionId: session.sessionId,
        deviceId,
        timestamp: Date.now(),
      });
    }
  }

  public subscribe(listener: SecurityEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitEvent(event: SecurityEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[PairingManager] Listener error:', err);
      }
    });
  }

  public destroy(): void {
    this.unregisterAdapterListener();
    this.adapter.destroy();
    this.activePairings.clear();
    this.activeSessions.clear();
    this.listeners.clear();
  }
}
