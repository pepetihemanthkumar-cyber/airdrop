/**
 * NearShare Security & Pairing Events Contract
 *
 * Defines strongly typed events emitted across the pairing and session lifecycle.
 */

import type { PairingSession, TrustState } from './types';
import type { VerificationRequest } from './Verification';
import type { SecurityError } from './errors';
import type { TransferSession } from './TransferSession';

export type SecurityEventType =
  | 'pairingRequested'
  | 'pairingStarted'
  | 'verificationRequired'
  | 'verificationSucceeded'
  | 'verificationFailed'
  | 'pairingCompleted'
  | 'pairingRejected'
  | 'pairingExpired'
  | 'pairingFailed'
  | 'trustChanged'
  | 'sessionCreated'
  | 'sessionClosed'
  | 'sessionFailed';

export interface BaseSecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  deviceId?: string;
  pairingId?: string;
  sessionId?: string;
}

export interface PairingRequestedEvent extends BaseSecurityEvent {
  type: 'pairingRequested';
  deviceId: string;
  profileId: string;
  session: PairingSession;
}

export interface PairingStartedEvent extends BaseSecurityEvent {
  type: 'pairingStarted';
  deviceId: string;
  pairingId: string;
}

export interface VerificationRequiredEvent extends BaseSecurityEvent {
  type: 'verificationRequired';
  deviceId: string;
  pairingId: string;
  request: VerificationRequest;
}

export interface VerificationSucceededEvent extends BaseSecurityEvent {
  type: 'verificationSucceeded';
  deviceId: string;
  pairingId: string;
}

export interface VerificationFailedEvent extends BaseSecurityEvent {
  type: 'verificationFailed';
  deviceId: string;
  pairingId: string;
  reason: string;
}

export interface PairingCompletedEvent extends BaseSecurityEvent {
  type: 'pairingCompleted';
  deviceId: string;
  pairingId: string;
  session: PairingSession;
}

export interface PairingRejectedEvent extends BaseSecurityEvent {
  type: 'pairingRejected';
  deviceId: string;
  pairingId: string;
  reason?: string;
}

export interface PairingExpiredEvent extends BaseSecurityEvent {
  type: 'pairingExpired';
  deviceId: string;
  pairingId: string;
}

export interface PairingFailedEvent extends BaseSecurityEvent {
  type: 'pairingFailed';
  deviceId: string;
  pairingId: string;
  error: SecurityError;
}

export interface TrustChangedEvent extends BaseSecurityEvent {
  type: 'trustChanged';
  deviceId: string;
  trustState: TrustState;
}

export interface SessionCreatedEvent extends BaseSecurityEvent {
  type: 'sessionCreated';
  session: TransferSession;
}

export interface SessionClosedEvent extends BaseSecurityEvent {
  type: 'sessionClosed';
  sessionId: string;
  deviceId: string;
}

export interface SessionFailedEvent extends BaseSecurityEvent {
  type: 'sessionFailed';
  sessionId: string;
  deviceId: string;
  error: SecurityError;
}

export type SecurityEvent =
  | PairingRequestedEvent
  | PairingStartedEvent
  | VerificationRequiredEvent
  | VerificationSucceededEvent
  | VerificationFailedEvent
  | PairingCompletedEvent
  | PairingRejectedEvent
  | PairingExpiredEvent
  | PairingFailedEvent
  | TrustChangedEvent
  | SessionCreatedEvent
  | SessionClosedEvent
  | SessionFailedEvent;

export type SecurityEventListener = (event: SecurityEvent) => void;
