import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  ArrowRight,
  Pause,
  Play,
  X,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  Zap,
  Wifi,
  Laptop,
  Smartphone,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Package,
  Plus,
  FileText,
  Video,
  Image as ImageIcon,
  Archive,
  Folder,
  File,
  Radio,
  Download,
} from 'lucide-react';
import { useTransferQueue, type TransferQueueItem } from '../context/TransferQueueContext';
import { useSettings } from '../context/SettingsContext';
import { useIncomingTransfer } from '../context/IncomingTransferContext';
import { TransferDetailsPanel } from './TransferDetailsPanel';
import { formatDuration } from '../services/mockTransferEngine';

interface TransferQueueScreenProps {
  onBackToHome?: () => void;
  onStartNewTransfer: () => void;
  onViewHistory: () => void;
}

type DirectionFilter = 'all' | 'send' | 'receive';
type StatusFilter = 'all' | 'active' | 'queued' | 'completed' | 'failed';

export const TransferQueueScreen: React.FC<TransferQueueScreenProps> = ({
  onStartNewTransfer,
  onViewHistory,
}) => {
  const {
    transfers,
    activeTransfer,
    completedTransfers,
    activeToast,
    dismissToast,
    pauseTransfer,
    resumeTransfer,
    cancelTransfer,
    retryTransfer,
    clearCompleted,
    pauseAll,
    resumeAll,
    moveTransferUp,
    moveTransferDown,
    removeTransfer,
  } = useTransferQueue();

  const { settings } = useSettings();
  const { simulateIncomingRequest } = useIncomingTransfer();

  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [inspectingTransfer, setInspectingTransfer] = useState<TransferQueueItem | null>(null);
  const [cancelModalTransferId, setCancelModalTransferId] = useState<string | null>(null);
  const [showClearCompletedModal, setShowClearCompletedModal] = useState(false);
  const [showMobileActionsMenu, setShowMobileActionsMenu] = useState(false);
  const [showSimulateMenu, setShowSimulateMenu] = useState(false);

  // Filter transfers
  const filteredTransfers = transfers.filter((t) => {
    if (directionFilter !== 'all' && t.direction !== directionFilter) return false;
    if (statusFilter === 'active') {
      return (
        t.status === 'transferring' ||
        t.status === 'preparing' ||
        t.status === 'connecting' ||
        t.status === 'paused'
      );
    }
    if (statusFilter === 'queued') return t.status === 'queued';
    if (statusFilter === 'completed') return t.status === 'completed';
    if (statusFilter === 'failed') return t.status === 'failed' || t.status === 'cancelled';
    return true;
  });

  const activeFiltered = filteredTransfers.filter(
    (t) =>
      t.status === 'transferring' ||
      t.status === 'preparing' ||
      t.status === 'connecting' ||
      t.status === 'paused'
  );

  const queuedFiltered = filteredTransfers.filter((t) => t.status === 'queued');
  const completedFiltered = filteredTransfers.filter((t) => t.status === 'completed');
  const failedFiltered = filteredTransfers.filter((t) => t.status === 'failed' || t.status === 'cancelled');

  const renderFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-[#F5F5F5]" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-[#F5F5F5]" />;
      case 'document':
        return <FileText className="w-4 h-4 text-[#F5F5F5]" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-[#F5F5F5]" />;
      case 'apk':
        return <Package className="w-4 h-4 text-[#F5F5F5]" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-[#F5F5F5]" />;
      default:
        return <File className="w-4 h-4 text-[#F5F5F5]" />;
    }
  };

  const getPlatformIcon = (platform: string) => {
    if (platform?.toLowerCase().includes('mac') || platform?.toLowerCase().includes('windows')) {
      return <Laptop className="w-3.5 h-3.5 text-[#F5F5F5]" />;
    }
    return <Smartphone className="w-3.5 h-3.5 text-[#F5F5F5]" />;
  };

  return (
    <div className="relative w-full max-w-4xl px-2 sm:px-4 py-2 flex flex-col items-center mx-auto">
      {/* 1. Subtle In-App Notification Toast (Respects settings.notifications) */}
      <AnimatePresence>
        {activeToast && settings.notifications && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 z-50 px-4 py-2.5 rounded-full smoked-glass-pill border border-white/20 shadow-2xl flex items-center gap-3 backdrop-blur-xl bg-[#0F1014]/90 text-xs"
          >
            <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{activeToast.title}:</span>
              <span className="text-[#A6A8AD] truncate max-w-xs">{activeToast.message}</span>
            </div>
            <button
              onClick={dismissToast}
              className="p-1 rounded-full text-[#686B72] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Top Header & Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 z-20 pointer-events-auto"
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">Transfers</h1>
            <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-mono font-medium text-[#A6A8AD]">
              {transfers.length} total
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#A6A8AD] mt-1">
            Everything you're sending and receiving.
          </p>
        </div>

        {/* Global Queue Action Buttons (Desktop) */}
        <div className="hidden sm:flex items-center gap-2">
          {activeTransfer?.status === 'transferring' ? (
            <button
              onClick={pauseAll}
              className="px-3.5 py-1.5 rounded-full smoked-btn-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause All</span>
            </button>
          ) : (
            <button
              onClick={resumeAll}
              className="px-3.5 py-1.5 rounded-full smoked-btn-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume All</span>
            </button>
          )}

          {completedTransfers.length > 0 && (
            <button
              onClick={() => setShowClearCompletedModal(true)}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-[#A6A8AD] hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Completed</span>
            </button>
          )}

          {/* Simulate Incoming Transfer Action */}
          <div className="relative">
            <button
              onClick={() => setShowSimulateMenu(!showSimulateMenu)}
              title="Simulate Incoming Transfer Request"
              className="px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simulate Incoming</span>
            </button>

            <AnimatePresence>
              {showSimulateMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 6 }}
                  className="absolute right-0 top-full mt-2 w-56 p-1.5 rounded-2xl smoked-glass-card border border-white/15 shadow-2xl z-50 flex flex-col gap-1 text-left"
                >
                  <div className="px-2.5 py-1 text-[10px] uppercase font-mono tracking-widest text-[#686B72]">
                    Simulate Incoming
                  </div>
                  <button
                    onClick={() => {
                      simulateIncomingRequest('trusted');
                      setShowSimulateMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/[0.08] text-xs text-[#F5F5F5] text-left flex items-center justify-between transition-colors"
                  >
                    <span>Hemanth's MacBook</span>
                    <span className="text-[10px] text-[#A6A8AD] font-mono">Trusted</span>
                  </button>
                  <button
                    onClick={() => {
                      simulateIncomingRequest('unknown');
                      setShowSimulateMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/[0.08] text-xs text-[#F5F5F5] text-left flex items-center justify-between transition-colors"
                  >
                    <span>Alex's Poco F7</span>
                    <span className="text-[10px] text-[#686B72] font-mono">Unknown</span>
                  </button>
                  <button
                    onClick={() => {
                      simulateIncomingRequest('multi_file');
                      setShowSimulateMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/[0.08] text-xs text-[#F5F5F5] text-left flex items-center justify-between transition-colors"
                  >
                    <span>Design Archive</span>
                    <span className="text-[10px] text-[#A6A8AD] font-mono">5 files</span>
                  </button>
                  <button
                    onClick={() => {
                      simulateIncomingRequest('large_file');
                      setShowSimulateMenu(false);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-white/[0.08] text-xs text-[#F5F5F5] text-left flex items-center justify-between transition-colors"
                  >
                    <span>4K Raw Cut</span>
                    <span className="text-[10px] text-[#A6A8AD] font-mono">3.8 GB</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={onStartNewTransfer}
            className="px-4 py-1.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg hover:scale-105 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Transfer</span>
          </button>
        </div>

        {/* Mobile Action Controls & Overflow */}
        <div className="flex sm:hidden items-center justify-between gap-2">
          <button
            onClick={onStartNewTransfer}
            className="flex-1 py-2 rounded-full smoked-btn-primary text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Transfer</span>
          </button>
          <button
            onClick={() => setShowMobileActionsMenu(!showMobileActionsMenu)}
            className="p-2 rounded-full bg-white/[0.05] border border-white/10 text-[#A6A8AD]"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Mobile Overflow Menu */}
      <AnimatePresence>
        {showMobileActionsMenu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full sm:hidden mb-4 p-3 rounded-2xl smoked-glass-card border border-white/10 space-y-2 pointer-events-auto"
          >
            <button
              onClick={() => {
                simulateIncomingRequest('trusted');
                setShowMobileActionsMenu(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.04] text-xs text-left font-medium text-[#F5F5F5] flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simulate Trusted Request (MacBook)</span>
            </button>
            <button
              onClick={() => {
                simulateIncomingRequest('unknown');
                setShowMobileActionsMenu(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.04] text-xs text-left font-medium text-[#F5F5F5] flex items-center gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Simulate Unknown Request (Android)</span>
            </button>
            <button
              onClick={() => {
                pauseAll();
                setShowMobileActionsMenu(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.04] text-xs text-left font-medium text-[#F5F5F5] flex items-center gap-2"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause All Transfers</span>
            </button>
            <button
              onClick={() => {
                resumeAll();
                setShowMobileActionsMenu(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-white/[0.04] text-xs text-left font-medium text-[#F5F5F5] flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume All Transfers</span>
            </button>
            {completedTransfers.length > 0 && (
              <button
                onClick={() => {
                  setShowClearCompletedModal(true);
                  setShowMobileActionsMenu(false);
                }}
                className="w-full py-2 px-3 rounded-xl bg-white/[0.04] text-xs text-left font-medium text-[#A6A8AD] flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Completed</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Smoked-Glass Filter Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] mb-6 pointer-events-auto"
      >
        {/* Direction Filter Segmented Control */}
        <div className="flex items-center p-1 rounded-full bg-white/[0.03] border border-white/10 text-xs">
          {(['all', 'send', 'receive'] as DirectionFilter[]).map((dir) => (
            <button
              key={dir}
              onClick={() => setDirectionFilter(dir)}
              className={`px-3 py-1 rounded-full font-medium transition-all cursor-pointer ${
                directionFilter === dir
                  ? 'bg-white text-[#08090B] font-semibold shadow-md'
                  : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
              }`}
            >
              {dir === 'all' ? 'All' : dir === 'send' ? 'Sending' : 'Receiving'}
            </button>
          ))}
        </div>

        {/* Status Filter Segmented Control */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0 text-xs font-medium text-[#A6A8AD]">
          {(['all', 'active', 'queued', 'completed', 'failed'] as StatusFilter[]).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-full transition-all cursor-pointer capitalize ${
                statusFilter === st
                  ? 'bg-white/[0.1] text-white border border-white/20 font-semibold'
                  : 'hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </motion.div>

      {/* 4. Main Transfer Queue Content Area */}
      <div className="w-full flex flex-col space-y-6 pointer-events-auto">
        {/* ========================================================= */}
        {/* SECTION A: CURRENT ACTIVE / TRANSFERRING VESSEL           */}
        {/* ========================================================= */}
        {activeFiltered.length > 0 && statusFilter !== 'queued' && statusFilter !== 'completed' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-[#A6A8AD] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Active Transfer
              </span>
              <span className="text-xs text-[#686B72]">1 active channel</span>
            </div>

            {activeFiltered.map((activeItem) => {
              const primaryFile = activeItem.files[0] || {
                name: 'Cinematic_Cut.mp4',
                sizeFormatted: '2.4 GB',
                type: 'video',
              };
              const isReceiving = activeItem.direction === 'receive';
              const isPaused = activeItem.status === 'paused';
              const isLargeFile = activeItem.totalSize > 1024 * 1024 * 1024;
              const isReconnecting = activeItem.isReconnecting;

              return (
                <motion.div
                  key={activeItem.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`relative w-full rounded-[32px] smoked-glass-hero border ${
                    isPaused ? 'border-white/10 opacity-80' : 'border-white/20 shadow-2xl'
                  } p-6 sm:p-8 flex flex-col overflow-hidden transition-all`}
                >
                  {/* Internal ambient light glow */}
                  <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-24 bg-white/[0.05] rounded-full blur-2xl pointer-events-none" />

                  {/* Top Bar inside Active Vessel */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-white/[0.06] border border-white/10">
                        {activeItem.mode === 'direct' ? (
                          <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        ) : (
                          <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        )}
                      </span>
                      <span className="text-xs font-semibold text-[#F5F5F5]">
                        {activeItem.mode === 'direct' ? '⚡ Direct Nearby' : '📶 Local Wi-Fi'}
                      </span>
                      <span className="text-xs text-[#686B72]">•</span>
                      <span className="text-xs text-[#A6A8AD]">
                        {isReceiving ? 'Inbound stream' : 'Outbound stream'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isReconnecting ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] text-xs font-medium text-[#A6A8AD] border border-white/15 flex items-center gap-1.5">
                          <Radio className="w-3 h-3 text-white animate-spin" />
                          Reconnecting...
                        </span>
                      ) : isPaused ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] text-xs font-medium text-[#A6A8AD] border border-white/15">
                          Paused
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/[0.1] text-xs font-medium text-white border border-white/20 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          Transferring
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Center Progress Ring & Liquid Composition */}
                  <div className="my-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                    {/* Ring Visual */}
                    <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center shrink-0">
                      {/* Outer liquid blur halo */}
                      <div className="absolute inset-2 rounded-full bg-white/[0.03] blur-md" />

                      {/* SVG Smooth Progress Ring */}
                      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
                        {/* Background track */}
                        <circle
                          cx="80"
                          cy="80"
                          r="68"
                          fill="transparent"
                          stroke="rgba(255,255,255,0.08)"
                          strokeWidth="8"
                        />
                        {/* Silver-white progress arc */}
                        <circle
                          cx="80"
                          cy="80"
                          r="68"
                          fill="transparent"
                          stroke="#F5F5F5"
                          strokeWidth="8"
                          strokeDasharray={2 * Math.PI * 68}
                          strokeDashoffset={
                            2 * Math.PI * 68 * (1 - Math.min(100, Math.max(0, activeItem.progress)) / 100)
                          }
                          strokeLinecap="round"
                          className="transition-all duration-300 ease-out"
                        />
                      </svg>

                      {/* Vessel Center Info */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                        <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-[#F5F5F5]">
                          {Math.round(activeItem.progress)}%
                        </span>
                        <span className="text-[11px] font-mono text-[#A6A8AD] mt-0.5">
                          {isPaused ? 'Paused' : `${activeItem.speed} MB/s`}
                        </span>
                      </div>
                    </div>

                    {/* File & Target Metadata */}
                    <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
                      <div>
                        <div className="flex items-center justify-center sm:justify-start gap-2">
                          <div className="p-1.5 rounded-lg bg-white/[0.06]">
                            {renderFileIcon(primaryFile.type)}
                          </div>
                          <h2 className="text-lg sm:text-xl font-bold text-[#F5F5F5] truncate">
                            {primaryFile.name}
                          </h2>
                        </div>
                        <div className="text-xs text-[#A6A8AD] mt-1 flex items-center justify-center sm:justify-start gap-2">
                          <span className="font-mono">{activeItem.totalSizeFormatted}</span>
                          <span>•</span>
                          <span>ETA {activeItem.eta}</span>
                          {activeItem.files.length > 1 && (
                            <>
                              <span>•</span>
                              <span>{activeItem.files.length} files</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Direction Device Flow */}
                      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {getPlatformIcon(
                            isReceiving
                              ? activeItem.sourceDevice.platform
                              : activeItem.destinationDevice.platform
                          )}
                          <div className="text-xs truncate">
                            <span className="text-[#686B72]">
                              {isReceiving ? 'Receiving from ' : 'Transferring to '}
                            </span>
                            <span className="font-semibold text-[#F5F5F5]">
                              {isReceiving
                                ? activeItem.sourceDevice.deviceName
                                : activeItem.destinationDevice.deviceName}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] text-[#A6A8AD] font-mono shrink-0">
                          {formatDuration(activeItem.durationSeconds)}
                        </span>
                      </div>

                      {/* Large file notice */}
                      {isLargeFile && (
                        <div className="text-[11px] text-[#A6A8AD] flex items-center gap-1.5 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                          <Package className="w-3.5 h-3.5 text-white shrink-0" />
                          <span className="truncate">
                            Large file • Resume support will be provided by the native transfer engine.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Controls */}
                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                    {isPaused ? (
                      <button
                        onClick={() => resumeTransfer(activeItem.id)}
                        className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => pauseTransfer(activeItem.id)}
                        className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}

                    <button
                      onClick={() => setInspectingTransfer(activeItem)}
                      className="px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 transition-colors cursor-pointer"
                    >
                      View Details
                    </button>

                    <button
                      onClick={() => setCancelModalTransferId(activeItem.id)}
                      className="px-3 py-2 rounded-full bg-white/[0.02] hover:bg-white/[0.06] text-xs font-medium text-[#686B72] hover:text-[#A6A8AD] border border-white/5 transition-colors cursor-pointer"
                      title="Cancel Transfer"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION B: QUEUED TRANSFERS ("Up Next")                   */}
        {/* ========================================================= */}
        {queuedFiltered.length > 0 && statusFilter !== 'active' && statusFilter !== 'completed' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-[#A6A8AD]">
                Up Next ({queuedFiltered.length})
              </span>
              <span className="text-xs text-[#686B72]">Sequential queue</span>
            </div>

            <div className="space-y-2">
              {queuedFiltered.map((queuedItem, index) => {
                const primaryFile = queuedItem.files[0] || {
                  name: 'Payload.zip',
                  sizeFormatted: '846 MB',
                  type: 'archive',
                };

                return (
                  <motion.div
                    key={queuedItem.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 rounded-2xl smoked-glass-card hover:bg-white/[0.05] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    {/* Left File Information */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/10 shrink-0">
                        {renderFileIcon(primaryFile.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                          {primaryFile.name}
                        </div>
                        <div className="text-xs text-[#A6A8AD] flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{queuedItem.totalSizeFormatted}</span>
                          <span>→</span>
                          <span className="truncate">{queuedItem.destinationDevice.deviceName}</span>
                          {queuedItem.files.length > 1 && (
                            <>
                              <span>•</span>
                              <span>{queuedItem.files.length} files</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Queue Badge & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <span className="px-2.5 py-1 rounded-full bg-white/[0.04] text-[11px] font-mono text-[#A6A8AD] border border-white/10">
                        Queued
                      </span>

                      {/* Reorder Buttons */}
                      <div className="flex items-center gap-1">
                        {index > 0 && (
                          <button
                            onClick={() => moveTransferUp(queuedItem.id)}
                            className="p-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-[#A6A8AD] hover:text-white border border-white/10 transition-colors cursor-pointer"
                            title="Move Up in Queue"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {index < queuedFiltered.length - 1 && (
                          <button
                            onClick={() => moveTransferDown(queuedItem.id)}
                            className="p-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-[#A6A8AD] hover:text-white border border-white/10 transition-colors cursor-pointer"
                            title="Move Down in Queue"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => setInspectingTransfer(queuedItem)}
                        className="px-3 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 transition-colors cursor-pointer"
                      >
                        Details
                      </button>

                      <button
                        onClick={() => setCancelModalTransferId(queuedItem.id)}
                        className="p-1.5 rounded-full bg-white/[0.02] hover:bg-white/[0.06] text-[#686B72] hover:text-[#A6A8AD] border border-white/5 transition-colors cursor-pointer"
                        title="Cancel Transfer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION C: COMPLETED TRANSFERS                            */}
        {/* ========================================================= */}
        {completedFiltered.length > 0 && statusFilter !== 'active' && statusFilter !== 'queued' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-[#A6A8AD]">
                Completed ({completedFiltered.length})
              </span>
              <button
                onClick={() => setShowClearCompletedModal(true)}
                className="text-xs text-[#686B72] hover:text-[#A6A8AD] transition-colors cursor-pointer"
              >
                Clear completed
              </button>
            </div>

            <div className="space-y-2">
              {completedFiltered.map((completedItem) => {
                const primaryFile = completedItem.files[0] || {
                  name: 'Presentation.pdf',
                  sizeFormatted: '12.4 MB',
                  type: 'document',
                };

                return (
                  <motion.div
                    key={completedItem.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="p-4 rounded-2xl smoked-glass-card hover:bg-white/[0.04] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white/[0.08] text-white border border-white/15 shrink-0">
                        <Check className="w-4 h-4 text-white stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                          {primaryFile.name}
                        </div>
                        <div className="text-xs text-[#A6A8AD] flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{completedItem.totalSizeFormatted}</span>
                          <span>•</span>
                          <span>Transferred to {completedItem.destinationDevice.deviceName}</span>
                          <span>•</span>
                          <span className="font-mono">{completedItem.speed} MB/s</span>
                          <span>•</span>
                          <span className="font-mono">{formatDuration(completedItem.durationSeconds)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <button
                        onClick={() => setInspectingTransfer(completedItem)}
                        className="px-3 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 transition-colors cursor-pointer"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => retryTransfer(completedItem.id)}
                        className="px-3 py-1.5 rounded-full smoked-btn-secondary text-xs font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION D: FAILED / CANCELLED TRANSFERS (Monochrome)       */}
        {/* ========================================================= */}
        {failedFiltered.length > 0 && statusFilter !== 'active' && statusFilter !== 'queued' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-mono uppercase tracking-wider text-[#A6A8AD]">
                Failed & Cancelled ({failedFiltered.length})
              </span>
            </div>

            <div className="space-y-2">
              {failedFiltered.map((failedItem) => {
                const primaryFile = failedItem.files[0] || {
                  name: 'Project_Source.zip',
                  sizeFormatted: '846 MB',
                  type: 'archive',
                };

                return (
                  <motion.div
                    key={failedItem.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white/[0.04] text-[#A6A8AD] border border-white/10 shrink-0">
                        <AlertCircle className="w-4 h-4 text-[#A6A8AD]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                          {primaryFile.name}
                        </div>
                        <div className="text-xs text-[#A6A8AD] flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{failedItem.totalSizeFormatted}</span>
                          <span>•</span>
                          <span>
                            {failedItem.status === 'cancelled'
                              ? 'Transfer cancelled'
                              : 'Connection interrupted.'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <button
                        onClick={() => retryTransfer(failedItem.id)}
                        className="px-3.5 py-1.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                      <button
                        onClick={() => removeTransfer(failedItem.id)}
                        className="p-1.5 rounded-full bg-white/[0.02] hover:bg-white/[0.06] text-[#686B72] hover:text-[#A6A8AD] border border-white/5 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION E: EMPTY STATE                                    */}
        {/* ========================================================= */}
        {filteredTransfers.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full py-16 px-6 rounded-[36px] smoked-glass-hero border border-white/10 flex flex-col items-center justify-center text-center space-y-4 my-6"
          >
            <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center shadow-inner">
              <Layers className="w-7 h-7 text-[#A6A8AD]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#F5F5F5]">No active transfers</h3>
              <p className="text-xs text-[#A6A8AD] max-w-sm">
                Your transfer queue is clear.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={onStartNewTransfer}
                className="px-6 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 transition-all"
              >
                <span>New Transfer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onViewHistory}
                className="px-5 py-2.5 rounded-full smoked-btn-secondary text-xs font-medium cursor-pointer"
              >
                View History
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* 5. Transfer Details Inspector Modal */}
      <AnimatePresence>
        {inspectingTransfer && (
          <TransferDetailsPanel
            transfer={inspectingTransfer}
            onClose={() => setInspectingTransfer(null)}
          />
        )}
      </AnimatePresence>

      {/* 6. Cancel Transfer Confirmation Modal */}
      <AnimatePresence>
        {cancelModalTransferId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 rounded-[28px] smoked-glass-card border border-white/15 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-[#F5F5F5]">Cancel Transfer?</h3>
              <p className="text-xs text-[#A6A8AD] leading-relaxed">
                This transfer will stop and remain in your transfer history as cancelled.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setCancelModalTransferId(null)}
                  className="flex-1 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer"
                >
                  Keep Transfer
                </button>
                <button
                  onClick={() => {
                    cancelTransfer(cancelModalTransferId);
                    setCancelModalTransferId(null);
                  }}
                  className="flex-1 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[#F5F5F5] border border-white/20 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel Transfer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. Clear Completed Confirmation Modal */}
      <AnimatePresence>
        {showClearCompletedModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 rounded-[28px] smoked-glass-card border border-white/15 shadow-2xl space-y-4"
            >
              <h3 className="text-base font-bold text-[#F5F5F5]">Clear completed transfers?</h3>
              <p className="text-xs text-[#A6A8AD] leading-relaxed">
                Completed transfers will be removed from the active queue but remain in Transfer History.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowClearCompletedModal(false)}
                  className="flex-1 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearCompleted();
                    setShowClearCompletedModal(false);
                  }}
                  className="flex-1 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer shadow-lg"
                >
                  Clear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
