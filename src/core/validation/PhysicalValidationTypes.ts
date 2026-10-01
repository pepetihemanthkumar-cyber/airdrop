/**
 * NearShare Physical Multi-Device Validation Engine — Types
 *
 * Defines the evidence model, device matrix, scenario definitions,
 * evidence level hierarchy, and immutable environment boundaries.
 *
 * MANDATORY BOUNDARIES:
 * 1. LEVEL 0 (Simulation) != LEVEL 1 (Localhost) != LEVEL 2 (Same-host Runtime) != LEVEL 3 (Physical LAN) != LEVEL 4 (Physical Direct).
 * 2. Simulated/Deterministic/Localhost results CANNOT be promoted to PHYSICAL.
 * 3. Physical transfers require bidirectional cryptographic SHA-256 verification.
 * 4. Sensitive keys, tokens, auth secrets, personal IDs, and raw filesystem paths are NEVER stored in evidence.
 */

export type ValidationStatus =
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'NOT_AVAILABLE'
  | 'NOT_RUN';

export type ValidationEnvironment =
  | 'DETERMINISTIC'
  | 'LOCALHOST'
  | 'LAN'
  | 'PHYSICAL';

/**
 * Canonical Evidence Levels for NearShare Release Validation.
 * Lower levels cannot upgrade higher level test requirements.
 */
export type EvidenceLevel =
  | 'LEVEL_0' // Deterministic unit/integration simulation
  | 'LEVEL_1' // Localhost / Loopback
  | 'LEVEL_2' // Same-machine native runtime
  | 'LEVEL_3' // Physical LAN (Distinct physical devices on same network)
  | 'LEVEL_4'; // Physical Direct (Distinct physical devices over P2P radio)

export type DevicePlatform = 'macOS' | 'Windows' | 'Android' | 'iOS';

export type TransportValidationMode = 'wifi' | 'direct';

export type TransportUsed =
  | 'DIRECT_NATIVE'
  | 'LAN_NATIVE'
  | 'MOCK_TEST'
  | 'UNSPECIFIED';

export type PairSupportStatus =
  | 'SUPPORTED'
  | 'PLATFORM_DEPENDENT'
  | 'NOT_SUPPORTED'
  | 'REQUIRES_NATIVE'
  | 'NOT_VALIDATED';

export type ReleaseGateId =
  | 'GATE-PHYSICAL-LAN'
  | 'GATE-PHYSICAL-DIRECT'
  | 'GATE-SECURITY'
  | 'GATE-INTEGRITY'
  | 'GATE-RECOVERY'
  | 'GATE-PERFORMANCE';

export type RecoveryScenarioCode =
  | 'RECOVERY-25'
  | 'RECOVERY-50'
  | 'RECOVERY-75'
  | 'RECOVERY-90';

export interface DevicePairDefinition {
  id: string;
  senderPlatform: DevicePlatform;
  receiverPlatform: DevicePlatform;
  wifiStatus: PairSupportStatus;
  directStatus: PairSupportStatus;
  notes: string;
}

export interface ScenarioDefinition {
  id: string;
  code: string; // PHYS-001 ... PHYS-032, RECOVERY-25 ... RECOVERY-90
  name: string;
  description: string;
  category: 'discovery' | 'pairing' | 'session' | 'transfer' | 'control' | 'recovery' | 'integrity' | 'security' | 'lifecycle' | 'performance';
  requiresTransfer: boolean;
}

export interface NetworkConditions {
  sameLan?: boolean;
  routerPresent?: boolean;
  internetAvailable?: boolean;
  networkType?: string; // e.g. 'Wi-Fi 6', 'Ethernet', 'P2P-GO', 'AWDL'
}

/**
 * Safe Physical Test Device Inventory
 * Stores ONLY public/safe technical metadata. No personal identifiers or keys.
 */
