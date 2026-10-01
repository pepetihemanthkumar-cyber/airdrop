/**
 * NearShare Secure Transport & Cryptographic Error Types
 *
 * Strongly typed error envelopes for cryptographic handshake, key derivation,
 * AEAD encryption/decryption, sequence validation, replay detection, and session lifecycle.
 *
 * CRITICAL RULE: Secrets, private keys, or raw nonces must NEVER be included in error messages.
 */

export type CryptoErrorCode =
  | 'SECURE_SESSION_UNAVAILABLE'
  | 'HANDSHAKE_FAILED'
  | 'AUTHENTICATION_FAILED'
  | 'IDENTITY_MISMATCH'
  | 'IDENTITY_CHANGED'
  | 'INVALID_CIPHERTEXT'
  | 'AUTH_TAG_FAILED'
  | 'REPLAY_DETECTED'
  | 'INVALID_SEQUENCE'
  | 'EXPIRED_SECURE_SESSION'
  | 'EXPIRED_SESSION'
  | 'SECURE_SESSION_CLOSED'
  | 'CORRUPTED_FRAME'
  | 'OVERSIZED_FRAME'
  | 'UNSUPPORTED_VERSION'
  | 'UNENCRYPTED_MESSAGE_REJECTED';

export interface CryptoError {
  code: CryptoErrorCode;
  message: string;
  retryable: boolean;
  recoverable: boolean;
  timestamp: number;
  originalError?: unknown;
}

export class CryptoException extends Error {
  readonly code: CryptoErrorCode;
  readonly retryable: boolean;
  readonly recoverable: boolean;
  readonly timestamp: number;

  constructor(
    code: CryptoErrorCode,
    message: string,
    retryable: boolean = false,
    recoverable: boolean = false
  ) {
    super(`[Crypto:${code}] ${message}`);
    this.name = 'CryptoException';
    this.code = code;
    this.retryable = retryable;
    this.recoverable = recoverable;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, CryptoException.prototype);
  }

  toErrorEnvelope(): CryptoError {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
    };
  }
}

export function createCryptoError(
  code: CryptoErrorCode,
  message: string,
  retryable: boolean = false,
  recoverable: boolean = false,
  originalError?: unknown
): CryptoError {
  return {
    code,
    message,
    retryable,
    recoverable,
    timestamp: Date.now(),
    originalError,
  };
}
