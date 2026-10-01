/**
 * NearShare Local LAN UDP Discovery Protocol
 *
 * Defines the wire schema, packet constraints, and strict validation engine
 * for router-based local network peer discovery (Wi-Fi / LAN Mode).
 *
 * SECURITY INVARIANTS:
 * 1. Safe Metadata Only: Discovery packets NEVER carry private keys, pairing PINs,
 *    authorization tokens, session keys, host paths, or personal secrets.
 * 2. Untrusted Channel: Discovery packets produce ONLY "Device Discovered",
 *    NEVER "Device Trusted", "Device Paired", or "Device Authorized".
 * 3. Bounded Wire Size: Maximum packet size is strictly capped at 1024 bytes.
 * 4. LAN-Scoped: Operates on local multicast group with local network TTL.
 * 5. Stable Device Identity: Discovered devices are keyed by stable deviceId (not IP).
 */

export const DISCOVERY_PROTOCOL_NAME = 'NearShare';
export const DISCOVERY_PROTOCOL_VERSION = '1.0';
export const MAX_DISCOVERY_PACKET_BYTES = 1024; // 1 KiB ceiling
export const DEFAULT_DISCOVERY_MULTICAST_GROUP = '239.255.60.60';
export const DEFAULT_DISCOVERY_PORT = 53317;
export const DEFAULT_ADVERTISEMENT_TTL_MS = 15_000; // 15 seconds
export const STALE_DEVICE_TIMEOUT_MS = 30_000; // 30 seconds
export const REMOVE_DEVICE_TIMEOUT_MS = 45_000; // 45 seconds

export type DiscoveryPacketType =
  | 'DISCOVERY_ADVERTISEMENT'
  | 'DISCOVERY_QUERY'
  | 'DISCOVERY_GOODBYE';

export interface NearShareDiscoveryPacket {
  protocol: 'NearShare';
  version: string;
  type: DiscoveryPacketType;
  deviceId: string;
  profileId?: string;
  deviceName: string;
  platform: string;
  capabilities: string[];
  tcpPort: number;
  timestamp: number;
  expiresAt: number;
}

export interface DiscoveryValidationResult {
  valid: boolean;
  error?: string;
  packet?: NearShareDiscoveryPacket;
}

// Forbidden fields that must NEVER appear in discovery packets
const FORBIDDEN_SECURITY_FIELDS = [
  'privateKey',
  'private_key',
  'secret',
  'pin',
  'pairingPin',
  'token',
  'authToken',
  'filePath',
  'path',
  'sessionKey',
  'password',
  'symmetricKey',
  'nonce',
];

/**
 * Validates an incoming discovery packet against strict schema and security invariants.
 */
