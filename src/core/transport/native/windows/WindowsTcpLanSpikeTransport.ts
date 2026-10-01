/**
 * NearShare Windows Native Local TCP Transport Spike
 *
 * Implements the platform-neutral TCP/LAN transport adapter for Windows desktop execution.
 *
 * ARCHITECTURAL BOUNDARY:
 * - TCP/LAN is a local Wi-Fi / LAN network transport ("Wi-Fi Mode").
 * - It is NOT "Direct Mode" (which requires routerless P2P like Wi-Fi Direct).
 * - Implements standard 4-byte big-endian framing with a 1 MiB payload ceiling.
 * - Sits below SecureTransportSession: does NOT implement custom encryption.
 * - Communicates with the Rust Tauri host via platform-neutral TauriIpc.
 */

import type { TransportAdapter } from '../../TransportAdapter';
import type {
  TransportDevice,
  TransportConnection,
  TransportCapability,
  TransportState,
} from '../../types';
import type { TransferPayload } from '../../../transfer/types';
import type { TransportEventListener, TransportEvent } from '../../events';
import { createTransportError } from '../../errors';
import {
  startTcpServer,
  stopTcpServer,
  connectTcp,
  sendTcpMessage,
  disconnectTcp,
  onTcpMessage,
  onTcpConnectionState,
  type TcpServerInfo,
  type TcpConnectResult,
  type TcpConnectionStateEvent,
} from '../../../native/tauri/TauriIpc';

export const MAX_WINDOWS_TCP_PAYLOAD_BYTES = 1024 * 1024; // 1 MiB

export interface WindowsSpikeMessagePacket {
  type: 'PING' | 'PONG' | 'TEST_PAYLOAD' | 'TEST_ACK' | 'RAW';
  payload?: Uint8Array;
  timestamp: number;
  sequence?: number;
}

export class WindowsTcpLanSpikeTransport implements TransportAdapter {
  readonly mode = 'wifi' as const;
  readonly transportName = 'WindowsTcpLanSpike';

  private activeServer: TcpServerInfo | null = null;
  private activeConnection: TransportConnection | null = null;
  private eventListeners: Set<TransportEventListener> = new Set();
  private unlistenMessage: (() => void) | null = null;
  private unlistenState: (() => void) | null = null;
  private pingResolvers: Map<string, (rttMs: number) => void> = new Map();
  private ackResolvers: Map<string, (ack: { verified: boolean; bytesReceived: number }) => void> = new Map();
  private rawListeners: Set<(connectionId: string, bytes: Uint8Array) => void> = new Set();

  constructor() {
    this.initEventListeners();
  }

  /**
   * Subscribes to all incoming raw framed bytes from any connection.
   */
  onRawBytes(listener: (connectionId: string, bytes: Uint8Array) => void): () => void {
    this.rawListeners.add(listener);
    return () => this.rawListeners.delete(listener);
  }

  private async initEventListeners() {
    this.unlistenMessage = await onTcpMessage((evt) => {
      this.handleIncomingBytes(evt.connectionId, evt.bytes);
    });

    this.unlistenState = await onTcpConnectionState((evt: TcpConnectionStateEvent) => {
      if (this.activeConnection && this.activeConnection.connectionId === evt.connectionId) {
        if (evt.state === 'disconnected') {
          const deviceId = this.activeConnection.deviceId;
          this.activeConnection.state = 'disconnected';
          this.emitEvent({
            type: 'connectionLost',
            connectionId: evt.connectionId,
            deviceId,
            timestamp: Date.now(),
          });
        } else if (evt.state === 'error') {
          this.activeConnection.state = 'failed';
          this.emitEvent({
            type: 'connectionFailed',
            deviceId: this.activeConnection.deviceId,
            error: createTransportError(
              'CONNECTION_FAILED',
              evt.message || 'Windows TCP socket error occurred',
              true,
              false
            ),
            timestamp: Date.now(),
          });
        }
      }
    });
  }

  /**
   * Starts a local or LAN TCP listener in the Rust host shell.
   */
  async startServer(port = 0, bindLan = false): Promise<TcpServerInfo> {
    const server = await startTcpServer(port, bindLan);
    if (!server) {
      throw new Error('TCP_SERVER_FAILED: Unable to start Windows native TCP server');
    }
    this.activeServer = server;
    return server;
  }

  /**
   * Stops the active TCP listener.
   */
  async stopServer(): Promise<boolean> {
    if (!this.activeServer) return false;
    const ok = await stopTcpServer(this.activeServer.serverId);
    this.activeServer = null;
    return ok;
  }

