/**
 * NearShare Mock Native Transport Bridge
 *
 * In-memory simulated transport bridge executing peer discovery, connections,
 * transport sessions, and chunk transmission without physical network hardware.
 */

import type { TransportMode } from '../../types';
import type { NativeTransportBridge } from '../NativeTransportBridge';
import type {
  NativeDiscoveryDevice,
  NativeConnection,
  NativeTransportSession,
  NativeTransportChunk,
  NativeConnectionMetrics,
} from '../NativeTransportTypes';
import {
  type NativeTransportCapabilities,
  DEFAULT_MOCK_TRANSPORT_CAPABILITIES,
} from '../NativeTransportCapabilities';

export class MockNativeTransportBridge implements NativeTransportBridge {
  readonly platform = 'mock';
  private capabilities: NativeTransportCapabilities = { ...DEFAULT_MOCK_TRANSPORT_CAPABILITIES };
  private activeConnections = new Map<string, NativeConnection>();
  private activeSessions = new Map<string, NativeTransportSession>();
  private pausedTransfers = new Set<string>();
  private listeners = new Map<string, Set<(data: unknown) => void>>();
  private totalBytesSent = 0;
  private totalBytesReceived = 0;

  getCapabilities(): NativeTransportCapabilities {
    return { ...this.capabilities };
  }

  async startDiscovery(mode: TransportMode): Promise<NativeDiscoveryDevice[]> {
    if (mode === 'direct') {
      return [
        {
          deviceId: 'dev_mock_direct_01',
          profileId: 'prof_mac_01',
          deviceName: 'Studio Display Node',
          platform: 'macOS',
          mode: 'direct',
          connectionQuality: 'Excellent',
          approximateDistance: 2.4,
          trustState: 'trusted',
        },
        {
          deviceId: 'dev_mock_direct_02',
          profileId: 'prof_droid_02',
          deviceName: 'Pixel 9 Pro Direct',
          platform: 'Android',
          mode: 'direct',
          connectionQuality: 'Good',
          approximateDistance: 6.8,
          trustState: 'paired',
        },
      ];
    } else {
      return [
        {
          deviceId: 'dev_mock_wifi_01',
          profileId: 'prof_win_01',
          deviceName: 'Syntra Workstation (LAN)',
          platform: 'Windows',
          mode: 'wifi',
          connectionQuality: 'Excellent',
          trustState: 'trusted',
        },
      ];
    }
  }

  async stopDiscovery(): Promise<void> {
    // Discovery stopped
  }

  async connect(device: NativeDiscoveryDevice): Promise<NativeConnection> {
    const connection: NativeConnection = {
      id: `conn_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      deviceId: device.deviceId,
      mode: device.mode,
      state: 'connected',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    this.activeConnections.set(connection.id, connection);
    this.emit('connectionChanged', connection);
    return connection;
  }

  async disconnect(connection: NativeConnection): Promise<void> {
    const conn = this.activeConnections.get(connection.id);
    if (conn) {
      conn.state = 'disconnected';
      conn.lastActivityAt = Date.now();
      this.emit('connectionChanged', conn);
      this.activeConnections.delete(connection.id);
    }
  }

  async openSession(connection: NativeConnection): Promise<NativeTransportSession> {
    const session: NativeTransportSession = {
      id: `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      connectionId: connection.id,
      protocolVersion: '1.0',
      securitySessionId: `sec_sess_${Date.now()}`,
      createdAt: Date.now(),
      state: 'active',
    };
    this.activeSessions.set(session.id, session);
    return session;
  }

  async closeSession(session: NativeTransportSession): Promise<void> {
    const s = this.activeSessions.get(session.id);
    if (s) {
      s.state = 'closed';
      this.activeSessions.delete(session.id);
    }
  }

  async sendBytes(session: NativeTransportSession, chunk: NativeTransportChunk): Promise<number> {
    const byteLen = typeof chunk.data === 'string' ? chunk.data.length : chunk.data.byteLength;
    this.totalBytesSent += byteLen;
    const s = this.activeSessions.get(session.id);
    if (s) {
      const conn = this.activeConnections.get(s.connectionId);
      if (conn) conn.lastActivityAt = Date.now();
    }
    return byteLen;
  }

  async receiveBytes(_session: NativeTransportSession): Promise<NativeTransportChunk | null> {
    return null;
  }

  async pauseTransfer(_session: NativeTransportSession, transferId: string): Promise<void> {
    this.pausedTransfers.add(transferId);
  }

  async resumeTransfer(_session: NativeTransportSession, transferId: string): Promise<void> {
    this.pausedTransfers.delete(transferId);
  }

  async cancelTransfer(_session: NativeTransportSession, transferId: string): Promise<void> {
    this.pausedTransfers.delete(transferId);
  }

  async getConnectionMetrics(connection: NativeConnection): Promise<NativeConnectionMetrics> {
    return {
      latency: connection.mode === 'direct' ? 12 : 28,
      throughput: connection.mode === 'direct' ? 68000000 : 34000000, // 68 MB/s direct vs 34 MB/s Wi-Fi
      signalQuality: 'Excellent',
      stability: 0.99,
      reconnectCount: 0,
      bytesSent: this.totalBytesSent,
      bytesReceived: this.totalBytesReceived,
      lastPacketAt: connection.lastActivityAt,
      approximateDistance: connection.mode === 'direct' ? 2.5 : undefined,
    };
  }

  subscribe(event: string, listener: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: string, data: unknown): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of Array.from(set)) {
        try {
          listener(data);
        } catch (err) {
          console.error('[MockNativeTransportBridge] listener error:', err);
        }
      }
    }
  }
}
