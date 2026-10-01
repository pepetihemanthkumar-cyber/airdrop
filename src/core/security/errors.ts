/**
 * NearShare Security Error Contract
 *
 * Strongly typed error envelopes for pairing, verification, trust, and session boundaries.
 * Raw native exceptions must never be exposed directly to presentation components.
 */

export type SecurityErrorCode =
  | 'PAIRING_REQUIRED'
  | 'PAIRING_REJECTED'
  | 'PAIRING_EXPIRED'
  | 'PAIRING_FAILED'
  | 'VERIFICATION_FAILED'
  | 'DEVICE_BLOCKED'
  | 'SESSION_FAILED'
  | 'SESSION_EXPIRED'
  | 'SESSION_CLOSED';

export interface SecurityError {
  code: SecurityErrorCode;
  message: string;
  retryable: boolean;
  recoverable: boolean;
  originalError?: unknown;
}

export function createSecurityError(
  code: SecurityErrorCode,
  message: string,
  retryable: boolean = true,
  recoverable: boolean = false,
  originalError?: unknown
): SecurityError {
  return {
    code,
    message,
    retryable,
    recoverable,
    originalError,
  };
}
