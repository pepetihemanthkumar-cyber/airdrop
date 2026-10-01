/**
 * NearShare macOS Direct Transfer Validation & Observability Engine — Types
 *
 * Defines the execution roles, environment boundaries, physical gates,
 * telemetry structures, and evidence models for the real native MultipeerConnectivity Direct pipeline.
 *
 * CRITICAL BOUNDARIES:
 * 1. deterministic != localhost != lan != physicalDirect.
 * 2. Native implementation IMPLEMENTED != Physical Mac<->Mac VERIFIED.
 * 3. A physical Direct PASS requires transportUsed === 'DIRECT_NATIVE'.
 * 4. Wi-Fi or Mock fallback NEVER silently passes as Direct.
 */

export type ValidationRole = 'SENDER' | 'RECEIVER';

export type ValidationEnvironment =
  | 'deterministic'
  | 'localhost'
  | 'lan'
  | 'physicalDirect';

export type ValidationStatus =
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'NOT_RUN';

export type DirectTransportUsed =
  | 'DIRECT_NATIVE'
  | 'WIFI_NATIVE'
  | 'MOCK'
  | 'UNKNOWN';

export type IntegrityStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'NOT_VERIFIED';

export interface SecurityValidationState {
  pairingCompleted: boolean;
  secureSessionEstablished: boolean;
  encryptedFrameAccepted: boolean;
  sessionIdCorrect: boolean;
  sequenceValidationPassed: boolean;
  aeadVerificationPassed: boolean;
  transferAuthorized: boolean;
  peerNotBlocked: boolean;
  peerNotRevoked: boolean;
}

export interface DirectStreamTelemetry {
  bytesSent: number;
  bytesReceived: number;
  framesSent: number;
  framesReceived: number;
  framesRejected: number;
  partialReads: number;
  partialWrites: number;
  streamErrors: number;
  reconnectCount: number;
  cancelCount: number;
  pauseCount: number;
  resumeCount: number;
  currentBufferedBytes: number;
  peakBufferedBytes: number;
}

export interface DirectMemoryMetrics {
  nativeStreamBufferPeakBytes: number;
  protocolBufferPeakBytes: number;
  transferBackpressurePeakBytes: number;
}

export interface PhysicalGateState {
  passed: boolean;
  nativeImplemented: boolean;
  macOsRuntimeConfirmed: boolean;
  peerDeviceDetected: boolean;
  peerIsMacOS: boolean;
  directPathConfirmed: boolean;
  noWifiFallback: boolean;
  physicalDirectExplicitlySelected: boolean;
  blockReason?: string;
}

export interface MacOSDirectScenarioDefinition {
  id: string;
  code: string; // DIRECT-PHYS-001 ... DIRECT-PHYS-030
  name: string;
  description: string;
  category:
    | 'discovery'
    | 'pairing'
    | 'session'
    | 'transfer'
    | 'control'
    | 'recovery'
    | 'integrity'
    | 'security'
    | 'lifecycle';
  requiresTransfer: boolean;
  payloadSize?: number;
}

export interface MacOSDirectScenarioResult {
  scenarioId: string;
  scenarioCode: string;
  name: string;
  environment: ValidationEnvironment;
  startedAt: number | null;
  completedAt: number | null;
  senderDeviceId: string;
  receiverDeviceId: string;
  transportMode: 'direct';
  transportUsed: DirectTransportUsed;
  nativeImplementation: 'implemented' | 'scaffold' | 'mock';
  physicalValidation: 'verified' | 'unverified' | 'blocked';
  result: ValidationStatus;
  bytesTransferred: number;
  durationMs: number;
  averageThroughput: number | null;
  peakThroughput: number | null;
  latencyMs: number | null;
  integrityVerified: IntegrityStatus;
  securityVerified: boolean;
  recoveryVerified: boolean;
  errorCode?: string;
  errorMessage?: string;
  streamTelemetry?: DirectStreamTelemetry;
  memoryMetrics?: DirectMemoryMetrics;
}

export interface SanitizedDeviceInfo {
  deviceId: string;
  profileName: string;
  platform: 'macOS';
  appVersion: string;
}
