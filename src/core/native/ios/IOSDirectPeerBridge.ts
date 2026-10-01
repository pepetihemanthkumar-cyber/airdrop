/**
 * NearShare iOS Direct Native Peer Bridge
 *
 * Implements the TypeScript boundary for iOS/iPadOS native MultipeerConnectivity
 * direct peer-to-peer communication without exposing internal Objective-C/Swift
 * objects or private sandbox paths to React.
 */

import type { DirectDiscoveryProvider, DirectDiscoveryOptions, DirectDiscoveryEvent } from '../../transport/direct/DirectDiscovery';
import type { DirectPeer } from '../../transport/direct/DirectPeer';
import { clampDirectDistanceEstimate } from '../../transport/direct/DirectPeer';
import { DEFAULT_DIRECT_CAPABILITIES } from '../../transport/direct/DirectTransportCapabilities';
import type {
  IOSDirectPeerInfo,
  IOSDirectConnectionInfo,
  IOSDirectEvent,
  IOSDirectEventListener,
} from './IOSDirectPeerTypes';
import {
  type IOSDirectCapabilities,
  DEFAULT_IOS_DIRECT_CAPABILITIES,
} from './IOSDirectCapabilities';

// Safely resolve Tauri invoke helper
type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
let tauriInvoke: TauriInvoke | null = null;

try {
  // @ts-expect-error - Dynamic Tauri runtime resolution
  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__?.invoke) {
    // @ts-expect-error - Dynamic Tauri invoke
    tauriInvoke = window.__TAURI_INTERNALS__.invoke;
  }
} catch {
  tauriInvoke = null;
}

export class IOSDirectPeerBridge implements DirectDiscoveryProvider {
  private static instance?: IOSDirectPeerBridge;
  private scanning = false;
  private advertising = false;
  private discoveredPeers: Map<string, IOSDirectPeerInfo> = new Map();
  private activeConnections: Map<string, IOSDirectConnectionInfo> = new Map();
  private listeners: Set<IOSDirectEventListener> = new Set();
  private discoveryListeners: Set<(event: DirectDiscoveryEvent) => void> = new Set();
  private isIOSRuntime: boolean;

  constructor(isIOSRuntime = false) {
    this.isIOSRuntime = isIOSRuntime;
  }

  public static getInstance(isIOSRuntime = false): IOSDirectPeerBridge {
    if (!IOSDirectPeerBridge.instance) {
      IOSDirectPeerBridge.instance = new IOSDirectPeerBridge(isIOSRuntime);
    }
    return IOSDirectPeerBridge.instance;
  }

  public get isScanning(): boolean {
    return this.scanning;
  }

  public get isAdvertising(): boolean {
    return this.advertising;
  }

  public getCapabilities(): IOSDirectCapabilities {
    if (!this.isIOSRuntime) {
      return {
        ...DEFAULT_IOS_DIRECT_CAPABILITIES,
        nativeSupport: 'requiresNative',
        supportsMultipeer: 'requiresNative',
        supportsPeerDiscovery: 'requiresNative',
        supportsBidirectionalStream: 'requiresNative',
      };
    }
    return DEFAULT_IOS_DIRECT_CAPABILITIES;
  }

