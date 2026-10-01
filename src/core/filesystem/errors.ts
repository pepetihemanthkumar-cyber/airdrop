/**
 * NearShare Filesystem Error Definitions
 *
 * Defines strongly-typed filesystem error codes, exception classes,
 * and error helper builders.
 */

export type FileSystemErrorCode =
  | 'NOT_AVAILABLE'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'INVALID_REFERENCE'
  | 'INVALID_PATH'
  | 'INVALID_OFFSET'
  | 'INVALID_LENGTH'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'DIRECTORY_SCAN_FAILED'
  | 'DESTINATION_UNAVAILABLE'
  | 'INSUFFICIENT_STORAGE'
  | 'UNSUPPORTED_OPERATION'
  | 'CANCELLED';

export interface FileSystemError {
  code: FileSystemErrorCode;
  message: string;
  retryable: boolean;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export class FileSystemException extends Error {
  readonly code: FileSystemErrorCode;
  readonly retryable: boolean;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(error: FileSystemError) {
    super(`[${error.code}] ${error.message}`);
    this.name = 'FileSystemException';
    this.code = error.code;
    this.retryable = error.retryable;
    this.recoverable = error.recoverable;
    this.details = error.details;
    Object.setPrototypeOf(this, FileSystemException.prototype);
  }

  toFileSystemError(): FileSystemError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}

export function createFileSystemError(
  code: FileSystemErrorCode,
  message: string,
  options?: {
    retryable?: boolean;
    recoverable?: boolean;
    details?: Record<string, unknown>;
  }
): FileSystemError {
  const retryable = options?.retryable ?? isDefaultFsRetryable(code);
  const recoverable = options?.recoverable ?? isDefaultFsRecoverable(code);
  return {
    code,
    message,
    retryable,
    recoverable,
    details: options?.details,
  };
}

function isDefaultFsRetryable(code: FileSystemErrorCode): boolean {
  switch (code) {
    case 'READ_FAILED':
    case 'WRITE_FAILED':
    case 'DIRECTORY_SCAN_FAILED':
      return true;
    default:
      return false;
  }
}

function isDefaultFsRecoverable(code: FileSystemErrorCode): boolean {
  switch (code) {
    case 'PERMISSION_DENIED':
    case 'DESTINATION_UNAVAILABLE':
    case 'INSUFFICIENT_STORAGE':
    case 'READ_FAILED':
    case 'WRITE_FAILED':
      return true;
    default:
      return false;
  }
}
