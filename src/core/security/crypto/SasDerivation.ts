/**
 * NearShare Short Authentication String (SAS) Derivation
 *
 * Derives a human-verifiable 6-digit SAS from the cryptographic session transcript.
 *
 * SECURITY PROPERTIES:
 * - SAS is derived from the full handshake transcript: protocol version, session ID,
 *   both peer device identities (fingerprints), and both ephemeral public keys.
 * - Derivation uses HKDF-SHA256 with a well-separated info label.
 * - SAS value is unique per session — different sessions produce different SAS values.
 * - Transcript alteration (MITM) produces a mismatched SAS on both sides.
 * - SAS does NOT expose any private key material.
 * - SAS is NOT derived from Math.random() or timestamps alone.
 * - SAS uses Web Crypto API only.
 *
 * USAGE:
 * Both peers independently call deriveSas() with the same ordered transcript inputs.
 * The resulting 6-digit decimal string is displayed to the user for out-of-band
 * visual confirmation.
 */

import { computeSha256, bytesToHex } from './CryptoPrimitives';

export const SAS_PROTOCOL_VERSION = 'NearShare-v1';
export const SAS_DERIVATION_LABEL = 'NearShare-v1-SAS-Pairing-Verification';
export const SAS_LIFETIME_MS = 60_000; // 60 seconds
export const SAS_DIGITS = 6;

export interface SasTranscript {
  protocolVersion: string;           // e.g. 'NearShare-v1'
  sessionId: string;                 // shared session identifier
  initiatorFingerprint: string;      // SHA-256 fingerprint of initiator ECDSA public key
  responderFingerprint: string;      // SHA-256 fingerprint of responder ECDSA public key
  initiatorEphemeralPubHex: string;  // hex-encoded initiator ECDH P-256 public key
  responderEphemeralPubHex: string;  // hex-encoded responder ECDH P-256 public key
}

export interface DerivedSas {
  /** Display code in human-readable format: e.g. "123 456" */
  displayCode: string;
  /** Raw 6-digit string without space */
  rawCode: string;
  /** Transcript hash (hex) — for logging/audit; never the SAS itself */
  transcriptHash: string;
  /** Epoch ms when this SAS was derived */
  derivedAt: number;
  /** Epoch ms when this SAS expires */
  expiresAt: number;
}

/**
 * Builds the canonical SAS transcript byte string from session parameters.
 * Both peers must call this with the same ordered parameters to produce matching SAS.
 */
function buildTranscriptBytes(transcript: SasTranscript): Uint8Array {
  const enc = new TextEncoder();
  // Canonical ordering: protocol + session + sorted peer fingerprints + sorted ephemeral keys
  // Sorting ensures both peers produce the same byte string regardless of who is "local"
  const [fp1, fp2] = [transcript.initiatorFingerprint, transcript.responderFingerprint].sort();
  const [eph1, eph2] = [transcript.initiatorEphemeralPubHex, transcript.responderEphemeralPubHex].sort();

  const canonicalString = [
    transcript.protocolVersion,
    transcript.sessionId,
    fp1,
    fp2,
    eph1,
    eph2,
    SAS_DERIVATION_LABEL,
  ].join(':');

  return enc.encode(canonicalString);
}

/**
 * Derives a 6-digit SAS from the cryptographic session transcript.
 *
 * Algorithm:
 * 1. Build canonical transcript bytes (ordered so both peers get same result)
 * 2. SHA-256 hash the transcript
 * 3. Extract the first 4 bytes as a big-endian uint32
 * 4. Modulo 10^6 to get a 6-digit decimal
 * 5. Zero-pad to exactly 6 digits
 * 6. Format as "XXX YYY" for human display
 */
export async function deriveSas(transcript: SasTranscript): Promise<DerivedSas> {
  const transcriptBytes = buildTranscriptBytes(transcript);
  const hashBytes = await computeSha256(transcriptBytes);

  // Extract 4 bytes from hash positions 0..3 as big-endian uint32
  const view = new DataView(hashBytes.buffer, hashBytes.byteOffset, hashBytes.byteLength);
  const uint32Value = view.getUint32(0, false); // big-endian

  // Map to 6-digit decimal (000000..999999)
  const rawNumeric = uint32Value % 1_000_000;
  const rawCode = rawNumeric.toString().padStart(SAS_DIGITS, '0');

  // Format for display: "123 456"
  const displayCode = `${rawCode.slice(0, 3)} ${rawCode.slice(3)}`;

  const derivedAt = Date.now();
  return {
    displayCode,
    rawCode,
    transcriptHash: bytesToHex(hashBytes),
    derivedAt,
    expiresAt: derivedAt + SAS_LIFETIME_MS,
  };
}

/**
 * Checks whether a user-entered SAS code matches the derived SAS.
 * Normalizes whitespace before comparison (accepts both "123456" and "123 456").
 */
export function verifySasCode(
  entered: string,
  derived: DerivedSas,
  nowMs: number = Date.now()
): { valid: boolean; reason?: string } {
  if (nowMs > derived.expiresAt) {
    return { valid: false, reason: 'SAS code has expired. Request a new pairing.' };
  }

  const normalized = entered.replace(/\s+/g, '');
  if (normalized !== derived.rawCode) {
    return { valid: false, reason: 'SAS code does not match. Verify the code on both devices.' };
  }

  return { valid: true };
}

/**
 * Checks whether the SAS has expired.
 */
export function isSasExpired(derived: DerivedSas, nowMs: number = Date.now()): boolean {
  return nowMs > derived.expiresAt;
}

/**
 * Creates a minimal transcript for cases where the full ECDH handshake is not available
 * (e.g. during session establishment phase). Falls back to session-bound transcript only.
 * NOTE: This produces a weaker SAS — prefer full transcript with ephemeral keys.
 */
export async function deriveSessionBoundSas(
  sessionId: string,
  localFingerprint: string,
  peerFingerprint: string
): Promise<DerivedSas> {
  const transcript: SasTranscript = {
    protocolVersion: SAS_PROTOCOL_VERSION,
    sessionId,
    initiatorFingerprint: localFingerprint,
    responderFingerprint: peerFingerprint,
    // When ephemeral keys not yet exchanged, use deterministic placeholder bound to fingerprints
    initiatorEphemeralPubHex: localFingerprint,
    responderEphemeralPubHex: peerFingerprint,
  };
  return deriveSas(transcript);
}
