/**
 * NearShare File Integrity Contract
 *
 * Provides checksum hashing and integrity validation contracts.
 * NOTE: In browser/in-memory simulations, this uses a deterministic development-only
 * integrity simulation (Murmur/FNV-style hash formatted as hex digest).
 * Native platform adapters will substitute hardware-accelerated SHA-256 routines.
 */

export type ChecksumAlgorithm = 'sha256' | 'other';

export interface ChecksumResult {
  algorithm: ChecksumAlgorithm;
  value: string;
}

/**
 * Calculates a checksum for the provided chunk or file byte payload.
 * [DEVELOPMENT-ONLY INTEGRITY SIMULATION in non-native environments]
 */
export async function calculateChecksum(
  data: Uint8Array | string,
  algorithm: ChecksumAlgorithm = 'sha256'
): Promise<ChecksumResult> {
  if (typeof window !== 'undefined' && window.crypto?.subtle && typeof data !== 'string') {
    try {
      // Use Web Crypto SHA-256 if available on Uint8Array in modern browsers
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer as ArrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return { algorithm: 'sha256', value: hashHex };
    } catch {
      // Fallback to deterministic simulated hash
    }
  }

  // Deterministic simulation hash for string or mock payloads
  const simulatedHash = computeSimulatedHash(data);
  return {
    algorithm,
    value: simulatedHash,
  };
}

/**
 * Verifies that the computed checksum matches the expected checksum value.
 */
export async function verifyChecksum(
  data: Uint8Array | string,
  expectedChecksum: string,
  algorithm: ChecksumAlgorithm = 'sha256'
): Promise<boolean> {
  if (!expectedChecksum) return false;
  const result = await calculateChecksum(data, algorithm);
  return result.value.toLowerCase() === expectedChecksum.toLowerCase();
}

/**
 * Deterministic fast 64-bit hex hash simulator for mock / test datasets.
 * Clearly marked: DEVELOPMENT-ONLY INTEGRITY SIMULATION.
 */
function computeSimulatedHash(data: Uint8Array | string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;

  if (typeof data === 'string') {
    for (let i = 0; i < data.length; i++) {
      const ch = data.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
  } else {
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      h1 = Math.imul(h1 ^ byte, 2654435761);
      h2 = Math.imul(h2 ^ byte, 1597334677);
    }
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `sim_sha256_${hex1}${hex2}`;
}
