/**
 * NearShare Direct Transport Error Hierarchy
 *
 * Strongly-typed errors for off-grid peer-to-peer transport failures.
 */

export type DirectTransportErrorCode =
  | 'RADIO_DISABLED'
  | 'NATIVE_BRIDGE_REQUIRED'
  | 'PEER_UNREACHABLE'
  | 'CONNECTION_REJECTED'
  | 'CHANNEL_ESTABLISHMENT_FAILED'
  | 'CROSS_PLATFORM_INCOMPATIBLE'
  | 'BLUETOOTH_UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'TRANSFER_ABORTED'
  | 'SESSION_TIMEOUT'
  | 'PHYSICAL_VALIDATION_UNVERIFIED';

export class DirectTransportError extends Error {
  public readonly code: DirectTransportErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: DirectTransportErrorCode, message: string, details?: Record<string, unknown>) {
    super(`[DirectTransport:${code}] ${message}`);
    this.name = 'DirectTransportError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DirectRadioDisabledError extends DirectTransportError {
  constructor(message = 'Wi-Fi radio is powered off or disabled. Direct Mode requires an active Wi-Fi radio.') {
    super('RADIO_DISABLED', message);
  }
}

export class DirectNativeBridgeRequiredError extends DirectTransportError {
  constructor(platform: string, message?: string) {
    super(
      'NATIVE_BRIDGE_REQUIRED',
      message || `Direct Mode requires the native ${platform} NearShare application runtime with peer-to-peer radio support.`
    );
  }
}

export class DirectPeerUnreachableError extends DirectTransportError {
  constructor(deviceId: string, distanceEstimate?: number) {
    super('PEER_UNREACHABLE', `Direct peer ${deviceId} is unreachable or out of proximity range.`, {
      deviceId,
      distanceEstimate,
    });
  }
}

export class DirectChannelEstablishmentError extends DirectTransportError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super('CHANNEL_ESTABLISHMENT_FAILED', `Failed to establish direct peer-to-peer data channel: ${reason}`, details);
  }
}

export class DirectCrossPlatformIncompatibleError extends DirectTransportError {
  constructor(localPlatform: string, remotePlatform: string, reason?: string) {
    super(
      'CROSS_PLATFORM_INCOMPATIBLE',
      reason ||
        `Direct peer-to-peer radio connection between ${localPlatform} and ${remotePlatform} requires a common bootstrap primitive (e.g. Wi-Fi Direct SoftAP or BLE bootstrap).`
    );
  }
}