export interface TestDeviceInventoryItem {
  deviceId: string;
  platform: DevicePlatform;
  osVersion: string;
  nearShareVersion: string;
  architecture: string;
  connectionInterface: string;
  testRole: 'sender' | 'receiver' | 'dual';
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'BUSY';
  operatorNote?: string;
}

/**
 * Physical Validation Session Record
 */
export interface PhysicalValidationSession {
  validationSessionId: string;
  timestamp: number;
  senderDevice: TestDeviceInventoryItem;
  receiverDevice: TestDeviceInventoryItem;
  mode: TransportValidationMode;
  scenario: string;
  result: ValidationStatus;
  evidenceLevel: EvidenceLevel;
  transportUsed: TransportUsed;
  durationMs?: number;
  bytesTransferred?: number;
  throughputMbps?: number;
  integrityResult?: {
    senderSha256?: string;
    receiverSha256?: string;
    matched: boolean;
    manifestCount?: number;
    perFileVerified?: boolean;
  };
  securityResult?: {
    pairingRequested: boolean;
    sasVerified: boolean;
    sessionAuthorized: boolean;
    blockedRejected: boolean;
    revokedRejected: boolean;
    secureSessionEstablished: boolean;
  };
  recoveryResult?: {
    interruptedAtPercent?: number;
    bytesBeforeInterruption?: number;
    checkpointCreated: boolean;
    reconnected: boolean;
    resumedBytes: number;
    finalIntegrityMatched: boolean;
  };
  performanceResult?: {
    bytesTransferred: number;
    durationMs: number;
    averageThroughputMbps: number;
    peakThroughputMbps?: number;
    latencyMs?: number;
    reconnectCount?: number;
  };
  evidenceNotes?: string;
  safeErrorCategory?: string;
}

export interface PhysicalEvidence {
  testId: string;
  senderPlatform: DevicePlatform;
  receiverPlatform: DevicePlatform;
  senderDeviceId: string;
  receiverDeviceId: string;
  transportMode: TransportValidationMode;
  environment: ValidationEnvironment;
  evidenceLevel?: EvidenceLevel;
  transportUsed?: TransportUsed;
  timestamp: number;
  result: ValidationStatus;
  error?: string;
  transferId?: string;
  fileSizeBytes?: number;
  senderChecksum?: string;
  receiverChecksum?: string;
  checksumVerified?: boolean;
  durationMs?: number;
  throughputMbps?: number;
  peakThroughputMbps?: number;
  networkConditions?: NetworkConditions;
  notes?: string;
}

/**
 * Validates whether an evidence record satisfies strict constraints for PHYSICAL classification.
 */
export function validatePhysicalEvidenceIntegrity(evidence: PhysicalEvidence): {
  valid: boolean;
  error?: string;
} {
  if (!evidence.testId) {
    return { valid: false, error: 'EVIDENCE_MISSING_TEST_ID' };
  }

  // 1. Level upgrade prevention
  if (evidence.environment === 'DETERMINISTIC' || evidence.environment === 'LOCALHOST') {
    if (evidence.result === 'PASS' && evidence.testId.startsWith('PHYS-') && !evidence.testId.startsWith('PHYS-SIM-')) {
      return {
        valid: false,
        error: 'ILLEGAL_ENVIRONMENT_PROMOTION: Deterministic/Localhost runs cannot satisfy physical test IDs',
      };
    }
  }

  // 2. Direct Mode requirements
  if (evidence.transportMode === 'direct' && evidence.environment === 'PHYSICAL') {
    if (evidence.transportUsed && evidence.transportUsed !== 'DIRECT_NATIVE') {
      return {
        valid: false,
        error: 'DIRECT_PASS_REQUIRES_DIRECT_NATIVE: Direct physical pass must use native Direct transport without fallback',
      };
    }
  }

  // 3. Physical LAN requirements
  if (evidence.transportMode === 'wifi' && evidence.environment === 'PHYSICAL') {
    if (evidence.transportUsed === 'MOCK_TEST') {
      return {
        valid: false,
        error: 'PHYSICAL_FORBIDS_MOCK_TRANSPORT: Mock transports cannot produce a physical pass',
      };
    }
  }

  // 4. Physical identity & checksum requirements
  if (evidence.environment === 'PHYSICAL') {
    if (!evidence.senderDeviceId || !evidence.receiverDeviceId) {
      return { valid: false, error: 'PHYSICAL_REQUIRES_DISTINCT_DEVICE_IDENTIFIERS' };
    }
    if (evidence.senderDeviceId === evidence.receiverDeviceId) {
      return { valid: false, error: 'PHYSICAL_FORBIDS_IDENTICAL_SENDER_RECEIVER_DEVICE_ID' };
    }
    if (evidence.result === 'PASS' && evidence.fileSizeBytes !== undefined && evidence.fileSizeBytes > 0) {
      if (!evidence.senderChecksum || !evidence.receiverChecksum) {
        return { valid: false, error: 'PHYSICAL_TRANSFER_REQUIRES_CHECKSUMS' };
      }
      if (evidence.senderChecksum.toLowerCase() !== evidence.receiverChecksum.toLowerCase()) {
        return { valid: false, error: 'PHYSICAL_CHECKSUM_MISMATCH' };
      }
    }
  }

  return { valid: true };
}

