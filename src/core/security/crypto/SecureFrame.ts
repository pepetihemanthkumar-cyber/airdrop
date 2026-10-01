/**
 * NearShare Secure Frame Serializer & Parser
 *
 * Implements binary wire framing for authenticated, encrypted transport packets.
 *
 * WIRE SPECIFICATION:
 * [0..3]   Magic Bytes: 0x53454301 ("SEC\x01")
 * [4]      Frame Type:  0x01 (INIT), 0x02 (RESP), 0x03 (FINISH), 0x10 (ENCRYPTED_DATA), 0x1F (CLOSE)
 * [5]      Session ID Length: N (1..64)
 * [6..5+N] Session ID: N UTF-8 bytes
 * [6+N..13+N] Sequence Number: 8-byte Big-Endian unsigned integer
 * [14+N..17+N] Payload/Ciphertext Length: 4-byte Big-Endian unsigned integer
 * [18+N..] Payload/Ciphertext: Encrypted bytes with 16-byte GCM authentication tag
 *
 * AAD (Associated Authenticated Data):
 * Header slice from byte 0 through (13 + N) is authenticated by the AES-GCM tag.
 */

import { CryptoException } from './errors';
import {
  SECURE_FRAME_MAGIC,
  SecureFrameType,
  type ParsedSecureFrame,
} from './types';

export const MAX_SECURE_FRAME_SIZE = 2 * 1024 * 1024; // 2 MiB hard limit
export const MAX_SESSION_ID_LENGTH = 64;               // Bounded session ID length
export const MIN_SECURE_FRAME_HEADER_LEN = 19;         // 4 + 1 + 1 + 1 (min session) + 8 + 4
export const AES_GCM_TAG_LENGTH = 16;                  // 128-bit tag

export class SecureFrameSerializer {
  /**
   * Serializes a secure frame into binary bytes.
   */
  static serializeFrame(
    frameType: SecureFrameType,
    sessionId: string,
    sequenceNumber: bigint,
    payload: Uint8Array
  ): Uint8Array {
    if (sequenceNumber < 0n || sequenceNumber > 0xFFFFFFFFFFFFFFFFn) {
      throw new CryptoException('INVALID_SEQUENCE', 'Sequence number out of 64-bit bounds');
    }

    const enc = new TextEncoder();
    const sessionBytes = enc.encode(sessionId);
    if (sessionBytes.length === 0 || sessionBytes.length > MAX_SESSION_ID_LENGTH) {
      throw new CryptoException(
        'CORRUPTED_FRAME',
        `Session ID length must be between 1 and ${MAX_SESSION_ID_LENGTH} bytes`
      );
    }

    const headerLen = 4 + 1 + 1 + sessionBytes.length + 8 + 4;
    const totalLen = headerLen + payload.length;

    if (totalLen > MAX_SECURE_FRAME_SIZE) {
      throw new CryptoException(
        'OVERSIZED_FRAME',
        `Total frame size ${totalLen} exceeds maximum limit of ${MAX_SECURE_FRAME_SIZE} bytes`
      );
    }

    const buffer = new Uint8Array(totalLen);
    const view = new DataView(buffer.buffer);

    let offset = 0;

    // Magic (4 bytes)
    view.setUint32(offset, SECURE_FRAME_MAGIC, false);
    offset += 4;

    // Frame Type (1 byte)
    buffer[offset] = frameType;
    offset += 1;

    // Session ID length (1 byte)
    buffer[offset] = sessionBytes.length;
    offset += 1;

    // Session ID bytes
    buffer.set(sessionBytes, offset);
    offset += sessionBytes.length;

    // Sequence Number (8 bytes Big-Endian)
    view.setBigUint64(offset, sequenceNumber, false);
    offset += 8;

    // Payload Length (4 bytes Big-Endian)
    view.setUint32(offset, payload.length, false);
    offset += 4;

    // Payload bytes
    buffer.set(payload, offset);

    return buffer;
  }

  /**
   * Serializes only the authenticated header portion (AAD) for AEAD encryption.
   */
  static serializeAad(
    frameType: SecureFrameType,
    sessionId: string,
    sequenceNumber: bigint
  ): Uint8Array {
    const enc = new TextEncoder();
    const sessionBytes = enc.encode(sessionId);
    const aadLen = 4 + 1 + 1 + sessionBytes.length + 8;
    const buffer = new Uint8Array(aadLen);
    const view = new DataView(buffer.buffer);

    let offset = 0;
    view.setUint32(offset, SECURE_FRAME_MAGIC, false);
    offset += 4;
    buffer[offset] = frameType;
    offset += 1;
    buffer[offset] = sessionBytes.length;
    offset += 1;
    buffer.set(sessionBytes, offset);
    offset += sessionBytes.length;
    view.setBigUint64(offset, sequenceNumber, false);

    return buffer;
  }

