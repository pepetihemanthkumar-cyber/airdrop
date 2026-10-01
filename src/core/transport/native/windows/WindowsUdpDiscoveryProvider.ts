/**
 * NearShare Windows Local LAN UDP Discovery Provider
 *
 * Implements local network peer discovery via UDP multicast for Windows desktop runtimes (Wi-Fi / LAN Mode).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. LAN Wi-Fi Mode Only: Operates over router-provided local subnets. NOT Direct Mode.
 * 2. Strict Metadata Boundary: Disseminates only non-sensitive device info (ID, name, platform, port).
 *    Never broadcasts private keys, tokens, file paths, PINs, or secrets.
 * 3. Security Isolation: Discovered peers are NEVER automatically trusted, paired, or authorized.
 *    Any subsequent transfer MUST proceed through TCP -> SecureTransportSession -> Pairing/Auth.
 * 4. Device Lifecycle Management:
 *    DISCOVERED -> VISIBLE -> STALE -> REMOVED.
 *    Devices are keyed by stable deviceId (never IP address).
 */

import {
  DISCOVERY_PROTOCOL_NAME,
  DISCOVERY_PROTOCOL_VERSION,
  DEFAULT_DISCOVERY_MULTICAST_GROUP,
  DEFAULT_DISCOVERY_PORT,
  DEFAULT_ADVERTISEMENT_TTL_MS,
  STALE_DEVICE_TIMEOUT_MS,
  REMOVE_DEVICE_TIMEOUT_MS,
  type NearShareDiscoveryPacket,
  validateDiscoveryPacket,
} from '../../../protocol/discovery/DiscoveryProtocol';
import {
  isTauriRuntime,
  startUdpDiscovery,
  stopUdpDiscovery,
  sendDiscoveryAdvertisement,
  onUdpPeerDiscovered,
  onUdpPeerLost,
  type IpcDiscoveredPeer,
} from '../../../native/tauri/TauriIpc';

export type PeerDiscoveryState = 'discovered' | 'visible' | 'stale' | 'removed';

export interface WindowsDiscoveredPeer {
  deviceId: string;
  profileId?: string;
  deviceName: string;
  platform: string;
  ipAddress: string;
  tcpPort: number;
  capabilities: string[];
  state: PeerDiscoveryState;
  firstSeen: number;
  lastSeen: number;
  expiresAt: number;
  protocolVersion?: string;
}

export interface WindowsUdpDiscoveryConfig {
  multicastGroup: string;
  port: number;
  advertisementIntervalMs: number;
  staleTimeoutMs: number;
  removeTimeoutMs: number;
  sweepIntervalMs: number;
}

export const DEFAULT_WINDOWS_DISCOVERY_CONFIG: WindowsUdpDiscoveryConfig = {
  multicastGroup: DEFAULT_DISCOVERY_MULTICAST_GROUP,
  port: DEFAULT_DISCOVERY_PORT,
  advertisementIntervalMs: 5_000,
  staleTimeoutMs: STALE_DEVICE_TIMEOUT_MS,
  removeTimeoutMs: REMOVE_DEVICE_TIMEOUT_MS,
  sweepIntervalMs: 3_000,
};

export interface WindowsUdpDiscoveryProvider {
  readonly isRunning: boolean;
  readonly status: 'notImplemented' | 'mockOnly' | 'active';
  readonly config: WindowsUdpDiscoveryConfig;

  startDiscovery(config?: Partial<WindowsUdpDiscoveryConfig>): Promise<void>;
  stopDiscovery(): Promise<void>;
  announcePresence(localTcpPort: number, localDevice?: Partial<NearShareDiscoveryPacket>): Promise<void>;
  getDiscoveredPeers(): WindowsDiscoveredPeer[];
  processIncomingPacket(raw: unknown, remoteIp?: string): { accepted: boolean; error?: string; peer?: WindowsDiscoveredPeer };
  sweepStaleDevices(): string[];
  onPeerDiscovered(listener: (peer: WindowsDiscoveredPeer) => void): () => void;
  onPeerUpdated(listener: (peer: WindowsDiscoveredPeer) => void): () => void;
  onPeerLost(listener: (deviceId: string) => void): () => void;
  destroy(): void;
}

