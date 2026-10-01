/**
 * NearShare Protocol Version Specification
 *
 * Defines protocol versioning constants and version negotiation helpers.
 * Note: Protocol version is distinct from the host application version.
 */

export const PROTOCOL_NAME = 'NearShare' as const;

export const PROTOCOL_VERSION = '1.0' as const;

export const MIN_SUPPORTED_VERSION = '1.0' as const;

export const MAX_SUPPORTED_VERSION = '1.0' as const;

/**
 * Checks if a remote peer's protocol version is compatible with this implementation.
 */
export function isCompatibleVersion(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  
  const [major, minor] = parseVersion(version);
  const [minMajor, minMinor] = parseVersion(MIN_SUPPORTED_VERSION);
  const [maxMajor, maxMinor] = parseVersion(MAX_SUPPORTED_VERSION);

  if (major === -1 || minMajor === -1 || maxMajor === -1) return false;

  // Major version must strictly match for SemVer 1.x protocol compatibility
  if (major !== minMajor) return false;

  // Version must fall within [MIN_SUPPORTED_VERSION, MAX_SUPPORTED_VERSION]
  const current = major * 1000 + minor;
  const min = minMajor * 1000 + minMinor;
  const max = maxMajor * 1000 + maxMinor;

  return current >= min && current <= max;
}

/**
 * Negotiates a common protocol version between local and remote peer.
 * Returns the highest mutually supported version string or null if incompatible.
 */
export function negotiateVersion(remoteVersion: string): string | null {
  if (isCompatibleVersion(remoteVersion)) {
    // Both support 1.0
    return PROTOCOL_VERSION;
  }
  return null;
}

function parseVersion(v: string): [number, number] {
  const parts = v.trim().split('.');
  if (parts.length < 2) return [-1, -1];
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  if (isNaN(major) || isNaN(minor)) return [-1, -1];
  return [major, minor];
}
