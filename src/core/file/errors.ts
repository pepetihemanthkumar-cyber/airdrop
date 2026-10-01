/**
 * NearShare File Engine Errors
 *
 * Defines strongly-typed file-level error codes and error models.
 * Isolates React components from platform-specific I/O exceptions.
 */

export type FileErrorCode =
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_FAILED'
  | 'FILE_WRITE_FAILED'
  | 'INVALID_CHUNK'
  | 'DUPLICATE_CHUNK'
  | 'CHECKSUM_FAILED'
  | 'CHECKPOINT_FAILED'
  | 'STORAGE_INSUFFICIENT'
  | 'FILE_FINALIZE_FAILED'
  | 'TRANSFER_STAGING_FAILED'
  | 'UNSUPPORTED_FILE'
  | 'UNKNOWN';

export interface FileError {
  code: FileErrorCode;
  message: string;
  retryable: boolean;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

export class FileException extends Error {
  readonly code: FileErrorCode;
  readonly retryable: boolean;
  readonly recoverable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(error: FileError) {
    super(`[${error.code}] ${error.message}`);
    this.name = 'FileException';
    this.code = error.code;
    this.retryable = error.retryable;
    this.recoverable = error.recoverable;
    this.details = error.details;
    Object.setPrototypeOf(this, FileException.prototype);
  }

  toFileError(): FileError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      recoverable: this.recoverable,
      details: this.details,
    };
  }
}

export function createFileError(
  code: FileErrorCode,
  message: string,
  options?: {
    retryable?: boolean;
    recoverable?: boolean;
    details?: Record<string, unknown>;
  }
): FileError {
  const retryable = options?.retryable ?? isDefaultFileRetryable(code);
  const recoverable = options?.recoverable ?? isDefaultFileRecoverable(code);
  return {
    code,
    message,
    retryable,
    recoverable,
    details: options?.details,
  };
}

function isDefaultFileRetryable(code: FileErrorCode): boolean {
  switch (code) {
    case 'FILE_READ_FAILED':
    case 'FILE_WRITE_FAILED':
    case 'CHECKSUM_FAILED':
    case 'INVALID_CHUNK':
      return true;
    default:
      return false;
  }
}

function isDefaultFileRecoverable(code: FileErrorCode): boolean {
  switch (code) {
    case 'DUPLICATE_CHUNK':
    case 'CHECKPOINT_FAILED':
    case 'FILE_READ_FAILED':
    case 'FILE_WRITE_FAILED':
    case 'CHECKSUM_FAILED':
      return true;
    default:
      return false;
  }
}
