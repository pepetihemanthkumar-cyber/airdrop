/**
 * NearShare Release Readiness Model
 *
 * Computes evidence-based readiness states for desktop release candidates.
 * Distinguishes signed, notarized, and physical validation tiers.
 */

import type { ReleaseTargetPlatform } from './ReleaseMetadata';

export type ReadinessStatus =
  | 'ready'
  | 'unsigned'
  | 'notNotarized'
  | 'missingNativeValidation'
  | 'developmentOnly'
  | 'blocked';

export interface ReleaseReadinessEvidence {
  versionSynchronized: boolean;
  secretScanPassed: boolean;
  testsPassed: boolean;
  lintPassed: boolean;
  buildPassed: boolean;
  platform: ReleaseTargetPlatform;
  isSigned: boolean;
  isNotarized: boolean;
  hasPhysicalValidation: boolean;
  isProductionBuild: boolean;
}

export interface ReleaseReadinessReport {
  status: ReadinessStatus;
  canReleaseToStable: boolean;
  canReleaseToBeta: boolean;
  canReleaseToNightly: boolean;
  reasons: string[];
  evidence: ReleaseReadinessEvidence;
}

/**
 * Evaluates comprehensive release readiness strictly from verified evidence.
 */
export function evaluateReleaseReadiness(
  evidence: ReleaseReadinessEvidence
): ReleaseReadinessReport {
  const reasons: string[] = [];

  // Critical build blockers
  if (!evidence.versionSynchronized) {
    reasons.push('Version string mismatch across repository manifests.');
  }
  if (!evidence.secretScanPassed) {
    reasons.push('Secret scanner detected potential exposed secrets or credentials.');
  }
  if (!evidence.testsPassed) {
    reasons.push('Deterministic test suite has failing tests.');
  }
  if (!evidence.lintPassed) {
    reasons.push('Linter check failed with errors.');
  }
  if (!evidence.buildPassed) {
    reasons.push('Compilation/build failed.');
  }

  if (reasons.length > 0) {
    return {
      status: 'blocked',
      canReleaseToStable: false,
      canReleaseToBeta: false,
      canReleaseToNightly: false,
      reasons,
      evidence,
    };
  }

  // Development-only builds
  if (!evidence.isProductionBuild) {
    return {
      status: 'developmentOnly',
      canReleaseToStable: false,
      canReleaseToBeta: false,
      canReleaseToNightly: true,
      reasons: ['Build artifact was created with debug/development profile.'],
      evidence,
    };
  }

  // Check signing & notarization requirements
  if (evidence.platform === 'macOS') {
    if (!evidence.isSigned) {
      reasons.push('macOS bundle is unsigned (Apple Developer ID certificate not configured).');
    }
    if (!evidence.isNotarized) {
      reasons.push('macOS bundle is not notarized by Apple notary service.');
    }
  } else if (evidence.platform === 'Windows') {
    if (!evidence.isSigned) {
      reasons.push('Windows NSIS installer is unsigned (Authenticode certificate not configured).');
    }
  }

  // Physical validation check
  if (!evidence.hasPhysicalValidation) {
    reasons.push(`Physical ${evidence.platform} hardware peer-to-peer radio validation is unverified.`);
  }

  // Determine tier
  let status: ReadinessStatus = 'ready';
  if (!evidence.isSigned) {
    status = 'unsigned';
  } else if (evidence.platform === 'macOS' && !evidence.isNotarized) {
    status = 'notNotarized';
  } else if (!evidence.hasPhysicalValidation) {
    status = 'missingNativeValidation';
  }

  // Unsigned builds can still be distributed on Nightly / Developer channels,
  // but Stable production release requires signing and notarization.
  const canReleaseToStable = evidence.isSigned && (evidence.platform !== 'macOS' || evidence.isNotarized);
  const canReleaseToBeta = true;
  const canReleaseToNightly = true;

  return {
    status,
    canReleaseToStable,
    canReleaseToBeta,
    canReleaseToNightly,
    reasons,
    evidence,
  };
}
