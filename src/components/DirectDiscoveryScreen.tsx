import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { 
  Zap, 
  Wifi, 
  ChevronDown, 
  ArrowLeft, 
  Check, 
  RotateCw, 
  Laptop, 
  Smartphone, 
  Tablet, 
  ShieldCheck, 
  ArrowRight,
  User
} from 'lucide-react';
import type { TransferMode } from './ModeSelectionScreen';

interface DirectDiscoveryScreenProps {
  onBack: () => void;
  onSwitchMode: (mode: TransferMode) => void;
  onProceedToPairing: (device: NearbyDevice) => void;
}

export interface NearbyDevice {
  id: string;
  userName: string;
  deviceName: string;
  platform: 'macOS' | 'Android' | 'iOS' | 'Windows' | 'Linux';
  iconType: 'laptop' | 'phone' | 'tablet';
  avatarBg: string;
  connectionQuality: 'Excellent connection' | 'Strong connection' | 'Good connection';
  isTrusted?: boolean;
}

const INITIAL_MOCK_DEVICES: NearbyDevice[] = [
  {
    id: 'dev-1',
    userName: 'Hemanth',
    deviceName: 'MacBook Air',
    platform: 'macOS',
    iconType: 'laptop',
    avatarBg: 'from-white/20 to-white/5 border-white/20 text-[#F5F5F5]',
    connectionQuality: 'Excellent connection',
    isTrusted: true,
  },
  {
    id: 'dev-2',
    userName: "Hemanth's Android",
    deviceName: 'Pixel 9 Pro',
    platform: 'Android',
    iconType: 'phone',
    avatarBg: 'from-white/20 to-white/5 border-white/20 text-[#F5F5F5]',
    connectionQuality: 'Excellent connection',
    isTrusted: false,
  },
  {
    id: 'dev-3',
    userName: 'Elena Rostova',
    deviceName: 'iPad Pro',
    platform: 'iOS',
    iconType: 'tablet',
    avatarBg: 'from-white/20 to-white/5 border-white/20 text-[#F5F5F5]',
    connectionQuality: 'Good connection',
    isTrusted: false,
  },
];

type ScreenFlowState = 'discovering' | 'connecting' | 'connected';

