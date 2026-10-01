/**
 * NearShare Native Transport Event Bridge
 *
 * Maps low-level native bridge & protocol signals into unified TransportAdapter events.
 *
 * Invariants:
 * - Ephemeral Connection / Session IDs: Rotated per socket reconnection.
 * - Stable Logical Transfer IDs: Persisted through pause, resume, and reconnection cycles.
 * - Safe Subscription Lifecycle: All listener registrations return a precise unsubscribe function.
 * - Leak-Safe: Zero event emission and immediate listener eviction upon destroy().
 */

import type { TransportDevice, TransportConnection } from '../types';

export type NativeBridgeEventType =
  | 'discoveryStarted'
  | 'deviceDiscovered'
  | 'deviceLost'
  | 'connectionStarted'
  | 'connectionEstablished'
  | 'connectionLost'
  | 'connectionFailed'
  | 'reconnecting'
  | 'connectionRestored'
  | 'securityStateChanged'
  | 'transferStarted'
  | 'transferProgress'
  | 'transferPaused'
  | 'transferResumed'
  | 'transferCompleted'
  | 'transferCancelled'
  | 'transferFailed';

export interface NativeBridgeEventPayloadMap {
  discoveryStarted: { mode: string; timestamp: number };
  deviceDiscovered: { device: TransportDevice };
  deviceLost: { deviceId: string };
  connectionStarted: { deviceId: string; mode: string };
  connectionEstablished: { connection: TransportConnection };
  connectionLost: { connectionId: string; reason?: string };
  connectionFailed: { deviceId: string; error: string };
  reconnecting: { logicalTransferId?: string; attempt: number; delayMs: number };
  connectionRestored: { connection: TransportConnection; logicalTransferId?: string };
  securityStateChanged: { state: string; peerId: string; details?: string };
  transferStarted: { transferId: string; totalBytes: number; fileCount: number };
  transferProgress: { transferId: string; bytesTransferred: number; progress: number; speedBps: number };
  transferPaused: { transferId: string; reason?: string };
  transferResumed: { transferId: string; startOffset?: number };
  transferCompleted: { transferId: string; summary?: Record<string, unknown> };
  transferCancelled: { transferId: string; reason?: string };
  transferFailed: { transferId: string; error: string; retryable: boolean };
}

export type NativeBridgeEvent<T extends NativeBridgeEventType = NativeBridgeEventType> = {
  type: T;
  payload: NativeBridgeEventPayloadMap[T];
  timestamp: number;
};

export type NativeBridgeEventListener<T extends NativeBridgeEventType = NativeBridgeEventType> = (
  event: NativeBridgeEvent<T>
) => void;

export class NativeTransportEventBridge {
  private listeners: Map<NativeBridgeEventType, Set<NativeBridgeEventListener<any>>> = new Map();
  private wildcardListeners: Set<(event: NativeBridgeEvent) => void> = new Set();
  private isDestroyed = false;
  private activeLogicalTransferMap: Map<string, { logicalId: string; ephemeralConnectionId: string }> = new Map();

  /**
   * Subscribes to a specific native bridge event type.
   */
  public on<T extends NativeBridgeEventType>(
    type: T,
    listener: NativeBridgeEventListener<T>
  ): () => void {
    if (this.isDestroyed) {
      return () => {};
    }

    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    const set = this.listeners.get(type)!;
    set.add(listener);

    return () => {
      set.delete(listener);
    };
  }

  /**
   * Subscribes to all native bridge events.
   */
  public onAny(listener: (event: NativeBridgeEvent) => void): () => void {
    if (this.isDestroyed) {
      return () => {};
    }

    this.wildcardListeners.add(listener);
    return () => {
      this.wildcardListeners.delete(listener);
    };
  }

  /**
   * Emits a typed event to registered listeners while preserving logical transfer ID continuity.
   */
  public emit<T extends NativeBridgeEventType>(
    type: T,
    payload: NativeBridgeEventPayloadMap[T]
  ): void {
    if (this.isDestroyed) {
      return;
    }

    const event: NativeBridgeEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    // Track logical transfer mapping continuity
    if (type === 'transferStarted') {
      const p = payload as NativeBridgeEventPayloadMap['transferStarted'];
      this.activeLogicalTransferMap.set(p.transferId, {
        logicalId: p.transferId,
        ephemeralConnectionId: '',
      });
    } else if (type === 'connectionRestored') {
      const p = payload as NativeBridgeEventPayloadMap['connectionRestored'];
      if (p.logicalTransferId && this.activeLogicalTransferMap.has(p.logicalTransferId)) {
        const existing = this.activeLogicalTransferMap.get(p.logicalTransferId)!;
        existing.ephemeralConnectionId = p.connection.connectionId;
      }
    } else if (type === 'transferCompleted' || type === 'transferCancelled' || type === 'transferFailed') {
      const p = payload as { transferId: string };
      this.activeLogicalTransferMap.delete(p.transferId);
    }

    // Specific listeners
    const typeSet = this.listeners.get(type);
    if (typeSet) {
      typeSet.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error(`[NativeTransportEventBridge] Error in listener for ${type}:`, err);
        }
      });
    }

    // Wildcard listeners
    this.wildcardListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error(`[NativeTransportEventBridge] Error in wildcard listener:`, err);
      }
    });
  }

  /**
   * Retrieves the current logical transfer mapping.
   */
  public getLogicalTransferMapping(transferId: string): { logicalId: string; ephemeralConnectionId: string } | undefined {
    return this.activeLogicalTransferMap.get(transferId);
  }

  public getListenerCount(type?: NativeBridgeEventType): number {
    if (type) {
      return this.listeners.get(type)?.size ?? 0;
    }
    let total = this.wildcardListeners.size;
    this.listeners.forEach((set) => {
      total += set.size;
    });
    return total;
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.listeners.clear();
    this.wildcardListeners.clear();
    this.activeLogicalTransferMap.clear();
  }
}
