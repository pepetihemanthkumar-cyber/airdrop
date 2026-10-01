import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Wifi,
  Laptop,
  Smartphone,
  ShieldCheck,
  Activity,
  Radio,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useConnectionHealth } from '../context/ConnectionHealthContext';
import { useTransferQueue } from '../context/TransferQueueContext';
import { useSettings } from '../context/SettingsContext';
import { formatDistanceDisplay } from '../services/mockConnectionHealth';
import { GlassCloseButton } from './common/GlassCloseButton';

export const ConnectionHealthPanel: React.FC = () => {
  const {
    health,
    graphPoints,
    isPanelOpen,
    isDiagnosticsModalOpen,
    closePanel,
    openDiagnosticsModal,
    closeDiagnosticsModal,
    simulateInstability,
    simulateReconnect,
    manualReconnect,
  } = useConnectionHealth();

  const { activeTransfer } = useTransferQueue();
  const { settings } = useSettings();
  const isReducedMotion = settings.reducedMotion;

  // Keyboard accessibility: Escape to close
  React.useEffect(() => {
    if (!isPanelOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDiagnosticsModalOpen) closeDiagnosticsModal();
        else closePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, isDiagnosticsModalOpen, closeDiagnosticsModal, closePanel]);

  // Platform icon helper
  const renderPlatformIcon = (platform: string) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('mac') || p.includes('windows') || p.includes('linux')) {
      return <Laptop className="w-4 h-4 text-[#F5F5F5]" />;
    }
    return <Smartphone className="w-4 h-4 text-[#F5F5F5]" />;
  };

  // 4-dot monochrome quality meter
  const renderQualityMeter = (quality: string) => {
    let activeDots = 4;
    if (quality === 'good') activeDots = 3;
    if (quality === 'weak') activeDots = 2;
    if (quality === 'poor') activeDots = 1;

    return (
      <div className="flex items-center gap-1.5" aria-label={`Quality: ${quality}`}>
        {[0, 1, 2, 3].map((idx) => {
          const isActive = idx < activeDots;
          return (
            <motion.span
              key={`dot-${idx}`}
              animate={
                !isReducedMotion && isActive && quality === 'weak'
                  ? { opacity: [0.6, 1, 0.6] }
                  : {}
              }
              transition={{ duration: 1.2, repeat: Infinity }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                isActive
                  ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]'
                  : 'bg-white/15'
              }`}
            />
          );
        })}
      </div>
    );
  };

  // State text and subtitle description
  const getStateInfo = () => {
    switch (health.state) {
      case 'connecting':
        return { title: 'Connecting…', desc: 'Establishing initial link with device' };
      case 'connected':
      case 'stable':
        return { title: 'Connected', desc: 'Stable connection established' };
      case 'unstable':
        return { title: 'Unstable', desc: 'Connection quality is fluctuating' };
      case 'reconnecting':
        return {
          title: 'Reconnecting…',
          desc: `Re-establishing connection (Attempt ${health.reconnectAttempts || 1} of 3)`,
        };
      case 'disconnected':
        return { title: 'Disconnected', desc: 'Connection lost' };
      case 'failed':
        return { title: 'Failed', desc: 'Unable to establish connection' };
      case 'idle':
      default:
        return { title: 'Ready', desc: 'Awaiting transfer command' };
    }
  };

  const stateInfo = getStateInfo();

  // SVG Line Graph geometry
  const graphWidth = 360;
  const graphHeight = 80;
  const maxSpeed = Math.max(65, ...graphPoints.map((p) => p.speedMBps));

  const pointsString = graphPoints
    .map((pt, idx) => {
      const x = (idx / (graphPoints.length - 1)) * graphWidth;
      const y = graphHeight - (pt.speedMBps / maxSpeed) * (graphHeight - 12) - 6;
      return `${x},${y}`;
    })
    .join(' ');

  const areaString = `${pointsString} ${graphWidth},${graphHeight} 0,${graphHeight}`;

  return (
    <>
      {/* 1. SLIDE-OVER / FLOATING CONNECTION HEALTH PANEL */}
      <AnimatePresence>
        {isPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-6 pt-20 sm:pt-24 bg-black/60 backdrop-blur-sm pointer-events-auto">
            {/* Backdrop click to dismiss */}
            <div
              className="absolute inset-0"
              onClick={closePanel}
              aria-label="Close connection health overlay"
            />

            <motion.aside
              initial={
                isReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: 20, y: window.innerWidth < 640 ? 50 : 0 }
              }
              animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
              exit={
                isReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: 20, y: window.innerWidth < 640 ? 50 : 0 }
              }
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-labelledby="connection-health-title"
              className="relative z-10 w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-[32px] sm:rounded-[32px] bg-[#0E1013]/95 backdrop-blur-2xl border border-white/15 p-5 sm:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_36px_rgba(255,255,255,0.03)] text-[#F5F5F5] space-y-5 select-none"
            >
              {/* Subtle top reflection */}
              <div className="absolute top-0 inset-x-8 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#F5F5F5]" />
                    <h2
                      id="connection-health-title"
                      className="text-base font-bold text-[#F5F5F5] tracking-tight"
                    >
                      Connection Health
                    </h2>
                  </div>
                  <p className="text-xs text-[#A6A8AD]">Live connection details</p>
                </div>
                <GlassCloseButton onClose={closePanel} ariaLabel="Close Connection Health" />
              </div>

              {/* Person & Device Card */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center text-sm font-bold text-[#F5F5F5] shrink-0 shadow-md">
                    {health.profileName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#F5F5F5] truncate">
                      {health.profileName}
                    </div>
                    <div className="text-xs text-[#A6A8AD] font-mono truncate">
                      {health.username}
                    </div>
                    <div className="text-[11px] text-[#686B72] truncate mt-0.5 flex items-center gap-1.5">
                      {renderPlatformIcon(health.platform)}
                      <span>{health.deviceName}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono text-[#686B72] uppercase tracking-wider block">
                    Quality
                  </span>
                  <div className="flex flex-col items-end gap-1 mt-0.5">
                    <span className="text-xs font-bold text-[#F5F5F5] capitalize">
                      {health.quality}
                    </span>
                    {renderQualityMeter(health.quality)}
                  </div>
                </div>
              </div>

              {/* Connection Mode Badge */}
              <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10 text-[#F5F5F5]">
                    {health.mode === 'direct' ? (
                      <Zap className="w-4 h-4" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#F5F5F5]">
                      {health.mode === 'direct' ? '⚡ Direct Nearby' : '📶 Local Wi-Fi'}
                    </div>
                    <div className="text-[11px] text-[#A6A8AD]">
                      {health.mode === 'direct'
                        ? 'No existing Wi-Fi network required'
                        : 'Local network transfer'}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-[#A6A8AD] px-2 py-0.5 rounded bg-white/[0.04] border border-white/5">
                  {formatDistanceDisplay(health.distanceMeters, health.mode)}
                </div>
              </div>

              {/* Connection State & Reconnect Banner */}
              <div
                className={`p-3.5 rounded-2xl border transition-all ${
                  health.state === 'reconnecting'
                    ? 'bg-white/[0.05] border-white/25'
                    : health.state === 'unstable'
                    ? 'bg-white/[0.04] border-white/15'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        health.state === 'reconnecting'
                          ? 'bg-white animate-ping'
                          : health.state === 'unstable'
                          ? 'bg-white/60 animate-pulse'
                          : 'bg-white'
                      }`}
                    />
                    <span className="text-xs font-bold text-[#F5F5F5]">{stateInfo.title}</span>
                  </div>

                  <span className="text-[10px] font-mono text-[#A6A8AD]">
                    Stability {health.stabilityPercent}%
                  </span>
                </div>
                <p className="text-[11px] text-[#A6A8AD] mt-1 leading-relaxed">{stateInfo.desc}</p>

                {/* Reconnect Sequence Details */}
                {health.state === 'reconnecting' && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#A6A8AD]">
                      <span>Reconnection Progress</span>
                      <span>Attempt {health.reconnectAttempts || 1}/3</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        initial={{ width: '10%' }}
                        animate={{ width: `${(health.reconnectAttempts || 1) * 33}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                      />
                    </div>
                  </div>
                )}

                {/* If AutoReconnect is disabled and connection dropped */}
                {!settings.autoReconnect &&
                  (health.state === 'reconnecting' ||
                    health.state === 'disconnected' ||
                    health.state === 'failed') && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#A6A8AD]">
                        Automatic reconnect is disabled
                      </span>
                      <button
                        type="button"
                        onClick={manualReconnect}
                        className="px-3 py-1 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                      >
                        Reconnect
                      </button>
                    </div>
                  )}
              </div>

              {/* Live Monochrome Telemetry Line Graph */}
              <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[#F5F5F5] font-semibold">
                    <Radio className="w-3.5 h-3.5 text-[#A6A8AD]" />
                    <span>Throughput Live Graph</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#A6A8AD]">
                    {health.currentSpeedMBps} MB/s
                  </span>
                </div>

                {/* SVG Graph Viewport */}
                <div className="relative w-full h-20 overflow-hidden rounded-xl bg-white/[0.02] border border-white/[0.04] p-1 flex items-end">
                  <svg
                    className="w-full h-full"
                    viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="monochrome-graph-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
                        <stop offset="80%" stopColor="#FFFFFF" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Area under curve */}
                    <polygon points={areaString} fill="url(#monochrome-graph-grad)" />

                    {/* Line Stroke */}
                    <polyline
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pointsString}
                      className={!isReducedMotion ? 'transition-all duration-300' : ''}
                    />
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-[#686B72]">
                  <span>Past 30 sec</span>
                  <span>Time → →</span>
                  <span>Live</span>
                </div>
              </div>

              {/* Live Metrics Grid (2 columns on mobile / 3 on tablet) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                  <div className="text-[10px] font-mono uppercase text-[#686B72]">Speed</div>
                  <div className="text-sm font-mono font-bold text-[#F5F5F5]">
                    {health.currentSpeedMBps} MB/s
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                  <div className="text-[10px] font-mono uppercase text-[#686B72]">Average</div>
                  <div className="text-sm font-mono font-bold text-[#F5F5F5]">
                    {health.averageSpeedMBps} MB/s
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                  <div className="text-[10px] font-mono uppercase text-[#686B72]">Latency</div>
                  <div className="text-sm font-mono font-bold text-[#F5F5F5]">
                    {health.latencyMs} ms
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                  <div className="text-[10px] font-mono uppercase text-[#686B72]">Distance</div>
                  <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                    {formatDistanceDisplay(health.distanceMeters, health.mode)}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                  <div className="text-[10px] font-mono uppercase text-[#686B72]">Stability</div>
                  <div className="text-sm font-mono font-bold text-[#F5F5F5]">
                    {health.stabilityPercent}%
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
                  <div className="text-[10px] font-mono uppercase text-[#686B72]">Signal</div>
                  <div className="text-sm font-mono font-bold text-[#F5F5F5]">
                    {health.signalPercent}%
                  </div>
                </div>
              </div>

              {/* Transfer-Specific Health (if active transfer) */}
              <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#F5F5F5] uppercase tracking-wider font-mono">
                    Transfer Health
                  </span>
                  {activeTransfer ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#686B72] font-mono">Idle</span>
                  )}
                </div>

                {activeTransfer ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-[#A6A8AD]">{activeTransfer.files[0]?.name || 'Payload'}</span>
                      <span className="text-[#F5F5F5] font-bold">{activeTransfer.speed} MB/s</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#A6A8AD] font-mono">
                      <span>
                        {(activeTransfer.transferredSize / (1024 * 1024 * 1024)).toFixed(2)} GB /{' '}
                        {(activeTransfer.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB
                      </span>
                      <span>
                        ~{Math.max(1, Math.round((activeTransfer.totalSize - activeTransfer.transferredSize) / ((activeTransfer.speed || 38) * 1024 * 1024)))} sec remaining
                      </span>
                    </div>

                    <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${activeTransfer.progress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[#A6A8AD] italic">No active transfer</div>
                )}
              </div>

              {/* Security & Pairing Row */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#F5F5F5]" />
                  <span className="font-semibold text-[#F5F5F5]">
                    {health.encryptionState === 'verified'
                      ? 'Secure pairing verified'
                      : health.encryptionState === 'pairing-required'
                      ? 'Pairing required'
                      : 'Native transfer security'}
                  </span>
                </div>
                <span className="text-[11px] text-[#A6A8AD]">
                  {health.encryptionState === 'verified' ? '✓ Trusted' : 'Peer-checked'}
                </span>
              </div>

              {/* Action Buttons: View Diagnostics & Simulation Triggers */}
              <div className="space-y-2 pt-1 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={openDiagnosticsModal}
                  className="w-full py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg hover:scale-[1.01] transition-all"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>View Diagnostics Details</span>
                </button>

                {/* Developer Simulation Controls */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={simulateInstability}
                    className="flex-1 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-[10px] font-mono text-[#A6A8AD] hover:text-white transition-colors cursor-pointer"
                  >
                    Simulate Instability
                  </button>
                  <button
                    type="button"
                    onClick={simulateReconnect}
                    className="flex-1 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-[10px] font-mono text-[#A6A8AD] hover:text-white transition-colors cursor-pointer"
                  >
                    Simulate Reconnect
                  </button>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* 2. DIAGNOSTICS DETAILS MODAL */}
      <AnimatePresence>
        {isDiagnosticsModalOpen && (
          <div
            onClick={closeDiagnosticsModal}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md pointer-events-auto"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-labelledby="diagnostics-modal-title"
              className="w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 sm:p-7 rounded-[32px] bg-[#101114] border border-white/20 shadow-2xl space-y-5 text-left text-[#F5F5F5] select-none"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10">
                    <Sparkles className="w-4 h-4 text-[#F5F5F5]" />
                  </div>
                  <div>
                    <h3 id="diagnostics-modal-title" className="text-base font-bold text-[#F5F5F5]">
                      System Diagnostics
                    </h3>
                    <p className="text-xs text-[#A6A8AD]">Complete telemetry breakdown</p>
                  </div>
                </div>
                <GlassCloseButton onClose={closeDiagnosticsModal} ariaLabel="Close Diagnostics Modal" />
              </div>

              {/* Diagnostic Parameters Breakdown Table */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#686B72]">
                  Connection Telemetry
                </div>

                <div className="divide-y divide-white/[0.06] rounded-2xl bg-white/[0.025] border border-white/[0.08] overflow-hidden text-xs">
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Connection Mode</span>
                    <span className="font-semibold text-[#F5F5F5] flex items-center gap-1.5">
                      {health.mode === 'direct' ? <Zap className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                      <span>{health.mode === 'direct' ? 'Direct Nearby' : 'Local Wi-Fi'}</span>
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Remote Device</span>
                    <span className="font-semibold text-[#F5F5F5]">{health.deviceName}</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Platform</span>
                    <span className="font-semibold text-[#F5F5F5]">{health.platform}</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Connection Quality</span>
                    <span className="font-semibold text-[#F5F5F5] capitalize flex items-center gap-2">
                      <span>{health.quality}</span>
                      {renderQualityMeter(health.quality)}
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Latency</span>
                    <span className="font-mono font-semibold text-[#F5F5F5]">{health.latencyMs} ms</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Signal Stability</span>
                    <span className="font-mono font-semibold text-[#F5F5F5]">{health.stabilityPercent}%</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Distance Metric</span>
                    <span className="font-semibold text-[#F5F5F5]">
                      {formatDistanceDisplay(health.distanceMeters, health.mode)}
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Current Throughput</span>
                    <span className="font-mono font-semibold text-[#F5F5F5]">{health.currentSpeedMBps} MB/s</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Average Throughput</span>
                    <span className="font-mono font-semibold text-[#F5F5F5]">{health.averageSpeedMBps} MB/s</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Peak Recorded Throughput</span>
                    <span className="font-mono font-semibold text-[#F5F5F5]">{health.peakSpeedMBps} MB/s</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Connection State</span>
                    <span className="font-semibold text-[#F5F5F5] capitalize">{health.state}</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Reconnect Attempts</span>
                    <span className="font-mono font-semibold text-[#F5F5F5]">{health.reconnectAttempts}</span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Security Status</span>
                    <span className="font-semibold text-[#F5F5F5]">
                      {health.encryptionState === 'verified'
                        ? 'Secure pairing verified'
                        : health.encryptionState === 'pairing-required'
                        ? 'Pairing required'
                        : 'Native transfer security'}
                    </span>
                  </div>

                  <div className="p-3 flex items-center justify-between">
                    <span className="text-[#A6A8AD]">Last Stable Timestamp</span>
                    <span className="font-mono text-[#F5F5F5]">{health.lastStableAt}</span>
                  </div>
                </div>
              </div>

              {/* Large File & Throughput Note */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-[#A6A8AD] flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#F5F5F5]">Engine architecture:</span> Diagnostic telemetry runs in real time to monitor channel health, packet acknowledgment, and throughput dynamics.
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={closeDiagnosticsModal}
                  className="px-6 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
