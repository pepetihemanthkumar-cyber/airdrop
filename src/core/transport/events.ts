/**
 * NearShare Transport Events Contract
 *
 * Defines strongly typed lifecycle and streaming events emitted by transport adapters.
 */

import type { TransportDevice, TransportConnection, TransportMode } from './types';
import type { TransferPayload } from '../transfer/types';
import type { TransportError } from './errors';

export interface TransferProgressEvent {
  transferId: string;
  bytesTransferred: number;
  totalBytes: number;
  speedBytesPerSecond: number;
  etaSeconds?: number;
  timestamp: number;
}

export type TransportEventType =
  | 'discoveryStarted'
  | 'deviceDiscovered'
  | 'deviceLost'
  | 'connectionStarted'
  | 'connectionEstablished'
  | 'connectionLost'
  | 'connectionFailed'
  | 'reconnecting'
  | 'connectionRestored'
  | 'transferStarted'
  | 'transferProgress'
  | 'transferPaused'
  | 'transferResumed'
  | 'transferCompleted'
  | 'transferCancelled'
  | 'transferFailed'
  | 'securityStateChanged';

export interface BaseTransportEvent {
  type: TransportEventType;
  timestamp: number;
  deviceId?: string;
  connectionId?: string;
  transferId?: string;
}

export interface DiscoveryStartedEvent extends BaseTransportEvent {
  type: 'discoveryStarted';
  mode: TransportMode;
}

export interface DeviceDiscoveredEvent extends BaseTransportEvent {
  type: 'deviceDiscovered';
  device: TransportDevice;
}

export interface DeviceLostEvent extends BaseTransportEvent {
  type: 'deviceLost';
  deviceId: string;
}

export interface ConnectionStartedEvent extends BaseTransportEvent {
  type: 'connectionStarted';
  deviceId: string;
  mode: TransportMode;
}

export interface ConnectionEstablishedEvent extends BaseTransportEvent {
  type: 'connectionEstablished';
  connection: TransportConnection;
  device: TransportDevice;
}

export interface ConnectionLostEvent extends BaseTransportEvent {
  type: 'connectionLost';
  connectionId: string;
  deviceId: string;
  reason?: string;
}

export interface ConnectionFailedEvent extends BaseTransportEvent {
  type: 'connectionFailed';
  deviceId: string;
  error: TransportError;
}

export interface ReconnectingEvent extends BaseTransportEvent {
  type: 'reconnecting';
  connectionId: string;
  deviceId: string;
  attempt: number;
}

export interface ConnectionRestoredEvent extends BaseTransportEvent {
  type: 'connectionRestored';
  connectionId: string;
  deviceId: string;
}

export interface TransferStartedEvent extends BaseTransportEvent {
  type: 'transferStarted';
  transferId: string;
  payload: TransferPayload;
}

export interface TransferProgressPayloadEvent extends BaseTransportEvent {
  type: 'transferProgress';
  transferId: string;
  progress: TransferProgressEvent;
}

export interface TransferPausedEvent extends BaseTransportEvent {
  type: 'transferPaused';
  transferId: string;
}

export interface TransferResumedEvent extends BaseTransportEvent {
  type: 'transferResumed';
  transferId: string;
}

export interface TransferCompletedEvent extends BaseTransportEvent {
  type: 'transferCompleted';
  transferId: string;
  totalBytes: number;
  durationMs: number;
}

export interface TransferCancelledEvent extends BaseTransportEvent {
  type: 'transferCancelled';
  transferId: string;
  reason?: string;
}

export interface TransferFailedEvent extends BaseTransportEvent {
  type: 'transferFailed';
  transferId: string;
  error: TransportError;
}

export interface SecurityStateChangedEvent extends BaseTransportEvent {
  type: 'securityStateChanged';
  deviceId: string;
  securityState: string;
  trusted: boolean;
  paired: boolean;
}

export type TransportEvent =
  | DiscoveryStartedEvent
  | DeviceDiscoveredEvent
  | DeviceLostEvent
  | ConnectionStartedEvent
  | ConnectionEstablishedEvent
  | ConnectionLostEvent
  | ConnectionFailedEvent
  | ReconnectingEvent
  | ConnectionRestoredEvent
  | TransferStartedEvent
  | TransferProgressPayloadEvent
  | TransferPausedEvent
  | TransferResumedEvent
  | TransferCompletedEvent
  | TransferCancelledEvent
  | TransferFailedEvent
  | SecurityStateChangedEvent;

export type TransportEventListener = (event: TransportEvent) => void;
