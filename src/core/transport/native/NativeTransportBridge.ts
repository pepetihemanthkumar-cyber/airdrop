/**
 * NearShare Native Transport Bridge Contract
 *
 * Defines the platform-neutral boundary interface between the core TransportManager
 * and the host platform's physical socket/radio/P2P networking drivers.
 *
 * ISOLATION RULES:
 * - Transport bridge manages raw byte delivery and socket connections.
 * - Transport bridge does NOT own file assembly (FileEngine owns assembly).
 * - Transport bridge does NOT own encryption algorithms (Security owns crypto).
 * - React UI never interacts directly with this bridge.
 */

import type { TransportMode } from '../types';
import type {
  NativeDiscoveryDevice,
  NativeConnection,
  NativeTransportSession,
  NativeTransportChunk,
  NativeConnectionMetrics,
} from './NativeTransportTypes';
import type { NativeTransportCapabilities } from './NativeTransportCapabilities';

export interface NativeTransportBridge {
  readonly platform: string;

  getCapabilities(): NativeTransportCapabilities;

  startDiscovery(mode: TransportMode): Promise<NativeDiscoveryDevice[]>;
  stopDiscovery(): Promise<void>;

  connect(device: NativeDiscoveryDevice): Promise<NativeConnection>;
  disconnect(connection: NativeConnection): Promise<void>;

  openSession(connection: NativeConnection): Promise<NativeTransportSession>;
  closeSession(session: NativeTransportSession): Promise<void>;

  sendBytes(session: NativeTransportSession, chunk: NativeTransportChunk): Promise<number>;
  receiveBytes(session: NativeTransportSession): Promise<NativeTransportChunk | null>;

  pauseTransfer(session: NativeTransportSession, transferId: string): Promise<void>;
  resumeTransfer(session: NativeTransportSession, transferId: string): Promise<void>;
  cancelTransfer(session: NativeTransportSession, transferId: string): Promise<void>;

  getConnectionMetrics(connection: NativeConnection): Promise<NativeConnectionMetrics>;

  subscribe(event: string, listener: (data: unknown) => void): () => void;
}