export const DirectDiscoveryScreen: React.FC<DirectDiscoveryScreenProps> = ({
  onBack,
  onSwitchMode,
  onProceedToPairing,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<NearbyDevice[]>(INITIAL_MOCK_DEVICES);
  const [selectedDevice, setSelectedDevice] = useState<NearbyDevice | null>(null);
  const [flowState, setFlowState] = useState<ScreenFlowState>('discovering');

  // Trigger scan animation
  const handleScanAgain = () => {
    setIsScanning(true);
    setDevices([]);
    setTimeout(() => {
      setDevices(INITIAL_MOCK_DEVICES);
      setIsScanning(false);
    }, 1200);
  };

  // Start connecting flow
  const handleConnect = (device: NearbyDevice) => {
    setSelectedDevice(device);
    setFlowState('connecting');
  };

  // Simulate connection handshake
  useEffect(() => {
    if (flowState === 'connecting') {
      const timer = setTimeout(() => {
        setFlowState('connected');
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [flowState]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.04,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.25, ease: 'easeInOut' },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: 'easeOut' },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative z-10 w-full h-full min-h-screen flex flex-col justify-between px-4 sm:px-8 py-5 md:py-7 select-none overflow-x-hidden"
    >
      {/* HEADER */}
      <motion.header variants={itemVariants} className="w-full max-w-5xl mx-auto flex items-center justify-between">
        {/* Top-Left: Brand & Mode Pill */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white/95 font-sans">
                NearShare
              </span>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/25 text-[11px] font-medium text-sky-300">
                <Zap className="w-3 h-3 fill-sky-400/40 text-sky-400" />
                <span>Direct</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right: Back & Mode Switch Dropdown */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl apple-glass-pill hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {/* Mode Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/50 text-xs font-semibold tracking-wide transition-all shadow-[0_0_15px_-3px_rgba(56,189,248,0.25)] cursor-pointer"
            >
              <Zap className="w-3 h-3 fill-sky-400/40" />
              <span>⚡ Direct</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 rounded-2xl apple-glass-card border border-white/15 p-1.5 z-50 shadow-2xl backdrop-blur-3xl bg-[#090b10]/95"
                  >
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold bg-sky-500/15 text-sky-200 border border-sky-400/30 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-sky-400 fill-sky-400/30" />
                        <span>⚡ Direct</span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-sky-400" />
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onSwitchMode('wifi');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium hover:bg-white/[0.06] text-slate-300 text-left mt-1 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Wifi className="w-3.5 h-3.5 text-purple-400" />
                        <span>📶 Wi-Fi</span>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {/* FLOW VIEW CONTROLLER */}
      <AnimatePresence mode="wait">
        {flowState === 'discovering' && (
          <motion.main
            key="discovery-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center items-center py-4 my-auto"
          >
            {/* Header Text */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight">
                Find nearby devices
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-400 font-normal">
                Searching for devices around you...
              </p>
            </div>

            {/* Central Liquid-Glass Discovery / Radar Area */}
            <div className="relative w-full max-w-lg mb-6 flex flex-col items-center">
              {/* Radar Wave Rings */}
              <div className="relative w-40 h-40 sm:w-44 sm:h-44 flex items-center justify-center">
                {/* Expanding subtle circular waves */}
                <motion.div
                  animate={{
                    scale: [1, 2.2, 2.8],
                    opacity: [0.6, 0.2, 0],
                  }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: 'easeOut',
                  }}
                  className="absolute inset-0 rounded-full border border-sky-400/40 pointer-events-none"
                />
                <motion.div
                  animate={{
                    scale: [1, 2.2, 2.8],
                    opacity: [0.5, 0.15, 0],
                  }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: 1.6,
                  }}
                  className="absolute inset-0 rounded-full border border-sky-400/30 pointer-events-none"
                />

                {/* Concentric subtle guide ring */}
                <div className="absolute w-32 h-32 rounded-full border border-white/[0.07]" />

                {/* Central Glass Disc */}
                <motion.div
                  animate={{
                    boxShadow: [
                      '0 0 25px -4px rgba(56,189,248,0.25)',
                      '0 0 45px 2px rgba(56,189,248,0.45)',
                      '0 0 25px -4px rgba(56,189,248,0.25)',
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative z-10 w-20 h-20 rounded-3xl apple-glass-card border border-sky-400/40 flex flex-col items-center justify-center text-sky-300"
                >
                  <Zap className="w-8 h-8 fill-sky-400/30 stroke-sky-300" />
                </motion.div>
              </div>

              {/* Status & Sub-text under Radar */}
              <div className="mt-3 text-center">
                <div className="text-sm font-semibold text-white/95 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                  <span>Scanning nearby</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Direct connection • No router • No internet
                </div>
              </div>

              {/* RANGE INDICATOR */}
              <div className="w-full max-w-sm mt-4 p-3 rounded-2xl apple-glass-pill border border-white/[0.08] flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-medium">
                  <span className="text-slate-300">Nearby range</span>
                  <span className="text-sky-300/90 font-semibold">Up to 30 m</span>
                </div>

                {/* Clean visual range bar */}
                <div className="relative w-full py-1">
                  <div className="h-1 w-full bg-white/[0.08] rounded-full overflow-hidden relative">
                    <motion.div 
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                      className="h-full w-1/3 bg-gradient-to-r from-transparent via-sky-400 to-transparent"
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>0m</span>
                    <span>10m</span>
                    <span>20m</span>
                    <span>30m</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-white/[0.04]">
                  <span>NearShare Direct Boundary</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Excellent
                  </span>
                </div>
              </div>
            </div>

            {/* DEVICE DISCOVERY LIST / EMPTY STATE */}
            {devices.length > 0 ? (
              <div className="w-full max-w-3xl">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Discovered Devices ({devices.length})
                  </span>
                  <button
                    onClick={handleScanAgain}
                    disabled={isScanning}
                    className="text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>Rescan</span>
                  </button>
                </div>

                {/* Device Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {devices.map((device) => {
                    return (
                      <motion.div
                        key={device.id}
                        layout
                        whileHover={{ y: -4 }}
                        style={{
                          '--card-glow': 'rgba(56, 189, 248, 0.16)',
                        } as React.CSSProperties}
                        className="group relative rounded-2xl p-4 sm:p-4.5 apple-glass-card border border-white/[0.09] hover:border-sky-400/40 flex flex-col justify-between transition-all"
                      >
                        {/* Device Avatar / Icon */}
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${device.avatarBg} border flex items-center justify-center shadow-md`}>
                              {device.iconType === 'laptop' && <Laptop className="w-5 h-5" />}
                              {device.iconType === 'phone' && <Smartphone className="w-5 h-5" />}
                              {device.iconType === 'tablet' && <Tablet className="w-5 h-5" />}
                            </div>

                            {/* Signal Indicator */}
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>{device.connectionQuality.split(' ')[0]}</span>
                            </div>
                          </div>

                          {/* Person / Profile Name (Prominent) */}
                          <h3 className="text-base font-semibold text-white tracking-tight leading-tight truncate">
                            {device.userName}
                          </h3>

                          {/* Device Name & Platform (Subordinate) */}
                          <div className="text-xs text-slate-400 truncate mt-0.5">
                            {device.deviceName} • <span className="text-slate-500">{device.platform}</span>
                          </div>

                          {/* Status text */}
                          <div className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                            <span>{device.connectionQuality}</span>
                          </div>
                        </div>

                        {/* Connect Button */}
                        <div className="mt-4 pt-3 border-t border-white/[0.06]">
                          <button
                            onClick={() => handleConnect(device)}
                            className="w-full py-2 px-3 rounded-xl apple-glass-button-primary text-xs font-semibold flex items-center justify-center gap-1.5 group-hover:gap-2 transition-all cursor-pointer"
                          >
                            <span>Connect</span>
                            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* EMPTY STATE */
              <div className="w-full max-w-md p-6 rounded-3xl apple-glass-card text-center border border-white/[0.08] flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl apple-glass-pill flex items-center justify-center text-slate-400 mb-3">
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  No nearby devices yet
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mb-5">
                  Make sure your other device has NearShare open and Direct Mode enabled.
                </p>
                <button
                  onClick={handleScanAgain}
                  className="px-5 py-2.5 rounded-xl apple-glass-button-primary text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Scan again</span>
                </button>
              </div>
            )}
          </motion.main>
        )}

        {/* CONNECTING STATE ANIMATION */}
        {flowState === 'connecting' && selectedDevice && (
          <motion.main
            key="connecting-main"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center items-center py-6 my-auto text-center"
          >
            <div className="w-full p-8 rounded-3xl apple-glass-card border border-sky-400/30 shadow-[0_0_50px_rgba(56,189,248,0.15)] flex flex-col items-center">
              <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight mb-6">
                Connecting...
              </h2>

              {/* Connection Pipeline: Your device ↓ ⚡ ↓ Selected device */}
              <div className="w-full flex flex-col items-center gap-3">
                {/* Your Device */}
                <div className="w-full p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center gap-2.5 text-xs font-medium text-slate-200">
                  <Laptop className="w-4 h-4 text-sky-400" />
                  <span>Your Device</span>
                </div>

                {/* Animated Liquid Beam */}
                <div className="flex flex-col items-center my-1">
                  <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-9 h-9 rounded-full bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.4)]"
                  >
                    <Zap className="w-4 h-4 fill-sky-400/40" />
                  </motion.div>
                </div>

                {/* Selected Device */}
                <div className="w-full p-3.5 rounded-2xl bg-sky-500/10 border border-sky-400/30 flex items-center justify-center gap-2.5 text-xs font-semibold text-white">
                  {selectedDevice.iconType === 'laptop' && <Laptop className="w-4 h-4 text-sky-300" />}
                  {selectedDevice.iconType === 'phone' && <Smartphone className="w-4 h-4 text-sky-300" />}
                  {selectedDevice.iconType === 'tablet' && <Tablet className="w-4 h-4 text-sky-300" />}
                  <span>{selectedDevice.userName} ({selectedDevice.deviceName})</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-6 animate-pulse">
                Establishing direct point-to-point handshake...
              </p>
            </div>
          </motion.main>
        )}

        {/* CONNECTED STATE PLACEHOLDER */}
        {flowState === 'connected' && selectedDevice && (
          <motion.main
            key="connected-main"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center items-center py-6 my-auto text-center"
          >
            <div className="w-full p-8 rounded-3xl apple-glass-card border border-emerald-400/30 shadow-[0_0_50px_rgba(52,211,153,0.15)] flex flex-col items-center">
              {/* Success Badge */}
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 mb-4 shadow-[0_0_30px_rgba(52,211,153,0.3)]">
                <Check className="w-7 h-7 stroke-[2.5]" />
              </div>

              <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">
                Device connected
              </h2>
              
              <p className="text-xs text-slate-400 mb-6">
                Direct encrypted peer session established
              </p>

              {/* Selected Device Information Card */}
              <div className="w-full p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-left mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Peer Details
                  </span>
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Encrypted
                  </span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {selectedDevice.userName}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {selectedDevice.deviceName} • {selectedDevice.platform}
                </div>
                <div className="text-[11px] text-sky-400 mt-2 flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-sky-400/40" />
                  <span>Direct Wi-Fi / Non-Router Pipeline</span>
                </div>
              </div>

              {/* Continue CTA */}
              <div className="w-full flex flex-col gap-2.5">
                <button
                  onClick={() => onProceedToPairing(selectedDevice)}
                  className="w-full py-3.5 px-5 rounded-2xl apple-glass-button-primary font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setSelectedDevice(null);
                    setFlowState('discovering');
                  }}
                  className="w-full py-2.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Disconnect & find other devices
                </button>
              </div>
            </div>
          </motion.main>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <motion.footer variants={itemVariants} className="w-full max-w-5xl mx-auto flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/[0.04]">
        <span>NearShare Direct Protocol</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Zero Router Network
          </span>
          <span>•</span>
          <span>Max 30 m Boundary</span>
        </div>
      </motion.footer>
    </motion.div>
  );
};
