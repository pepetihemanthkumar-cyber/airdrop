import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Wifi,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Check,
  Star,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  Radio,
  AlertCircle,
} from 'lucide-react';
import type { TransferMode } from './FloatingNavPill';
import { useProfileDevice, type Device } from '../context/ProfileDeviceContext';
import { useDeviceTrust } from '../context/DeviceTrustContext';
import { useSettings } from '../context/SettingsContext';
import { usePlatformReadiness } from '../context/PlatformReadinessContext';
import { useTransport } from '../context/TransportContext';

export type DiscoveryFlowState =
  | 'scanning'
  | 'devices_found'
  | 'no_devices'
  | 'connecting'
  | 'connection_failed'
  | 'refreshing';

interface DeviceDiscoveryVesselProps {
  currentMode: TransferMode;
  transferAction: 'send' | 'receive';
  onSelectDevice: (device: Device) => void;
  onProceedToConnected: (device: Device) => void;
}

export const DeviceDiscoveryVessel: React.FC<DeviceDiscoveryVesselProps> = ({
  currentMode,
  transferAction,
  onSelectDevice,
  onProceedToConnected,
}) => {
  const { userProfile, devices } = useProfileDevice();
  const { isDeviceBlocked, isDeviceTrusted, isDevicePaired, getRelationship } = useDeviceTrust();
  const { settings } = useSettings();
  const { checkModeReadiness, openReadinessScreen } = usePlatformReadiness();
  const transport = useTransport();
  const [discoveryState, setDiscoveryState] = useState<DiscoveryFlowState>('scanning');
  const [connectingDevice, setConnectingDevice] = useState<Device | null>(null);
  const [simulateFail, setSimulateFail] = useState(false);

  const modeReadiness = checkModeReadiness(currentMode);

  // Filter out blocked devices and apply settings filters (trustedOnly, allowUnknownDevices)
  const discoverableDevices = devices
    .filter((d) => {
      if (isDeviceBlocked(d.id) || d.isBlocked || d.status === 'offline') return false;
      const trusted = isDeviceTrusted(d.id) || d.isTrusted;
      if (settings.trustedOnly && !trusted) return false;
      const isUnknown = !isDevicePaired(d.id) && (d.isUnknown || !trusted);
      if (!settings.allowUnknownDevices && isUnknown) return false;
      return true;
    })
    .sort((a, b) => {
      const relA = getRelationship(a.id);
      const relB = getRelationship(b.id);
      const favA = relA ? relA.favorite : a.isFavorite;
      const favB = relB ? relB.favorite : b.isFavorite;
      if (favA && !favB) return -1;
      if (!favA && favB) return 1;

      const trustA = isDeviceTrusted(a.id) || a.isTrusted;
      const trustB = isDeviceTrusted(b.id) || b.isTrusted;
      if (trustA && !trustB) return -1;
      if (!trustA && trustB) return 1;
      return 0;
    });

  // Initial scanning simulation on mount or mode change
  useEffect(() => {
    transport.discover(currentMode).catch(() => {});
    const timer = setTimeout(() => {
      if (discoverableDevices.length > 0) {
        setDiscoveryState('devices_found');
      } else {
        setDiscoveryState('no_devices');
      }
    }, 1400);

    return () => clearTimeout(timer);
  }, [currentMode, discoverableDevices.length, transport]);

  // Handle Refresh / Scan Again
  const handleScanAgain = () => {
    setDiscoveryState('refreshing');
    transport.discover(currentMode).catch(() => {});
    setTimeout(() => {
      setDiscoveryState('devices_found');
    }, 1200);
  };

  // Handle Simulate No Devices
  const handleSimulateNoDevices = () => {
    setDiscoveryState('scanning');
    setTimeout(() => {
      setDiscoveryState('no_devices');
    }, 900);
  };

  // Handle Device Connection Click
  const handleConnectDevice = (device: Device) => {
    setConnectingDevice(device);
    onSelectDevice(device);
    setDiscoveryState('connecting');

    setTimeout(() => {
      if (simulateFail) {
        setDiscoveryState('connection_failed');
      } else {
        onProceedToConnected(device);
      }
    }, 1500);
  };

  // Render Platform Icon
  const renderDeviceIcon = (platform: Device['platform']) => {
    switch (platform) {
      case 'macOS':
        return <Laptop className="w-5 h-5 text-[#F5F5F5]" />;
      case 'Android':
        return <Smartphone className="w-5 h-5 text-[#F5F5F5]" />;
      case 'iOS':
        return <Tablet className="w-5 h-5 text-[#F5F5F5]" />;
      case 'Windows':
        return <Monitor className="w-5 h-5 text-[#F5F5F5]" />;
      default:
        return <Laptop className="w-5 h-5 text-[#A6A8AD]" />;
    }
  };

  return (
    <div className="w-full flex flex-col items-center space-y-6">
      
      {/* ========================================================= */}
      {/* 1. DISCOVERY HERO TITLE & DYNAMIC SUBTITLE               */}
      {/* ========================================================= */}
      <div className="text-center space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
          Find nearby devices
        </h2>
        <p className="text-xs sm:text-sm font-light text-[#A6A8AD]">
          {currentMode === 'direct'
            ? 'Looking for nearby devices...'
            : 'Looking for devices on your local network...'}
        </p>
      </div>

      {/* Permission Requirement Notice */}
      {!modeReadiness.ready && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-3.5 rounded-2xl bg-white/[0.05] border border-white/20 flex items-center justify-between gap-3 text-xs shadow-lg"
        >
          <div className="flex items-center gap-2.5 text-[#F5F5F5] min-w-0">
            <AlertCircle className="w-4 h-4 text-white shrink-0 animate-pulse" />
            <div className="min-w-0">
              <span className="font-semibold block text-white truncate">
                {currentMode === 'direct' ? 'Nearby access required' : 'Local network access required'}
              </span>
              <span className="text-[11px] text-[#A6A8AD] truncate block">
                {currentMode === 'direct'
                  ? 'Required to scan and broadcast to surrounding devices.'
                  : 'Required to communicate with devices on this local Wi-Fi.'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openReadinessScreen()}
            className="px-3 py-1.5 rounded-full smoked-btn-primary text-xs font-semibold shrink-0 cursor-pointer shadow"
          >
            Review setup
          </button>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* 2. CENTRAL DISCOVERY VESSEL (LIQUID WAVES & EMBEDDED MODE)*/}
      {/* ========================================================= */}
      <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center my-1 select-none">
        
        {/* Soft Circular Expanding Scanning Waves (Liquid pulse) */}
        {(discoveryState === 'scanning' ||
          discoveryState === 'refreshing' ||
          discoveryState === 'devices_found') && (
          <>
            {/* Wave 1 - Large Ring */}
            <motion.div
              animate={{
                scale: [0.5, 1.1, 1.8],
                opacity: [0.7, 0.35, 0],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: 'easeOut',
              }}
              className="absolute inset-0 rounded-full border border-white/20 pointer-events-none"
            />
            {/* Wave 2 - Medium Ring */}
            <motion.div
              animate={{
                scale: [0.5, 1.1, 1.8],
                opacity: [0.7, 0.35, 0],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                delay: 1.05,
                ease: 'easeOut',
              }}
              className="absolute inset-0 rounded-full border border-white/15 pointer-events-none"
            />
            {/* Wave 3 - Small Ring */}
            <motion.div
              animate={{
                scale: [0.5, 1.1, 1.8],
                opacity: [0.7, 0.35, 0],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                delay: 2.1,
                ease: 'easeOut',
              }}
              className="absolute inset-0 rounded-full border border-white/10 pointer-events-none"
            />
          </>
        )}

        {/* Central Smoked-Glass Discovery Orb */}
        <div className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-white/[0.10] to-white/[0.02] border border-white/25 backdrop-blur-xl shadow-[0_0_35px_rgba(255,255,255,0.12)] flex flex-col items-center justify-center p-2">
          
          {/* Internal reflective glint */}
          <div className="absolute top-1 left-3 right-3 h-4 bg-gradient-to-b from-white/20 to-transparent rounded-full blur-[1px] pointer-events-none" />

          {/* Central Mode Symbol: ⚡ or 📶 */}
          <div className="relative z-10 flex flex-col items-center">
            {discoveryState === 'connecting' ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <RotateCw className="w-8 h-8 text-[#F5F5F5]" />
              </motion.div>
            ) : currentMode === 'direct' ? (
              <Zap className="w-8 h-8 text-[#F5F5F5] drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
            ) : (
              <Wifi className="w-8 h-8 text-[#F5F5F5] drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
            )}
            
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#A6A8AD] mt-1">
              {currentMode === 'direct' ? 'Direct' : 'Wi-Fi'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. DIRECT MODE RANGE SCALE vs WI-FI LOCAL NETWORK INFO   */}
      {/* ========================================================= */}
      {currentMode === 'direct' ? (
        <div className="w-full max-w-md px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#F5F5F5] font-medium">Nearby range</span>
            <span className="text-[#A6A8AD] font-mono text-[11px]">Up to 30 m</span>
          </div>

          {/* Subtle Visual Scale: 0 m ────── 10 m ────── 20 m ────── 30 m */}
          <div className="w-full flex items-center justify-between relative pt-1">
            <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10 -translate-y-1/2 z-0" />
            
            {['0 m', '10 m', '20 m', '30 m'].map((dist, idx) => (
              <div key={dist} className="relative z-10 flex flex-col items-center space-y-1">
                <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 || idx === 3 ? 'bg-white/60' : 'bg-white/30'}`} />
                <span className="text-[9px] font-mono text-[#686B72]">{dist}</span>
              </div>
            ))}
          </div>

          {/* Direct Mode Subtext */}
          <div className="text-[10px] text-[#686B72] text-center pt-0.5 font-mono">
            ⚡ Direct • No router • No internet • Up to 30 m
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md px-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs text-[#A6A8AD]">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />
            <span className="text-[#F5F5F5] font-medium">Connected to local network</span>
          </div>
          <span className="text-[11px] font-mono text-[#686B72]">Zero configuration</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. DISCOVERY STATES CONTAINER                             */}
      {/* ========================================================= */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          
          {/* STATE 1: SCANNING / REFRESHING */}
          {(discoveryState === 'scanning' || discoveryState === 'refreshing') && (
            <motion.div
              key="state-scanning"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-6 flex flex-col items-center justify-center space-y-3 text-center"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#F5F5F5]">
                  {discoveryState === 'refreshing' ? 'Refreshing scan...' : 'Searching nearby...'}
                </span>
              </div>
              <p className="text-xs text-[#A6A8AD] max-w-xs">
                {currentMode === 'direct'
                  ? 'Listening for direct high-speed radio signals.'
                  : 'Resolving active devices on this local Wi-Fi subnet.'}
              </p>
            </motion.div>
          )}

          {/* STATE 2: DEVICES FOUND */}
          {discoveryState === 'devices_found' && (
            <motion.div
              key="state-devices-found"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Header with Count & Refresh Action */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-mono uppercase tracking-wider text-[#A6A8AD]">
                  {discoverableDevices.length} {discoverableDevices.length === 1 ? 'device' : 'devices'} {currentMode === 'direct' ? 'nearby' : 'on local network'}
                </span>
                <button
                  onClick={handleScanAgain}
                  className="flex items-center gap-1.5 text-xs text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Scan Again</span>
                </button>
              </div>

              {/* Discovered Device Cards List */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {discoverableDevices.map((device) => {
                  const isCompact = settings.compactDeviceCards;
                  return (
                    <motion.div
                      key={device.id}
                      whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                      whileTap={{ scale: 0.99 }}
                      className={`${
                        isCompact ? 'p-2.5 rounded-xl' : 'p-3.5 rounded-2xl'
                      } bg-white/[0.03] border border-white/[0.08] hover:border-white/20 transition-all flex items-center justify-between gap-3 shadow-md group cursor-pointer`}
                      onClick={() => handleConnectDevice(device)}
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        
                        {/* Smoked Avatar Orb */}
                        <div
                          className={`relative ${
                            isCompact ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-2xl'
                          } bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 shadow-inner`}
                        >
                          {device.isUnknown ? (
                            renderDeviceIcon(device.platform)
                          ) : (
                            <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-bold text-[#F5F5F5]`}>
                              {device.avatar || device.ownerName?.[0] || 'D'}
                            </span>
                          )}

                          {/* Small Favorite Star Badge */}
                          {device.isFavorite && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#17191D] border border-white/20 flex items-center justify-center shadow">
                              <Star className="w-2.5 h-2.5 text-[#F5F5F5] fill-white" />
                            </div>
                          )}
                        </div>

                        {/* Person Name & Device Details */}
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-[#F5F5F5] truncate`}>
                              {device.isUnknown ? device.name : device.ownerName || device.name}
                            </span>
                            
                            {/* Trust / Pairing status indicator */}
                            {(isDeviceTrusted(device.id) || device.isTrusted) ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white/[0.08] text-[10px] text-[#F5F5F5] border border-white/15">
                                <Check className="w-2.5 h-2.5 text-white" />
                                <span>✓ Trusted</span>
                              </span>
                            ) : isDevicePaired(device.id) ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white/[0.04] text-[10px] text-[#A6A8AD] border border-white/10">
                                <span>Paired</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white/[0.03] text-[10px] text-[#686B72] border border-white/5">
                                <span>Pairing required</span>
                              </span>
                            )}
                          </div>

                          {/* User Handle & Device Name */}
                          <div className="flex items-center gap-1.5 text-xs text-[#A6A8AD] truncate">
                            {device.userHandle && <span>{device.userHandle}</span>}
                            {device.userHandle && <span className="text-[#686B72]">•</span>}
                            <span className="truncate">{device.deviceName}</span>
                          </div>

                          {/* Quality and Distance row (Strict Monochrome) */}
                          <div className="flex items-center gap-2 text-[11px] text-[#686B72] mt-0.5">
                            <span className="text-[#A6A8AD]">
                              ● {device.connectionQuality || 'Excellent'}
                            </span>
                            {currentMode === 'direct' && settings.showDistance && device.distance && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-[#A6A8AD]">{device.distance}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="font-mono text-[#686B72]">{device.platform}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Connect CTA */}
                      <div className="shrink-0 flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConnectDevice(device);
                          }}
                          className={`${
                            isCompact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
                          } rounded-full bg-white/[0.08] hover:bg-white font-semibold text-[#F5F5F5] hover:text-[#08090B] border border-white/15 transition-all flex items-center gap-1 cursor-pointer group-hover:bg-white group-hover:text-[#08090B]`}
                        >
                          <span>Connect</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Simulation test toggles */}
              <div className="pt-2 flex items-center justify-between text-[11px] text-[#686B72] border-t border-white/[0.05]">
                <button
                  onClick={handleSimulateNoDevices}
                  className="hover:text-[#A6A8AD] underline underline-offset-4 cursor-pointer"
                >
                  Simulate no devices
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#A6A8AD]">
                  <input
                    type="checkbox"
                    checked={simulateFail}
                    onChange={(e) => setSimulateFail(e.target.checked)}
                    className="rounded border-white/20 bg-transparent text-white focus:ring-0 cursor-pointer"
                  />
                  <span>Simulate failure on connect</span>
                </label>
              </div>
            </motion.div>
          )}

          {/* STATE 3: NO DEVICES FOUND */}
          {discoveryState === 'no_devices' && (
            <motion.div
              key="state-no-devices"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-6 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-[#A6A8AD]">
                <Radio className="w-6 h-6 text-[#A6A8AD]" />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#F5F5F5]">
                  No nearby devices found
                </h4>
                <p className="text-xs text-[#A6A8AD] max-w-xs mx-auto">
                  Make sure the other device has NearShare open and is visible.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setDiscoveryState('scanning');
                    setTimeout(() => {
                      setDiscoveryState('devices_found');
                    }, 1000);
                  }}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold inline-flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Scan Again</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 4: CONNECTING */}
          {discoveryState === 'connecting' && connectingDevice && (
            <motion.div
              key="state-connecting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-6 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center space-y-4"
            >
              <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F5F5F5]">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>Connecting to {connectingDevice.name}...</span>
              </div>

              <div className="flex items-center justify-center gap-4 py-2">
                {/* Local Sender / Receiver */}
                <div className="flex flex-col items-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#F5F5F5]">
                    <Laptop className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium text-[#F5F5F5]">{userProfile.name}</span>
                  <span className="text-[10px] text-[#686B72]">This device</span>
                </div>

                {/* Animated connecting bridge */}
                <div className="w-16 h-1 bg-white/10 rounded-full relative overflow-hidden">
                  <motion.div
                    animate={{ x: [-20, 64] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-6 h-full bg-white rounded-full shadow-[0_0_8px_white]"
                  />
                </div>

                {/* Remote Device */}
                <div className="flex flex-col items-center space-y-1">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#F5F5F5]">
                    {renderDeviceIcon(connectingDevice.platform)}
                  </div>
                  <span className="text-xs font-medium text-[#F5F5F5] truncate max-w-[100px]">
                    {connectingDevice.ownerName || connectingDevice.name}
                  </span>
                  <span className="text-[10px] text-[#686B72]">{connectingDevice.deviceName}</span>
                </div>
              </div>

              <div className="text-[11px] text-[#A6A8AD] font-mono">
                {connectingDevice.isUnknown
                  ? 'Initiating discovery handshake & identity request...'
                  : transferAction === 'send'
                  ? 'Establishing encrypted direct link (TLS 1.3) • Ready to send'
                  : 'Establishing encrypted direct link (TLS 1.3) • Ready to receive'}
              </div>
            </motion.div>
          )}

          {/* STATE 5: CONNECTION FAILED */}
          {discoveryState === 'connection_failed' && (
            <motion.div
              key="state-connection-failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-6 px-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-[#F5F5F5]">
                <AlertCircle className="w-6 h-6 text-[#F5F5F5]" />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[#F5F5F5]">
                  Unable to connect
                </h4>
                <p className="text-xs text-[#A6A8AD] max-w-xs mx-auto">
                  The device may be out of range or unavailable.
                </p>
              </div>

              {/* Action Buttons: Try Again & Back (No Red!) */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setSimulateFail(false);
                    setDiscoveryState('devices_found');
                  }}
                  className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-medium cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => {
                    if (connectingDevice) handleConnectDevice(connectingDevice);
                  }}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer shadow"
                >
                  <RotateCw className="w-3.5 h-3.5 inline mr-1" />
                  <span>Try Again</span>
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
};
