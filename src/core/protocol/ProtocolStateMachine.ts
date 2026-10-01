/**
 * NearShare Protocol State Machine
 *
 * Enforces valid state transitions across the protocol lifecycle.
 * Validates message receipt against current protocol state.
 */

import { ProtocolException, createProtocolError } from './errors';
import type { ProtocolMessageType } from './messageTypes';

export type ProtocolState =
  | 'IDLE'
  | 'DISCOVERED'
  | 'HELLO'
  | 'CAPABILITIES'
  | 'PAIRING'
  | 'PAIRING_REJECTED'
  | 'SESSION'
  | 'SESSION_FAILED'
  | 'TRANSFER_REQUEST'
  | 'TRANSFER_REJECTED'
  | 'MANIFEST'
  | 'FILE_ACCEPT'
  | 'FILE_REJECTED'
  | 'CHUNK_TRANSFER'
  | 'TRANSFER_PAUSED'
  | 'TRANSFER_INTERRUPTED'
  | 'TRANSFER_CANCELLED'
  | 'TRANSFER_FAILED'
  | 'VERIFY'
  | 'COMPLETE'
  | 'SESSION_CLOSE'
  | 'CLOSED';

/**
 * Transition Table defining valid forward & branch states for every ProtocolState.
 */
const STATE_TRANSITIONS: Record<ProtocolState, ProtocolState[]> = {
  IDLE: ['DISCOVERED', 'HELLO'],
  DISCOVERED: ['HELLO', 'CLOSED'],
  HELLO: ['CAPABILITIES', 'PAIRING', 'SESSION', 'CLOSED'],
  CAPABILITIES: ['PAIRING', 'SESSION', 'CLOSED'],
  PAIRING: ['PAIRING', 'SESSION', 'PAIRING_REJECTED', 'CLOSED'],
  PAIRING_REJECTED: ['PAIRING', 'SESSION_CLOSE', 'CLOSED'],
  SESSION: ['PAIRING', 'TRANSFER_REQUEST', 'MANIFEST', 'CHUNK_TRANSFER', 'SESSION_FAILED', 'SESSION_CLOSE', 'CLOSED'],
  SESSION_FAILED: ['SESSION', 'CLOSED'],
  TRANSFER_REQUEST: ['TRANSFER_REJECTED', 'MANIFEST', 'FILE_ACCEPT', 'TRANSFER_CANCELLED', 'CLOSED'],
  TRANSFER_REJECTED: ['TRANSFER_REQUEST', 'SESSION_CLOSE', 'CLOSED'],
  MANIFEST: ['FILE_ACCEPT', 'FILE_REJECTED', 'TRANSFER_CANCELLED', 'CLOSED'],
  FILE_ACCEPT: ['CHUNK_TRANSFER', 'COMPLETE', 'TRANSFER_CANCELLED', 'CLOSED'],
  FILE_REJECTED: ['MANIFEST', 'TRANSFER_REQUEST', 'SESSION_CLOSE', 'CLOSED'],
  CHUNK_TRANSFER: [
    'CHUNK_TRANSFER', // loop for ongoing chunks
    'TRANSFER_PAUSED',
    'TRANSFER_INTERRUPTED',
    'TRANSFER_CANCELLED',
    'TRANSFER_FAILED',
    'VERIFY',
    'COMPLETE',
    'SESSION_CLOSE',
    'CLOSED',
  ],
  TRANSFER_PAUSED: ['CHUNK_TRANSFER', 'TRANSFER_CANCELLED', 'SESSION_CLOSE', 'CLOSED'],
  TRANSFER_INTERRUPTED: ['CHUNK_TRANSFER', 'TRANSFER_CANCELLED', 'TRANSFER_FAILED', 'SESSION_CLOSE', 'CLOSED'],
  TRANSFER_CANCELLED: ['TRANSFER_REQUEST', 'MANIFEST', 'SESSION_CLOSE', 'CLOSED'],
  TRANSFER_FAILED: ['TRANSFER_REQUEST', 'MANIFEST', 'SESSION_CLOSE', 'CLOSED'],
  VERIFY: ['COMPLETE', 'TRANSFER_FAILED', 'CLOSED'],
  COMPLETE: ['TRANSFER_REQUEST', 'MANIFEST', 'SESSION_CLOSE', 'CLOSED'],
  SESSION_CLOSE: ['CLOSED', 'IDLE'],
  CLOSED: ['IDLE', 'DISCOVERED'],
};

/**
 * Checks whether a transition between two states is valid according to protocol rules.
 */
