/**
 * NearShare Protocol Message Envelope
 *
 * Defines the standard envelope wrapper for every message sent over any transport.
 */

import { PROTOCOL_NAME, PROTOCOL_VERSION } from './version';
import type { ProtocolMessageType, ProtocolPayloadMap } from './messageTypes';

export interface ProtocolMessage<T = unknown> {
  protocol: string;
  version: string;
  messageId: string;
  type: ProtocolMessageType;
  timestamp: number;
  sessionId?: string;
  transferId?: string;
  deviceId?: string;
  payload: T;
}

/**
 * Creates a unique message identifier.
 */
export function generateMessageId(): string {
  return `msg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Helper to build a strongly-typed ProtocolMessage.
 */
export function createProtocolMessage<K extends ProtocolMessageType>(
  type: K,
  payload: ProtocolPayloadMap[K],
  options?: {
    sessionId?: string;
    transferId?: string;
    deviceId?: string;
    messageId?: string;
    timestamp?: number;
    version?: string;
  }
): ProtocolMessage<ProtocolPayloadMap[K]> {
  return {
    protocol: PROTOCOL_NAME,
    version: options?.version ?? PROTOCOL_VERSION,
    messageId: options?.messageId ?? generateMessageId(),
    type,
    timestamp: options?.timestamp ?? Date.now(),
    sessionId: options?.sessionId,
    transferId: options?.transferId,
    deviceId: options?.deviceId,
    payload,
  };
}
