/**
 * NearShare Native Transport Test Harness
 *
 * Provides a fully deterministic, controllable in-memory test environment for validating
 * low-level native transport lifecycle, fault recovery, backpressure, and security boundaries.
 *
 * NOTE: All tests executed with this harness are strictly labeled as DETERMINISTIC SIMULATION.
 * It does NOT claim physical hardware verification.
 */

import type { TransportMode } from '../types';
import type { NativeTransportBridge } from './NativeTransportBridge';
import type {
  NativeDiscoveryDevice,
  NativeConnection,
  NativeTransportSession,
  NativeTransportChunk,
  NativeConnectionMetrics,
} from './NativeTransportTypes';
import type { NativeTransportCapabilities } from './NativeTransportCapabilities';
import { NativeTransportLifecycle } from './NativeTransportLifecycle';

export interface HarnessFaultConfig {
  dropPackets?: boolean;
  duplicatePackets?: boolean;
  reorderPackets?: boolean;
  packetDelayMs?: number;
  ackDelayMs?: number;
  injectSecurityFailure?: boolean;
  injectTransportFailure?: boolean;
  disconnectOnChunkIndex?: number;
}

export class NativeTransportHarness implements NativeTransportBridge {
  public readonly platform = 'Harness (Deterministic Simulation)';
  public readonly lifecycle = new NativeTransportLifecycle();

  private discoveredDevices: NativeDiscoveryDevice[] = [];
  private activeConnections: Map<string, NativeConnection> = new Map();
  private activeSessions: Map<string, NativeTransportSession> = new Map();
  private receivedChunks: NativeTransportChunk[] = [];
  private eventListeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private faultConfig: HarnessFaultConfig = {};
  private chunkCounter = 0;
  private totalBytesTransferred = 0;

  constructor(initialDevices?: NativeDiscoveryDevice[]) {
    if (initialDevices) {
      this.discoveredDevices = [...initialDevices];
    }
  }

  public setFaultConfig(config: HarnessFaultConfig): void {
    this.faultConfig = { ...this.faultConfig, ...config };
  }

  public clearFaultConfig(): void {
    this.faultConfig = {};
  }

  public getCapabilities(): NativeTransportCapabilities {
    return {
      directNearby: 'supported',
      localNetwork: 'supported',
      bluetooth: 'supported',
      wifiAware: 'notImplemented',
      wifiDirect: 'supported',
      multipeerConnectivity: 'supported',
      localNetworkDiscovery: 'supported',
      backgroundTransfer: 'supported',
      streaming: 'supported',
      pauseResume: 'supported',
      largeFileTransfer: 'supported',
    };
  }

  public async startDiscovery(mode: TransportMode): Promise<NativeDiscoveryDevice[]> {
    this.lifecycle.transition('discovering', `Started discovery for mode ${mode}`);
    return [...this.discoveredDevices];
  }

  public async stopDiscovery(): Promise<void> {
    this.lifecycle.transition('idle', 'Stopped discovery');
  }

  public addDiscoveredDevice(device: NativeDiscoveryDevice): void {
    this.discoveredDevices.push(device);
    this.emitEvent('deviceDiscovered', device);
  }

