/**
 * NearShare Windows Direct Native Peer Bridge
 *
 * Implements the TypeScript boundary for the Windows native Wi-Fi Direct / StreamSocket
 * direct peer-to-peer transport. Interacts with Tauri native Rust IPC commands without exposing
 * internal WinRT handles, IP sockets, or raw filesystem paths to React.
 */

import type { DirectDiscoveryProvider, DirectDiscoveryOptions, DirectDiscoveryEvent } from '../../transport/direct/DirectDiscovery';
import type { DirectPeer } from '../../transport/direct/DirectPeer';
import { clampDirectDistanceEstimate } from '../../transport/direct/DirectPeer';
import { DEFAULT_DIRECT_CAPABILITIES } from '../../transport/direct/DirectTransportCapabilities';
import type {
  WindowsDirectPeerInfo,
  WindowsDirectConnectionInfo,
  WindowsDirectEvent,
  WindowsDirectEventListener,
} from './WindowsDirectPeerTypes';
import {
  type WindowsDirectCapabilities,
  DEFAULT_WINDOWS_DIRECT_CAPABILITIES,
} from './WindowsDirectCapabilities';

export class WindowsDirectPeerBridge implements DirectDiscoveryProvider {
  private static instance?: WindowsDirectPeerBridge;
  private scanning = false;
  private advertising = false;
  private discoveredPeers: Map<string, WindowsDirectPeerInfo> = new Map();
  private activeConnections: Map<string, WindowsDirectConnectionInfo> = new Map();
  private listeners: Set<WindowsDirectEventListener> = new Set();
  private discoveryListeners: Set<(event: DirectDiscoveryEvent) => void> = new Set();
  private isWindowsRuntime: boolean;
  private unlistenTauriEvents?: () => void;

  constructor(isWindowsRuntime = false) {
    this.isWindowsRuntime = isWindowsRuntime;
    this.initTauriListeners();
  }

  public static getInstance(isWindowsRuntime = false): WindowsDirectPeerBridge {
    if (!WindowsDirectPeerBridge.instance) {
      WindowsDirectPeerBridge.instance = new WindowsDirectPeerBridge(isWindowsRuntime);
    }
    return WindowsDirectPeerBridge.instance;
  }

  public get isScanning(): boolean {
    return this.scanning;
  }

  public get isAdvertising(): boolean {
    return this.advertising;
  }

  public getCapabilities(): WindowsDirectCapabilities {
    if (!this.isWindowsRuntime) {
      return {
        ...DEFAULT_WINDOWS_DIRECT_CAPABILITIES,
        nativeSupport: 'requiresNative',
        supportsWifiDirect: 'requiresNative',
        supportsPeerDiscovery: 'requiresNative',
        supportsBidirectionalStream: 'requiresNative',
        supportsTcp: 'requiresNative',
        supportsUdp: 'requiresNative',
      };
    }
    return DEFAULT_WINDOWS_DIRECT_CAPABILITIES;
  }

