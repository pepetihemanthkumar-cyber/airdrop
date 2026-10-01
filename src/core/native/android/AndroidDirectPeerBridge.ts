/**
 * NearShare Android Direct Native Peer Bridge
 *
 * Implements the TypeScript boundary for Android native Wi-Fi Direct (WifiP2pManager)
 * and TCP socket streaming without exposing internal Java/Kotlin handles or raw
 * network addresses to React.
 */

import type { DirectDiscoveryProvider, DirectDiscoveryOptions, DirectDiscoveryEvent } from '../../transport/direct/DirectDiscovery';
import type { DirectPeer } from '../../transport/direct/DirectPeer';
import { clampDirectDistanceEstimate } from '../../transport/direct/DirectPeer';
import { DEFAULT_DIRECT_CAPABILITIES } from '../../transport/direct/DirectTransportCapabilities';
import type {
  AndroidDirectPeerInfo,
  AndroidDirectConnectionInfo,
  AndroidDirectEvent,
  AndroidDirectEventListener,
} from './AndroidDirectPeerTypes';
import {
  type AndroidDirectCapabilities,
  DEFAULT_ANDROID_DIRECT_CAPABILITIES,
} from './AndroidDirectCapabilities';

export class AndroidDirectPeerBridge implements DirectDiscoveryProvider {
  private static instance?: AndroidDirectPeerBridge;
  private scanning = false;
  private advertising = false;
  private discoveredPeers: Map<string, AndroidDirectPeerInfo> = new Map();
  private activeConnections: Map<string, AndroidDirectConnectionInfo> = new Map();
  private listeners: Set<AndroidDirectEventListener> = new Set();
  private discoveryListeners: Set<(event: DirectDiscoveryEvent) => void> = new Set();
  private isAndroidRuntime: boolean;
  private unlistenTauriEvents?: () => void;

  constructor(isAndroidRuntime = false) {
    this.isAndroidRuntime = isAndroidRuntime;
    this.initTauriListeners();
  }

  public static getInstance(isAndroidRuntime = false): AndroidDirectPeerBridge {
    if (!AndroidDirectPeerBridge.instance) {
      AndroidDirectPeerBridge.instance = new AndroidDirectPeerBridge(isAndroidRuntime);
    }
    return AndroidDirectPeerBridge.instance;
  }

  public get isScanning(): boolean {
    return this.scanning;
  }

  public get isAdvertising(): boolean {
    return this.advertising;
  }

  public getCapabilities(): AndroidDirectCapabilities {
    if (!this.isAndroidRuntime) {
      return {
        ...DEFAULT_ANDROID_DIRECT_CAPABILITIES,
        nativeSupport: 'requiresNative',
        supportsWifiDirect: 'requiresNative',
        supportsWifiAware: 'requiresNative',
        supportsPeerDiscovery: 'requiresNative',
        supportsBidirectionalStream: 'requiresNative',
        supportsTcp: 'requiresNative',
        supportsUdp: 'requiresNative',
      };
    }
    return DEFAULT_ANDROID_DIRECT_CAPABILITIES;
  }

  /**
   * Initializes the native Android Wi-Fi Direct controller.
   */
  public async init(displayName?: string, deviceId?: string): Promise<boolean> {
    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        return await (window as any).__TAURI__.core.invoke('direct_android_init', { displayName, deviceId });
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
   * Starts native Android Wi-Fi Direct advertising via DNS-SD service registration.
   */
  public async startAdvertising(serviceName = 'nearshare-p2p'): Promise<void> {
    this.advertising = true;

    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_android_start_advertising', { serviceName });
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
   * Stops native Android Wi-Fi Direct advertising.
   */
  public async stopAdvertising(): Promise<void> {
    this.advertising = false;

    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_android_stop_advertising');
      } catch (err) {
        console.warn('[AndroidDirectPeerBridge] Error stopping native advertiser:', err);
      }
    }

    this.emitEvent({
      type: 'advertiserStopped',
      timestamp: Date.now(),
    });
  }

