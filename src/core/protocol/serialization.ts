/**
 * NearShare Protocol Serialization Contract
 *
 * Provides logical encoding and decoding of protocol messages.
 * Transport adapters are free to frame serialized messages as JSON strings,
 * binary streams, or platform-native payloads.
 */

import type { ProtocolMessage } from './Message';
import { validateProtocolMessage } from './MessageValidator';
import { type ProtocolError, createProtocolError } from './errors';

export type DeserializeResult<T = unknown> =
  | { success: true; message: ProtocolMessage<T> }
  | { success: false; error: ProtocolError };

/**
 * Serializes a ProtocolMessage into a canonical JSON string.
 */
export function serializeMessage<T = unknown>(message: ProtocolMessage<T>): string {
  return JSON.stringify(message);
}

/**
 * Deserializes and validates a raw string into a ProtocolMessage.
 */
export function deserializeMessage<T = unknown>(serialized: string): DeserializeResult<T> {
  if (!serialized || typeof serialized !== 'string') {
    return {
      success: false,
      error: createProtocolError('INVALID_MESSAGE', 'Serialized message must be a non-empty string'),
    };
  }

  try {
    const raw = JSON.parse(serialized);
    const validation = validateProtocolMessage(raw);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    return {
      success: true,
      message: validation.message as ProtocolMessage<T>,
    };
  } catch (err) {
    return {
      success: false,
      error: createProtocolError(
        'INVALID_MESSAGE',
        `JSON deserialization failed: ${err instanceof Error ? err.message : String(err)}`
      ),
    };
  }
}
