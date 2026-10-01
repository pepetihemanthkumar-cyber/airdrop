/**
 * NearShare Secure Transport Session
 *
 * Implements an authenticated, encrypted secure session layer directly above TCP.
 *
 * CRYPTOGRAPHIC CONTRACT:
 * - Key Exchange: Ephemeral ECDH (NIST P-256) establishes fresh per-session key material.
 * - Key Derivation: HKDF-SHA256 generates independent directional keys (initiator vs responder).
 * - AEAD Cipher: AES-256-GCM with 128-bit authentication tags and sequence-derived IVs.
 * - Monotonic Sequence Numbers: Enforces strict in-order delivery and drops replays/duplicates.
 * - Identity Binding: Handshake transcript is signed by long-term device ECDSA keys.
 * - Clean Teardown: Invalidation permanently wipes keys from memory.
 */

import {
  type EphemeralKeyPair,
  generateEphemeralKeyPair,
  importEphemeralPublicKey,
  deriveSharedEcdhSecret,
  deriveSessionKeysFromSecret,
  constructNonce,
  encryptAesGcm,
  decryptAesGcm,
  bytesToHex,
  hexToBytes,
} from './CryptoPrimitives';
import { SecureFrameSerializer } from './SecureFrame';
import { DeviceIdentityManager } from './DeviceIdentity';
import { CryptoException } from './errors';
import {
  SecureFrameType,
  type SecureSessionState,
  type IdentityVerificationStatus,
  type SessionRole,
  type HandshakeEnvelope,
  type SecureSessionDiagnostics,
} from './types';

export const MAX_SESSION_SEQUENCE_NUMBER = 0xFFFFFFFFFFFFFFFEn;

export class SecureTransportSession {
  readonly sessionId: string;
  readonly localDeviceId: string;
  readonly role: SessionRole;

  private state: SecureSessionState = 'none';
  private identityStatus: IdentityVerificationStatus = 'unknown';

  private localEphemeral: EphemeralKeyPair | null = null;
  private peerEphemeralPubHex: string | null = null;
  private peerIdentityPubHex: string | null = null;
  private peerFingerprint: string | null = null;
  private peerDeviceId: string | null = null;

  // Directional symmetric keys & IV salts (Never exposed outside this class)
  private outboundKey: CryptoKey | null = null;
  private inboundKey: CryptoKey | null = null;
  private outboundIvSalt: Uint8Array | null = null;
  private inboundIvSalt: Uint8Array | null = null;

  // Sequence counters (64-bit monotonic)
  private outboundSeqNum: bigint = 0n;
  private expectedInboundSeqNum: bigint = 0n;

  // Telemetry & diagnostics (Safe metadata only)
  private createdAt: number = Date.now();
  private establishedAt: number | null = null;
  private lastActivityAt: number = Date.now();
  private framesSent: number = 0;
  private framesReceived: number = 0;
  private bytesSentEncrypted: number = 0;
  private bytesReceivedEncrypted: number = 0;

  private stateChangeListeners: Set<(state: SecureSessionState) => void> = new Set();

  constructor(sessionId: string, localDeviceId: string, role: SessionRole = 'initiator') {
    this.sessionId = sessionId;
    this.localDeviceId = localDeviceId;
    this.role = role;
  }

  getState(): SecureSessionState {
    return this.state;
  }

  isEstablished(): boolean {
    return this.state === 'established';
  }

  getIdentityStatus(): IdentityVerificationStatus {
    return this.identityStatus;
  }

  getPeerFingerprint(): string | null {
    return this.peerFingerprint;
  }

  getPeerDeviceId(): string | null {
    return this.peerDeviceId;
  }

  getCreatedAt(): number {
    return this.createdAt;
  }

  getPeerEphemeralPublicKeyHex(): string | null {
    return this.peerEphemeralPubHex;
  }

  getPeerIdentityPublicKeyHex(): string | null {
    return this.peerIdentityPubHex;
  }

