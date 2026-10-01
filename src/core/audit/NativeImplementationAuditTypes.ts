/**
 * NearShare Native Runtime Implementation Audit — Types
 *
 * Defines the taxonomy, evaluation criteria, and structured audit entry schema
 * for establishing the ground truth of every subsystem in NearShare.
 *
 * STRICT AUDIT RULES:
 * 1. REAL_NATIVE_IMPLEMENTATION requires the complete vertical stack:
 *    TypeScript Bridge + Native Rust Command + OS API Invocation + Native Event/Data Path + Production Integration.
 * 2. Compiling Rust structs or TypeScript interfaces alone are SCAFFOLD or ARCHITECTURAL_ONLY.
 * 3. Never inflate simulated or localhost status to physical runtime.
 */

export type NativeImplementationStatus =
  | 'REAL_NATIVE_IMPLEMENTATION'
  | 'PARTIAL_IMPLEMENTATION'
  | 'SCAFFOLD'
  | 'ARCHITECTURAL_ONLY'
  | 'UNVERIFIED_RUNTIME'
  | 'MOCK_ONLY'
  | 'NOT_IMPLEMENTED';

export type AuditPlatform = 'macOS' | 'Windows' | 'Android' | 'iOS' | 'Cross-Platform' | 'Web';

export type AuditSubsystem =
  | 'direct_transport'
  | 'lan_transport'
  | 'lan_discovery'
  | 'filesystem'
  | 'secure_transport'
  | 'protocol_engine'
  | 'recovery_engine'
  | 'telemetry_diagnostics'
  | 'desktop_lifecycle';

export interface AuditEntry {
  id: string;
  platform: AuditPlatform;
  subsystem: AuditSubsystem;
  feature: string;
  status: NativeImplementationStatus;
  evidence: string;
  nativeFiles: string[];
  bridgeFiles: string[];
  productionPath: string;
  runtimeVerified: boolean;
  physicalVerified: boolean;
  limitations: string;
  requiredNextAction: string;
}

export interface AuditSummary {
  totalEntries: number;
  realNativeCount: number;
  partialCount: number;
  scaffoldCount: number;
  architecturalCount: number;
  unverifiedRuntimeCount: number;
  mockOnlyCount: number;
  notImplementedCount: number;
  entriesByPlatform: Record<AuditPlatform, AuditEntry[]>;
}

/**
 * Validates the integrity of an audit entry against strict classification rules.
 */
export function validateAuditClassification(entry: AuditEntry): {
  valid: boolean;
  error?: string;
} {
  if (!entry.id || !entry.feature) {
    return { valid: false, error: 'AUDIT_ENTRY_MISSING_ID_OR_FEATURE' };
  }

  // A REAL_NATIVE_IMPLEMENTATION must have native files and a production path
  if (entry.status === 'REAL_NATIVE_IMPLEMENTATION') {
    if (entry.nativeFiles.length === 0) {
      return { valid: false, error: 'REAL_NATIVE_REQUIRES_NATIVE_SOURCE_FILES' };
    }
    if (!entry.productionPath || entry.productionPath.includes('Mock')) {
      return { valid: false, error: 'REAL_NATIVE_FORBIDS_MOCK_PRODUCTION_PATH' };
    }
  }

  // An ARCHITECTURAL_ONLY or SCAFFOLD feature cannot claim runtimeVerified = true
  if ((entry.status === 'ARCHITECTURAL_ONLY' || entry.status === 'SCAFFOLD') && entry.runtimeVerified && entry.physicalVerified) {
    return { valid: false, error: 'SCAFFOLD_CANNOT_CLAIM_PHYSICAL_VERIFICATION' };
  }

  return { valid: true };
}