  public async connect(device: NativeDiscoveryDevice): Promise<NativeConnection> {
    this.lifecycle.transition('connecting', `Connecting to ${device.deviceName}`);

    if (this.faultConfig.injectSecurityFailure) {
      this.lifecycle.transition('failed', 'Security verification failed');
      throw new Error('SECURITY_ERROR: Identity token rejected during simulation');
    }

    if (this.faultConfig.injectTransportFailure) {
      this.lifecycle.transition('failed', 'Transport connection failed');
      throw new Error('TRANSPORT_ERROR: Socket binding rejected during simulation');
    }

    this.lifecycle.transition('authenticating', 'Authenticating peer');
    this.lifecycle.transition('connected', 'Connection established');

    const conn: NativeConnection = {
      id: `harness-conn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      deviceId: device.deviceId,
      mode: device.mode,
      state: 'connected',
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    this.activeConnections.set(conn.id, conn);
    this.emitEvent('connectionEstablished', conn);
    return conn;
  }

  public async disconnect(connection: NativeConnection): Promise<void> {
    this.activeConnections.delete(connection.id);
    this.lifecycle.transition('disconnected', `Disconnected ${connection.id}`);
    this.emitEvent('connectionLost', { connectionId: connection.id });
  }

  public async openSession(connection: NativeConnection): Promise<NativeTransportSession> {
    const session: NativeTransportSession = {
      id: `harness-sess-${Date.now()}`,
      connectionId: connection.id,
      protocolVersion: '1.0',
      state: 'active',
      createdAt: Date.now(),
    };
    this.activeSessions.set(session.id, session);
    this.lifecycle.transition('transferring', `Session ${session.id} opened`);
    return session;
  }

  public async closeSession(session: NativeTransportSession): Promise<void> {
    this.activeSessions.delete(session.id);
    this.lifecycle.transition('completed', `Session ${session.id} closed`);
  }

  public async sendBytes(
    _session: NativeTransportSession,
    chunk: NativeTransportChunk
  ): Promise<number> {
    this.chunkCounter++;

    if (
      this.faultConfig.disconnectOnChunkIndex !== undefined &&
      this.chunkCounter === this.faultConfig.disconnectOnChunkIndex
    ) {
      this.lifecycle.transition('reconnecting', 'Injected disconnect at chunk boundary');
      throw new Error('SIMULATED_DISCONNECT: Socket connection dropped at chunk boundary');
    }

    const byteLen = typeof chunk.data === 'string' ? chunk.data.length : chunk.data.byteLength;

    if (this.faultConfig.dropPackets && this.chunkCounter % 3 === 0) {
      // Simulate silent packet drop
      return byteLen;
    }

    if (this.faultConfig.duplicatePackets && this.chunkCounter % 2 === 0) {
      this.receivedChunks.push(chunk);
    }

    this.receivedChunks.push(chunk);
    this.totalBytesTransferred += byteLen;
    return byteLen;
  }

  public async receiveBytes(_session: NativeTransportSession): Promise<NativeTransportChunk | null> {
    if (this.receivedChunks.length === 0) {
      return null;
    }
    return this.receivedChunks.shift() ?? null;
  }

  public async pauseTransfer(session: NativeTransportSession, _transferId: string): Promise<void> {
    session.state = 'closing';
    this.lifecycle.transition('paused', 'Transfer paused by request');
  }

  public async resumeTransfer(session: NativeTransportSession, _transferId: string): Promise<void> {
    session.state = 'active';
    this.lifecycle.transition('transferring', 'Transfer resumed');
  }

  public async cancelTransfer(session: NativeTransportSession, _transferId: string): Promise<void> {
    session.state = 'closed';
    this.lifecycle.transition('cancelled', 'Transfer cancelled');
  }

  public async getConnectionMetrics(_connection: NativeConnection): Promise<NativeConnectionMetrics> {
    return {
      latency: 1.5,
      throughput: 250 * 1024 * 1024, // 250 MB/s logical simulation
      signalQuality: 'Excellent',
      stability: this.lifecycle.getState() === 'reconnecting' ? 0.5 : 1.0,
      reconnectCount: this.lifecycle.getState() === 'reconnecting' ? 1 : 0,
      bytesSent: this.totalBytesTransferred,
      bytesReceived: this.totalBytesTransferred,
      lastPacketAt: Date.now(),
    };
  }

  public getTotalBytesTransferred(): number {
    return this.totalBytesTransferred;
  }

  public subscribe(event: string, listener: (data: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    const set = this.eventListeners.get(event)!;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  private emitEvent(event: string, data: unknown): void {
    const set = this.eventListeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(data);
        } catch (err) {
          console.error(`[NativeTransportHarness] Listener error for ${event}:`, err);
        }
      });
    }
  }

  public getReceivedChunks(): readonly NativeTransportChunk[] {
    return [...this.receivedChunks];
  }

  public reset(): void {
    this.discoveredDevices = [];
    this.activeConnections.clear();
    this.activeSessions.clear();
    this.receivedChunks = [];
    this.eventListeners.clear();
    this.faultConfig = {};
    this.chunkCounter = 0;
    this.totalBytesTransferred = 0;
    this.lifecycle.reset();
  }
}
