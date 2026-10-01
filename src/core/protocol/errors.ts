/**
 * NearShare Protocol Error Definitions
 *
 * Defines strongly-typed protocol-level error codes and error models.
 * Protocol errors are distinct from transport and security layer errors.
 */

export type ProtocolErrorCode =
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_MESSAGE'
  | 'INVALID_STATE'
  | 'CAPABILITY_MISMATCH'
  | 'PAIRING_REQUIRED'
  | 'PAIRING_FAILED'
  | 'SESSION_REJECTED'
  | 'TRANSFER_REJECTED'
  | 'FILE_REJECTED'
  | 'CHUNK_FAILED'
  | 'CHECKSUM_FAILED'
  | 'TRANSFER_INTERRUPTED'
  | 'TRANSFER_CANCELLED'
  | 'RESUME_UNSUPPORTED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
  retryable: boolean;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export class ProtocolException extends Error {
  readonly code: ProtocolErrorCode;
  readonly retryable: boolean;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(error: ProtocolError) {
    super(`[${error.code}] ${error.message}`);
    this.name = 'ProtocolException';
    this.code = error.code;
    this.retryable = error.retryable;
    this.recoverable = error.recoverable;
    this.details = error.details;
    Object.setPrototypeOf(this, ProtocolException.prototype);
  }

  toProtocolError(): ProtocolError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}

export function createProtocolError(
  code: ProtocolErrorCode,
  message: string,
  options?: {
    retryable?: boolean;
    recoverable?: boolean;
    details?: Record<string, unknown>;
  }
): ProtocolError {
  const retryable = options?.retryable ?? isDefaultRetryable(code);
  const recoverable = options?.recoverable ?? isDefaultRecoverable(code);
  return {
    code,
    message,
    retryable,
    recoverable,
    details: options?.details,
  };
}

function isDefaultRetryable(code: ProtocolErrorCode): boolean {
  switch (code) {
    case 'TIMEOUT':
    case 'CHUNK_FAILED':
    case 'TRANSFER_INTERRUPTED':
      return true;
    default:
      return false;
  }
}

function isDefaultRecoverable(code: ProtocolErrorCode): boolean {
  switch (code) {
    case 'TIMEOUT':
    case 'CHUNK_FAILED':
    case 'TRANSFER_INTERRUPTED':
    case 'CHECKSUM_FAILED':
      return true;
    default:
      return false;
  }
}
