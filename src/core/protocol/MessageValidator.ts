/**
 * NearShare Protocol Message Validator
 *
 * Provides runtime validation for protocol message envelopes and payloads
 * without external heavyweight libraries.
 */

import { PROTOCOL_NAME, isCompatibleVersion } from './version';
import type { ProtocolMessage } from './Message';
import type { ProtocolMessageType } from './messageTypes';
import { type ProtocolError, createProtocolError } from './errors';

export type ValidationResult<T = unknown> =
  | { valid: true; message: ProtocolMessage<T> }
  | { valid: false; error: ProtocolError };

const VALID_MESSAGE_TYPES = new Set<ProtocolMessageType>([
  'HELLO',
  'CAPABILITIES',
  'PAIRING_REQUEST',
  'PAIRING_RESPONSE',
  'PAIRING_VERIFY',
  'SESSION_CREATE',
  'SESSION_ACCEPT',
  'SESSION_CLOSE',
  'TRANSFER_REQUEST',
  'TRANSFER_ACCEPT',
  'TRANSFER_REJECT',
  'FILE_MANIFEST',
  'FILE_ACCEPT',
  'FILE_REJECT',
  'CHUNK_START',
  'CHUNK_DATA',
  'CHUNK_ACK',
  'TRANSFER_PAUSE',
  'TRANSFER_RESUME',
  'TRANSFER_CANCEL',
  'TRANSFER_PROGRESS',
  'TRANSFER_COMPLETE',
  'TRANSFER_ERROR',
  'HEARTBEAT',
  'GOODBYE',
  'RESUME_REQUEST',
  'RESUME_RESPONSE',
  'RESUME_REJECT',
]);

/**
 * Validates a protocol message envelope and type-specific payload.
 */
export function validateProtocolMessage(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      error: createProtocolError('INVALID_MESSAGE', 'Message must be a non-null object'),
    };
  }

  const obj = raw as Record<string, unknown>;

  // 1. Envelope validations
  if (typeof obj.protocol !== 'string' || obj.protocol !== PROTOCOL_NAME) {
    return {
      valid: false,
      error: createProtocolError(
        'INVALID_MESSAGE',
        `Invalid protocol header: expected '${PROTOCOL_NAME}', received '${String(obj.protocol)}'`
      ),
    };
  }

  if (typeof obj.version !== 'string' || !isCompatibleVersion(obj.version)) {
    return {
      valid: false,
      error: createProtocolError(
        'UNSUPPORTED_VERSION',
        `Incompatible protocol version: '${String(obj.version)}'`,
        { details: { version: obj.version } }
      ),
    };
  }

  if (typeof obj.messageId !== 'string' || obj.messageId.trim().length === 0) {
    return {
      valid: false,
      error: createProtocolError('INVALID_MESSAGE', 'Missing or empty messageId'),
    };
  }

  if (typeof obj.type !== 'string' || !VALID_MESSAGE_TYPES.has(obj.type as ProtocolMessageType)) {
    return {
      valid: false,
      error: createProtocolError('INVALID_MESSAGE', `Unknown message type: '${String(obj.type)}'`),
    };
  }

  if (typeof obj.timestamp !== 'number' || isNaN(obj.timestamp) || obj.timestamp <= 0) {
    return {
      valid: false,
      error: createProtocolError('INVALID_MESSAGE', 'Invalid timestamp in message header'),
    };
  }

  if (obj.payload === undefined || obj.payload === null || typeof obj.payload !== 'object') {
    return {
      valid: false,
      error: createProtocolError('INVALID_MESSAGE', `Message payload must be an object for type '${obj.type}'`),
    };
  }

  // 2. Payload schema checks
  const payloadError = validatePayload(obj.type as ProtocolMessageType, obj.payload as Record<string, unknown>);
  if (payloadError) {
    return {
      valid: false,
      error: payloadError,
    };
  }

  return {
    valid: true,
    message: raw as ProtocolMessage,
  };
}

