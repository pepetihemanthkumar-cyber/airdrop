/**
 * NearShare Direct Mode Native Inspector (Development Only)
 *
 * Provides a real-time diagnostic panel for monitoring macOS Multipeer / Direct Mode
 * native discovery, byte channel state, physical validation status, and capability invariants.
 *
 * PALETTE: STRICT MONOCHROME (#08090B, #101114, #17191D, #F5F5F5, #A6A8AD, #686B72)
 */

import React, { useState, useEffect } from 'react';
import {
  Radio,
  Terminal,
} from 'lucide-react';
import { MacOSDirectPeerBridge } from '../core/native/macos/MacOSDirectPeerBridge';
import type { MacOSDirectCapabilities } from '../core/native/macos/MacOSDirectCapabilities';
import type { MacOSDirectPeerInfo } from '../core/native/macos/MacOSDirectPeerTypes';
import { WindowsDirectPeerBridge } from '../core/native/windows/WindowsDirectPeerBridge';
import type { WindowsDirectCapabilities } from '../core/native/windows/WindowsDirectCapabilities';
import { AndroidDirectPeerBridge } from '../core/native/android/AndroidDirectPeerBridge';
import type { AndroidDirectCapabilities } from '../core/native/android/AndroidDirectCapabilities';
import { IOSDirectPeerBridge } from '../core/native/ios/IOSDirectPeerBridge';
import type { IOSDirectCapabilities } from '../core/native/ios/IOSDirectCapabilities';
import { GlassCloseButton } from './common/GlassCloseButton';