  onStateChange(listener: (state: SecureSessionState) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  private setState(nextState: SecureSessionState): void {
    this.state = nextState;
    this.lastActivityAt = Date.now();
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(nextState);
      } catch (err) {
        console.error('[SecureTransportSession] state listener error:', err);
      }
    });
  }

  // =========================================================================
  // HANDSHAKE PROTOCOL
  // =========================================================================

  /**
   * Initiates the secure handshake by generating local ephemeral keys and returning the INIT frame.
   */
  async createHandshakeInit(): Promise<Uint8Array> {
    if (this.role !== 'initiator') {
      throw new CryptoException('HANDSHAKE_FAILED', 'Only initiator can create HANDSHAKE_INIT');
    }

    this.setState('handshaking');
    this.localEphemeral = await generateEphemeralKeyPair();

    const identityManager = DeviceIdentityManager.getInstance();
    const identityPubHex = await identityManager.getLocalPublicKeyHex();
    const identityFingerprint = await identityManager.getLocalFingerprint();

    // Sign initial transcript: sessionId + localEphemeralPubHex
    const enc = new TextEncoder();
    const transcript = enc.encode(`NearShare-v1-Init:${this.sessionId}:${this.localEphemeral.publicKeyHex}`);
    const signature = await identityManager.signHandshakeTranscript(transcript);

    const envelope: HandshakeEnvelope = {
      type: 'HANDSHAKE_INIT',
      sessionId: this.sessionId,
      deviceId: this.localDeviceId,
      ephemeralPublicKeyHex: this.localEphemeral.publicKeyHex,
      identityPublicKeyHex: identityPubHex,
      identityFingerprint,
      signatureHex: bytesToHex(signature),
      timestamp: Date.now(),
    };

    const payload = enc.encode(JSON.stringify(envelope));
    return SecureFrameSerializer.serializeFrame(
      SecureFrameType.HANDSHAKE_INIT,
      this.sessionId,
      0n,
      payload
    );
  }

  /**
   * Responder handles incoming HANDSHAKE_INIT, derives session keys, and generates HANDSHAKE_RESP.
   */
  async handleHandshakeInit(initFrameBytes: Uint8Array): Promise<Uint8Array> {
    if (this.role !== 'responder') {
      throw new CryptoException('HANDSHAKE_FAILED', 'Only responder can handle HANDSHAKE_INIT');
    }

    this.setState('handshaking');
    const parsed = SecureFrameSerializer.parseFrame(initFrameBytes);
    if (parsed.frameType !== SecureFrameType.HANDSHAKE_INIT || parsed.sessionId !== this.sessionId) {
      this.setState('failed');
      throw new CryptoException('HANDSHAKE_FAILED', 'Expected valid HANDSHAKE_INIT frame matching sessionId');
    }

    const envelope: HandshakeEnvelope = JSON.parse(new TextDecoder().decode(parsed.payload));
    this.peerDeviceId = envelope.deviceId;
    this.peerEphemeralPubHex = envelope.ephemeralPublicKeyHex;
    this.peerIdentityPubHex = envelope.identityPublicKeyHex;
    this.peerFingerprint = envelope.identityFingerprint;

    // Verify initiator signature over transcript
    const enc = new TextEncoder();
    const transcript = enc.encode(`NearShare-v1-Init:${this.sessionId}:${envelope.ephemeralPublicKeyHex}`);
    const identityManager = DeviceIdentityManager.getInstance();
    const verified = await identityManager.verifyPeerTranscriptSignature(
      envelope.identityPublicKeyHex,
      hexToBytes(envelope.signatureHex),
      transcript
    );

    if (!verified) {
      this.setState('failed');
      throw new CryptoException('AUTHENTICATION_FAILED', 'Peer identity signature verification failed');
    }

    // Evaluate TOFU identity
    const tofu = identityManager.evaluatePeerIdentity(
      envelope.deviceId,
      envelope.identityPublicKeyHex,
      envelope.identityFingerprint
    );
    this.identityStatus = tofu.status;
    if (tofu.status === 'changed') {
      this.setState('failed');
      throw new CryptoException(
        'IDENTITY_CHANGED',
        `Peer '${envelope.deviceId}' identity fingerprint changed from '${tofu.previousFingerprint}' to '${envelope.identityFingerprint}'`
      );
    }

    // Generate local responder ephemeral keypair
    this.localEphemeral = await generateEphemeralKeyPair();

    // Derive shared secret and directional session keys
    const peerEphemeralKey = await importEphemeralPublicKey(hexToBytes(envelope.ephemeralPublicKeyHex));
    const sharedSecret = await deriveSharedEcdhSecret(this.localEphemeral.keyPair.privateKey, peerEphemeralKey);

    const derived = await deriveSessionKeysFromSecret(
      sharedSecret,
      this.sessionId,
      hexToBytes(envelope.ephemeralPublicKeyHex), // initiator
      this.localEphemeral.publicKeyRaw           // responder
    );

    // Responder outbound is responderKey, inbound is initiatorKey
    this.outboundKey = derived.responderKey;
    this.inboundKey = derived.initiatorKey;
    this.outboundIvSalt = derived.responderIvSalt;
    this.inboundIvSalt = derived.initiatorIvSalt;

    // Sign responder transcript: sessionId + initiatorEphemeral + responderEphemeral
    const respTranscript = enc.encode(
      `NearShare-v1-Resp:${this.sessionId}:${envelope.ephemeralPublicKeyHex}:${this.localEphemeral.publicKeyHex}`
    );
    const respSig = await identityManager.signHandshakeTranscript(respTranscript);

    const localIdentityPubHex = await identityManager.getLocalPublicKeyHex();
    const localIdentityFingerprint = await identityManager.getLocalFingerprint();

    const respEnvelope: HandshakeEnvelope = {
      type: 'HANDSHAKE_RESP',
      sessionId: this.sessionId,
      deviceId: this.localDeviceId,
      ephemeralPublicKeyHex: this.localEphemeral.publicKeyHex,
      identityPublicKeyHex: localIdentityPubHex,
      identityFingerprint: localIdentityFingerprint,
      signatureHex: bytesToHex(respSig),
      timestamp: Date.now(),
    };

    const respPayload = enc.encode(JSON.stringify(respEnvelope));
    return SecureFrameSerializer.serializeFrame(
      SecureFrameType.HANDSHAKE_RESP,
      this.sessionId,
      0n,
      respPayload
    );
  }

  /**
   * Initiator handles incoming HANDSHAKE_RESP, derives session keys, and generates HANDSHAKE_FINISH.
   */
  async handleHandshakeResp(respFrameBytes: Uint8Array): Promise<Uint8Array> {
    if (this.role !== 'initiator') {
      throw new CryptoException('HANDSHAKE_FAILED', 'Only initiator can handle HANDSHAKE_RESP');
    }
    if (!this.localEphemeral) {
      this.setState('failed');
      throw new CryptoException('HANDSHAKE_FAILED', 'Missing local ephemeral keypair');
    }

    const parsed = SecureFrameSerializer.parseFrame(respFrameBytes);
    if (parsed.frameType !== SecureFrameType.HANDSHAKE_RESP || parsed.sessionId !== this.sessionId) {
      this.setState('failed');
      throw new CryptoException('HANDSHAKE_FAILED', 'Expected valid HANDSHAKE_RESP frame matching sessionId');
    }

    const envelope: HandshakeEnvelope = JSON.parse(new TextDecoder().decode(parsed.payload));
    this.peerDeviceId = envelope.deviceId;
    this.peerEphemeralPubHex = envelope.ephemeralPublicKeyHex;
    this.peerIdentityPubHex = envelope.identityPublicKeyHex;
    this.peerFingerprint = envelope.identityFingerprint;

    // Verify responder transcript signature
    const enc = new TextEncoder();
    const respTranscript = enc.encode(
      `NearShare-v1-Resp:${this.sessionId}:${this.localEphemeral.publicKeyHex}:${envelope.ephemeralPublicKeyHex}`
    );
    const identityManager = DeviceIdentityManager.getInstance();
    const verified = await identityManager.verifyPeerTranscriptSignature(
      envelope.identityPublicKeyHex,
      hexToBytes(envelope.signatureHex),
      respTranscript
    );

    if (!verified) {
      this.setState('failed');
      throw new CryptoException('AUTHENTICATION_FAILED', 'Responder identity signature verification failed');
    }

    // Evaluate TOFU identity
    const tofu = identityManager.evaluatePeerIdentity(
      envelope.deviceId,
      envelope.identityPublicKeyHex,
      envelope.identityFingerprint
    );
    this.identityStatus = tofu.status;
    if (tofu.status === 'changed') {
      this.setState('failed');
      throw new CryptoException(
        'IDENTITY_CHANGED',
        `Peer '${envelope.deviceId}' identity fingerprint changed from '${tofu.previousFingerprint}' to '${envelope.identityFingerprint}'`
      );
    }

    // Derive shared secret and directional session keys
    const peerEphemeralKey = await importEphemeralPublicKey(hexToBytes(envelope.ephemeralPublicKeyHex));
    const sharedSecret = await deriveSharedEcdhSecret(this.localEphemeral.keyPair.privateKey, peerEphemeralKey);

    const derived = await deriveSessionKeysFromSecret(
      sharedSecret,
      this.sessionId,
      this.localEphemeral.publicKeyRaw,          // initiator
      hexToBytes(envelope.ephemeralPublicKeyHex) // responder
    );

    // Initiator outbound is initiatorKey, inbound is responderKey
    this.outboundKey = derived.initiatorKey;
    this.inboundKey = derived.responderKey;
    this.outboundIvSalt = derived.initiatorIvSalt;
    this.inboundIvSalt = derived.responderIvSalt;

    this.establishedAt = Date.now();
    this.setState('established');

    const finishEnvelope: HandshakeEnvelope = {
      type: 'HANDSHAKE_FINISH',
      sessionId: this.sessionId,
      deviceId: this.localDeviceId,
      ephemeralPublicKeyHex: '',
      identityPublicKeyHex: '',
      identityFingerprint: '',
      signatureHex: '',
      timestamp: Date.now(),
    };

    const finishPayload = enc.encode(JSON.stringify(finishEnvelope));
    return SecureFrameSerializer.serializeFrame(
      SecureFrameType.HANDSHAKE_FINISH,
      this.sessionId,
      0n,
      finishPayload
    );
  }

  /**
   * Responder handles incoming HANDSHAKE_FINISH to complete establishment.
   */
  handleHandshakeFinish(finishFrameBytes: Uint8Array): void {
    if (this.role !== 'responder') {
      throw new CryptoException('HANDSHAKE_FAILED', 'Only responder can handle HANDSHAKE_FINISH');
    }

    const parsed = SecureFrameSerializer.parseFrame(finishFrameBytes);
    if (parsed.frameType !== SecureFrameType.HANDSHAKE_FINISH || parsed.sessionId !== this.sessionId) {
      this.setState('failed');
      throw new CryptoException('HANDSHAKE_FAILED', 'Expected valid HANDSHAKE_FINISH frame');
    }

    this.establishedAt = Date.now();
    this.setState('established');
  }

  // =========================================================================
  // ENCRYPTION & DECRYPTION
  // =========================================================================

  /**
   * Encrypts plaintext bytes with AES-256-GCM and frames as binary SecureFrame.
   */
  async encryptPayload(plaintext: Uint8Array): Promise<Uint8Array> {
    if (this.state !== 'established' || !this.outboundKey || !this.outboundIvSalt) {
      throw new CryptoException('SECURE_SESSION_UNAVAILABLE', 'Cannot encrypt: secure session is not established');
    }

    if (this.outboundSeqNum >= MAX_SESSION_SEQUENCE_NUMBER) {
      this.setState('failed');
      this.teardown();
      throw new CryptoException('EXPIRED_SESSION', 'Session sequence numbers exhausted; re-keying required');
    }

    const seq = this.outboundSeqNum++;
    const iv = constructNonce(this.outboundIvSalt, seq);
    const aad = SecureFrameSerializer.serializeAad(
      SecureFrameType.ENCRYPTED_DATA,
      this.sessionId,
      seq
    );

    // Encrypt plaintext with AEAD tag
    const ciphertext = await encryptAesGcm(this.outboundKey, iv, plaintext, aad);

    // Assemble final wire frame
    const wireFrame = SecureFrameSerializer.serializeFrame(
      SecureFrameType.ENCRYPTED_DATA,
      this.sessionId,
      seq,
      ciphertext
    );

    this.framesSent++;
    this.bytesSentEncrypted += wireFrame.length;
    this.lastActivityAt = Date.now();

    return wireFrame;
  }

  /**
   * Decrypts and integrity-verifies an incoming binary SecureFrame.
   */
  async decryptFrame(frameBytes: Uint8Array): Promise<Uint8Array> {
    if (this.state !== 'established' || !this.inboundKey || !this.inboundIvSalt) {
      throw new CryptoException('SECURE_SESSION_UNAVAILABLE', 'Cannot decrypt: secure session is not established');
    }

    const parsed = SecureFrameSerializer.parseFrame(frameBytes);

    if (parsed.sessionId !== this.sessionId) {
      this.setState('failed');
      this.teardown();
      throw new CryptoException(
        'SECURE_SESSION_UNAVAILABLE',
        `Frame sessionId '${parsed.sessionId}' does not match active secure session '${this.sessionId}'`
      );
    }

    if (parsed.frameType !== SecureFrameType.ENCRYPTED_DATA) {
      this.setState('failed');
      this.teardown();
      throw new CryptoException('CORRUPTED_FRAME', `Expected ENCRYPTED_DATA frame, got type 0x${parsed.frameType.toString(16)}`);
    }

    // Strict monotonic sequence number verification
    if (parsed.sequenceNumber < this.expectedInboundSeqNum) {
      this.setState('failed');
      this.teardown();
      throw new CryptoException(
        'REPLAY_DETECTED',
        `Replay detected: received sequence ${parsed.sequenceNumber}, expected ${this.expectedInboundSeqNum}`
      );
    }
    if (parsed.sequenceNumber > this.expectedInboundSeqNum) {
      this.setState('failed');
      this.teardown();
      throw new CryptoException(
        'INVALID_SEQUENCE',
        `Out-of-order sequence detected: received sequence ${parsed.sequenceNumber}, expected ${this.expectedInboundSeqNum}`
      );
    }

    const iv = constructNonce(this.inboundIvSalt, parsed.sequenceNumber);

    try {
      const plaintext = await decryptAesGcm(this.inboundKey, iv, parsed.payload, parsed.aad);
      this.expectedInboundSeqNum++;
      this.framesReceived++;
      this.bytesReceivedEncrypted += frameBytes.length;
      this.lastActivityAt = Date.now();
      return plaintext;
    } catch (err) {
      // AEAD failure triggers permanent session invalidation
      this.setState('failed');
      this.teardown();
      throw err;
    }
  }

  // =========================================================================
  // TEARDOWN & LIFECYCLE
  // =========================================================================

  /**
   * Destroys the secure transport session, permanently wiping all cryptographic keys from memory.
   */
  teardown(): void {
    this.outboundKey = null;
    this.inboundKey = null;
    this.outboundIvSalt = null;
    this.inboundIvSalt = null;
    this.localEphemeral = null;

    if (this.state !== 'failed') {
      this.setState('closed');
    }
  }

  /**
   * Returns safe metadata telemetry for the Protocol Inspector without exposing secret keys.
   */
  async getDiagnostics(): Promise<SecureSessionDiagnostics> {
    const identityManager = DeviceIdentityManager.getInstance();
    const localFingerprint = await identityManager.getLocalFingerprint();

    return {
      sessionId: this.sessionId,
      state: this.state,
      role: this.role,
      localFingerprint,
      peerFingerprint: this.peerFingerprint,
      identityStatus: this.identityStatus,
      cipherSuite: 'AES-256-GCM / ECDH-P256 / HKDF-SHA256',
      sessionAgeMs: this.establishedAt ? Date.now() - this.establishedAt : 0,
      framesSent: this.framesSent,
      framesReceived: this.framesReceived,
      bytesSentEncrypted: this.bytesSentEncrypted,
      bytesReceivedEncrypted: this.bytesReceivedEncrypted,
      isEncrypted: this.state === 'established',
      lastActivityAt: this.lastActivityAt,
    };
  }
}
