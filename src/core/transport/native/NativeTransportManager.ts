/**
 * NearShare Native Transport Manager
 *
 * Singleton orchestrator coordinating low-level transport bridges, discovery requests,
 * and physical connection telemetry. Independent from React.
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
import { NativeTransportRegistry } from './NativeTransportRegistry';

export class NativeTransportManager {
  private static instance: NativeTransportManager | null = null;
  private bridge: NativeTransportBridge;

  private constructor(customBridge?: NativeTransportBridge) {
    this.bridge = customBridge ?? NativeTransportRegistry.getInstance().getBridge();
  }

  public static getInstance(customBridge?: NativeTransportBridge): NativeTransportManager {
    if (!NativeTransportManager.instance) {
      NativeTransportManager.instance = new NativeTransportManager(customBridge);
    }
    return NativeTransportManager.instance;
  }

  public setBridge(bridge: NativeTransportBridge): void {
    this.bridge = bridge;
  }

  public getBridge(): NativeTransportBridge {
    return this.bridge;
  }

  public getCapabilities(): NativeTransportCapabilities {
    return this.bridge.getCapabilities();
  }

  public async startDiscovery(mode: TransportMode): Promise<NativeDiscoveryDevice[]> {
    return this.bridge.startDiscovery(mode);
  }

  public async stopDiscovery(): Promise<void> {
    return this.bridge.stopDiscovery();
  }

  public async connect(device: NativeDiscoveryDevice): Promise<NativeConnection> {
    return this.bridge.connect(device);
  }

  public async disconnect(connection: NativeConnection): Promise<void> {
    return this.bridge.disconnect(connection);
  }

  public async openSession(connection: NativeConnection): Promise<NativeTransportSession> {
    return this.bridge.openSession(connection);
  }

  public async closeSession(session: NativeTransportSession): Promise<void> {
    return this.bridge.closeSession(session);
  }

  public async sendBytes(session: NativeTransportSession, chunk: NativeTransportChunk): Promise<number> {
    return this.bridge.sendBytes(session, chunk);
  }

  public async receiveBytes(session: NativeTransportSession): Promise<NativeTransportChunk | null> {
    return this.bridge.receiveBytes(session);
  }

  public async pauseTransfer(session: NativeTransportSession, transferId: string): Promise<void> {
    return this.bridge.pauseTransfer(session, transferId);
  }

  public async resumeTransfer(session: NativeTransportSession, transferId: string): Promise<void> {
    return this.bridge.resumeTransfer(session, transferId);
  }

  public async cancelTransfer(session: NativeTransportSession, transferId: string): Promise<void> {
    return this.bridge.cancelTransfer(session, transferId);
  }

  public async getConnectionMetrics(connection: NativeConnection): Promise<NativeConnectionMetrics> {
    return this.bridge.getConnectionMetrics(connection);
  }

  public static resetInstance(): void {
    NativeTransportManager.instance = null;
  }
}
