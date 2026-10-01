/**
 * NearShare Safe User-Facing Error Mapper
 *
 * Sanitizes low-level errors (Rust panics, socket exceptions, filesystem paths,
 * cryptographic exceptions, and protocol mismatches) into clean, actionable,
 * privacy-preserving user messages.
 */

export interface SafeUserError {
  title: string;
  message: string;
  code: string;
  isRetryable: boolean;
}

export function mapToSafeUserError(rawError: unknown): SafeUserError {
  const errorString = rawError instanceof Error ? rawError.message : String(rawError || '');
  const lower = errorString.toLowerCase();

  // 1. Connection & Network Errors
  if (lower.includes('connection refused') || lower.includes('econnrefused')) {
    return {
      title: 'Connection Refused',
      message: 'Unable to connect to this device. Ensure NearShare is open on the other device and on the same Wi-Fi network.',
      code: 'ERR_CONNECTION_REFUSED',
      isRetryable: true,
    };
  }

  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return {
      title: 'Connection Timed Out',
      message: 'The connection to the remote device timed out. Please check your local network connection.',
      code: 'ERR_CONNECTION_TIMEOUT',
      isRetryable: true,
    };
  }

  if (lower.includes('network unreachable') || lower.includes('ehostunreach') || lower.includes('enotconn')) {
    return {
      title: 'Network Unreachable',
      message: 'Local network is currently unreachable. Make sure both devices are on the same Wi-Fi or hotspot.',
      code: 'ERR_NETWORK_UNREACHABLE',
      isRetryable: true,
    };
  }

  // 2. Cryptographic & Security Errors
  if (lower.includes('identity mismatch') || lower.includes('tofu') || lower.includes('signature')) {
    return {
      title: 'Security Verification Failed',
      message: 'Device identity verification failed. The remote device key does not match trusted records.',
      code: 'ERR_IDENTITY_MISMATCH',
      isRetryable: false,
    };
  }

  if (lower.includes('blocked') || lower.includes('trust state')) {
    return {
      title: 'Device Blocked',
      message: 'Transfer rejected because this device has been blocked in your trust settings.',
      code: 'ERR_DEVICE_BLOCKED',
      isRetryable: false,
    };
  }

  if (lower.includes('expired') || lower.includes('authorization expired')) {
    return {
      title: 'Session Expired',
      message: 'Transfer authorization has expired. Please initiate a new pairing request.',
      code: 'ERR_SESSION_EXPIRED',
      isRetryable: true,
    };
  }

  if (lower.includes('tag mismatch') || lower.includes('tamper') || lower.includes('decryption failed')) {
    return {
      title: 'Decryption Error',
      message: 'Secure payload could not be decrypted. The session will be reset.',
      code: 'ERR_CRYPTO_TAMPER',
      isRetryable: true,
    };
  }

  // 3. Integrity & File Verification Errors
  if (lower.includes('sha-256') || lower.includes('digest mismatch') || lower.includes('integrity')) {
    return {
      title: 'Integrity Check Failed',
      message: 'File checksum verification failed after transfer. The file may have been corrupted.',
      code: 'ERR_INTEGRITY_MISMATCH',
      isRetryable: true,
    };
  }

  // 4. Filesystem & Permission Errors
  if (lower.includes('permission denied') || lower.includes('eacces') || lower.includes('eperm')) {
    return {
      title: 'Permission Denied',
      message: 'NearShare does not have permission to read or write this file. Please check system permissions.',
      code: 'ERR_PERMISSION_DENIED',
      isRetryable: false,
    };
  }

  if (lower.includes('no space left') || lower.includes('enospc') || lower.includes('disk full')) {
    return {
      title: 'Disk Full',
      message: 'Not enough storage space available on the target device to complete this transfer.',
      code: 'ERR_DISK_FULL',
      isRetryable: false,
    };
  }

  // 5. Default Fallback
  return {
    title: 'Transfer Error',
    message: 'An unexpected issue occurred during transfer. Please try again.',
    code: 'ERR_TRANSFER_FAILED',
    isRetryable: true,
  };
}

export const SafeErrorMapper = {
  mapToSafeUserError,
  mapToPublicMessage: (rawError: unknown): string => mapToSafeUserError(rawError).message,
};
