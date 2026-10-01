/**
 * NearShare Cryptographic Primitives
 *
 * Implements standard, audited cryptographic algorithms via the W3C Web Cryptography API:
 * 1. ECDH (NIST P-256 / secp256r1) for ephemeral authenticated key exchange
 * 2. HKDF (RFC 5869 with SHA-256) for cryptographically sound directional key derivation
 * 3. AES-256-GCM (NIST SP 800-38D) with 128-bit authentication tags for AEAD encryption
 * 4. ECDSA (P-256 / SHA-256) for device identity signing and transcript authentication
 * 5. SHA-256 for deterministic device identity fingerprints
 *
 * SAFETY GUARANTEES:
 * - No custom crypto math or hand-rolled primitives.
 * - Hardware-accelerated and audited standard implementations across macOS Apple Silicon / Intel and Windows.
 * - Strict directional key separation (initiator vs responder).
 * - Monotonic 64-bit sequence-dependent IV construction.
 */

import { CryptoException } from './errors';

export function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  if (cleanHex.length % 2 !== 0) {
    throw new CryptoException('CORRUPTED_FRAME', 'Invalid hexadecimal string length');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function computeSha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data as any);
  return new Uint8Array(hashBuffer);
}

export async function formatFingerprint(publicKeyBytes: Uint8Array): Promise<string> {
  const hash = await computeSha256(publicKeyBytes);
  const parts: string[] = [];
  for (let i = 0; i < hash.length; i++) {
    parts.push(hash[i].toString(16).padStart(2, '0').toUpperCase());
  }
  return parts.join(':');
}

// =========================================================================
// DEVICE IDENTITY (ECDSA P-256)
// =========================================================================

export interface IdentityKeyPair {
  keyPair: CryptoKeyPair;
  publicKeySpki: Uint8Array;
  publicKeyHex: string;
  fingerprint: string;
}

export async function generateDeviceIdentityKeyPair(): Promise<IdentityKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign', 'verify']
  );

  const spkiBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeySpki = new Uint8Array(spkiBuffer);
  const publicKeyHex = bytesToHex(publicKeySpki);
  const fingerprint = await formatFingerprint(publicKeySpki);

  return {
    keyPair,
    publicKeySpki,
    publicKeyHex,
    fingerprint,
  };
}

export async function importIdentityPublicKey(spkiBytes: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'spki',
    spkiBytes as any,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );
}

export async function signTranscript(
  privateKey: CryptoKey,
  transcriptBytes: Uint8Array
): Promise<Uint8Array> {
  const sigBuffer = await crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: { name: 'SHA-256' },
    },
    privateKey,
    transcriptBytes as any
  );
  return new Uint8Array(sigBuffer);
}

export async function verifyTranscriptSignature(
  publicKey: CryptoKey,
  signature: Uint8Array,
  transcriptBytes: Uint8Array
): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' },
      },
      publicKey,
      signature as any,
      transcriptBytes as any
    );
  } catch {
    return false;
  }
}

// =========================================================================
// EPHEMERAL KEY EXCHANGE (ECDH P-256)
// =========================================================================

export interface EphemeralKeyPair {
  keyPair: CryptoKeyPair;
  publicKeyRaw: Uint8Array; // 65 bytes uncompressed P-256
  publicKeyHex: string;
}

export async function generateEphemeralKeyPair(): Promise<EphemeralKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  const rawBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyRaw = new Uint8Array(rawBuffer);
  const publicKeyHex = bytesToHex(publicKeyRaw);

  return {
    keyPair,
    publicKeyRaw,
    publicKeyHex,
  };
}

export async function importEphemeralPublicKey(rawBytes: Uint8Array): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    rawBytes as any,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    false,
    []
  );
}

export async function deriveSharedEcdhSecret(
  localPrivateKey: CryptoKey,
  remotePublicKey: CryptoKey
): Promise<ArrayBuffer> {
  return await crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: remotePublicKey,
    },
    localPrivateKey,
    256
  );
}

// =========================================================================
// DIRECTIONAL KEY DERIVATION (HKDF-SHA256)
// =========================================================================