export function validateDiscoveryPacket(raw: unknown, byteLength?: number): DiscoveryValidationResult {
  if (byteLength !== undefined && byteLength > MAX_DISCOVERY_PACKET_BYTES) {
    return {
      valid: false,
      error: `OVERSIZED_PACKET: Packet size (${byteLength} bytes) exceeds maximum ceiling of ${MAX_DISCOVERY_PACKET_BYTES} bytes`,
    };
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      error: 'MALFORMED_PACKET: Discovery payload must be a non-null JSON object',
    };
  }

  const obj = raw as Record<string, any>;

  // Security check: Reject any packet attempting to leak secret keys
  for (const forbidden of FORBIDDEN_SECURITY_FIELDS) {
    if (forbidden in obj && obj[forbidden] !== undefined) {
      return {
        valid: false,
        error: `SECURITY_VIOLATION: Discovery packet contains forbidden key '${forbidden}'`,
      };
    }
  }

  // 1. Protocol Name
  if (obj.protocol !== DISCOVERY_PROTOCOL_NAME) {
    return {
      valid: false,
      error: `UNSUPPORTED_PROTOCOL: Expected '${DISCOVERY_PROTOCOL_NAME}', got '${obj.protocol}'`,
    };
  }

  // 2. Protocol Version
  if (typeof obj.version !== 'string' || obj.version !== DISCOVERY_PROTOCOL_VERSION) {
    return {
      valid: false,
      error: `UNSUPPORTED_VERSION: Expected version '${DISCOVERY_PROTOCOL_VERSION}', got '${obj.version}'`,
    };
  }

  // 3. Message Type
  const validTypes: DiscoveryPacketType[] = [
    'DISCOVERY_ADVERTISEMENT',
    'DISCOVERY_QUERY',
    'DISCOVERY_GOODBYE',
  ];
  if (!validTypes.includes(obj.type)) {
    return {
      valid: false,
      error: `INVALID_TYPE: Unknown discovery message type '${obj.type}'`,
    };
  }

  // 4. Device ID
  if (
    typeof obj.deviceId !== 'string' ||
    obj.deviceId.trim().length === 0 ||
    obj.deviceId.length > 64 ||
    /[\x00-\x1F\x7F]/.test(obj.deviceId)
  ) {
    return {
      valid: false,
      error: 'INVALID_DEVICE_ID: Device ID must be a non-empty string <= 64 chars without control characters',
    };
  }

  // 5. Device Name
  if (
    typeof obj.deviceName !== 'string' ||
    obj.deviceName.trim().length === 0 ||
    obj.deviceName.length > 128
  ) {
    return {
      valid: false,
      error: 'INVALID_DEVICE_NAME: Device name must be a non-empty string <= 128 characters',
    };
  }

  // 6. Platform
  if (typeof obj.platform !== 'string' || obj.platform.trim().length === 0 || obj.platform.length > 32) {
    return {
      valid: false,
      error: 'INVALID_PLATFORM: Platform must be a non-empty string <= 32 characters',
    };
  }

  // 7. Capabilities
  if (!Array.isArray(obj.capabilities)) {
    return {
      valid: false,
      error: 'INVALID_CAPABILITIES: Capabilities must be an array of strings',
    };
  }
  for (const cap of obj.capabilities) {
    if (typeof cap !== 'string' || cap.length > 32) {
      return {
        valid: false,
        error: `INVALID_CAPABILITY_ENTRY: Capability '${cap}' is invalid or exceeds 32 chars`,
      };
    }
  }

  // 8. TCP Port
  if (
    typeof obj.tcpPort !== 'number' ||
    !Number.isInteger(obj.tcpPort) ||
    obj.tcpPort <= 0 ||
    obj.tcpPort > 65535
  ) {
    return {
      valid: false,
      error: `INVALID_TCP_PORT: TCP port must be an integer between 1 and 65535, got ${obj.tcpPort}`,
    };
  }

  // 9. Timestamps
  if (typeof obj.timestamp !== 'number' || obj.timestamp <= 0 || !Number.isFinite(obj.timestamp)) {
    return {
      valid: false,
      error: 'INVALID_TIMESTAMP: Timestamp must be a positive finite number',
    };
  }

  if (typeof obj.expiresAt !== 'number' || obj.expiresAt <= 0 || !Number.isFinite(obj.expiresAt)) {
    return {
      valid: false,
      error: 'INVALID_EXPIRATION: expiresAt must be a positive finite timestamp',
    };
  }

  if (obj.expiresAt < obj.timestamp) {
    return {
      valid: false,
      error: 'EXPIRED_ADVERTISEMENT: expiresAt must be greater than or equal to timestamp',
    };
  }

  // Optional profileId validation
  if (obj.profileId !== undefined && (typeof obj.profileId !== 'string' || obj.profileId.length > 64)) {
    return {
      valid: false,
      error: 'INVALID_PROFILE_ID: profileId must be a string <= 64 chars',
    };
  }

  const packet: NearShareDiscoveryPacket = {
    protocol: 'NearShare',
    version: obj.version,
    type: obj.type,
    deviceId: obj.deviceId.trim(),
    profileId: obj.profileId?.trim(),
    deviceName: obj.deviceName.trim(),
    platform: obj.platform.trim(),
    capabilities: [...obj.capabilities],
    tcpPort: obj.tcpPort,
    timestamp: obj.timestamp,
    expiresAt: obj.expiresAt,
  };

  return {
    valid: true,
    packet,
  };
}

/**
 * Serializes a discovery packet into a UTF-8 binary payload.
 */
export function serializeDiscoveryPacket(packet: NearShareDiscoveryPacket): Uint8Array {
  const jsonStr = JSON.stringify(packet);
  const bytes = new TextEncoder().encode(jsonStr);
  if (bytes.length > MAX_DISCOVERY_PACKET_BYTES) {
    throw new Error(
      `OVERSIZED_PACKET: Serialized discovery packet (${bytes.length} bytes) exceeds 1024 byte limit`
    );
  }
  return bytes;
}

/**
 * Deserializes and validates a binary discovery packet from wire bytes.
 */
export function deserializeDiscoveryPacket(bytes: Uint8Array): DiscoveryValidationResult {
  if (bytes.length > MAX_DISCOVERY_PACKET_BYTES) {
    return {
      valid: false,
      error: `OVERSIZED_PACKET: Received ${bytes.length} bytes exceeding 1024 byte ceiling`,
    };
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = JSON.parse(text);
    return validateDiscoveryPacket(parsed, bytes.length);
  } catch (err: any) {
    return {
      valid: false,
      error: `MALFORMED_JSON: Failed to parse discovery packet JSON: ${err?.message || err}`,
    };
  }
}