export function canTransition(fromState: ProtocolState, toState: ProtocolState): boolean {
  if (fromState === toState) return true;
  const allowed = STATE_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

/**
 * Asserts that a state transition is legal, throwing a ProtocolException if illegal.
 */
export function assertValidTransition(fromState: ProtocolState, toState: ProtocolState): void {
  if (!canTransition(fromState, toState)) {
    throw new ProtocolException(
      createProtocolError(
        'INVALID_STATE',
        `Illegal protocol transition from '${fromState}' to '${toState}'`,
        { details: { fromState, toState } }
      )
    );
  }
}

/**
 * Returns the list of permitted next states from the current state.
 */
export function getNextStates(currentState: ProtocolState): ProtocolState[] {
  return STATE_TRANSITIONS[currentState] ? [...STATE_TRANSITIONS[currentState]] : [];
}

/**
 * Maps an incoming ProtocolMessageType to the target ProtocolState.
 */
export function mapMessageTypeToState(type: ProtocolMessageType): ProtocolState | null {
  switch (type) {
    case 'HELLO':
      return 'HELLO';
    case 'CAPABILITIES':
      return 'CAPABILITIES';
    case 'PAIRING_REQUEST':
    case 'PAIRING_RESPONSE':
    case 'PAIRING_VERIFY':
      return 'PAIRING';
    case 'SESSION_CREATE':
    case 'SESSION_ACCEPT':
      return 'SESSION';
    case 'SESSION_CLOSE':
    case 'GOODBYE':
      return 'SESSION_CLOSE';
    case 'TRANSFER_REQUEST':
      return 'TRANSFER_REQUEST';
    case 'TRANSFER_ACCEPT':
      return 'TRANSFER_REQUEST';
    case 'TRANSFER_REJECT':
      return 'TRANSFER_REJECTED';
    case 'FILE_MANIFEST':
      return 'MANIFEST';
    case 'FILE_ACCEPT':
      return 'FILE_ACCEPT';
    case 'FILE_REJECT':
      return 'FILE_REJECTED';
    case 'CHUNK_START':
    case 'CHUNK_DATA':
    case 'CHUNK_ACK':
    case 'TRANSFER_PROGRESS':
      return 'CHUNK_TRANSFER';
    case 'TRANSFER_PAUSE':
      return 'TRANSFER_PAUSED';
    case 'TRANSFER_RESUME':
    case 'RESUME_REQUEST':
    case 'RESUME_RESPONSE':
      return 'CHUNK_TRANSFER';
    case 'RESUME_REJECT':
      return 'TRANSFER_FAILED';
    case 'TRANSFER_CANCEL':
      return 'TRANSFER_CANCELLED';
    case 'TRANSFER_COMPLETE':
      return 'COMPLETE';
    case 'TRANSFER_ERROR':
      return 'TRANSFER_FAILED';
    case 'HEARTBEAT':
      return null; // Heartbeat does not alter the core transfer lifecycle state
    default:
      return null;
  }
}

/**
 * Validates if a message type is acceptable in the current protocol state.
 */
export function isMessageAcceptableInState(
  currentState: ProtocolState,
  messageType: ProtocolMessageType
): { acceptable: boolean; reason?: string } {
  // Heartbeats and goodbyes are acceptable in any active session state
  if (messageType === 'HEARTBEAT') {
    const valid = currentState !== 'IDLE' && currentState !== 'CLOSED';
    return {
      acceptable: valid,
      reason: valid ? undefined : 'HEARTBEAT not allowed when session is idle or closed',
    };
  }

  if (messageType === 'GOODBYE' || messageType === 'SESSION_CLOSE') {
    return { acceptable: true };
  }

  // Prevent receiving CHUNK_DATA before FILE_ACCEPT
  if (messageType === 'CHUNK_DATA' || messageType === 'CHUNK_START') {
    if (currentState !== 'FILE_ACCEPT' && currentState !== 'CHUNK_TRANSFER' && currentState !== 'TRANSFER_PAUSED') {
      return {
        acceptable: false,
        reason: `Cannot receive ${messageType} in state '${currentState}'. FILE_ACCEPT must precede chunk transmission.`,
      };
    }
  }

  // Prevent receiving TRANSFER_COMPLETE before TRANSFER_REQUEST/CHUNK_TRANSFER
  if (messageType === 'TRANSFER_COMPLETE') {
    if (currentState !== 'CHUNK_TRANSFER' && currentState !== 'VERIFY' && currentState !== 'FILE_ACCEPT') {
      return {
        acceptable: false,
        reason: `Cannot receive TRANSFER_COMPLETE in state '${currentState}'. Transfer must be active.`,
      };
    }
  }

  const targetState = mapMessageTypeToState(messageType);
  if (!targetState) {
    return { acceptable: true };
  }

  if (canTransition(currentState, targetState)) {
    return { acceptable: true };
  }

  return {
    acceptable: false,
    reason: `Message type '${messageType}' requires transition from '${currentState}' to '${targetState}', which is not allowed.`,
  };
}