export interface DerivedSessionKeys {
  initiatorKey: CryptoKey;
  responderKey: CryptoKey;
  initiatorIvSalt: Uint8Array;
  responderIvSalt: Uint8Array;
}

export async function deriveSessionKeysFromSecret(
  sharedSecret: ArrayBuffer,
  sessionId: string,
  initiatorEphemeralPub: Uint8Array,
  responderEphemeralPub: Uint8Array
): Promise<DerivedSessionKeys> {
  // Import raw shared secret as HKDF master key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveKey', 'deriveBits']
  );

  // Compute deterministic HKDF salt over sessionId + sorted ephemeral public keys
  const saltInput = new Uint8Array(
    sessionId.length + initiatorEphemeralPub.length + responderEphemeralPub.length + 16
  );
  const enc = new TextEncoder();
  const sessionBytes = enc.encode(sessionId);
  saltInput.set(sessionBytes, 0);
  saltInput.set(initiatorEphemeralPub, sessionBytes.length);
  saltInput.set(responderEphemeralPub, sessionBytes.length + initiatorEphemeralPub.length);
  const salt = await computeSha256(saltInput);

  // 1. Derive Initiator -> Responder 256-bit AES-GCM Key
  const initiatorKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as any,
      info: enc.encode('NearShare-v1-SecureTransport-Initiator-To-Responder-Key') as any,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // 2. Derive Responder -> Initiator 256-bit AES-GCM Key
  const responderKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as any,
      info: enc.encode('NearShare-v1-SecureTransport-Responder-To-Initiator-Key') as any,
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // 3. Derive Initiator 12-byte IV salt
  const initIvBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as any,
      info: enc.encode('NearShare-v1-SecureTransport-Initiator-IV-Salt') as any,
    },
    hkdfKey,
    96 // 12 bytes = 96 bits
  );
  const initiatorIvSalt = new Uint8Array(initIvBits);

  // 4. Derive Responder 12-byte IV salt
  const respIvBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as any,
      info: enc.encode('NearShare-v1-SecureTransport-Responder-IV-Salt') as any,
    },
    hkdfKey,
    96
  );
  const responderIvSalt = new Uint8Array(respIvBits);

  return {
    initiatorKey,
    responderKey,
    initiatorIvSalt,
    responderIvSalt,
  };
}

// =========================================================================
// NONCE / IV CONSTRUCTION (12 BYTES)
// =========================================================================

export function constructNonce(salt: Uint8Array, sequenceNumber: bigint): Uint8Array {
  if (salt.length !== 12) {
    throw new CryptoException('CORRUPTED_FRAME', 'IV salt must be exactly 12 bytes');
  }
  const iv = new Uint8Array(12);
  iv.set(salt);

  // XOR the last 8 bytes with big-endian sequence number
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, sequenceNumber, false); // big-endian
  const seqBytes = new Uint8Array(view.buffer);

  for (let i = 0; i < 8; i++) {
    iv[4 + i] ^= seqBytes[i];
  }

  return iv;
}

// =========================================================================
// AUTHENTICATED ENCRYPTION (AES-256-GCM)
// =========================================================================

export async function encryptAesGcm(
  key: CryptoKey,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  try {
    const cipherBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
        additionalData: aad ? (aad as any) : undefined,
        tagLength: 128, // 128-bit authentication tag
      },
      key,
      plaintext as any
    );
    return new Uint8Array(cipherBuffer);
  } catch (err) {
    throw new CryptoException(
      'INVALID_CIPHERTEXT',
      'AEAD encryption failed',
      false,
      false
    );
  }
}

export async function decryptAesGcm(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  try {
    const plainBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
        additionalData: aad ? (aad as any) : undefined,
        tagLength: 128,
      },
      key,
      ciphertext as any
    );
    return new Uint8Array(plainBuffer);
  } catch (err) {
    throw new CryptoException(
      'AUTH_TAG_FAILED',
      'AEAD authentication tag verification failed — ciphertext was modified, corrupted, or replayed',
      false,
      false
    );
  }
}