/**
 * Concrete implementation of the Windows UDP Discovery Provider.
 */
export class RealWindowsUdpDiscoveryProvider implements WindowsUdpDiscoveryProvider {
  readonly config: WindowsUdpDiscoveryConfig;
  private running = false;
  private peers: Map<string, WindowsDiscoveredPeer> = new Map();
  private discoveredListeners: Set<(peer: WindowsDiscoveredPeer) => void> = new Set();
  private updatedListeners: Set<(peer: WindowsDiscoveredPeer) => void> = new Set();
  private lostListeners: Set<(deviceId: string) => void> = new Set();

  private sweepTimer: any = null;
  private advertTimer: any = null;
  private unlistenIpcDiscovered: (() => void) | null = null;
  private unlistenIpcLost: (() => void) | null = null;
  private localAdvertPacket: NearShareDiscoveryPacket | null = null;

  constructor(config?: Partial<WindowsUdpDiscoveryConfig>) {
    this.config = { ...DEFAULT_WINDOWS_DISCOVERY_CONFIG, ...config };
  }

  get isRunning(): boolean {
    return this.running;
  }

  get status(): 'active' | 'mockOnly' {
    return isTauriRuntime() ? 'active' : 'mockOnly';
  }

  /**
   * Starts local UDP discovery listener and stale eviction loop.
   */
  async startDiscovery(config?: Partial<WindowsUdpDiscoveryConfig>): Promise<void> {
    if (this.running) return;

    if (config) {
      Object.assign(this.config, config);
    }

    this.running = true;

    // 1. If running inside Tauri host, invoke native UDP discovery command
    if (isTauriRuntime()) {
      try {
        await startUdpDiscovery(this.config.multicastGroup, this.config.port);

        this.unlistenIpcDiscovered = await onUdpPeerDiscovered((peer) => {
          this.handleIpcDiscovered(peer);
        });

        this.unlistenIpcLost = await onUdpPeerLost((evt) => {
          this.removePeer(evt.deviceId, 'ipc_lost');
        });
      } catch (err) {
        console.warn('[RealWindowsUdpDiscoveryProvider] Failed to start native UDP socket:', err);
      }
    }

    // 2. Start stale sweep timer
    this.sweepTimer = setInterval(() => {
      this.sweepStaleDevices();
    }, this.config.sweepIntervalMs);
  }

  /**
   * Stops UDP discovery and clears all tracking.
   */
  async stopDiscovery(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }

    if (this.advertTimer) {
      clearInterval(this.advertTimer);
      this.advertTimer = null;
    }

    if (this.unlistenIpcDiscovered) {
      this.unlistenIpcDiscovered();
      this.unlistenIpcDiscovered = null;
    }

    if (this.unlistenIpcLost) {
      this.unlistenIpcLost();
      this.unlistenIpcLost = null;
    }

    if (isTauriRuntime()) {
      try {
        await stopUdpDiscovery();
      } catch (err) {
        console.warn('[RealWindowsUdpDiscoveryProvider] Failed to stop native UDP socket:', err);
      }
    }

