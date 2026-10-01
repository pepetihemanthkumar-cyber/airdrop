/**
 * NearShare Transport Error Contract
 *
 * Defines strongly typed error codes and normalized TransportError envelopes
 * so raw native platform exceptions are never exposed unformatted to UI layers.
 */

export type TransportErrorCode =
  | 'DISCOVERY_FAILED'
  | 'DEVICE_UNAVAILABLE'
  | 'CONNECTION_FAILED'
  | 'PAIRING_REQUIRED'
  | 'PAIRING_FAILED'
  | 'PERMISSION_REQUIRED'
  | 'STORAGE_INSUFFICIENT'
  | 'TRANSFER_FAILED'
  | 'TRANSFER_CANCELLED'
  | 'TRANSFER_INTERRUPTED'
  | 'RESUME_UNSUPPORTED'
  | 'MODE_UNAVAILABLE'
  | 'UNKNOWN';

export interface TransportError {
  code: TransportErrorCode;
  message: string;
  retryable: boolean;
  recoverable: boolean;
  originalError?: unknown;
}

export function createTransportError(
  code: TransportErrorCode,
  message: string,
  retryable: boolean = true,
  recoverable: boolean = false,
  originalError?: unknown
): TransportError {
  return {
    code,
    message,
    retryable,
    recoverable,
    originalError,
  };
}
