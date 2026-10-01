/**
 * Mock Direct Nearby Transport Adapter
 *
 * DIRECT MODE SEMANTICS:
 * - "No existing Wi-Fi network / router / internet connection is required."
 * - Direct mode does NOT mean "Wi-Fi radio is disabled".
 * - On native platforms (macOS/iOS Multipeer/AWDL, Android Wi-Fi Direct/Nearby, Windows Wi-Fi Direct),
 *   a direct ad-hoc peer-to-peer link is created using peer wireless radios.
 * - 30m is the NearShare product UX boundary, not a guaranteed physical hardware distance.
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

export class MockDirectNearbyTransport implements TransportAdapter {
  readonly mode = 'direct' as const;

  private listeners: Set<TransportEventListener> = new Set();
  private activeConnections: Map<string, TransportConnection> = new Map();
  private transferTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private transferStates: Map<string, { paused: boolean; transferred: number; total: number }> =
    new Map();

  /**
   * Discovers direct nearby devices within 30m product boundary.
   */
  async discover(): Promise<TransportDevice[]> {
    this.emitEvent({
      type: 'discoveryStarted',
      mode: 'direct',
      timestamp: Date.now(),
    });

    const mockDevices: TransportDevice[] = [
      {
        id: 'dev-mac-01',
        profileId: 'NS-HEMANTH-8492',
        deviceName: "Hemanth's MacBook Air",
        platform: 'macOS',
        username: '@hemanth',
        avatar: 'H',
        mode: 'direct',
        signalQuality: 'Excellent',
        distanceMeters: 6,
        trusted: true,
        paired: true,
      },
      {
        id: 'dev-poco-01',
        profileId: 'NS-POCO-8812',
        deviceName: 'Poco F7',
        platform: 'Android',
        username: '@hemanth',
        avatar: 'H',
        mode: 'direct',
        signalQuality: 'Excellent',
        distanceMeters: 12,
        trusted: true,
        paired: true,
      },
      {
        id: 'dev-ipad-01',
        profileId: 'NS-ELENA-5512',
        deviceName: "Elena's iPad Pro",
        platform: 'iOS',
        username: '@elena',
        avatar: 'E',
        mode: 'direct',
        signalQuality: 'Good',
        distanceMeters: 18,
        trusted: true,
        paired: false,
      },
      {
        id: 'dev-alex-mbp',
        profileId: 'NS-ALEX-9921',
        deviceName: 'Alex MacBook Pro',
        platform: 'macOS',
        username: '@alex',
        avatar: 'A',
        mode: 'direct',
        signalQuality: 'Good',
        distanceMeters: 24,
        trusted: false,
        paired: false,
      },
    ];

    mockDevices.forEach((device) => {
      this.emitEvent({
        type: 'deviceDiscovered',
        device,
        timestamp: Date.now(),
      });
    });

    return mockDevices;
  }

  /**
   * Establishes a simulated direct peer session.
   */
  async connect(device: TransportDevice): Promise<TransportConnection> {
    this.emitEvent({
      type: 'connectionStarted',
      deviceId: device.id,
      mode: 'direct',
      timestamp: Date.now(),
    });

    // Simulate minor peer negotiation latency (150ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    const connectionId = `conn-direct-${device.id}-${Date.now()}`;
    const connection: TransportConnection = {
      connectionId,
      deviceId: device.id,
      mode: 'direct',
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
   * Disconnects active direct peer session.
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
        reason: 'User disconnected',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Sends payload over simulated direct transport link.
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

    // Tick progress simulation periodically
    const speedMBps = 44.5;
    const speedBytesPerSec = speedMBps * 1024 * 1024;
    const chunkSize = Math.round(speedBytesPerSec * 0.25); // 250ms chunks

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
      direct: true,
      wifi: false,
      discovery: true,
      resume: true,
      pause: true,
      streaming: true,
      folderTransfer: true,
      backgroundTransfer: false, // native direct p2p requires foreground connection
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
        console.error('[MockDirectNearbyTransport] listener error:', err);
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