  /**
   * Starts native Android peer discovery via WifiP2pManager.
   */
  public async startDiscovery(options?: DirectDiscoveryOptions): Promise<void> {
    const serviceType = options?.serviceType || 'nearshare-p2p';
    this.scanning = true;

    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_android_start_discovery', { serviceType });
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
      serviceType,
      timestamp: Date.now(),
    });

    this.emitDiscoveryEvent({
      type: 'started',
      mode: 'direct',
      timestamp: Date.now(),
    });
  }

  /**
   * Stops native Android peer discovery.
   */
  public async stopDiscovery(): Promise<void> {
    this.scanning = false;

    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_android_stop_discovery');
      } catch (err) {
        console.warn('[AndroidDirectPeerBridge] Error stopping native discovery:', err);
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
   * Connects to a discovered Android peer via native Wi-Fi Direct.
   */
  public async connect(peerId: string): Promise<AndroidDirectConnectionInfo> {
    const connectionId = `android-direct-${peerId}-${Date.now()}`;
    const now = Date.now();

    this.emitEvent({
      type: 'connectionStarted',
      peerId,
      timestamp: now,
    });

    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_android_connect', { peerId });
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

    const conn: AndroidDirectConnectionInfo = {
      connectionId,
      peerId,
      establishedAt: now,
      channelType: 'stream',
      isEncryptedTransport: true,
      groupRole: 'client',
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
  public async connectPeer(peerId: string): Promise<AndroidDirectConnectionInfo> {
    return this.connect(peerId);
  }

  /**
   * Disconnects an active direct session.
   */
  public async disconnect(connectionId: string): Promise<void> {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      this.activeConnections.delete(connectionId);

      if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
        try {
          await (window as any).__TAURI__.core.invoke('direct_android_disconnect', { peerId: conn.peerId });
        } catch (err) {
          console.warn('[AndroidDirectPeerBridge] Error disconnecting native peer:', err);
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
    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_android_disconnect', { peerId });
      } catch (err) {
        console.warn('[AndroidDirectPeerBridge] Error disconnecting native peer:', err);
      }
    }
  }

  /**
   * Opens a binary stream with the connected peer.
   */
  public async openStream(peerId: string, streamName = 'nearshare-stream'): Promise<string> {
    let connectionId = `android-stream-${peerId}-${Date.now()}`;

    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        connectionId = await (window as any).__TAURI__.core.invoke('direct_android_open_stream', { peerId, streamName });
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
    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        await (window as any).__TAURI__.core.invoke('direct_android_close_stream', { connectionId });
      } catch (err) {
        console.warn('[AndroidDirectPeerBridge] Error closing native stream:', err);
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
    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      sentLength = await (window as any).__TAURI__.core.invoke('direct_android_send_bytes', {
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
   * Queries the native connection state for an active connection ID.
   */
  public async getConnectionState(connectionId: string): Promise<string> {
    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        return await (window as any).__TAURI__.core.invoke('direct_android_get_connection_state', { connectionId });
      } catch {
        return 'disconnected';
      }
    }
    return this.activeConnections.has(connectionId) ? 'connected' : 'disconnected';
  }

  /**
   * Runs the native Android Wi-Fi Direct self-test.
   */
  public async selfTest(): Promise<boolean> {
    if (this.isAndroidRuntime && typeof window !== 'undefined' && (window as any).__TAURI__?.core?.invoke) {
      try {
        return await (window as any).__TAURI__.core.invoke('direct_android_self_test');
      } catch (err) {
        console.warn('[AndroidDirectPeerBridge] Self-test failed:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Returns domain-mapped DirectPeers for DirectDiscoveryProvider interface.
   */
  public getDiscoveredPeers(): DirectPeer[] {
    return Array.from(this.discoveredPeers.values()).map(this.mapAndroidPeerToDirectPeer);
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
   * Registers a native Android direct bridge event listener.
   */
  public onNativeEvent(listener: AndroidDirectEventListener): () => void {
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
  public handleNativePeerDiscovered(peer: AndroidDirectPeerInfo): void {
    this.discoveredPeers.set(peer.peerId, peer);
    this.emitEvent({
      type: 'peerDiscovered',
      peer,
      timestamp: Date.now(),
    });

    const directPeer = this.mapAndroidPeerToDirectPeer(peer);
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

  private mapAndroidPeerToDirectPeer(peer: AndroidDirectPeerInfo): DirectPeer {
    const cleanSuffix = peer.peerId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'PEER01';
    return {
      deviceId: peer.peerId,
      profileId: `NS-AND-${cleanSuffix}`,
      platform: 'Android',
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
    if (!this.isAndroidRuntime || typeof window === 'undefined') return;
    const tauriEvent = (window as any).__TAURI__?.event;
    if (!tauriEvent?.listen) return;

    const unlistens: Array<() => void> = [];

    tauriEvent.listen('direct_android_peer_discovered', (ev: { payload: AndroidDirectPeerInfo }) => {
      if (ev?.payload) this.handleNativePeerDiscovered(ev.payload);
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_android_peer_lost', (ev: { payload: { peerId: string } }) => {
      if (ev?.payload?.peerId) this.handleNativePeerLost(ev.payload.peerId);
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_android_connection_started', (ev: { payload: { peerId: string } }) => {
      if (ev?.payload?.peerId) {
        this.emitEvent({
          type: 'connectionStarted',
          peerId: ev.payload.peerId,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_android_connection_established', (ev: { payload: AndroidDirectConnectionInfo }) => {
      if (ev?.payload) {
        this.activeConnections.set(ev.payload.connectionId, ev.payload);
        this.emitEvent({
          type: 'connectionEstablished',
          connection: ev.payload,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_android_connection_failed', (ev: { payload: { peerId: string; error?: string } }) => {
      if (ev?.payload) {
        this.emitEvent({
          type: 'connectionFailed',
          peerId: ev.payload.peerId,
          error: ev.payload.error,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_android_connected', (ev: { payload: AndroidDirectConnectionInfo }) => {
      if (ev?.payload) {
        this.activeConnections.set(ev.payload.connectionId, ev.payload);
        this.emitEvent({
          type: 'connected',
          connection: ev.payload,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_android_connection_lost', (ev: { payload: { connectionId: string; peerId: string; reason?: string } }) => {
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

    tauriEvent.listen('direct_android_disconnected', (ev: { payload: { connectionId: string; peerId: string; reason?: string } }) => {
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

    tauriEvent.listen('direct_android_stream_opened', (ev: { payload: { connectionId: string; peerId?: string; streamName?: string } }) => {
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

    tauriEvent.listen('direct_android_stream_closed', (ev: { payload: { connectionId: string } }) => {
      if (ev?.payload) {
        this.emitEvent({
          type: 'streamClosed',
          connectionId: ev.payload.connectionId,
          timestamp: Date.now(),
        });
      }
    }).then((unlisten: () => void) => unlistens.push(unlisten));

    tauriEvent.listen('direct_android_data', (ev: { payload: { connectionId: string; peerId?: string; payloadBase64: string; byteLength: number } }) => {
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

    tauriEvent.listen('direct_android_send_completed', (ev: { payload: { peerId: string; bytesSent: number } }) => {
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

  private emitEvent(event: AndroidDirectEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[AndroidDirectPeerBridge] Listener error:', err);
      }
    });
  }

  private emitDiscoveryEvent(event: DirectDiscoveryEvent): void {
    this.discoveryListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[AndroidDirectPeerBridge] Discovery listener error:', err);
      }
    });
  }
}