  getActiveServer(): TcpServerInfo | null {
    return this.activeServer;
  }

  /**
   * Discovers reachable devices.
   */
  async discover(): Promise<TransportDevice[]> {
    return [];
  }

  /**
   * Connects to a target host and port.
   */
  async connectToHost(host: string, port: number): Promise<TcpConnectResult> {
    if (!host || host.trim().length === 0) {
      throw new Error('TCP_CONNECT_FAILED: Target host address cannot be empty');
    }
    if (port <= 0 || port > 65535) {
      throw new Error(`TCP_CONNECT_FAILED: Invalid TCP port ${port}`);
    }

    const res = await connectTcp(host.trim(), port);
    if (!res) {
      throw new Error(`TCP_CONNECT_FAILED: Failed to connect to ${host}:${port}`);
    }

    const deviceId = `tcp_win_${host}_${port}`;
    this.activeConnection = {
      connectionId: res.connectionId,
      deviceId,
      mode: 'wifi',
      state: 'connected',
      connectedAt: Date.now(),
      lastUpdatedAt: Date.now(),
    };

    const targetDevice: TransportDevice = {
      id: deviceId,
      profileId: deviceId,
      deviceName: `Windows TCP Host (${host}:${port})`,
      platform: 'Windows',
      username: 'peer',
      avatar: 'laptop',
      mode: 'wifi',
      signalQuality: 'Excellent',
      trusted: false,
      paired: false,
    };

    this.emitEvent({
      type: 'connectionEstablished',
      device: targetDevice,
      connection: this.activeConnection,
      timestamp: Date.now(),
    });

    return res;
  }

  async connect(device: TransportDevice): Promise<TransportConnection> {
    const port = 49152;
    await this.connectToHost(device.id, port);
    if (!this.activeConnection) {
      throw new Error('TCP_CONNECT_FAILED: Failed to establish transport connection');
    }
    return this.activeConnection;
  }

  async disconnect(connectionId: string): Promise<void> {
    if (this.activeConnection && this.activeConnection.connectionId === connectionId) {
      this.activeConnection.state = 'disconnected';
    }
    await disconnectTcp(connectionId);
  }

  /**
   * Sends raw binary bytes (up to 1 MiB limit) over the active socket.
   */
  async sendBytes(connectionId: string, data: Uint8Array): Promise<number> {
    if (data.length > MAX_WINDOWS_TCP_PAYLOAD_BYTES) {
      throw new Error(
        `TCP_SEND_FAILED: Payload size (${data.length} bytes) exceeds maximum spike limit of 1 MiB`
      );
    }
    return await sendTcpMessage(connectionId, data);
  }