  public async initialize(displayName?: string, deviceId?: string): Promise<boolean> {
    if (tauriInvoke && this.isIOSRuntime) {
      try {
        const res = await tauriInvoke<boolean>('direct_ios_init', { displayName, deviceId });
        return res;
      } catch (err) {
        this.emitEvent({
          type: 'nativeError',
          code: 'INIT_FAILED',
          message: String(err),
          timestamp: Date.now(),
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Starts native iOS peer browsing via MCNearbyServiceBrowser.
   */
  public async startDiscovery(options?: DirectDiscoveryOptions): Promise<void> {
    const serviceType = options?.serviceType || 'nearshare-p2p';
    this.scanning = true;

    if (tauriInvoke && this.isIOSRuntime) {
      try {
        await tauriInvoke<boolean>('direct_ios_start_discovery', { serviceType });
      } catch (err) {
        this.emitEvent({
          type: 'nativeError',
          code: 'DISCOVERY_START_FAILED',
          message: String(err),
          timestamp: Date.now(),
        });
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
   * Stops native iOS peer discovery.
   */
  public async stopDiscovery(): Promise<void> {
    this.scanning = false;

    if (tauriInvoke && this.isIOSRuntime) {
      try {
        await tauriInvoke<boolean>('direct_ios_stop_discovery');
      } catch (err) {
        console.error('[IOSDirectPeerBridge] Error stopping discovery:', err);
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
   * Starts native iOS service advertisement via MCNearbyServiceAdvertiser.
   */
  public async startAdvertising(serviceType = 'nearshare-p2p'): Promise<void> {
    this.advertising = true;

    if (tauriInvoke && this.isIOSRuntime) {
      try {
        await tauriInvoke<boolean>('direct_ios_start_advertising', { serviceType });
      } catch (err) {
        this.emitEvent({
          type: 'nativeError',
          code: 'ADVERTISING_START_FAILED',
          message: String(err),
          timestamp: Date.now(),
        });
      }
    }

    this.emitEvent({
      type: 'advertisingStarted',
      serviceType,
      timestamp: Date.now(),
    });
  }

  /**
   * Stops native iOS service advertisement.
   */
  public async stopAdvertising(): Promise<void> {
    this.advertising = false;

    if (tauriInvoke && this.isIOSRuntime) {
      try {
        await tauriInvoke<boolean>('direct_ios_stop_advertising');
      } catch (err) {
        console.error('[IOSDirectPeerBridge] Error stopping advertising:', err);
      }
    }

    this.emitEvent({
      type: 'advertisingStopped',
      timestamp: Date.now(),
    });
  }

  /**
   * Invites a discovered peer to an MCSession.
   */
  public async invitePeer(peerId: string): Promise<boolean> {
    this.emitEvent({
      type: 'connectionStarted',
      peerId,
      timestamp: Date.now(),
    });

    if (tauriInvoke && this.isIOSRuntime) {
      try {
        return await tauriInvoke<boolean>('direct_ios_invite_peer', { peerId });
      } catch (err) {
        this.emitEvent({
          type: 'connectionFailed',
          peerId,
          reason: String(err),
          timestamp: Date.now(),
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Accepts an incoming invitation from a remote peer.
   */
  public async acceptInvitation(invitationId: string): Promise<boolean> {
    if (tauriInvoke && this.isIOSRuntime) {
      try {
        return await tauriInvoke<boolean>('direct_ios_accept_invitation', { invitationId });
      } catch (err) {
        console.error('[IOSDirectPeerBridge] Error accepting invitation:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Rejects an incoming invitation from a remote peer.
   */
  public async rejectInvitation(invitationId: string): Promise<boolean> {
    if (tauriInvoke && this.isIOSRuntime) {
      try {
        return await tauriInvoke<boolean>('direct_ios_reject_invitation', { invitationId });
      } catch (err) {
        console.error('[IOSDirectPeerBridge] Error rejecting invitation:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Connects to a discovered iOS peer via MCSession invite.
   */
  public async connect(peerId: string): Promise<IOSDirectConnectionInfo> {
    const connectionId = `ios-direct-${peerId}-${Date.now()}`;
    const now = Date.now();

    if (tauriInvoke && this.isIOSRuntime) {
      try {
        const conn = await tauriInvoke<IOSDirectConnectionInfo>('direct_ios_connect', { peerId });
        this.activeConnections.set(conn.connectionId, conn);
        this.emitEvent({
          type: 'connectionEstablished',
          connection: conn,
          timestamp: now,
        });
        return conn;
      } catch (err) {
        this.emitEvent({
          type: 'connectionFailed',
          peerId,
          reason: String(err),
          timestamp: now,
        });
        throw err;
      }
    }

    const conn: IOSDirectConnectionInfo = {
      connectionId,
      peerId,
      establishedAt: now,
      channelType: 'multipeer_stream',
      isEncryptedTransport: true,
      sessionSecurity: 'required',
    };

    this.activeConnections.set(connectionId, conn);

    this.emitEvent({
      type: 'connectionEstablished',
      connection: conn,
      timestamp: now,
    });

    return conn;
  }

  /**
   * Disconnects an active direct session.
   */
  public async disconnect(connectionId: string): Promise<void> {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      this.activeConnections.delete(connectionId);

      if (tauriInvoke && this.isIOSRuntime) {
        try {
          await tauriInvoke<boolean>('direct_ios_disconnect', { connectionId });
        } catch (err) {
          console.error('[IOSDirectPeerBridge] Error disconnecting:', err);
        }
      }

      this.emitEvent({
        type: 'connectionLost',
        peerId: conn.peerId,
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
   * Opens an MCSession data stream to a connected peer.
   */
  public async openStream(peerId: string, streamName = 'nearshare-stream'): Promise<IOSDirectConnectionInfo> {
    if (tauriInvoke && this.isIOSRuntime) {
      const conn = await tauriInvoke<IOSDirectConnectionInfo>('direct_ios_open_stream', { peerId, streamName });
      this.activeConnections.set(conn.connectionId, conn);
      this.emitEvent({
        type: 'streamOpened',
        connectionId: conn.connectionId,
        peerId,
        streamName,
        timestamp: Date.now(),
      });
      return conn;
    }

    return this.connect(peerId);
  }

  /**
   * Closes an active stream channel.
   */
  public async closeStream(connectionId: string): Promise<void> {
    if (tauriInvoke && this.isIOSRuntime) {
      try {
        await tauriInvoke<boolean>('direct_ios_close_stream', { connectionId });
      } catch (err) {
        console.error('[IOSDirectPeerBridge] Error closing stream:', err);
      }
    }

    this.activeConnections.delete(connectionId);
    this.emitEvent({
      type: 'streamClosed',
      connectionId,
      timestamp: Date.now(),
    });
  }

  /**
   * Sends raw payload bytes over the native Multipeer NSOutputStream.
   */
  public async sendBytes(connectionId: string, payload: Uint8Array | string): Promise<number> {
    const bytes = typeof payload === 'string'
      ? Array.from(Uint8Array.from(atob(payload), c => c.charCodeAt(0)))
      : Array.from(payload);

    if (tauriInvoke && this.isIOSRuntime) {
      const bytesWritten = await tauriInvoke<number>('direct_ios_send_bytes', {
        connectionId,
        data: bytes,
      });

      this.emitEvent({
        type: 'sendCompleted',
        connectionId,
        bytesWritten,
        timestamp: Date.now(),
      });

      return bytesWritten;
    }

    if (!this.isIOSRuntime) {
      throw new Error('iOS Direct byte stream is not available outside iOS runtime');
    }

    return bytes.length;
  }

  /**
   * Receives raw bytes from the stream buffer.
   */
  public async receiveBytes(connectionId: string, maxBytes = 65536): Promise<Uint8Array> {
    if (tauriInvoke && this.isIOSRuntime) {
      const chunk = await tauriInvoke<number[]>('direct_ios_receive_bytes', { connectionId, maxBytes });
      return new Uint8Array(chunk);
    }
    return new Uint8Array(0);
  }

  /**
   * Returns domain-mapped DirectPeers for DirectDiscoveryProvider interface.
   */
  public getDiscoveredPeers(): DirectPeer[] {
    return Array.from(this.discoveredPeers.values()).map(this.mapIOSPeerToDirectPeer);
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
   * Registers a native iOS direct bridge event listener.
   */
  public onNativeEvent(listener: IOSDirectEventListener): () => void {
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
  }

  /**
   * Injects a discovered peer into bridge state.
   */
  public handleNativePeerDiscovered(peer: IOSDirectPeerInfo): void {
    this.discoveredPeers.set(peer.peerId, peer);
    this.emitEvent({
      type: 'peerDiscovered',
      peer,
      timestamp: Date.now(),
    });

    const directPeer = this.mapIOSPeerToDirectPeer(peer);
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

  public handleNativeInvitationReceived(invitationId: string, peerId: string, displayName: string): void {
    this.emitEvent({
      type: 'invitationReceived',
      invitationId,
      peerId,
      displayName,
      timestamp: Date.now(),
    });
  }

  private mapIOSPeerToDirectPeer(peer: IOSDirectPeerInfo): DirectPeer {
    return {
      deviceId: peer.peerId,
      profileId: `NS-IOS-${peer.peerId.slice(-6)}`,
      platform: 'iOS',
      deviceName: peer.displayName,
      ownerName: 'Nearby User',
      username: `@${peer.displayName.toLowerCase().replace(/\s+/g, '_')}`,
      avatar: peer.displayName.charAt(0).toUpperCase(),
      capabilities: DEFAULT_DIRECT_CAPABILITIES,
      discoveryMethod: 'awdl',
      connectionMethod: 'awdl_channel',
      distanceEstimateMeters: clampDirectDistanceEstimate(peer.estimatedDistanceMeters),
      signalQuality: 'Excellent',
      connectionState: peer.state,
      securityState: 'unpaired',
      lastSeenTimestamp: peer.discoveredAt,
    };
  }

  private emitEvent(event: IOSDirectEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[IOSDirectPeerBridge] Listener error:', err);
      }
    });
  }

  private emitDiscoveryEvent(event: DirectDiscoveryEvent): void {
    this.discoveryListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[IOSDirectPeerBridge] Discovery listener error:', err);
      }
    });
  }
}