export const DirectModeInspector: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const [isOpen, setIsOpen] = useState(false);
  const [activePlatform, setActivePlatform] = useState<'macOS' | 'Windows' | 'Android' | 'iOS'>('macOS');
  const [macCaps, setMacCaps] = useState<MacOSDirectCapabilities | null>(null);
  const [winCaps, setWinCaps] = useState<WindowsDirectCapabilities | null>(null);
  const [androidCaps, setAndroidCaps] = useState<AndroidDirectCapabilities | null>(null);
  const [iosCaps, setIosCaps] = useState<IOSDirectCapabilities | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredPeers, setDiscoveredPeers] = useState<MacOSDirectPeerInfo[]>([]);
  const [activeConnection, setActiveConnection] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  useEffect(() => {
    if (!isDev) return;
    const macBridge = MacOSDirectPeerBridge.getInstance();
    const winBridge = WindowsDirectPeerBridge.getInstance();
    const androidBridge = AndroidDirectPeerBridge.getInstance();
    const iosBridge = IOSDirectPeerBridge.getInstance();

    setMacCaps(macBridge.getCapabilities());
    setWinCaps(winBridge.getCapabilities());
    setAndroidCaps(androidBridge.getCapabilities());
    setIosCaps(iosBridge.getCapabilities());
    setIsScanning(macBridge.isScanning);

    const unsubscribe = macBridge.onNativeEvent((event) => {
      switch (event.type) {
        case 'discoveryStarted':
          setIsScanning(true);
          addLog(`Discovery started (service: ${event.serviceType})`);
          break;
        case 'discoveryStopped':
          setIsScanning(false);
          addLog('Discovery stopped');
          break;
        case 'peerDiscovered':
          setDiscoveredPeers((prev) => {
            const map = new Map(prev.map((p) => [p.peerId, p]));
            map.set(event.peer.peerId, event.peer);
            return Array.from(map.values());
          });
          addLog(`Peer discovered: ${event.peer.displayName} (${event.peer.peerId})`);
          break;
        case 'peerLost':
          setDiscoveredPeers((prev) => prev.filter((p) => p.peerId !== event.peerId));
          addLog(`Peer lost: ${event.peerId}`);
          break;
        case 'connected':
          setActiveConnection(event.connection.peerId);
          addLog(`Session connected to peer: ${event.connection.peerId}`);
          break;
        case 'disconnected':
          setActiveConnection(null);
          addLog(`Session disconnected: ${event.peerId}`);
          break;
        case 'dataReceived':
          addLog(`Received ${event.byteLength} raw bytes from ${event.peerId}`);
          break;
        case 'error':
          addLog(`Error [${event.code}]: ${event.message}`);
          break;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isDev]);

  if (!isDev) return null;

  const handleToggleDiscovery = async () => {
    const macBridge = MacOSDirectPeerBridge.getInstance();
    if (isScanning) {
      await macBridge.stopDiscovery();
    } else {
      await macBridge.startDiscovery();
    }
    setIsScanning(macBridge.isScanning);
  };

  const getActiveCaps = () => {
    switch (activePlatform) {
      case 'macOS':
        return {
          framework: macCaps?.nativeFramework || 'MultipeerConnectivity',
          nativeSupport: macCaps?.nativeSupport || 'supported',
          wifiDirect: 'unsupported',
          bgTransfer: 'restricted',
          validation: macCaps?.physicalValidation || 'not_verified',
          range: macCaps?.targetProductRangeMeters ?? 30,
          requiresRouter: macCaps?.requiresRouter ?? false,
        };
      case 'Windows':
        return {
          framework: winCaps?.nativeFramework || 'WiFiDirectAdvertisementPublisher',
          nativeSupport: winCaps?.nativeSupport || 'requiresNative',
          wifiDirect: winCaps?.supportsWifiDirect || 'supported',
          bgTransfer: winCaps?.supportsBackgroundTransfer || 'supported',
          validation: winCaps?.physicalValidation || 'not_verified',
          range: winCaps?.targetProductRangeMeters ?? 30,
          requiresRouter: winCaps?.requiresRouter ?? false,
        };
      case 'Android':
        return {
          framework: androidCaps?.nativeFramework || 'WifiP2pManager',
          nativeSupport: androidCaps?.nativeSupport || 'requiresNative',
          wifiDirect: androidCaps?.supportsWifiDirect || 'supported',
          bgTransfer: androidCaps?.supportsBackgroundTransfer || 'supported',
          validation: androidCaps?.physicalValidation || 'not_verified',
          range: androidCaps?.targetProductRangeMeters ?? 30,
          requiresRouter: androidCaps?.requiresRouter ?? false,
        };
      case 'iOS':
        return {
          framework: iosCaps?.nativeFramework || 'MultipeerConnectivity',
          nativeSupport: iosCaps?.nativeSupport || 'requiresNative',
          wifiDirect: iosCaps?.supportsWifiDirect || 'unsupported',
          bgTransfer: iosCaps?.supportsBackgroundTransfer || 'restricted',
          validation: iosCaps?.physicalValidation || 'not_verified',
          range: iosCaps?.targetProductRangeMeters ?? 30,
          requiresRouter: iosCaps?.requiresRouter ?? false,
        };
    }
  };

  const activeCaps = getActiveCaps();

  return (
    <>
      {/* Floating Diagnostics Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#101114]/90 border border-white/10 text-white/70 hover:text-white hover:border-white/20 text-xs font-mono backdrop-blur-md transition-all shadow-lg"
        title="Open Direct Mode Native Diagnostics"
      >
        <Radio className="w-3.5 h-3.5 text-white/80" />
        <span>DIRECT SPIKE</span>
        <span
          className={`w-2 h-2 rounded-full ${
            isScanning ? 'bg-white animate-pulse' : 'bg-white/30'
          }`}
        />
      </button>

      {/* Inspector Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-[#0d0e11] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121317]/50">
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-white/90" />
                <h3 className="text-sm font-semibold text-white tracking-wide">
                  Direct Mode Native Inspector
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 uppercase">
                  Dev Only
                </span>
                {activeConnection && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/80 font-mono">
                    Peer: {activeConnection}
                  </span>
                )}
              </div>
              <GlassCloseButton onClose={() => setIsOpen(false)} ariaLabel="Close Inspector" />
            </div>

            {/* Platform Toggle Bar */}
            <div className="flex items-center gap-2 px-6 py-2.5 border-b border-white/5 bg-[#0a0b0d] overflow-x-auto">
              <button
                onClick={() => setActivePlatform('macOS')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activePlatform === 'macOS'
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-white/40 hover:text-white/70 border border-transparent'
                }`}
              >
                macOS (Multipeer)
              </button>
              <button
                onClick={() => setActivePlatform('Windows')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activePlatform === 'Windows'
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-white/40 hover:text-white/70 border border-transparent'
                }`}
              >
                Windows (Wi-Fi Direct)
              </button>
              <button
                onClick={() => setActivePlatform('Android')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activePlatform === 'Android'
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-white/40 hover:text-white/70 border border-transparent'
                }`}
              >
                Android (WifiP2p)
              </button>
              <button
                onClick={() => setActivePlatform('iOS')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  activePlatform === 'iOS'
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-white/40 hover:text-white/70 border border-transparent'
                }`}
              >
                iOS (Multipeer / AWDL)
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-white/70">
              {/* Capability Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Native Framework</span>
                  <span className="font-mono text-white font-medium truncate block" title={activeCaps.framework}>
                    {activeCaps.framework}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Wi-Fi Direct API</span>
                  <span className="font-mono text-white font-medium">
                    {activeCaps.wifiDirect}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Background Transfer</span>
                  <span className="font-mono text-white font-medium">
                    {activeCaps.bgTransfer}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <span className="text-[10px] text-white/40 block">Physical Validation</span>
                  <span className="font-mono text-white font-medium">
                    {activeCaps.validation}
                  </span>
                </div>
              </div>

              {/* Native Actions */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#121317] border border-white/10">
                <div>
                  <h4 className="text-xs font-medium text-white">Peer Discovery Control ({activePlatform})</h4>
                  <p className="text-[11px] text-white/50">
                    {activePlatform === 'macOS' && 'Browses for nearby NearShare peers via native Apple Multipeer / AWDL.'}
                    {activePlatform === 'Windows' && 'Publishes & discovers peers via WinRT Wi-Fi Direct API (native runtime required).'}
                    {activePlatform === 'Android' && 'Discovers peers via Android WifiP2pManager (Android native runtime required).'}
                    {activePlatform === 'iOS' && 'Browses for nearby peers via iOS MultipeerConnectivity (iOS native runtime required).'}
                  </p>
                </div>
                <button
                  onClick={handleToggleDiscovery}
                  className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                    isScanning
                      ? 'bg-white text-black border-white hover:bg-white/90'
                      : 'bg-white/5 text-white border-white/20 hover:bg-white/10'
                  }`}
                >
                  {isScanning ? 'Stop Discovery' : 'Start Discovery'}
                </button>
              </div>

              {/* Discovered Peers List */}
              <div className="space-y-2">
                <span className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">
                  Discovered Native Peers ({discoveredPeers.length})
                </span>
                {discoveredPeers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white/[0.01] border border-dashed border-white/10 text-center text-white/40">
                    No physical peers discovered yet. Requires physical devices with native runtime.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {discoveredPeers.map((peer) => (
                      <div
                        key={peer.peerId}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/10"
                      >
                        <div>
                          <span className="text-white font-medium block">{peer.displayName}</span>
                          <span className="font-mono text-[10px] text-white/40">
                            ID: {peer.peerId} • Dist: ~{peer.estimatedDistanceMeters}m
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/80">
                          {peer.state}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Console Logs */}
              <div className="space-y-2">
                <span className="text-[11px] text-white/50 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" /> Event Log
                </span>
                <div className="h-32 overflow-y-auto p-3 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px] space-y-1 text-white/60">
                  {logs.length === 0 ? (
                    <div className="text-white/20 italic">No events recorded.</div>
                  ) : (
                    logs.map((log, i) => <div key={i}>{log}</div>)
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

