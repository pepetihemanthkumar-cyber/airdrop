/**
 * NearShare Secure Transport Session & Cryptographic Types
 *
 * Defines models for secure framing, handshake payloads, identity fingerprints,
 * sequence verification, and safe diagnostic telemetry.
 */

export type SecureSessionState =
  | 'none'
  | 'handshaking'
  | 'established'
  | 'failed'
  | 'closed';

export type IdentityVerificationStatus =
  | 'unknown'
  | 'known'
  | 'verified'
  | 'changed'
  | 'mismatch';

export type SessionRole = 'initiator' | 'responder';

export const SECURE_FRAME_MAGIC = 0x53454301; // "SEC\x01" (4 bytes)
export const SECURE_FRAME_VERSION = 1;

export const SecureFrameType = {
  HANDSHAKE_INIT: 0x01,
  HANDSHAKE_RESP: 0x02,
  HANDSHAKE_FINISH: 0x03,
  ENCRYPTED_DATA: 0x10,
  SESSION_CLOSE: 0x1f,
} as const;

export type SecureFrameType = (typeof SecureFrameType)[keyof typeof SecureFrameType];

export interface ParsedSecureFrame {
  magic: number;
  frameType: SecureFrameType;
  sessionId: string;
  sequenceNumber: bigint;
  payloadLength: number;
  payload: Uint8Array;
  aad: Uint8Array; // Authenticated Associated Data used in AEAD verification
}

export interface HandshakeEnvelope {
  type: 'HANDSHAKE_INIT' | 'HANDSHAKE_RESP' | 'HANDSHAKE_FINISH';
  sessionId: string;
  deviceId: string;
  ephemeralPublicKeyHex: string; // Raw uncompressed P-256 ECDH public key (65 bytes hex)
  identityPublicKeyHex: string;  // SPKI P-256 ECDSA public key hex
  identityFingerprint: string;   // SHA-256 colon-separated hex format
  signatureHex: string;          // ECDSA SHA-256 signature over transcript
  timestamp: number;
}

export interface PeerIdentityRecord {
  deviceId: string;
  fingerprint: string;
  identityPublicKeyHex: string;
  trustStatus: 'trusted' | 'unknown' | 'rejected';
  firstSeen: number;
  lastSeen: number;
}

export interface SecureSessionDiagnostics {
  sessionId: string;
  state: SecureSessionState;
  role: SessionRole;
  localFingerprint: string;
  peerFingerprint: string | null;
  identityStatus: IdentityVerificationStatus;
  cipherSuite: string;
  sessionAgeMs: number;
  framesSent: number;
  framesReceived: number;
  bytesSentEncrypted: number;
  bytesReceivedEncrypted: number;
  isEncrypted: boolean;
  lastActivityAt: number;
}