  /**
   * Initializes the native Windows Wi-Fi Direct controller.
   */
  public async init(displayName?: string, deviceId?: string): Promise<boolean> {
    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        return await (window as any).__TAURI__.core.invoke('direct_windows_init', { displayName, deviceId });
      } catch (err) {
        this.emitEvent({
          type: 'nativeError',
          code: 'INIT_FAILED',
          message: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        });
        throw err;
      }
    }
    return true;
  }

  /**
   * Starts native Wi-Fi Direct advertising (WiFiDirectAdvertisementPublisher).
   */
  public async startAdvertising(serviceName = 'nearshare-p2p'): Promise<void> {
    this.advertising = true;

    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_windows_start_advertising', { serviceName });
      } catch (err) {
        this.emitEvent({
          type: 'nativeError',
          code: 'ADVERTISE_START_FAILED',
          message: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        });
        throw err;
      }
    }

    this.emitEvent({
      type: 'advertiserStarted',
      serviceName,
      timestamp: Date.now(),
    });
  }

  /**
   * Stops native Wi-Fi Direct advertising.
   */
  public async stopAdvertising(): Promise<void> {
    this.advertising = false;

    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_windows_stop_advertising');
      } catch (err) {
        console.warn('[WindowsDirectPeerBridge] Error stopping native advertiser:', err);
      }
    }

    this.emitEvent({
      type: 'advertiserStopped',
      timestamp: Date.now(),
    });
  }

  /**
   * Starts native Windows peer discovery (DeviceWatcher / WiFiDirectDevice::GetDeviceSelector).
   */
  public async startDiscovery(options?: DirectDiscoveryOptions): Promise<void> {
    const serviceName = options?.serviceType || 'nearshare-p2p';
    this.scanning = true;

    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_windows_start_discovery', { serviceName });
      } catch (err) {
        this.emitEvent({
          type: 'nativeError',
          code: 'DISCOVERY_START_FAILED',
          message: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        });
        throw err;
      }
    }

    this.emitEvent({
      type: 'discoveryStarted',
      serviceName,
      timestamp: Date.now(),
    });

    this.emitDiscoveryEvent({
      type: 'started',
      mode: 'direct',
      timestamp: Date.now(),
    });
  }

  /**
   * Stops native Windows peer discovery.
   */
  public async stopDiscovery(): Promise<void> {
    this.scanning = false;

    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_windows_stop_discovery');
      } catch (err) {
        console.warn('[WindowsDirectPeerBridge] Error stopping native discovery:', err);
      }
    }

    this.emitEvent({
      type: 'discoveryStopped',
      timestamp: Date.now(),
    });

    this.emitDiscoveryEvent({
      type: 'stopped',
      timestamp: Date.now(),
    });
  }

  /**
   * Connects to a discovered Windows peer via native Wi-Fi Direct channel.
   */
  public async connect(peerId: string): Promise<WindowsDirectConnectionInfo> {
    const connectionId = `win-direct-${peerId}-${Date.now()}`;
    const now = Date.now();

    this.emitEvent({
      type: 'connectionStarted',
      peerId,
      timestamp: now,
    });

    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_windows_connect', { peerId });
      } catch (err) {
        this.emitEvent({
          type: 'connectionFailed',
          peerId,
          error: err instanceof Error ? err.message : String(err),
          timestamp: now,
        });
        this.emitEvent({
          type: 'nativeError',
          code: 'CONNECTION_FAILED',
          message: err instanceof Error ? err.message : String(err),
          timestamp: now,
        });
        throw err;
      }
    }

    const conn: WindowsDirectConnectionInfo = {
      connectionId,
      peerId,
      establishedAt: now,
      channelType: 'stream',
      isEncryptedTransport: true,
      negotiatedRole: 'client',
    };

    this.activeConnections.set(connectionId, conn);

    this.emitEvent({
      type: 'connectionEstablished',
      connection: conn,
      timestamp: now,
    });

    this.emitEvent({
      type: 'connected',
      connection: conn,
      timestamp: now,
    });

    return conn;
  }

  /**
   * Alias for connect() meeting standard interface conventions.
   */
  public async connectPeer(peerId: string): Promise<WindowsDirectConnectionInfo> {
    return this.connect(peerId);
  }

  /**
   * Disconnects an active direct session by connectionId.
   */
  public async disconnect(connectionId: string): Promise<void> {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      this.activeConnections.delete(connectionId);

      if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
        try {
          await (window as any).__TAURI__.core.invoke('direct_windows_disconnect', { peerId: conn.peerId });
        } catch (err) {
          console.warn('[WindowsDirectPeerBridge] Error disconnecting native peer:', err);
        }
      }

      this.emitEvent({
        type: 'connectionLost',
        connectionId,
        peerId: conn.peerId,
        reason: 'Client requested disconnect',
        timestamp: Date.now(),
      });

      this.emitEvent({
        type: 'disconnected',
        connectionId,
        peerId: conn.peerId,
        reason: 'Client requested disconnect',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Disconnects an active direct session by peerId.
   */
  public async disconnectPeer(peerId: string): Promise<void> {
    for (const [connId, conn] of this.activeConnections.entries()) {
      if (conn.peerId === peerId) {
        await this.disconnect(connId);
        return;
      }
    }
    // If not found in map, trigger native disconnect anyway
    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_windows_disconnect', { peerId });
      } catch (err) {
        console.warn('[WindowsDirectPeerBridge] Error disconnecting native peer:', err);
      }
    }
  }

  /**
   * Queries the native connection state for an active connection ID.
   */
  public async getConnectionState(connectionId: string): Promise<string> {
    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        return await (window as any).__TAURI__.core.invoke('direct_windows_get_connection_state', { connectionId });
      } catch {
        return 'disconnected';
      }
    }
    return this.activeConnections.has(connectionId) ? 'connected' : 'disconnected';
  }

  /**
   * Opens a binary stream with the connected peer.
   */
  public async openStream(peerId: string, streamName = 'nearshare-stream'): Promise<string> {
    let connectionId = `win-stream-${peerId}-${Date.now()}`;

    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        connectionId = await (window as any).__TAURI__.core.invoke('direct_windows_open_stream', { peerId, streamName });
      } catch (err) {
        this.emitEvent({
          type: 'nativeError',
          code: 'STREAM_OPEN_FAILED',
          message: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        });
        throw err;
      }
    }

    this.emitEvent({
      type: 'streamOpened',
      connectionId,
      peerId,
      streamName,
      timestamp: Date.now(),
    });

    return connectionId;
  }

  /**
   * Closes a native direct stream.
   */
  public async closeStream(connectionId: string): Promise<void> {
    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_windows_close_stream', { connectionId });
      } catch (err) {
        console.warn('[WindowsDirectPeerBridge] Error closing native stream:', err);
      }
    }

    this.emitEvent({
      type: 'streamClosed',
      connectionId,
      timestamp: Date.now(),
    });
  }

  /**
   * Sends raw payload bytes over the native Wi-Fi Direct stream channel.
   */
  public async sendBytes(peerId: string, payloadBase64: string): Promise<number> {
    let sentLength = payloadBase64.length;
    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      sentLength = await (window as any).__TAURI__.core.invoke('direct_windows_send_bytes', {
        peerId,
        payloadBase64,
      });
    }

    this.emitEvent({
      type: 'sendCompleted',
      peerId,
      bytesSent: sentLength,
      timestamp: Date.now(),
    });

    return sentLength;
  }

  /**
   * Runs the native WinRT Wi-Fi Direct self-test.
   */
  public async selfTest(): Promise<boolean> {
    if (this.isWindowsRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        return await (window as any).__TAURI__.core.invoke('direct_windows_self_test');
      } catch (err) {
        console.warn('[WindowsDirectPeerBridge] Self-test failed:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Returns domain-mapped DirectPeers for DirectDiscoveryProvider interface.
   */
  public getDiscoveredPeers(): DirectPeer[] {
    return Array.from(this.discoveredPeers.values()).map(this.mapWindowsPeerToDirectPeer);
  }

  /**
   * Registers a direct discovery event listener.
   */
  public onEvent(listener: (event: DirectDiscoveryEvent) => void): () => void {
    this.discoveryListeners.add(listener);
    return () => {
      this.discoveryListeners.delete(listener);
    };
  }

  /**
   * Registers a native Windows direct bridge event listener.
   */
  public onNativeEvent(listener: WindowsDirectEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Cleans up resources.
   */
  public destroy(): void {
    this.scanning = false;
    this.advertising = false;
    this.discoveredPeers.clear();
    this.activeConnections.clear();
    this.listeners.clear();
    this.discoveryListeners.clear();
    if (this.unlistenTauriEvents) {
      this.unlistenTauriEvents();
    }
  }

  /**
   * Injects a discovered peer into bridge state.
   */
  public handleNativePeerDiscovered(peer: WindowsDirectPeerInfo): void {
    this.discoveredPeers.set(peer.peerId, peer);
    this.emitEvent({
      type: 'peerDiscovered',
      peer,
      timestamp: Date.now(),
    });

    const directPeer = this.mapWindowsPeerToDirectPeer(peer);
    this.emitDiscoveryEvent({
      type: 'peerDiscovered',
      peer: directPeer,
      timestamp: Date.now(),
    });
  }

  public handleNativePeerLost(peerId: string): void {
    this.discoveredPeers.delete(peerId);
    this.emitEvent({
      type: 'peerLost',
      peerId,
      timestamp: Date.now(),
    });

    this.emitDiscoveryEvent({
      type: 'peerLost',
      deviceId: peerId,
      timestamp: Date.now(),
    });
  }

  private mapWindowsPeerToDirectPeer(peer: WindowsDirectPeerInfo): DirectPeer {
    const cleanSuffix = peer.peerId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'PEER01';
    return {
      deviceId: peer.peerId,
      profileId: `NS-WIN-${cleanSuffix}`,
      platform: 'Windows',
      deviceName: peer.displayName,
      ownerName: 'Nearby User',
      username: `@${peer.displayName.toLowerCase().replace(/\s+/g, '_')}`,
      avatar: peer.displayName.charAt(0).toUpperCase(),
      capabilities: DEFAULT_DIRECT_CAPABILITIES,
      discoveryMethod: 'wifi_direct',
      connectionMethod: 'wifi_direct_socket',
      distanceEstimateMeters: clampDirectDistanceEstimate(peer.estimatedDistanceMeters),
      signalQuality: peer.rssi && peer.rssi > -65 ? 'Excellent' : 'Good',
      connectionState: peer.state,
      securityState: 'unpaired',
      lastSeenTimestamp: peer.discoveredAt,
    };
  }

  private initTauriListeners(): void {
    if (!this.isWindowsRuntime || typeof window === 'undefined') return;
    const tauriEvent = (window as any).__TAURI__?.event;
    if (!tauriEvent?.listen) return;

    const unlistens: Array<() => void> = [];

    tauriEvent.listen('direct_windows_peer_discovered', (ev: { payload: WindowsDirectPeerInfo }) => {
      if (ev?.payload) this.handleNativePeerDiscovered(ev.payload);
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_peer_lost', (ev: { payload: { peerId: string } }) => {
      if (ev?.payload?.peerId) this.handleNativePeerLost(ev.payload.peerId);
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_connection_started', (ev: { payload: { peerId: string } }) => {
      if (ev?.payload?.peerId) {
        this.emitEvent({
          type: 'connectionStarted',
          peerId: ev.payload.peerId,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_connection_established', (ev: { payload: WindowsDirectConnectionInfo }) => {
      if (ev?.payload) {
        this.activeConnections.set(ev.payload.connectionId, ev.payload);
        this.emitEvent({
          type: 'connectionEstablished',
          connection: ev.payload,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_connection_failed', (ev: { payload: { peerId: string; error?: string } }) => {
      if (ev?.payload) {
        this.emitEvent({
          type: 'connectionFailed',
          peerId: ev.payload.peerId,
          error: ev.payload.error,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_connected', (ev: { payload: WindowsDirectConnectionInfo }) => {
      if (ev?.payload) {
        this.activeConnections.set(ev.payload.connectionId, ev.payload);
        this.emitEvent({
          type: 'connected',
          connection: ev.payload,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_connection_lost', (ev: { payload: { connectionId: string; peerId: string; reason?: string } }) => {
      if (ev?.payload) {
        this.activeConnections.delete(ev.payload.connectionId);
        this.emitEvent({
          type: 'connectionLost',
          connectionId: ev.payload.connectionId,
          peerId: ev.payload.peerId,
          reason: ev.payload.reason,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_disconnected', (ev: { payload: { connectionId: string; peerId: string; reason?: string } }) => {
      if (ev?.payload) {
        this.activeConnections.delete(ev.payload.connectionId);
        this.emitEvent({
          type: 'disconnected',
          connectionId: ev.payload.connectionId,
          peerId: ev.payload.peerId,
          reason: ev.payload.reason,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_stream_opened', (ev: { payload: { connectionId: string; peerId?: string; streamName?: string } }) => {
      if (ev?.payload) {
        this.emitEvent({
          type: 'streamOpened',
          connectionId: ev.payload.connectionId,
          peerId: ev.payload.peerId,
          streamName: ev.payload.streamName,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_stream_closed', (ev: { payload: { connectionId: string } }) => {
      if (ev?.payload) {
        this.emitEvent({
          type: 'streamClosed',
          connectionId: ev.payload.connectionId,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_data', (ev: { payload: { connectionId: string; peerId?: string; payloadBase64: string; byteLength: number } }) => {
      if (ev?.payload) {
        this.emitEvent({
          type: 'dataReceived',
          connectionId: ev.payload.connectionId,
          peerId: ev.payload.peerId,
          payloadBase64: ev.payload.payloadBase64,
          byteLength: ev.payload.byteLength,
          timestamp: Date.now(),
        });
        this.emitEvent({
          type: 'bytesReceived',
          connectionId: ev.payload.connectionId,
          peerId: ev.payload.peerId,
          payloadBase64: ev.payload.payloadBase64,
          byteLength: ev.payload.byteLength,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_windows_send_completed', (ev: { payload: { peerId: string; bytesSent: number } }) => {
      if (ev?.payload) {
        this.emitEvent({
          type: 'sendCompleted',
          peerId: ev.payload.peerId,
          bytesSent: ev.payload.bytesSent,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    this.unlistenTauriEvents = () => {
      unlistens.forEach((u) => u());
    };
  }

  private emitEvent(event: WindowsDirectEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[WindowsDirectPeerBridge] Listener error:', err);
      }
    });
  }

  private emitDiscoveryEvent(event: DirectDiscoveryEvent): void {
    this.discoveryListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[WindowsDirectPeerBridge] Discovery listener error:', err);
      }
    });
  }
}