  /**
   * Checks if incoming raw bytes start with the NearShare Secure Transport magic prefix.
   */
  static isSecureFrame(bytes: Uint8Array): boolean {
    if (!bytes || bytes.length < 4) return false;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getUint32(0, false) === SECURE_FRAME_MAGIC;
  }

  /**
   * Parses binary wire bytes into a structured ParsedSecureFrame envelope.
   */
  static parseFrame(bytes: Uint8Array): ParsedSecureFrame {
    if (!bytes || bytes.length < MIN_SECURE_FRAME_HEADER_LEN) {
      throw new CryptoException('CORRUPTED_FRAME', 'Frame too short to contain secure header');
    }

    if (bytes.length > MAX_SECURE_FRAME_SIZE) {
      throw new CryptoException(
        'OVERSIZED_FRAME',
        `Frame length ${bytes.length} exceeds maximum limit of ${MAX_SECURE_FRAME_SIZE} bytes`
      );
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;

    // Magic check
    const magic = view.getUint32(offset, false);
    if (magic !== SECURE_FRAME_MAGIC) {
      throw new CryptoException('CORRUPTED_FRAME', `Invalid magic header: 0x${magic.toString(16)}`);
    }
    offset += 4;

    // Frame Type
    const rawType = bytes[offset];
    if (![0x01, 0x02, 0x03, 0x10, 0x1f].includes(rawType)) {
      throw new CryptoException('CORRUPTED_FRAME', `Unknown secure frame type: 0x${rawType.toString(16)}`);
    }
    const frameType = rawType as SecureFrameType;
    offset += 1;

    // Session ID length
    const sessionLen = bytes[offset];
    offset += 1;

    if (sessionLen === 0 || sessionLen > MAX_SESSION_ID_LENGTH) {
      throw new CryptoException(
        'CORRUPTED_FRAME',
        `Invalid session ID length ${sessionLen} (must be 1..${MAX_SESSION_ID_LENGTH})`
      );
    }

    if (offset + sessionLen + 12 > bytes.length) {
      throw new CryptoException('CORRUPTED_FRAME', 'Truncated secure frame header');
    }

    // Session ID decoding with strict UTF-8 validation
    let sessionId: string;
    try {
      const sessionBytes = bytes.subarray(offset, offset + sessionLen);
      sessionId = new TextDecoder('utf-8', { fatal: true }).decode(sessionBytes);
    } catch {
      throw new CryptoException('CORRUPTED_FRAME', 'Malformed UTF-8 in session ID');
    }
    offset += sessionLen;

    // Sequence Number
    const sequenceNumber = view.getBigUint64(offset, false);
    offset += 8;

    // AAD slice is everything from byte 0 up to the end of sequenceNumber
    const aad = bytes.subarray(0, offset);

    // Payload Length
    const payloadLength = view.getUint32(offset, false);
    offset += 4;

    if (payloadLength > MAX_SECURE_FRAME_SIZE) {
      throw new CryptoException(
        'OVERSIZED_FRAME',
        `Declared payload length ${payloadLength} exceeds maximum limit of ${MAX_SECURE_FRAME_SIZE} bytes`
      );
    }

    if (offset + payloadLength > bytes.length) {
      throw new CryptoException(
        'CORRUPTED_FRAME',
        `Truncated payload: expected ${payloadLength} bytes, found ${bytes.length - offset}`
      );
    }

    if (offset + payloadLength !== bytes.length) {
      throw new CryptoException(
        'CORRUPTED_FRAME',
        `Trailing garbage bytes detected in frame: expected ${offset + payloadLength} bytes total, found ${bytes.length}`
      );
    }

    // For ENCRYPTED_DATA, payload must include at least 16 bytes for AES-GCM tag
    if (frameType === SecureFrameType.ENCRYPTED_DATA && payloadLength < AES_GCM_TAG_LENGTH) {
      throw new CryptoException(
        'CORRUPTED_FRAME',
        `Encrypted payload length ${payloadLength} is less than required 16-byte AES-GCM authentication tag`
      );
    }

    const payload = bytes.subarray(offset, offset + payloadLength);

    return {
      magic,
      frameType,
      sessionId,
      sequenceNumber,
      payloadLength,
      payload,
      aad,
    };
  }
}
