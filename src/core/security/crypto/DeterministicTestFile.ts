/**
 * NearShare Deterministic Test File Generator & Verification Engine
 *
 * Implements deterministic byte generation and SHA-256 checksum verification
 * for multi-device physical transfer validation and loopback testing (Step 44).
 *
 * SAFETY & PURITY:
 * - Deterministic PRNG algorithm: byte[i] = (i * 17 + seed) % 256
 * - Generates test files of standard tiers: 16 KiB, 1 MiB, 10 MiB, 100 MiB
 * - Computes standard SHA-256 checksums before and after transfer
 * - Verifies exact byte-for-byte fidelity without memory leakage
 */

import { computeSha256, bytesToHex } from './CryptoPrimitives';

export const TEST_FILE_SIZES = {
  TIER_16_KIB: 16 * 1024,
  TIER_1_MIB: 1024 * 1024,
  TIER_10_MIB: 10 * 1024 * 1024,
  TIER_100_MIB: 100 * 1024 * 1024,
} as const;

export type TestFileSizeTier = keyof typeof TEST_FILE_SIZES;

export interface TestFileGenerationResult {
  size: number;
  seed: number;
  bytes: Uint8Array;
  sha256Hex: string;
}

export interface TestFileVerificationResult {
  verified: boolean;
  expectedSize: number;
  receivedSize: number;
  expectedSha256Hex?: string;
  actualSha256Hex: string;
  bytesChecked: number;
  error?: string;
  durationMs: number;
}

/**
 * Generates a deterministic byte array of the specified size.
 */
export function generateDeterministicTestBytes(
  sizeInBytes: number,
  seed: number = 42
): Uint8Array {
  const buffer = new Uint8Array(sizeInBytes);
  for (let i = 0; i < sizeInBytes; i++) {
    buffer[i] = (i * 17 + seed) % 256;
  }
  return buffer;
}

/**
 * Computes the hex-encoded SHA-256 digest of a byte array.
 */
export async function computeTestPayloadSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await computeSha256(bytes);
  return bytesToHex(digest);
}

/**
 * Creates a complete test file payload descriptor with computed SHA-256.
 */
export async function createDeterministicTestFile(
  sizeInBytes: number,
  seed: number = 42
): Promise<TestFileGenerationResult> {
  const bytes = generateDeterministicTestBytes(sizeInBytes, seed);
  const sha256Hex = await computeTestPayloadSha256Hex(bytes);
  return {
    size: sizeInBytes,
    seed,
    bytes,
    sha256Hex,
  };
}

/**
 * Verifies received byte payload against deterministic pattern and optional expected hash.
 */
export async function verifyDeterministicTestPayload(
  receivedBytes: Uint8Array,
  expectedSize: number,
  seed: number = 42,
  expectedSha256Hex?: string
): Promise<TestFileVerificationResult> {
  const t0 = Date.now();

  if (receivedBytes.length !== expectedSize) {
    return {
      verified: false,
      expectedSize,
      receivedSize: receivedBytes.length,
      expectedSha256Hex,
      actualSha256Hex: await computeTestPayloadSha256Hex(receivedBytes),
      bytesChecked: receivedBytes.length,
      error: `Size mismatch: expected ${expectedSize} bytes, received ${receivedBytes.length} bytes`,
      durationMs: Date.now() - t0,
    };
  }

  // Verify byte-for-byte pattern
  for (let i = 0; i < expectedSize; i++) {
    const expectedByte = (i * 17 + seed) % 256;
    if (receivedBytes[i] !== expectedByte) {
      return {
        verified: false,
        expectedSize,
        receivedSize: receivedBytes.length,
        expectedSha256Hex,
        actualSha256Hex: await computeTestPayloadSha256Hex(receivedBytes),
        bytesChecked: i,
        error: `Byte corruption detected at byte offset ${i}: expected 0x${expectedByte.toString(16)}, got 0x${receivedBytes[i].toString(16)}`,
        durationMs: Date.now() - t0,
      };
    }
  }

  const actualSha256Hex = await computeTestPayloadSha256Hex(receivedBytes);

  if (expectedSha256Hex && actualSha256Hex.toLowerCase() !== expectedSha256Hex.toLowerCase()) {
    return {
      verified: false,
      expectedSize,
      receivedSize: receivedBytes.length,
      expectedSha256Hex,
      actualSha256Hex,
      bytesChecked: expectedSize,
      error: `SHA-256 digest mismatch: expected ${expectedSha256Hex}, computed ${actualSha256Hex}`,
      durationMs: Date.now() - t0,
    };
  }

  return {
    verified: true,
    expectedSize,
    receivedSize: receivedBytes.length,
    expectedSha256Hex,
    actualSha256Hex,
    bytesChecked: expectedSize,
    durationMs: Date.now() - t0,
  };
}