    this.peers.clear();
    this.localAdvertPacket = null;
  }

  /**
   * Broadcasts local presence advertisement to the LAN multicast group.
   */
  async announcePresence(
    localTcpPort: number,
    localDevice?: Partial<NearShareDiscoveryPacket>
  ): Promise<void> {
    if (!this.running) {
      throw new Error('DISCOVERY_NOT_RUNNING: Cannot announce presence while discovery is stopped');
    }

    if (localTcpPort <= 0 || localTcpPort > 65535) {
      throw new Error(`INVALID_TCP_PORT: Invalid TCP port ${localTcpPort}`);
    }

    const now = Date.now();
    const packet: NearShareDiscoveryPacket = {
      protocol: DISCOVERY_PROTOCOL_NAME,
      version: DISCOVERY_PROTOCOL_VERSION,
      type: 'DISCOVERY_ADVERTISEMENT',
      deviceId: localDevice?.deviceId ?? `dev_win_${now.toString(36)}`,
      profileId: localDevice?.profileId,
      deviceName: localDevice?.deviceName ?? 'Windows Node',
      platform: localDevice?.platform ?? 'windows',
      capabilities: localDevice?.capabilities ?? ['wifi'],
      tcpPort: localTcpPort,
      timestamp: now,
      expiresAt: now + DEFAULT_ADVERTISEMENT_TTL_MS,
    };

    const validation = validateDiscoveryPacket(packet);
    if (!validation.valid || !validation.packet) {
      throw new Error(`INVALID_ADVERTISEMENT: ${validation.error}`);
    }

    this.localAdvertPacket = validation.packet;

    if (isTauriRuntime()) {
      await sendDiscoveryAdvertisement(validation.packet);
    }
  }

  /**
   * Processes an incoming raw discovery packet from UDP wire or simulated source.
   */
  processIncomingPacket(
    raw: unknown,
    remoteIp: string = '127.0.0.1'
  ): { accepted: boolean; error?: string; peer?: WindowsDiscoveredPeer } {
    if (!this.running) {
      return { accepted: false, error: 'DISCOVERY_NOT_RUNNING' };
    }

    const validation = validateDiscoveryPacket(raw);
    if (!validation.valid || !validation.packet) {
      return { accepted: false, error: validation.error };
    }

    const packet = validation.packet;

    // Handle explicit goodbye
    if (packet.type === 'DISCOVERY_GOODBYE') {
      this.removePeer(packet.deviceId, 'goodbye_received');
      return { accepted: true };
    }

    // Ignore expired advertisement
    if (packet.expiresAt < Date.now()) {
      return { accepted: false, error: 'EXPIRED_ADVERTISEMENT' };
    }

    const existing = this.peers.get(packet.deviceId);
    const now = Date.now();

    if (existing) {
      // Update existing peer (Duplicate suppression & state refresh)
      existing.deviceName = packet.deviceName;
      existing.platform = packet.platform;
      existing.profileId = packet.profileId ?? existing.profileId;
      existing.ipAddress = remoteIp;
      existing.tcpPort = packet.tcpPort;
      existing.capabilities = packet.capabilities;
      existing.lastSeen = now;
      existing.expiresAt = packet.expiresAt;
      existing.state = 'visible';

      this.emitPeerUpdated(existing);
      return { accepted: true, peer: existing };
    } else {
      // Discovered new peer
      const newPeer: WindowsDiscoveredPeer = {
        deviceId: packet.deviceId,
        profileId: packet.profileId,
        deviceName: packet.deviceName,
        platform: packet.platform,
        ipAddress: remoteIp,
        tcpPort: packet.tcpPort,
        capabilities: packet.capabilities,
        state: 'discovered',
        firstSeen: now,
        lastSeen: now,
        expiresAt: packet.expiresAt,
      };

      this.peers.set(packet.deviceId, newPeer);
      newPeer.state = 'visible';

      this.emitPeerDiscovered(newPeer);
      return { accepted: true, peer: newPeer };
    }
  }

  /**
   * Sweeps peer cache and transitions stale/expired devices.
   */
  sweepStaleDevices(): string[] {
    const now = Date.now();
    const removedIds: string[] = [];

    for (const [deviceId, peer] of this.peers.entries()) {
      const ageMs = now - peer.lastSeen;

      if (ageMs >= this.config.removeTimeoutMs || now >= peer.expiresAt + 10_000) {
        peer.state = 'removed';
        this.peers.delete(deviceId);
        removedIds.push(deviceId);
        this.emitPeerLost(deviceId);
      } else if (ageMs >= this.config.staleTimeoutMs) {
        if (peer.state !== 'stale') {
          peer.state = 'stale';
          this.emitPeerUpdated(peer);
        }
      }
    }

    return removedIds;
  }

  getDiscoveredPeers(): WindowsDiscoveredPeer[] {
    return Array.from(this.peers.values()).filter((p) => p.state !== 'removed');
  }

  getLocalAdvertisement(): NearShareDiscoveryPacket | null {
    return this.localAdvertPacket;
  }

  private handleIpcDiscovered(ipcPeer: IpcDiscoveredPeer): void {
    const existing = this.peers.get(ipcPeer.deviceId);
    if (existing) {
      Object.assign(existing, ipcPeer);
      existing.lastSeen = Date.now();
      existing.state = 'visible';
      this.emitPeerUpdated(existing);
    } else {
      const peer: WindowsDiscoveredPeer = {
        ...ipcPeer,
        state: 'visible',
      };
      this.peers.set(peer.deviceId, peer);
      this.emitPeerDiscovered(peer);
    }
  }

  private removePeer(deviceId: string, _reason: string): void {
    if (this.peers.has(deviceId)) {
      const peer = this.peers.get(deviceId)!;
      peer.state = 'removed';
      this.peers.delete(deviceId);
      this.emitPeerLost(deviceId);
    }
  }

  onPeerDiscovered(listener: (peer: WindowsDiscoveredPeer) => void): () => void {
    this.discoveredListeners.add(listener);
    return () => this.discoveredListeners.delete(listener);
  }

  onPeerUpdated(listener: (peer: WindowsDiscoveredPeer) => void): () => void {
    this.updatedListeners.add(listener);
    return () => this.updatedListeners.delete(listener);
  }

  onPeerLost(listener: (deviceId: string) => void): () => void {
    this.lostListeners.add(listener);
    return () => this.lostListeners.delete(listener);
  }

  private emitPeerDiscovered(peer: WindowsDiscoveredPeer): void {
    this.discoveredListeners.forEach((l) => {
      try {
        l(peer);
      } catch (err) {
        console.error('[RealWindowsUdpDiscoveryProvider] Discovered listener error:', err);
      }
    });
  }

  private emitPeerUpdated(peer: WindowsDiscoveredPeer): void {
    this.updatedListeners.forEach((l) => {
      try {
        l(peer);
      } catch (err) {
        console.error('[RealWindowsUdpDiscoveryProvider] Updated listener error:', err);
      }
    });
  }

  private emitPeerLost(deviceId: string): void {
    this.lostListeners.forEach((l) => {
      try {
        l(deviceId);
      } catch (err) {
        console.error('[RealWindowsUdpDiscoveryProvider] Lost listener error:', err);
      }
    });
  }

  destroy(): void {
    this.stopDiscovery().catch(() => {});
    this.discoveredListeners.clear();
    this.updatedListeners.clear();
    this.lostListeners.clear();
    this.peers.clear();
  }
}

/**
 * Backwards-compatible alias for the mock fallback implementation.
 */
export class MockWindowsUdpDiscoveryProvider extends RealWindowsUdpDiscoveryProvider {
  override get status(): 'mockOnly' {
    return 'mockOnly';
  }

  /**
   * Helper for simulated development injection of discovered peers.
   */
  injectMockPeer(peer: Partial<WindowsDiscoveredPeer> & { deviceId: string; deviceName: string; ipAddress: string; tcpPort: number }): void {
    this.processIncomingPacket(
      {
        protocol: DISCOVERY_PROTOCOL_NAME,
        version: DISCOVERY_PROTOCOL_VERSION,
        type: 'DISCOVERY_ADVERTISEMENT',
        deviceId: peer.deviceId,
        profileId: peer.profileId || 'default',
        deviceName: peer.deviceName,
        platform: peer.platform || 'windows',
        capabilities: peer.capabilities || ['wifi'],
        tcpPort: peer.tcpPort,
        timestamp: Date.now(),
        expiresAt: peer.expiresAt || Date.now() + DEFAULT_ADVERTISEMENT_TTL_MS,
      },
      peer.ipAddress
    );
  }
}
