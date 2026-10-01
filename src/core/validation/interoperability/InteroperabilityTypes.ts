/**
 * NearShare Cross-Platform Interoperability Types
 *
 * Defines the core data models, evidence environments, test scenarios,
 * and result states for rigorous cross-platform interoperability validation.
 */

export type PlatformType = 'macOS' | 'Windows' | 'Android' | 'iOS' | 'Web';
export type ConnectionMode = 'direct' | 'wifi';

export type EvidenceEnvironment =
  | 'deterministic'
  | 'localhost'
  | 'lan'
  | 'physicalDirect'
  | 'physicalLan';

export type InteroperabilityResultState =
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'NOT_AVAILABLE'
  | 'NOT_RUN';

export type DirectRadioCompatibility =
  | 'NATIVE_COMPATIBLE'        // Same radio tech (e.g. Apple Multipeer macOS <-> iOS)
  | 'STANDARDIZED_WIFI_DIRECT'  // Wi-Fi Direct spec (Windows <-> Android, pending multi-vendor validation)
  | 'RADIO_INCOMPATIBLE'       // Fundamentally different radio protocols (e.g. Apple AWDL vs Wi-Fi Direct)
  | 'UNVERIFIED';

export interface InteroperabilityPairKey {
  readonly platformA: PlatformType;
  readonly platformB: PlatformType;
  readonly mode: ConnectionMode;
  readonly direction: 'A_TO_B' | 'B_TO_A' | 'BIDIRECTIONAL';
}

export interface InteroperabilityEvidenceRecord {
  readonly recordId: string;
  readonly timestamp: number;
  readonly platformA: PlatformType;
  readonly platformB: PlatformType;
  readonly deviceIdA: string;
  readonly deviceIdB: string;
  readonly mode: ConnectionMode;
  readonly transport: string;
  readonly environment: EvidenceEnvironment;
  readonly protocolVersion: string;
  readonly fileSize: number;
  readonly bytesTransferred: number;
  readonly sha256Sender: string;
  readonly sha256Receiver: string;
  readonly durationMs: number;
  readonly averageThroughputBps: number;
  readonly result: InteroperabilityResultState;
  readonly failureReason?: string;
  readonly securityValidated: boolean;
  readonly checksumMatched: boolean;
}

export interface ProtocolMessageValidationResult {
  readonly messageType: string;
  readonly platformSender: PlatformType;
  readonly platformReceiver: PlatformType;
  readonly payloadSerializedSize: number;
  readonly validEnvelope: boolean;
  readonly roundtripMatched: boolean;
  readonly error?: string;
}

export interface SecurityBoundaryValidationResult {
  readonly platformA: PlatformType;
  readonly platformB: PlatformType;
  readonly keyExchangeSuccess: boolean;
  readonly aeadEncryptionValid: boolean;
  readonly sequenceProtectionEnforced: boolean;
  readonly replayAttackRejected: boolean;
  readonly tamperedCiphertextRejected: boolean;
  readonly privateKeyNeverExposedToNative: boolean;
}

export interface InteroperabilityMatrixEntry {
  readonly pairId: string;
  readonly platformA: PlatformType;
  readonly platformB: PlatformType;
  readonly mode: ConnectionMode;
  readonly directRadioCompatibility: DirectRadioCompatibility;
  readonly lanCompatibility: 'SUPPORTED' | 'UNSUPPORTED';
  readonly architecturalSupport: boolean;
  readonly nativeCodePresentA: boolean;
  readonly nativeCodePresentB: boolean;
  readonly runtimeVerifiedA: boolean;
  readonly runtimeVerifiedB: boolean;
  readonly physicalInteroperabilityStatus: InteroperabilityResultState;
  readonly primaryTransport: string;
  readonly securityProtocol: 'ECDH_P256_AES256_GCM';
  readonly failureOrBlockerReason?: string;
}

export interface InteroperabilitySummaryReport {
  readonly generatedAt: number;
  readonly totalPairsEvaluated: number;
  readonly directPairsCount: number;
  readonly lanPairsCount: number;
  readonly passedPhysicalCount: number;
  readonly blockedPhysicalCount: number;
  readonly unverifiedPhysicalCount: number;
  readonly protocolCompatibility100Percent: boolean;
  readonly securityBoundaryStrictlyEnforced: boolean;
  readonly zeroSilentFallbackEnforced: boolean;
}