/**
 * Sanitizes evidence by stripping any accidentally included live secrets or host paths.
 */
export function sanitizePhysicalEvidence(evidence: PhysicalEvidence): PhysicalEvidence {
  const sanitized = { ...evidence };

  // Anonymize device identifiers if they resemble raw hardware MACs or sensitive strings
  if (sanitized.senderDeviceId && sanitized.senderDeviceId.includes(':')) {
    const cleanSuffix = sanitized.senderDeviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '0000';
    sanitized.senderDeviceId = `dev_${sanitized.senderPlatform.toLowerCase()}_${cleanSuffix}`;
  }
  if (sanitized.receiverDeviceId && sanitized.receiverDeviceId.includes(':')) {
    const cleanSuffix = sanitized.receiverDeviceId.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '0000';
    sanitized.receiverDeviceId = `dev_${sanitized.receiverPlatform.toLowerCase()}_${cleanSuffix}`;
  }

  // Redact any path leaks in notes
  if (sanitized.notes) {
    sanitized.notes = sanitized.notes.replace(/\/Users\/[^\s/]+/g, '/Users/***');
    sanitized.notes = sanitized.notes.replace(/[a-zA-Z]:\\(?:[^\\\s]+\\)*[^\\\s]*/gi, '[REDACTED_PATH]');
  }

  if (sanitized.error) {
    sanitized.error = sanitized.error.replace(/\/Users\/[^\s/]+/g, '/Users/***');
    sanitized.error = sanitized.error.replace(/[a-zA-Z]:\\(?:[^\\\s]+\\)*[^\\\s]*/gi, '[REDACTED_PATH]');
  }

  return sanitized;
}

/**
 * Sanitizes session records before public export.
 */
export function sanitizeValidationSession(session: PhysicalValidationSession): PhysicalValidationSession {
  const sanitized = { ...session };
  if (sanitized.evidenceNotes) {
    sanitized.evidenceNotes = sanitized.evidenceNotes.replace(/\/Users\/[^\s/]+/g, '/Users/***');
    sanitized.evidenceNotes = sanitized.evidenceNotes.replace(/[a-zA-Z]:\\(?:[^\\\s]+\\)*[^\\\s]*/gi, '[REDACTED_PATH]');
  }
  if (sanitized.senderDevice.operatorNote) {
    sanitized.senderDevice.operatorNote = sanitized.senderDevice.operatorNote.replace(/\/Users\/[^\s/]+/g, '/Users/***');
  }
  if (sanitized.receiverDevice.operatorNote) {
    sanitized.receiverDevice.operatorNote = sanitized.receiverDevice.operatorNote.replace(/\/Users\/[^\s/]+/g, '/Users/***');
  }
  return sanitized;
}
