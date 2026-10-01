/**
 * Mock Local Wi-Fi Transport Adapter
 *
 * WI-FI MODE SEMANTICS:
 * - "Uses an existing local Wi-Fi / Local Area Network (LAN / WLAN)."
 * - An active internet connection / external WAN routing is NOT required.
 * - No artificial 30m proximity product boundary.
 * - High throughput streaming across local network subnets with mDNS / local socket negotiation on native platforms.
 *
 * NOTE: Frontend simulation only. Emits canonical TransportEvents for UI and queue orchestration.
 */

import type { TransportAdapter } from '../TransportAdapter';
import type {
  TransportDevice,
  TransportConnection,
  TransportCapability,
  TransportState,
} from '../types';
import type { TransferPayload } from '../../transfer/types';
import type { TransportEventListener, TransportEvent } from '../events';

export class MockWiFiTransport implements TransportAdapter {
  readonly mode = 'wifi' as const;

  private listeners: Set<TransportEventListener> = new Set();
  private activeConnections: Map<string, TransportConnection> = new Map();
  private transferTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private transferStates: Map<string, { paused: boolean; transferred: number; total: number }> =
    new Map();

  /**
   * Discovers devices visible on the current local network subnet.
   */
  async discover(): Promise<TransportDevice[]> {
    this.emitEvent({
      type: 'discoveryStarted',
      mode: 'wifi',
      timestamp: Date.now(),
    });

    const mockLocalDevices: TransportDevice[] = [
      {
        id: 'dev-sarah-pc',
        profileId: 'NS-SARAH-4129',
        deviceName: "Sarah's Studio PC",
        platform: 'Windows',
        username: '@sarahc',
        avatar: 'S',
        mode: 'wifi',
        signalQuality: 'Excellent',
        trusted: true,
        paired: true,
      },
      {
        id: 'dev-mac-01',
        profileId: 'NS-HEMANTH-8492',
        deviceName: "Hemanth's MacBook Air",
        platform: 'macOS',
        username: '@hemanth',
        avatar: 'H',
        mode: 'wifi',
        signalQuality: 'Excellent',
        trusted: true,
        paired: true,
      },
      {
        id: 'dev-android-01',
        profileId: 'NS-DEV-AND-4210',
        deviceName: "Hemanth's Pixel",
        platform: 'Android',
        username: '@hemanth',
        avatar: 'H',
        mode: 'wifi',
        signalQuality: 'Good',
        trusted: true,
        paired: true,
      },
    ];

    mockLocalDevices.forEach((device) => {
      this.emitEvent({
        type: 'deviceDiscovered',
        device,
        timestamp: Date.now(),
      });
    });

    return mockLocalDevices;
  }

  /**
   * Establishes a simulated local network channel session.
   */
  async connect(device: TransportDevice): Promise<TransportConnection> {
    this.emitEvent({
      type: 'connectionStarted',
      deviceId: device.id,
      mode: 'wifi',
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 120));

    const connectionId = `conn-wifi-${device.id}-${Date.now()}`;
    const connection: TransportConnection = {
      connectionId,
      deviceId: device.id,
      mode: 'wifi',
      state: 'connected',
      connectedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };

    this.activeConnections.set(connectionId, connection);

    this.emitEvent({
      type: 'connectionEstablished',
      connectionId,
      deviceId: device.id,
      connection,
      device,
      timestamp: Date.now(),
    });

    return connection;
  }

  /**
   * Disconnects active local network session.
   */
  async disconnect(connectionId: string): Promise<void> {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      conn.state = 'disconnected';
      conn.lastUpdatedAt = Date.now();
      this.activeConnections.delete(connectionId);

      this.emitEvent({
        type: 'connectionLost',
        connectionId,
        deviceId: conn.deviceId,
        reason: 'User disconnected session',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Sends payload over simulated local network channel.
   */
  async send(payload: TransferPayload, connection: TransportConnection): Promise<void> {
    const { transferId, totalBytes } = payload;

    this.emitEvent({
      type: 'transferStarted',
      transferId,
      connectionId: connection.connectionId,
      deviceId: connection.deviceId,
      payload,
      timestamp: Date.now(),
    });

    this.transferStates.set(transferId, {
      paused: false,
      transferred: 0,
      total: totalBytes,
    });

    const speedMBps = 38.0;
    const speedBytesPerSec = speedMBps * 1024 * 1024;
    const chunkSize = Math.round(speedBytesPerSec * 0.25); // 250ms interval

    const timer = setInterval(() => {
      const state = this.transferStates.get(transferId);
      if (!state) {
        clearInterval(timer);
        return;
      }

      if (state.paused) {
        return;
      }

      state.transferred = Math.min(state.total, state.transferred + chunkSize);
      const remainingBytes = Math.max(0, state.total - state.transferred);
      const etaSeconds = Math.ceil(remainingBytes / speedBytesPerSec);

      this.emitEvent({
        type: 'transferProgress',
        transferId,
        connectionId: connection.connectionId,
        deviceId: connection.deviceId,
        progress: {
          transferId,
          bytesTransferred: state.transferred,
          totalBytes: state.total,
          speedBytesPerSecond: speedBytesPerSec,
          etaSeconds,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      });

      if (state.transferred >= state.total) {
        clearInterval(timer);
        this.transferTimers.delete(transferId);
        this.transferStates.delete(transferId);

        this.emitEvent({
          type: 'transferCompleted',
          transferId,
          connectionId: connection.connectionId,
          deviceId: connection.deviceId,
          totalBytes: state.total,
          durationMs: Math.round((state.total / speedBytesPerSec) * 1000),
          timestamp: Date.now(),
        });
      }
    }, 250);

    this.transferTimers.set(transferId, timer);
  }

  async pause(transferId: string): Promise<void> {
    const state = this.transferStates.get(transferId);
    if (state) {
      state.paused = true;
      this.emitEvent({
        type: 'transferPaused',
        transferId,
        timestamp: Date.now(),
      });
    }
  }

  async resume(transferId: string): Promise<void> {
    const state = this.transferStates.get(transferId);
    if (state) {
      state.paused = false;
      this.emitEvent({
        type: 'transferResumed',
        transferId,
        timestamp: Date.now(),
      });
    }
  }

  async cancel(transferId: string): Promise<void> {
    const timer = this.transferTimers.get(transferId);
    if (timer) {
      clearInterval(timer);
      this.transferTimers.delete(transferId);
    }
    this.transferStates.delete(transferId);

    this.emitEvent({
      type: 'transferCancelled',
      transferId,
      reason: 'User cancelled',
      timestamp: Date.now(),
    });
  }

  getCapabilities(): TransportCapability {
    return {
      direct: false,
      wifi: true,
      discovery: true,
      resume: true,
      pause: true,
      streaming: true,
      folderTransfer: true,
      backgroundTransfer: true, // Wi-Fi LAN allows background execution on supported OSes
    };
  }

  getConnectionState(connectionId?: string): TransportState {
    if (!connectionId) return 'idle';
    const conn = this.activeConnections.get(connectionId);
    return conn ? conn.state : 'idle';
  }

  onEvent(callback: TransportEventListener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private emitEvent(event: TransportEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[MockWiFiTransport] listener error:', err);
      }
    });
  }

  destroy(): void {
    this.transferTimers.forEach((timer) => clearInterval(timer));
    this.transferTimers.clear();
    this.transferStates.clear();
    this.activeConnections.clear();
    this.listeners.clear();
  }
}