  /**
   * Sends a structured diagnostic PING message and awaits a PONG response.
   */
  async sendPing(connectionId: string): Promise<number> {
    const t0 = Date.now();
    const packet: WindowsSpikeMessagePacket = {
      type: 'PING',
      timestamp: t0,
    };

    const encoded = new TextEncoder().encode(JSON.stringify(packet));

    return new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pingResolvers.delete(connectionId);
        reject(new Error('TCP_PING_TIMEOUT: Remote peer did not respond with PONG within 5s'));
      }, 5000);

      this.pingResolvers.set(connectionId, (rttMs) => {
        clearTimeout(timeout);
        this.pingResolvers.delete(connectionId);
        resolve(rttMs);
      });

      this.sendBytes(connectionId, encoded).catch((err) => {
        clearTimeout(timeout);
        this.pingResolvers.delete(connectionId);
        reject(err);
      });
    });
  }

  /**
   * Sends a deterministic test payload (e.g. 64 KiB) and waits for remote verification ACK.
   */
  async sendTestPayload(
    connectionId: string,
    sizeBytes: number = 64 * 1024
  ): Promise<{ rttMs: number; bytesSent: number; verified: boolean }> {
    if (sizeBytes > MAX_WINDOWS_TCP_PAYLOAD_BYTES) {
      throw new Error(`Size exceeds 1 MiB spike limit: ${sizeBytes}`);
    }

    const t0 = Date.now();
    // Deterministic test data: byte[i] = i % 251
    const payload = new Uint8Array(sizeBytes);
    for (let i = 0; i < sizeBytes; i++) {
      payload[i] = i % 251;
    }

    // Header prefix (JSON metadata + newline + binary)
    const header = JSON.stringify({
      type: 'TEST_PAYLOAD',
      size: sizeBytes,
      checksumMod251: true,
      timestamp: t0,
    }) + '\n';

    const headerBytes = new TextEncoder().encode(header);
    const combined = new Uint8Array(headerBytes.length + payload.length);
    combined.set(headerBytes, 0);
    combined.set(payload, headerBytes.length);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ackResolvers.delete(connectionId);
        reject(new Error('TCP_ACK_TIMEOUT: Remote peer did not acknowledge test payload within 10s'));
      }, 10000);

      this.ackResolvers.set(connectionId, (ack) => {
        clearTimeout(timeout);
        this.ackResolvers.delete(connectionId);
        resolve({
          rttMs: Date.now() - t0,
          bytesSent: sizeBytes,
          verified: ack.verified,
        });
      });

      this.sendBytes(connectionId, combined).catch((err) => {
        clearTimeout(timeout);
        this.ackResolvers.delete(connectionId);
        reject(err);
      });
    });
  }

  private handleIncomingBytes(connectionId: string, bytes: Uint8Array) {
    // Notify raw protocol/byte listeners
    this.rawListeners.forEach((listener) => {
      try {
        listener(connectionId, bytes);
      } catch (err) {
        console.error('[WindowsTcpLanSpikeTransport] Raw listener error:', err);
      }
    });

    try {
      const text = new TextDecoder().decode(bytes);

      if (text.startsWith('{"type":')) {
        const newlineIdx = text.indexOf('\n');
        const jsonStr = newlineIdx !== -1 ? text.slice(0, newlineIdx) : text;
        const parsed = JSON.parse(jsonStr);

        if (parsed.type === 'PING') {
          // Auto-respond PONG
          const pongPacket = {
            type: 'PONG',
            pingTimestamp: parsed.timestamp,
            timestamp: Date.now(),
          };
          this.sendBytes(connectionId, new TextEncoder().encode(JSON.stringify(pongPacket))).catch(() => {});
        } else if (parsed.type === 'PONG') {
          const rtt = Date.now() - (parsed.pingTimestamp || parsed.timestamp);
          const resolver = this.pingResolvers.get(connectionId);
          if (resolver) resolver(rtt);
        } else if (parsed.type === 'TEST_PAYLOAD') {
          // Verify deterministic payload
          const headerLen = new TextEncoder().encode(jsonStr + '\n').length;
          const bodyBytes = bytes.slice(headerLen);
          let match = bodyBytes.length === parsed.size;
          for (let i = 0; i < bodyBytes.length && match; i++) {
            if (bodyBytes[i] !== (i % 251)) match = false;
          }

          // Send ACK
          const ackPacket = {
            type: 'TEST_ACK',
            verified: match,
            bytesReceived: bodyBytes.length,
            timestamp: Date.now(),
          };
          this.sendBytes(connectionId, new TextEncoder().encode(JSON.stringify(ackPacket))).catch(() => {});
        } else if (parsed.type === 'TEST_ACK') {
          const resolver = this.ackResolvers.get(connectionId);
          if (resolver) {
            resolver({
              verified: Boolean(parsed.verified),
              bytesReceived: parsed.bytesReceived || 0,
            });
          }
        }
      }
    } catch {
      // Non-JSON or raw binary payload
    }
  }

  async send(_payload: TransferPayload, _connection: TransportConnection): Promise<void> {
    throw new Error('NOT_IMPLEMENTED: Production TransferPayload sending is not part of TCP spike');
  }

  async pause(_transferId: string): Promise<void> {}
  async resume(_transferId: string): Promise<void> {}
  async cancel(_transferId: string): Promise<void> {}

  getCapabilities(): TransportCapability {
    return {
      direct: false,
      wifi: true,
      discovery: false,
      resume: false,
      pause: false,
      streaming: true,
      folderTransfer: false,
      backgroundTransfer: false,
    };
  }

  getConnectionState(connectionId?: string): TransportState {
    if (!this.activeConnection) return 'idle';
    if (connectionId && this.activeConnection.connectionId !== connectionId) {
      return 'disconnected';
    }
    return this.activeConnection.state;
  }

  onEvent(callback: TransportEventListener): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  private emitEvent(event: TransportEvent) {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[WindowsTcpLanSpikeTransport] Event listener threw:', err);
      }
    });
  }

  destroy(): void {
    if (this.unlistenMessage) this.unlistenMessage();
    if (this.unlistenState) this.unlistenState();
    if (this.activeServer) this.stopServer();
    if (this.activeConnection) this.disconnect(this.activeConnection.connectionId);
    this.eventListeners.clear();
  }
}
