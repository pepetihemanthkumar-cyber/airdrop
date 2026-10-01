/**
 * NearShare Native Bridge Errors
 *
 * Defines strongly-typed native error codes, normalized error models,
 * and exception classes for crossing the native/React boundary safely.
 *
 * SECURITY RULE:
 * Never leak sensitive host filesystem paths into user-facing errors.
 */

export type NativeErrorCode =
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_REFERENCE'
  | 'UNSUPPORTED'
  | 'PLATFORM_FAILURE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'STORAGE_FULL'
  | 'NETWORK_UNAVAILABLE'
  | 'UNKNOWN';

export interface NativeError {
  code: NativeErrorCode;
  message: string;
  operation?: string;
  retryable: boolean;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export class NativeException extends Error {
  readonly code: NativeErrorCode;
  readonly operation?: string;
  readonly retryable: boolean;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(error: NativeError) {
    super(`[Native:${error.code}] ${error.message}`);
    this.name = 'NativeException';
    this.code = error.code;
    this.operation = error.operation;
    this.retryable = error.retryable;
    this.recoverable = error.recoverable;
    this.details = error.details;
    Object.setPrototypeOf(this, NativeException.prototype);
  }

  toNativeError(): NativeError {
    return {
      code: this.code,
      message: this.message,
      operation: this.operation,
      retryable: this.retryable,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}

export function createNativeError(
  code: NativeErrorCode,
  message: string,
  options?: {
    operation?: string;
    retryable?: boolean;
    recoverable?: boolean;
    details?: Record<string, unknown>;
  }
): NativeError {
  const retryable = options?.retryable ?? isDefaultNativeRetryable(code);
  const recoverable = options?.recoverable ?? isDefaultNativeRecoverable(code);
  return {
    code,
    message,
    operation: options?.operation,
    retryable,
    recoverable,
    details: options?.details,
  };
}

function isDefaultNativeRetryable(code: NativeErrorCode): boolean {
  switch (code) {
    case 'TIMEOUT':
    case 'PLATFORM_FAILURE':
    case 'NETWORK_UNAVAILABLE':
      return true;
    default:
      return false;
  }
}

function isDefaultNativeRecoverable(code: NativeErrorCode): boolean {
  switch (code) {
    case 'PERMISSION_DENIED':
    case 'STORAGE_FULL':
    case 'TIMEOUT':
    case 'CANCELLED':
    case 'NETWORK_UNAVAILABLE':
      return true;
    default:
      return false;
  }
}
