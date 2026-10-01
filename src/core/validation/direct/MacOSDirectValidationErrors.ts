/**
 * NearShare macOS Direct Transfer Validation Errors
 */

export class MacOSDirectValidationError extends Error {
  public readonly code: string;
  public readonly isBlocked: boolean;

  constructor(code: string, message: string, isBlocked = false) {
    super(`[DirectValidation:${code}] ${message}`);
    this.name = 'MacOSDirectValidationError';
    this.code = code;
    this.isBlocked = isBlocked;
  }
}

export const ValidationErrorCode = {
  GATE_NATIVE_NOT_IMPLEMENTED: 'GATE_NATIVE_NOT_IMPLEMENTED',
  GATE_NOT_MACOS_RUNTIME: 'GATE_NOT_MACOS_RUNTIME',
  GATE_NO_PEER_DETECTED: 'GATE_NO_PEER_DETECTED',
  GATE_PEER_NOT_MACOS: 'GATE_PEER_NOT_MACOS',
  GATE_DIRECT_PATH_NOT_CONFIRMED: 'GATE_DIRECT_PATH_NOT_CONFIRMED',
  GATE_WIFI_FALLBACK_DETECTED: 'GATE_WIFI_FALLBACK_DETECTED',
  GATE_PHYSICAL_NOT_SELECTED: 'GATE_PHYSICAL_NOT_SELECTED',
  TRANSPORT_MISMATCH: 'TRANSPORT_MISMATCH',
  INTEGRITY_MISMATCH: 'INTEGRITY_MISMATCH',
  SECURITY_CHECK_FAILED: 'SECURITY_CHECK_FAILED',
  SESSION_DISCONNECTED: 'SESSION_DISCONNECTED',
  DISK_SPACE_INSUFFICIENT: 'DISK_SPACE_INSUFFICIENT',
  TIMEOUT: 'TIMEOUT',
} as const;
