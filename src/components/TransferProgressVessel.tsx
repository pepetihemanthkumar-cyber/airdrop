import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Package,
  Folder,
  Check,
  Smartphone,
  Laptop,
  ArrowDown,
  ArrowUp,
  Clock,
  History,
  Zap,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { FileItem } from './CentralTransferVessel';
import { useConnectionHealth } from '../context/ConnectionHealthContext';

interface TransferProgressVesselProps {
  activeSender: {
    userName: string;
    userHandle: string;
    platform: string;
    deviceName: string;
    icon: React.ReactNode;
  };
  activeReceiver: {
    userName: string;
    userHandle: string;
    platform: string;
    deviceName: string;
    icon: React.ReactNode;
  };
  isReversedDirection: boolean;
  files: FileItem[];
  totalSizeBytes: number;
  formatSize: (bytes: number) => string;
  initialComplete?: boolean;
  isReceiving?: boolean;
  onComplete: () => void;
  onNewTransfer: () => void;
  onViewHistory: () => void;
  onViewTransfers?: () => void;
}

export const TransferProgressVessel: React.FC<TransferProgressVesselProps> = ({
  activeSender,
  activeReceiver,
  isReversedDirection,
  files,
  totalSizeBytes,
  formatSize,
  initialComplete = false,
  isReceiving = false,
  onComplete,
  onNewTransfer,
  onViewHistory,
  onViewTransfers,
}) => {
  const { health, openPanel } = useConnectionHealth();
  const [progress, setProgress] = useState(initialComplete ? 100 : 0);
  const [speed, setSpeed] = useState(45.2);
  const [completionPhase, setCompletionPhase] = useState<
    'transferring' | 'settling' | 'dissolving' | 'complete'
  >(initialComplete ? 'complete' : 'transferring');
  
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Active primary file for display (defaults to the reference Cinematic_Cut.mp4)
  const primaryFile =
    files && files.length > 0 && files[0].id !== 'initial-1'
      ? files[0]
      : {
          id: 'f-cinematic',
          name: 'Cinematic_Cut.mp4',
          type: 'video',
          typeLabel: 'Video',
          sizeBytes: 2.4 * 1024 * 1024 * 1024,
          sizeFormatted: '2.4 GB',
        };

  const displayTotalBytes =
    totalSizeBytes > 0 && totalSizeBytes !== 2936012
      ? totalSizeBytes
      : 2.4 * 1024 * 1024 * 1024;
  const currentTransferredBytes = (progress / 100) * displayTotalBytes;

  // Real-time ETA computation
  const remainingBytes = Math.max(0, displayTotalBytes - currentTransferredBytes);
  const speedBytesPerSec = speed * 1024 * 1024;
  const etaSeconds = Math.max(1, Math.round(remainingBytes / speedBytesPerSec));
  const formatEta = (sec: number) => {
    if (sec <= 0 || progress >= 100) return 'Complete';
    if (sec < 60) return `${sec} sec`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  // High-frequency smooth progress interpolation with continuous animation
  useEffect(() => {
    if (initialComplete) {
      setCompletionPhase('complete');
      return;
    }

    let currentProgress = 0;

    const animateLoop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Realistic speed fluctuation (44 MB/s - 47 MB/s)
      const dynamicSpeed =
        45.2 + Math.sin(timestamp / 650) * 1.8 + Math.cos(timestamp / 320) * 0.7;
      setSpeed(Math.round(dynamicSpeed * 10) / 10);

      // Smooth progress advancement (takes ~12s for full cycle)
      const progressDelta = (delta / 1000) * (100 / 12);
      currentProgress = Math.min(100, currentProgress + progressDelta);
      setProgress(Math.round(currentProgress * 10) / 10);

      if (currentProgress < 100) {
        animationFrameRef.current = requestAnimationFrame(animateLoop);
      } else {
        // Step 7 Multi-phase completion sequence:
        // 1. Progress reaches 100%
        // 2. Particles settle
        setCompletionPhase('settling');

        setTimeout(() => {
          // 3. Light travels around ring and ring dissolves inward
          setCompletionPhase('dissolving');

          setTimeout(() => {
            // 4. Checkmark appears, summary fades in
            setCompletionPhase('complete');
            onComplete();
          }, 450);
        }, 350);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animateLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initialComplete, onComplete]);

  // Large Prominent Ring Geometry (340x340 SVG viewport, center (170, 170), radius 132)
  const ringRadius = 132;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = ringCircumference * (1 - progress / 100);

  // Calculate leading edge glowing highlight point position
  const leadingAngle = (progress / 100) * 2 * Math.PI - Math.PI / 2;
  const leadingX = 170 + ringRadius * Math.cos(leadingAngle);
  const leadingY = 170 + ringRadius * Math.sin(leadingAngle);

  // File icon renderer with clean soft outline
  const renderFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Folder className="w-6 h-6 text-[#F5F5F5] stroke-[1.8]" />;
      case 'document':
        return <FileText className="w-6 h-6 text-[#F5F5F5] stroke-[1.8]" />;
      case 'apk':
        return <Package className="w-6 h-6 text-[#F5F5F5] stroke-[1.8]" />;
      case 'folder':
        return <Folder className="w-6 h-6 text-[#F5F5F5] stroke-[1.8]" />;
      default:
        return <Folder className="w-6 h-6 text-[#F5F5F5] stroke-[1.8]" />;
    }
  };

  const isTransferring = completionPhase === 'transferring' || completionPhase === 'settling';

  return (
    <div className="relative w-full flex flex-col items-center justify-center my-auto py-1">
      
      {/* ========================================================= */}
      {/* 0. CONNECTION HEALTH PILL (Opens Diagnostic Panel)        */}
      {/* ========================================================= */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={openPanel}
        className="mb-1.5 px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-medium text-[#A6A8AD] hover:text-[#F5F5F5] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm z-10"
        title="View Connection Health Diagnostics"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white" />
        <span className="capitalize">Connection · {health.quality}</span>
        <span className="text-[10px] text-[#686B72] font-mono">
          {health.mode === 'direct' ? '⚡ Direct' : '📶 Wi-Fi'}
        </span>
      </motion.button>

      {/* ========================================================= */}
      {/* 1. SENDER IDENTITY BADGE (Above Vessel)                   */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: isReversedDirection ? 10 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-sm z-10"
      >
        <div className="w-7 h-7 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-[#F5F5F5]">
          {activeSender.platform === 'Android' ? (
            <Smartphone className="w-3.5 h-3.5" />
          ) : (
            <Laptop className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5">
            <span>{activeSender.userName}</span>
            <span className="text-[10px] text-[#A6A8AD] px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/10">
              {activeSender.platform}
            </span>
          </div>
          <div className="text-[11px] text-[#686B72] truncate max-w-[140px]">
            {activeSender.deviceName}
          </div>
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 2. TOP VERTICAL DATA STREAM (Sender → Vessel)             */}
      {/* ========================================================= */}
      <div className="relative w-12 h-7 flex items-center justify-center overflow-hidden my-0.5">
        <div className="absolute inset-y-0 w-[1px] bg-gradient-to-b from-white/20 via-white/10 to-transparent" />

        {isTransferring && (
          <>
            {[0, 0.4, 0.8].map((delay, idx) => (
              <motion.div
                key={`top-particle-${idx}`}
                animate={{
                  y: isReversedDirection ? [12, -12] : [-12, 12],
                  opacity: completionPhase === 'settling' ? [0.6, 0.2, 0] : [0, 0.9, 0.9, 0],
                  scale: completionPhase === 'settling' ? [0.8, 0.4, 0.2] : [0.6, 1.2, 0.6],
                }}
                transition={{
                  duration: completionPhase === 'settling' ? 2.0 : 1.2,
                  repeat: completionPhase === 'settling' ? 1 : Infinity,
                  delay,
                  ease: 'easeInOut',
                }}
                className="absolute w-1.5 h-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              />
            ))}
          </>
        )}

        <div className="absolute top-1/2 -translate-y-1/2 opacity-30">
          {isReversedDirection ? (
            <ArrowUp className="w-3 h-3 text-white" />
          ) : (
            <ArrowDown className="w-3 h-3 text-white" />
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. THE FLOATING LIQUID-GLASS TRANSFER VESSEL              */}
      {/* ========================================================= */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[580px] min-h-[350px] sm:min-h-[370px] rounded-[48px] animate-vessel-float flex items-center justify-center text-center shadow-[0_28px_72px_rgba(0,0,0,0.9),inset_0_1.5px_2px_rgba(255,255,255,0.25),inset_0_-1.5px_2px_rgba(0,0,0,0.6)] overflow-hidden border border-white/[0.20]"
        style={{
          background:
            'linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0%, rgba(18, 20, 26, 0.65) 50%, rgba(255, 255, 255, 0.03) 100%)',
          backdropFilter: 'blur(36px) saturate(140%)',
          WebkitBackdropFilter: 'blur(36px) saturate(140%)',
        }}
      >
        {/* Optical Liquid Glass Wave Caustics (Left & Right Flanks) */}
        <div className="absolute inset-0 pointer-events-none opacity-50 mix-blend-screen overflow-hidden">
          {/* Left organic liquid wave fold */}
          <svg className="absolute -left-10 -top-8 w-80 h-[400px]" viewBox="0 0 220 320" fill="none">
            <path
              d="M-20,20 C45,85 85,150 35,230 C-5,290 -20,330 -20,330"
              stroke="url(#left-wave-grad)"
              strokeWidth="48"
              strokeLinecap="round"
              filter="blur(18px)"
            />
            <path
              d="M10,40 C65,105 75,175 45,245"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="5"
              filter="blur(5px)"
            />
            <defs>
              <linearGradient id="left-wave-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#9AA2B6" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>

          {/* Right organic liquid wave fold */}
          <svg className="absolute -right-10 -bottom-8 w-80 h-[400px]" viewBox="0 0 220 320" fill="none">
            <path
              d="M240,300 C175,235 135,170 185,90 C225,30 240,-20 240,-20"
              stroke="url(#right-wave-grad)"
              strokeWidth="48"
              strokeLinecap="round"
              filter="blur(18px)"
            />
            <path
              d="M210,280 C155,215 145,145 175,75"
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="5"
              filter="blur(5px)"
            />
            <defs>
              <linearGradient id="right-wave-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#9AA2B6" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Specular Liquid Highlights & Traveling Sheen */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent pointer-events-none animate-reflection-sweep" />
        <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

        <AnimatePresence mode="wait">
          {completionPhase !== 'complete' ? (
            /* =================================================== */
            /* A. ACTIVE TRANSFERRING STATE                        */
            /* =================================================== */
            <motion.div
              key="active-transfer-state"
              initial={{ opacity: 0 }}
              animate={{
                opacity: completionPhase === 'dissolving' ? 0 : 1,
                scale: completionPhase === 'dissolving' ? 0.92 : 1,
              }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.35 }}
              className="relative w-full h-full flex items-center justify-center p-4"
            >
              {/* CENTRAL TRANSFER RING (Wraps the File Info) */}
              <div className="relative w-[340px] h-[340px] flex items-center justify-center">
                
                {/* SVG Progress Ring */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 340 340">
                  <defs>
                    <linearGradient id="liquid-arc-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
                      <stop offset="70%" stopColor="#EEF2F8" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#D2D8E4" stopOpacity="0.9" />
                    </linearGradient>

                    <filter id="liquid-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="5.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* 1. Background Inactive Smoked Glass Track */}
                  <circle
                    cx="170"
                    cy="170"
                    r={ringRadius}
                    stroke="rgba(255, 255, 255, 0.14)"
                    strokeWidth="14"
                    fill="transparent"
                  />

                  {/* 2. Soft Ambient Blurred Outer Rim Light */}
                  <circle
                    cx="170"
                    cy="170"
                    r={ringRadius}
                    stroke="rgba(255, 255, 255, 0.28)"
                    strokeWidth="22"
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={strokeDashoffset}
                    filter="url(#liquid-glow)"
                    className="transition-all duration-100 ease-out"
                  />

                  {/* 3. Main Crisp Liquid-Glass Silver Stroke */}
                  <circle
                    cx="170"
                    cy="170"
                    r={ringRadius}
                    stroke="url(#liquid-arc-grad)"
                    strokeWidth="14"
                    fill="transparent"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-100 ease-out"
                  />

                  {/* 4. Brighter Leading Edge Glowing Point */}
                  {progress > 1 && progress < 99 && (
                    <g className="transition-all duration-100 ease-out">
                      <circle
                        cx={leadingX}
                        cy={leadingY}
                        r="10"
                        fill="rgba(255, 255, 255, 0.4)"
                        className="animate-pulse"
                      />
                      <circle
                        cx={leadingX}
                        cy={leadingY}
                        r="5.5"
                        fill="#FFFFFF"
                        stroke="rgba(255, 255, 255, 0.95)"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}
                </svg>

                {/* Content Inside the Ring */}
                <div className="relative z-10 flex flex-col items-center justify-center max-w-[240px] px-3 select-none">
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="w-11 h-11 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.35)] mb-1"
                  >
                    {renderFileIcon(primaryFile.type)}
                  </motion.div>

                  <h3 className="text-lg sm:text-xl font-bold text-[#F5F5F5] tracking-tight truncate max-w-[220px] mt-0.5">
                    {primaryFile.name}
                  </h3>

                  <div className="text-xs sm:text-sm font-medium text-[#D0D3DA] mt-0.5">
                    ({primaryFile.sizeFormatted || formatSize(primaryFile.sizeBytes)}) - {speed.toFixed(0)} MB/s
                  </div>

                  <div className="w-44 sm:w-48 bg-white/20 h-1.5 rounded-full overflow-hidden relative my-2.5">
                    <motion.div
                      className="h-full bg-gradient-to-r from-white/80 via-white to-white rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between w-44 sm:w-48 text-xs text-[#A6A8AD] font-mono">
                    <span className="font-medium text-[#C0C4CC]">
                      {formatSize(currentTransferredBytes)} {isReceiving ? 'received' : ''}
                    </span>
                    <span className="flex items-center gap-1 text-[#F5F5F5] font-medium">
                      <Clock className="w-3 h-3 text-[#A6A8AD]" />
                      <span>{formatEta(etaSeconds)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* =================================================== */
            /* B. STEP 7 / 8 — TRANSFER COMPLETE STATE             */
            /* =================================================== */
            <motion.div
              key="success-transfer-state"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: [0.75, 1.08, 1.0] }}
              transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full flex flex-col items-center justify-center p-5 sm:p-7 space-y-4"
            >
              {/* Subtle glass reflection sweep across vessel */}
              <motion.div
                initial={{ x: '-120%', opacity: 0 }}
                animate={{ x: '120%', opacity: [0, 0.35, 0] }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-20deg] pointer-events-none"
              />

              {/* 1. Large Soft-White Elegant Thin Checkmark */}
              <motion.div
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: [0.75, 1.08, 1.0], opacity: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/[0.06] border border-white/25 flex items-center justify-center shadow-[0_0_32px_rgba(255,255,255,0.22),inset_0_1px_1px_rgba(255,255,255,0.4)]"
              >
                <Check className="w-8 h-8 sm:w-10 sm:h-10 text-[#F5F5F5] stroke-[1.8]" />
                <motion.div
                  initial={{ scale: 0.85, opacity: 0.7 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border border-white/30 pointer-events-none"
                />
              </motion.div>

              {/* 2. Main Text & Supporting Text */}
              <div className="space-y-1 text-center">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#F5F5F5] tracking-tight">
                  Transfer complete
                </h3>
                <p className="text-xs sm:text-sm text-[#A6A8AD] font-light">
                  {isReceiving ? 'Received successfully' : 'Your files were sent successfully.'}
                </p>
              </div>

              {/* 3. Compact Transfer Summary (From, To, File, Status) */}
              <div className="w-full max-w-sm p-3.5 rounded-2xl bg-white/[0.035] border border-white/[0.08] text-xs text-[#A6A8AD] space-y-2">
                <div className="flex items-center justify-between font-medium">
                  <div className="flex items-center gap-2 text-[#F5F5F5]">
                    <div className="p-1 rounded bg-white/[0.08]">
                      {renderFileIcon(primaryFile.type)}
                    </div>
                    <span className="truncate max-w-[170px] font-semibold">
                      {primaryFile.name}
                    </span>
                  </div>
                  <span className="font-mono text-[#D0D3DA]">
                    {primaryFile.sizeFormatted || formatSize(displayTotalBytes)}
                  </span>
                </div>

                <div className="h-[1px] bg-white/[0.06]" />

                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-[#686B72] uppercase tracking-wider">From</span>
                    <span className="text-[#F5F5F5]">{activeSender.userName} • {activeSender.deviceName}</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-[#686B72] uppercase tracking-wider">To</span>
                    <span className="text-[#F5F5F5]">{activeReceiver.userName} • {activeReceiver.deviceName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-[10px] font-mono text-[#686B72]">
                  <span className="flex items-center gap-1 text-[#A6A8AD]">
                    <Zap className="w-3 h-3 text-[#F5F5F5]" />
                    <span>Direct Channel</span>
                  </span>
                  {isReceiving ? (
                    <span className="text-[#F5F5F5] font-sans">
                      Saved to: <span className="font-medium text-white">Downloads</span>
                    </span>
                  ) : (
                    <span className="text-[#F5F5F5]">Completed just now</span>
                  )}
                </div>
              </div>

              {/* 4. Small Confirmation Note */}
              <div className="flex items-center gap-1.5 text-[11px] text-[#686B72]">
                <ShieldCheck className="w-3 h-3 text-[#A6A8AD]" />
                <span>Saved to transfer history</span>
              </div>

              {/* 5. Primary & Secondary Actions */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                {onViewTransfers && (
                  <button
                    onClick={onViewTransfers}
                    className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-white/[0.08] transition-all"
                  >
                    <span>View Transfers</span>
                  </button>
                )}

                <button
                  onClick={onViewHistory}
                  className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-white/[0.08] transition-all"
                >
                  <History className="w-3.5 h-3.5 text-[#A6A8AD]" />
                  <span>View History</span>
                </button>

                <button
                  onClick={onNewTransfer}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg hover:scale-105 transition-all"
                >
                  <span>New Transfer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ========================================================= */}
      {/* 4. BOTTOM VERTICAL DATA STREAM (Vessel → Receiver)        */}
      {/* ========================================================= */}
      <div className="relative w-12 h-7 flex items-center justify-center overflow-hidden my-0.5">
        <div className="absolute inset-y-0 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-white/20" />

        {isTransferring && (
          <>
            {[0, 0.4, 0.8].map((delay, idx) => (
              <motion.div
                key={`bottom-particle-${idx}`}
                animate={{
                  y: isReversedDirection ? [12, -12] : [-12, 12],
                  opacity: completionPhase === 'settling' ? [0.6, 0.2, 0] : [0, 0.9, 0.9, 0],
                  scale: completionPhase === 'settling' ? [0.8, 0.4, 0.2] : [0.6, 1.2, 0.6],
                }}
                transition={{
                  duration: completionPhase === 'settling' ? 2.0 : 1.2,
                  repeat: completionPhase === 'settling' ? 1 : Infinity,
                  delay,
                  ease: 'easeInOut',
                }}
                className="absolute w-1.5 h-2.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              />
            ))}
          </>
        )}

        <div className="absolute top-1/2 -translate-y-1/2 opacity-30">
          {isReversedDirection ? (
            <ArrowUp className="w-3 h-3 text-white" />
          ) : (
            <ArrowDown className="w-3 h-3 text-white" />
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. RECEIVER IDENTITY BADGE (Below Vessel)                 */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: isReversedDirection ? -10 : 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] shadow-sm z-10"
      >
        <div className="w-7 h-7 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-[#F5F5F5]">
          {activeReceiver.platform === 'Android' ? (
            <Smartphone className="w-3.5 h-3.5" />
          ) : (
            <Laptop className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="text-left">
          <div className="text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5">
            <span>{activeReceiver.userName}</span>
            <span className="text-[10px] text-[#A6A8AD] px-1.5 py-0.2 rounded bg-white/[0.06] border border-white/10">
              {activeReceiver.platform}
            </span>
          </div>
          <div className="text-[11px] text-[#686B72] truncate max-w-[140px]">
            {activeReceiver.deviceName}
          </div>
        </div>
      </motion.div>

    </div>
  );
};
