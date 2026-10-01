/**
 * NearShare Device Identity Manager
 *
 * Manages long-term device identity keypairs (ECDSA P-256), SHA-256 public key fingerprints,
 * transcript signing, and Trust-On-First-Use (TOFU) peer identity verification.
 *
 * CRITICAL SECURITY INVARIANTS:
 * - Private key material is never serialized or exposed to React / UI state.
 * - Identity fingerprints follow standard colon-separated hex format (AB:CD:12:34:...).
 * - Changed identity keys for known devices are strictly detected and flagged as 'changed',
 *   requiring explicit user action rather than silent overwrite.
 */

import {
  type IdentityKeyPair,
  generateDeviceIdentityKeyPair,
  importIdentityPublicKey,
  signTranscript,
  verifyTranscriptSignature,
  hexToBytes,
} from './CryptoPrimitives';
import type {
  PeerIdentityRecord,
  IdentityVerificationStatus,
} from './types';

export class DeviceIdentityManager {
  private static instance: DeviceIdentityManager | null = null;

  private identityKeyPair: IdentityKeyPair | null = null;
  private knownPeers: Map<string, PeerIdentityRecord> = new Map();

  private constructor() {}

  static getInstance(): DeviceIdentityManager {
    if (!DeviceIdentityManager.instance) {
      DeviceIdentityManager.instance = new DeviceIdentityManager();
    }
    return DeviceIdentityManager.instance;
  }

  /**
   * Initializes or retrieves the local device identity keypair.
   */
  async getOrCreateIdentity(): Promise<IdentityKeyPair> {
    if (!this.identityKeyPair) {
      this.identityKeyPair = await generateDeviceIdentityKeyPair();
    }
    return this.identityKeyPair;
  }

  /**
   * Returns the safe local public key fingerprint.
   */
  async getLocalFingerprint(): Promise<string> {
    const id = await this.getOrCreateIdentity();
    return id.fingerprint;
  }

  /**
   * Returns the local public key in hex format (safe for wire transmission).
   */
  async getLocalPublicKeyHex(): Promise<string> {
    const id = await this.getOrCreateIdentity();
    return id.publicKeyHex;
  }

  /**
   * Signs a cryptographic handshake transcript using the local private key.
   */
  async signHandshakeTranscript(transcriptBytes: Uint8Array): Promise<Uint8Array> {
    const id = await this.getOrCreateIdentity();
    return await signTranscript(id.keyPair.privateKey, transcriptBytes);
  }

  /**
   * Verifies an incoming handshake transcript signature against the peer's public key.
   */
  async verifyPeerTranscriptSignature(
    peerPublicKeyHex: string,
    signature: Uint8Array,
    transcriptBytes: Uint8Array
  ): Promise<boolean> {
    try {
      const spkiBytes = hexToBytes(peerPublicKeyHex);
      const peerCryptoKey = await importIdentityPublicKey(spkiBytes);
      return await verifyTranscriptSignature(peerCryptoKey, signature, transcriptBytes);
    } catch {
      return false;
    }
  }

  /**
   * Evaluates the Trust-On-First-Use (TOFU) status of a peer device identity.
   */
  evaluatePeerIdentity(
    deviceId: string,
    presentedPublicKeyHex: string,
    presentedFingerprint: string
  ): {
    status: IdentityVerificationStatus;
    record: PeerIdentityRecord;
    previousFingerprint?: string;
  } {
    const existing = this.knownPeers.get(deviceId);
    const now = Date.now();

    if (!existing) {
      const newRecord: PeerIdentityRecord = {
        deviceId,
        fingerprint: presentedFingerprint,
        identityPublicKeyHex: presentedPublicKeyHex,
        trustStatus: 'unknown',
        firstSeen: now,
        lastSeen: now,
      };
      this.knownPeers.set(deviceId, newRecord);
      return { status: 'unknown', record: newRecord };
    }

    // Existing device seen previously
    if (existing.fingerprint === presentedFingerprint) {
      existing.lastSeen = now;
      return {
        status: existing.trustStatus === 'trusted' ? 'verified' : 'known',
        record: existing,
      };
    }

    // IDENTITY CHANGED: Stored fingerprint differs from presented fingerprint!
    return {
      status: 'changed',
      record: existing,
      previousFingerprint: existing.fingerprint,
    };
  }

  /**
   * Explicit user action to trust a device fingerprint.
   */
  trustDevice(deviceId: string, fingerprint?: string): void {
    const existing = this.knownPeers.get(deviceId);
    if (existing) {
      if (fingerprint && existing.fingerprint !== fingerprint) {
        existing.fingerprint = fingerprint;
      }
      existing.trustStatus = 'trusted';
      existing.lastSeen = Date.now();
    } else if (fingerprint) {
      this.knownPeers.set(deviceId, {
        deviceId,
        fingerprint,
        identityPublicKeyHex: '',
        trustStatus: 'trusted',
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      });
    }
  }

  /**
   * Alias for trustDevice for peer identity management.
   */
  trustPeerIdentity(deviceId: string, fingerprint?: string): void {
    this.trustDevice(deviceId, fingerprint);
  }

  /**
   * Explicit user action to reject a device.
   */
  rejectDevice(deviceId: string): void {
    const existing = this.knownPeers.get(deviceId);
    if (existing) {
      existing.trustStatus = 'rejected';
    }
  }

  /**
   * Clears peer identity store (development / test runner only).
   */
  reset(): void {
    this.knownPeers.clear();
    this.identityKeyPair = null;
  }
}
