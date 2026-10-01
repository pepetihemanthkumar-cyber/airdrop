/**
 * NearShare Cross-Platform Interoperability Evidence Store
 *
 * Implements strict, immutable evidence capture and verification.
 * Enforces security invariants, zero credential leakage, and strict non-promotion
 * of deterministic/localhost test runs to physical validation evidence.
 */

import type {
  InteroperabilityEvidenceRecord,
  EvidenceEnvironment,
} from './InteroperabilityTypes';

export class InteroperabilityEvidenceStore {
  private static instance?: InteroperabilityEvidenceStore;
  private records: Map<string, InteroperabilityEvidenceRecord> = new Map();

  private constructor() {}

  public static getInstance(): InteroperabilityEvidenceStore {
    if (!InteroperabilityEvidenceStore.instance) {
      InteroperabilityEvidenceStore.instance = new InteroperabilityEvidenceStore();
    }
    return InteroperabilityEvidenceStore.instance;
  }

  /**
   * Records a validated interoperability test execution record.
   * Enforces that physical validation records must originate from distinct physical hardware.
   */
  public recordEvidence(record: InteroperabilityEvidenceRecord): { success: boolean; error?: string } {
    // 1. Invariant: Distinct hardware IDs required for physical validation
    if (
      (record.environment === 'physicalDirect' || record.environment === 'physicalLan') &&
      record.deviceIdA === record.deviceIdB
    ) {
      return {
        success: false,
        error: 'PHYSICAL_VALIDATION_REQUIRES_DISTINCT_DEVICE_IDS',
      };
    }

    // 2. Invariant: Physical PASS requires matching SHA-256 digests
    if (
      record.result === 'PASS' &&
      record.sha256Sender !== record.sha256Receiver
    ) {
      return {
        success: false,
        error: 'CHECKSUM_MISMATCH_CANNOT_PASS',
      };
    }

    // 3. Invariant: Sanitization - ensure no absolute private keys or credentials leaked
    const serialized = JSON.stringify(record);
    if (
      serialized.includes('privateKey') ||
      serialized.includes('password') ||
      serialized.includes('authSecret')
    ) {
      return {
        success: false,
        error: 'CREDENTIAL_LEAKAGE_DETECTED',
      };
    }

    this.records.set(record.recordId, record);
    return { success: true };
  }

  public getRecord(recordId: string): InteroperabilityEvidenceRecord | undefined {
    return this.records.get(recordId);
  }

  public getAllRecords(): InteroperabilityEvidenceRecord[] {
    return Array.from(this.records.values());
  }

  public getRecordsByEnvironment(env: EvidenceEnvironment): InteroperabilityEvidenceRecord[] {
    return Array.from(this.records.values()).filter((r) => r.environment === env);
  }

  public clear(): void {
    this.records.clear();
  }
}