function validatePayload(type: ProtocolMessageType, payload: Record<string, unknown>): ProtocolError | null {
  switch (type) {
    case 'HELLO':
      if (typeof payload.deviceId !== 'string' || typeof payload.profileId !== 'string') {
        return createProtocolError('INVALID_MESSAGE', 'HELLO payload missing deviceId or profileId');
      }
      if (typeof payload.deviceName !== 'string' || typeof payload.username !== 'string') {
        return createProtocolError('INVALID_MESSAGE', 'HELLO payload missing deviceName or username');
      }
      return null;

    case 'CAPABILITIES':
      if (!Array.isArray(payload.modes) || typeof payload.maxChunkSize !== 'number') {
        return createProtocolError('INVALID_MESSAGE', 'CAPABILITIES payload missing modes or maxChunkSize');
      }
      return null;

    case 'PAIRING_REQUEST':
      if (typeof payload.pairingId !== 'string' || typeof payload.method !== 'string') {
        return createProtocolError('INVALID_MESSAGE', 'PAIRING_REQUEST missing pairingId or method');
      }
      return null;

    case 'PAIRING_RESPONSE':
      if (typeof payload.pairingId !== 'string' || typeof payload.accepted !== 'boolean') {
        return createProtocolError('INVALID_MESSAGE', 'PAIRING_RESPONSE missing pairingId or accepted flag');
      }
      return null;

    case 'SESSION_CREATE':
      if (typeof payload.sessionId !== 'string' || typeof payload.mode !== 'string') {
        return createProtocolError('INVALID_MESSAGE', 'SESSION_CREATE missing sessionId or mode');
      }
      return null;

    case 'SESSION_ACCEPT':
      if (typeof payload.sessionId !== 'string' || typeof payload.accepted !== 'boolean') {
        return createProtocolError('INVALID_MESSAGE', 'SESSION_ACCEPT missing sessionId or accepted flag');
      }
      return null;

    case 'TRANSFER_REQUEST':
      if (
        typeof payload.transferId !== 'string' ||
        typeof payload.totalBytes !== 'number' ||
        typeof payload.totalFiles !== 'number'
      ) {
        return createProtocolError('INVALID_MESSAGE', 'TRANSFER_REQUEST missing transferId, totalBytes, or totalFiles');
      }
      return null;

    case 'FILE_MANIFEST':
      if (typeof payload.transferId !== 'string' || !Array.isArray(payload.files)) {
        return createProtocolError('INVALID_MESSAGE', 'FILE_MANIFEST missing transferId or files array');
      }
      for (const f of payload.files) {
        if (!f || typeof f !== 'object' || typeof f.fileId !== 'string' || typeof f.name !== 'string') {
          return createProtocolError('INVALID_MESSAGE', 'FILE_MANIFEST contains invalid file entry');
        }
      }
      return null;

    case 'FILE_ACCEPT':
      if (typeof payload.transferId !== 'string' || !Array.isArray(payload.acceptedFileIds)) {
        return createProtocolError('INVALID_MESSAGE', 'FILE_ACCEPT missing transferId or acceptedFileIds');
      }
      return null;

    case 'CHUNK_START':
    case 'CHUNK_DATA':
      if (type === 'CHUNK_DATA' && typeof payload.dataLength !== 'number') {
        return createProtocolError('INVALID_MESSAGE', 'CHUNK_DATA missing dataLength');
      }
      if (!payload.descriptor || typeof payload.descriptor !== 'object') {
        return createProtocolError('INVALID_MESSAGE', `${type} missing chunk descriptor`);
      }
      return null;

    case 'CHUNK_ACK':
      if (
        typeof payload.transferId !== 'string' ||
        typeof payload.fileId !== 'string' ||
        typeof payload.chunkIndex !== 'number'
      ) {
        return createProtocolError('INVALID_MESSAGE', 'CHUNK_ACK missing transferId, fileId, or chunkIndex');
      }
      return null;

    case 'TRANSFER_PROGRESS':
      if (
        typeof payload.transferId !== 'string' ||
        typeof payload.bytesTransferred !== 'number' ||
        typeof payload.totalBytes !== 'number'
      ) {
        return createProtocolError('INVALID_MESSAGE', 'TRANSFER_PROGRESS missing numeric transfer telemetry');
      }
      return null;

    case 'TRANSFER_COMPLETE':
      if (typeof payload.transferId !== 'string' || typeof payload.completedAt !== 'number') {
        return createProtocolError('INVALID_MESSAGE', 'TRANSFER_COMPLETE missing transferId or completedAt timestamp');
      }
      return null;

    case 'TRANSFER_ERROR':
      if (typeof payload.code !== 'string' || typeof payload.message !== 'string') {
        return createProtocolError('INVALID_MESSAGE', 'TRANSFER_ERROR missing code or message');
      }
      return null;

    case 'HEARTBEAT':
      if (typeof payload.sessionId !== 'string' || typeof payload.sequence !== 'number') {
        return createProtocolError('INVALID_MESSAGE', 'HEARTBEAT missing sessionId or sequence number');
      }
      return null;

    default:
      return null;
  }
}
