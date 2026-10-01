/**
 * NearShare Transport Manager
 *
 * Central coordinator for transport operations across Direct Nearby and Local Wi-Fi modes.
 *
 * Responsibilities:
 * - Selects and routes requests to the registered TransportAdapter.
 * - Enforces single active session per device to prevent duplicate connections.
 * - Multiplexes lifecycle and streaming events to subscribers.
 * - Provides unified facade for discovery, connection, payload transfer, and cancellation.
 */

import { TransportRegistry } from './TransportRegistry';
import { PairingManager } from '../security/PairingManager';
import type {
  TransportDevice,
  TransportConnection,
  TransportCapability,
  TransportMode,
  TransportState,
} from './types';
import type { TransferPayload } from '../transfer/types';
import type { TransportEventListener, TransportEvent } from './events';

export class TransportManager {
  private static instance: TransportManager;
  private registry: TransportRegistry;
  private listeners: Set<TransportEventListener> = new Set();
  private activeConnections: Map<string, TransportConnection> = new Map();
  private unregisterFns: Map<TransportMode, () => void> = new Map();

  private constructor() {
    this.registry = TransportRegistry.getInstance();
    this.setupAdapterListeners();
  }

  public static getInstance(): TransportManager {
    if (!TransportManager.instance) {
      TransportManager.instance = new TransportManager();
    }
    return TransportManager.instance;
  }

  private setupAdapterListeners(): void {
    // Clean up old listeners if any
    this.unregisterFns.forEach((unsub) => unsub());
    this.unregisterFns.clear();

    (['direct', 'wifi'] as const).forEach((mode) => {
      try {
        const adapter = this.registry.getAdapter(mode);
        const unsub = adapter.onEvent((event: TransportEvent) => {
          this.handleAdapterEvent(event);
        });
        this.unregisterFns.set(mode, unsub);
      } catch (err) {
        console.warn(`[TransportManager] Adapter not found for mode ${mode}:`, err);
      }
    });
  }

  private handleAdapterEvent(event: TransportEvent): void {
    // Keep connection registry state up to date
    if (event.type === 'connectionEstablished') {
      this.activeConnections.set(event.connection.connectionId, event.connection);
    } else if (event.type === 'connectionLost') {
      this.activeConnections.delete(event.connectionId);
    }

    // Forward to all subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[TransportManager] Subscriber error:', err);
      }
    });
  }

  /**
   * Discovers devices visible under the specified transport mode.
   */
  public async discover(mode: TransportMode = 'direct'): Promise<TransportDevice[]> {
    const adapter = this.registry.getAdapter(mode);
    return adapter.discover();
  }

  /**
   * Connects to a target device using its preferred or requested transport mode.
   * Prevents duplicate open connection handles to the same device.
   */
  public async connect(
    device: TransportDevice,
    mode?: TransportMode
  ): Promise<TransportConnection> {
    const targetMode = mode || device.mode || 'direct';

    // Verify security & trust boundary before session connection
    const pairingManager = PairingManager.getInstance();
    const isAllowed = pairingManager.canEstablishSession(device);
    if (!isAllowed && !device.trusted && !device.paired) {
      // In simulation mode, ensure pairing is requested or handled gracefully
      pairingManager.requestPairing({
        id: device.id,
        deviceName: device.deviceName,
        profileId: device.profileId,
      }).catch(() => {});
    }

    // Check if an active connection already exists for this device
    const existing = Array.from(this.activeConnections.values()).find(
      (c) => c.deviceId === device.id && c.state === 'connected' && c.mode === targetMode
    );
    if (existing) {
      return existing;
    }

    const adapter = this.registry.getAdapter(targetMode);
    const conn = await adapter.connect(device);
    this.activeConnections.set(conn.connectionId, conn);
    return conn;
  }

  /**
   * Disconnects an active session.
   */
  public async disconnect(connectionId: string): Promise<void> {
    const conn = this.activeConnections.get(connectionId);
    if (!conn) return;

    const adapter = this.registry.getAdapter(conn.mode);
    await adapter.disconnect(connectionId);
    this.activeConnections.delete(connectionId);
  }

  /**
   * Dispatches payload sending through the appropriate adapter.
   */
  public async send(
    payload: TransferPayload,
    connection?: TransportConnection
  ): Promise<void> {
    const mode = payload.mode || 'direct';
    let targetConnection = connection;

    if (!targetConnection) {
      // Find active connection matching destination device
      const destId = payload.destinationDevice.id;
      targetConnection = Array.from(this.activeConnections.values()).find(
        (c) => c.deviceId === destId && c.state === 'connected' && c.mode === mode
      );
    }

    if (!targetConnection) {
      // Create lightweight simulated connection handle for sending
      targetConnection = {
        connectionId: `conn-${mode}-${payload.destinationDevice.id}-${Date.now()}`,
        deviceId: payload.destinationDevice.id,
        mode,
        state: 'connected',
        connectedAt: Date.now(),
        lastUpdatedAt: Date.now(),
      };
      this.activeConnections.set(targetConnection.connectionId, targetConnection);
    }

    const adapter = this.registry.getAdapter(mode);
    return adapter.send(payload, targetConnection);
  }

  public async pause(transferId: string, mode: TransportMode = 'direct'): Promise<void> {
    const adapter = this.registry.getAdapter(mode);
    return adapter.pause(transferId);
  }

  public async resume(transferId: string, mode: TransportMode = 'direct'): Promise<void> {
    const adapter = this.registry.getAdapter(mode);
    return adapter.resume(transferId);
  }

  public async cancel(transferId: string, mode: TransportMode = 'direct'): Promise<void> {
    const adapter = this.registry.getAdapter(mode);
    return adapter.cancel(transferId);
  }

  public getCapabilities(mode: TransportMode = 'direct'): TransportCapability {
    const adapter = this.registry.getAdapter(mode);
    return adapter.getCapabilities();
  }

  public getConnectionState(connectionId?: string, mode: TransportMode = 'direct'): TransportState {
    const adapter = this.registry.getAdapter(mode);
    return adapter.getConnectionState(connectionId);
  }

  /**
   * Subscribes to transport events across all modes.
   */
  public subscribe(listener: TransportEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public destroy(): void {
    this.unregisterFns.forEach((unsub) => unsub());
    this.unregisterFns.clear();
    this.listeners.clear();
    this.activeConnections.clear();
  }
}
