/**
 * NearShare Native Transport Inspector (Development Only)
 *
 * Diagnostic panel to inspect active NativeTransportBridge state,
 * direct & Wi-Fi capabilities, UDP multicast peer discovery, telemetry metrics, and test runner.
 *
 * PALETTE: STRICT MONOCHROME #08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Radio,
  Play,
  CheckCircle2,
  XCircle,
  X,
  Layers,
  Activity,
  Wifi,
  Trash2,
  Send,
  Square,
  ShieldAlert,
} from 'lucide-react';
import { useNativeTransport } from '../context/NativeTransportContext';
import { useNativeShell } from '../context/NativeShellContext';
import { useSettings } from '../context/SettingsContext';
import type { TransportTestSuiteSummary } from '../core/transport/native/mock/mockNativeTransportTestSuite';
import {
  RealWindowsUdpDiscoveryProvider,
  type WindowsDiscoveredPeer,
} from '../core/transport/native/windows';
import {
  DEFAULT_DISCOVERY_MULTICAST_GROUP,
  DEFAULT_DISCOVERY_PORT,
} from '../core/protocol/discovery';

export const NativeTransportInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const { capabilities, runTestSuite } = useNativeTransport();
  const { platform, lifecycle } = useNativeShell();
  const { settings } = useSettings();
  const reducedMotion = settings.reducedMotion;

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'udp_discovery' | 'capabilities' | 'tests'>('udp_discovery');
  const [testSummary, setTestSummary] = useState<TransportTestSuiteSummary | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // UDP Discovery state
  const discoveryProviderRef = useRef<RealWindowsUdpDiscoveryProvider | null>(null);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<'active' | 'mockOnly' | 'stopped'>('stopped');
  const [discoveredPeers, setDiscoveredPeers] = useState<WindowsDiscoveredPeer[]>([]);
  const [localAdvertPort, setLocalAdvertPort] = useState<number>(52140);
  const [advertMessage, setAdvertMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize discovery provider instance
  useEffect(() => {
    if (!discoveryProviderRef.current) {
      discoveryProviderRef.current = new RealWindowsUdpDiscoveryProvider();
    }
    return () => {
      if (discoveryProviderRef.current) {
        discoveryProviderRef.current.destroy();
        discoveryProviderRef.current = null;
      }
    };
  }, []);

  // Sync discovered peers
  useEffect(() => {
    const provider = discoveryProviderRef.current;
    if (!provider) return;

    const unsubDiscovered = provider.onPeerDiscovered(() => {
      setDiscoveredPeers([...provider.getDiscoveredPeers()]);
    });

    const unsubUpdated = provider.onPeerUpdated(() => {
      setDiscoveredPeers([...provider.getDiscoveredPeers()]);
    });

    const unsubLost = provider.onPeerLost(() => {
      setDiscoveredPeers([...provider.getDiscoveredPeers()]);
    });

    return () => {
      unsubDiscovered();
      unsubUpdated();
      unsubLost();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      closeButtonRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleStartDiscovery = async () => {
    const provider = discoveryProviderRef.current;
    if (!provider) return;
    try {
      await provider.startDiscovery();
      setDiscoveryRunning(true);
      setDiscoveryStatus(provider.status);
      setAdvertMessage(null);
    } catch (err) {
      console.error('[NativeTransportInspector] Failed to start discovery:', err);
    }
  };

  const handleStopDiscovery = async () => {
    const provider = discoveryProviderRef.current;
    if (!provider) return;
    try {
      await provider.stopDiscovery();
      setDiscoveryRunning(false);
      setDiscoveryStatus('stopped');
      setDiscoveredPeers([]);
      setAdvertMessage(null);
    } catch (err) {
      console.error('[NativeTransportInspector] Failed to stop discovery:', err);
    }
  };

  const handleSendAdvertisement = async () => {
    const provider = discoveryProviderRef.current;
    if (!provider || !provider.isRunning) return;
    try {
      await provider.announcePresence(localAdvertPort, {
        deviceName: `Syntra Node (${platform.toUpperCase()})`,
        platform: platform === 'macos' ? 'macos' : 'windows',
      });
      setAdvertMessage(`Advertisement broadcast on ${provider.config.multicastGroup}:${provider.config.port} (TCP Port: ${localAdvertPort})`);
      setTimeout(() => setAdvertMessage(null), 4000);
    } catch (err: any) {
      setAdvertMessage(`Error: ${err.message || String(err)}`);
    }
  };

  const handleClearDevices = () => {
    const provider = discoveryProviderRef.current;
    if (provider) {
      provider.sweepStaleDevices();
    }
    setDiscoveredPeers([]);
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    try {
      const summary = await runTestSuite();
      setTestSummary(summary);
    } catch (err) {
      console.error('[NativeTransportInspector] Test suite run failed:', err);
    } finally {
      setIsRunningTests(false);
    }
  };

  if (!isDev) {
    return null;
  }

  const transportCaps = [
    { label: 'Direct Nearby Radio', level: capabilities.directNearby },
    { label: 'Local Network (LAN)', level: capabilities.localNetwork },
    { label: 'UDP Multicast Discovery', level: 'Supported (LAN)' },
    { label: 'Bluetooth Proximity', level: capabilities.bluetooth },
    { label: 'Wi-Fi Direct', level: capabilities.wifiDirect },
    { label: 'Wi-Fi Aware (NAN)', level: capabilities.wifiAware },
    { label: 'Multipeer Connectivity', level: capabilities.multipeerConnectivity },
    { label: 'Local Discovery (mDNS)', level: capabilities.localNetworkDiscovery },
    { label: 'Streaming Chunk I/O', level: capabilities.streaming },
    { label: 'Pause & Resume', level: capabilities.pauseResume },
    { label: 'Large File (>2GB)', level: capabilities.largeFileTransfer },
    { label: 'Background Transfer', level: capabilities.backgroundTransfer },
  ];

  return (
    <>
      {/* Floating Trigger Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open NearShare Native Transport Inspector"
        className="fixed bottom-4 right-[42rem] z-50 flex items-center gap-2 px-3 py-2 bg-[#101114]/90 hover:bg-[#17191D] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded-full text-xs font-mono backdrop-blur-md shadow-2xl transition-colors cursor-pointer pointer-events-auto"
        title="Open Native Transport Inspector (Dev Only)"
      >
        <Radio className="w-3.5 h-3.5 text-[#F5F5F5]" />
        <span>TRANSPORT</span>
        <span className="text-[10px] px-1.5 py-0.2 bg-white/10 text-[#F5F5F5] rounded">
          UDP / LAN
        </span>
      </button>

      {/* Modal Viewport */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="transport-inspector-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono pointer-events-auto"
        >
          <div
            ref={modalRef}
            className={`relative w-full max-w-5xl h-[88vh] bg-[#08090B] border border-white/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden text-[#F5F5F5] ${
              reducedMotion ? '' : 'transition-all'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#101114] border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 border border-white/10 rounded-lg">
                  <Activity className="w-4 h-4 text-[#F5F5F5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="transport-inspector-title" className="text-sm font-semibold tracking-wide text-[#F5F5F5]">
                      NearShare Native Transport & Discovery Inspector
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] bg-white/10 text-[#A6A8AD] border border-white/10 rounded">
                      STEP 46 UDP LAN DISCOVERY
                    </span>
                    <span className="px-2 py-0.5 text-[10px] bg-white/5 text-[#686B72] border border-white/5 rounded">
                      PLATFORM: {platform.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#A6A8AD]">
                    Wi-Fi/LAN Mode UDP Multicast peer discovery, stale lifecycle eviction, and diagnostic telemetry
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  ref={closeButtonRef}
                  onClick={() => setIsOpen(false)}
                  aria-label="Close Native Transport Inspector"
                  className="p-1.5 hover:bg-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-bar: Navigation Tabs & Telemetry */}
            <div className="px-6 py-2 bg-[#101114]/60 border-b border-white/10 text-xs text-[#A6A8AD] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('udp_discovery')}
                  className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                    activeTab === 'udp_discovery'
                      ? 'bg-white/15 text-[#F5F5F5] font-semibold'
                      : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
                  }`}
                >
                  UDP Multicast Discovery
                </button>
                <button
                  onClick={() => setActiveTab('capabilities')}
                  className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                    activeTab === 'capabilities'
                      ? 'bg-white/15 text-[#F5F5F5] font-semibold'
                      : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
                  }`}
                >
                  Capability Matrix
                </button>
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                    activeTab === 'tests'
                      ? 'bg-white/15 text-[#F5F5F5] font-semibold'
                      : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
                  }`}
                >
                  Transport Tests
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#686B72]">
                <span>Wi-Fi/LAN Mode Only (NOT Direct Mode)</span>
                <span>•</span>
                <span>Shell: <strong className="text-[#F5F5F5]">{lifecycle.toUpperCase()}</strong></span>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#08090B]">
              {activeTab === 'udp_discovery' && (
                <div className="space-y-4">
                  {/* Discovery Control & Config Banner */}
                  <div className="p-4 bg-[#101114] border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-[#F5F5F5]" />
                        <span className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider">
                          UDP Multicast Discovery Engine
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono border ${
                          discoveryRunning
                            ? 'bg-white/10 border-white/25 text-[#F5F5F5]'
                            : 'bg-white/5 border-white/10 text-[#686B72]'
                        }`}>
                          STATUS: {discoveryRunning ? discoveryStatus.toUpperCase() : 'STOPPED'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-white/5 border border-white/10 text-[#A6A8AD]">
                          PEERS FOUND: {discoveredPeers.length}
                        </span>
                      </div>
                    </div>

                    {/* Network & Protocol Config */}
                    <div className="grid grid-cols-4 gap-3 p-3 bg-[#08090B] border border-white/5 rounded-lg text-xs">
                      <div>
                        <span className="text-[#686B72] block text-[10px] uppercase">Multicast Group</span>
                        <span className="text-[#F5F5F5] font-mono">{DEFAULT_DISCOVERY_MULTICAST_GROUP}</span>
                      </div>
                      <div>
                        <span className="text-[#686B72] block text-[10px] uppercase">UDP Port</span>
                        <span className="text-[#F5F5F5] font-mono">{DEFAULT_DISCOVERY_PORT}</span>
                      </div>
                      <div>
                        <span className="text-[#686B72] block text-[10px] uppercase">Advert Interval</span>
                        <span className="text-[#F5F5F5] font-mono">5,000 ms (TTL: LAN)</span>
                      </div>
                      <div>
                        <span className="text-[#686B72] block text-[10px] uppercase">Stale / Evict Time</span>
                        <span className="text-[#F5F5F5] font-mono">15s / 30s</span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        {!discoveryRunning ? (
                          <button
                            onClick={handleStartDiscovery}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-medium text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Start Discovery
                          </button>
                        ) : (
                          <button
                            onClick={handleStopDiscovery}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Square className="w-3.5 h-3.5" />
                            Stop Discovery
                          </button>
                        )}

                        <button
                          onClick={handleClearDevices}
                          disabled={discoveredPeers.length === 0}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear Devices
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[#686B72]">TCP Port:</label>
                        <input
                          type="number"
                          value={localAdvertPort}
                          onChange={(e) => setLocalAdvertPort(Number(e.target.value))}
                          className="w-20 px-2 py-1 bg-[#17191D] border border-white/10 rounded text-xs text-[#F5F5F5] font-mono"
                        />
                        <button
                          onClick={handleSendAdvertisement}
                          disabled={!discoveryRunning}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send Advertisement
                        </button>
                      </div>
                    </div>

                    {advertMessage && (
                      <div className="p-2 bg-white/5 border border-white/10 rounded text-[11px] font-mono text-[#A6A8AD]">
                        {advertMessage}
                      </div>
                    )}
                  </div>

                  {/* Security Invariant Alert */}
                  <div className="p-3 bg-[#101114] border border-white/10 rounded-xl flex items-start gap-2.5 text-xs text-[#A6A8AD]">
                    <ShieldAlert className="w-4 h-4 text-[#F5F5F5] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[#F5F5F5]">Security Boundary Invariant: </span>
                      Discovered devices are untrusted LAN endpoints. Discovery disseminates ONLY safe metadata (ID, name, platform, port).
                      Discovery produces "Device Discovered" and NEVER bypasses TCP handshake, SecureTransportSession, ECDH key exchange, or pairing/authorization.
                    </div>
                  </div>

                  {/* Discovered Devices Table */}
                  <div className="p-4 bg-[#101114] border border-white/10 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider">
                        Discovered LAN Peers ({discoveredPeers.length})
                      </span>
                      <span className="text-[11px] text-[#686B72]">Keyed by Stable Device ID</span>
                    </div>

                    {discoveredPeers.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#686B72] bg-[#08090B] border border-white/5 rounded-lg">
                        {discoveryRunning
                          ? 'Listening for NearShare multicast advertisements on 239.255.67.89:52139...'
                          : 'Discovery is currently stopped. Click "Start Discovery" to scan local LAN.'}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {discoveredPeers.map((peer) => {
                          const ageSec = Math.max(0, Math.floor((Date.now() - peer.lastSeen) / 1000));
                          return (
                            <div
                              key={peer.deviceId}
                              className="p-3 bg-[#08090B] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-[#F5F5F5]">{peer.deviceName}</span>
                                  <span className="px-1.5 py-0.2 bg-white/5 text-[#A6A8AD] border border-white/10 rounded text-[10px] uppercase">
                                    {peer.platform}
                                  </span>
                                  <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase ${
                                    peer.state === 'visible'
                                      ? 'bg-white/15 text-[#F5F5F5]'
                                      : 'bg-white/5 text-[#686B72]'
                                  }`}>
                                    {peer.state}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#686B72] font-mono flex items-center gap-3">
                                  <span>ID: <strong className="text-[#A6A8AD]">{peer.deviceId}</strong></span>
                                  <span>•</span>
                                  <span>TCP: <strong className="text-[#A6A8AD]">{peer.ipAddress}:{peer.tcpPort}</strong></span>
                                  <span>•</span>
                                  <span>Caps: <strong className="text-[#A6A8AD]">{peer.capabilities.join(', ')}</strong></span>
                                </div>
                              </div>
                              <div className="text-right font-mono text-[11px] text-[#686B72]">
                                <div>Last Seen: {ageSec}s ago</div>
                                <div className="text-[10px]">TTL: {Math.max(0, Math.floor((peer.expiresAt - Date.now()) / 1000))}s</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'capabilities' && (
                <div className="space-y-2">
                  <div className="p-3 bg-[#101114]/40 border-b border-white/5 text-[11px] text-[#686B72] uppercase tracking-wider flex justify-between">
                    <span>Radio & Network Capabilities</span>
                    <span>Support Status</span>
                  </div>
                  {transportCaps.map((item) => (
                    <div
                      key={item.label}
                      className="p-2.5 bg-[#101114] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                    >
                      <span className="text-[#F5F5F5]">{item.label}</span>
                      <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[11px] text-[#A6A8AD]">
                        {item.level}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tests' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-[#101114] border border-white/10 rounded-lg">
                    <span className="text-xs font-semibold text-[#F5F5F5]">Transport Contract Test Suite (15 Tests)</span>
                    <button
                      onClick={handleRunTests}
                      disabled={isRunningTests}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs text-[#F5F5F5] border border-white/15 rounded-lg transition-colors cursor-pointer"
                    >
                      <Play className="w-3 h-3 text-[#F5F5F5]" />
                      <span>{isRunningTests ? 'Running...' : 'Run Tests'}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {!testSummary ? (
                      <div className="p-8 text-center text-xs text-[#686B72]">
                        <Layers className="w-8 h-8 mb-3 mx-auto opacity-40 text-[#A6A8AD]" />
                        Click "Run Tests" to execute transport contract tests.
                      </div>
                    ) : (
                      testSummary.tests.map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 bg-[#101114] border border-white/10 rounded-lg flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {t.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#F5F5F5] shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-[#A6A8AD] shrink-0" />
                            )}
                            <span className="text-[#F5F5F5] truncate">{t.name}</span>
                          </div>
                          <span className="text-[10px] text-[#686B72] shrink-0 ml-2">{t.durationMs}ms</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-[#101114] border-t border-white/10 flex items-center justify-between text-xs text-[#686B72]">
              <div className="flex items-center gap-4">
                <span>Architecture Contract</span>
                <span>•</span>
                <span>No Radio Hardcoding</span>
                <span>•</span>
                <span>Zero Fake Networking</span>
              </div>
              <div>NearShare Direct Transport Engine</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
