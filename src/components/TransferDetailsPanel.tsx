import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Video,
  Image as ImageIcon,
  Archive,
  Package,
  Folder,
  Music,
  File,
  ShieldCheck,
  Zap,
  Wifi,
  Laptop,
  Smartphone,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Pause,
  Play,
  Trash2,
  AlertCircle,
  Activity,
} from 'lucide-react';
import type { TransferQueueItem, TransferFile } from '../context/TransferQueueContext';
import { useTransferQueue } from '../context/TransferQueueContext';
import { useConnectionHealth } from '../context/ConnectionHealthContext';
import { useSettings } from '../context/SettingsContext';
import { formatDuration, formatBytes } from '../services/mockTransferEngine';
import { GlassCloseButton } from './common/GlassCloseButton';
import { modalContentVariants } from '../core/motion/motionTokens';

interface TransferDetailsPanelProps {
  transfer: TransferQueueItem;
  onClose: () => void;
}

export const TransferDetailsPanel: React.FC<TransferDetailsPanelProps> = ({ transfer, onClose }) => {
  const { pauseTransfer, resumeTransfer, retryTransfer, cancelTransfer, removeTransfer } = useTransferQueue();
  const { health, openPanel: openConnectionHealth } = useConnectionHealth();
  const { settings } = useSettings();

  // Escape key dismiss support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const primaryFile = transfer.files[0] || {
    name: 'Payload',
    type: 'other',
    typeLabel: 'File',
    sizeBytes: transfer.totalSize,
    sizeFormatted: transfer.totalSizeFormatted,
  };

  const isLargeFile = transfer.totalSize > 1024 * 1024 * 1024; // >1 GB

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
      case 'audio':
        return <Music className="w-4 h-4 text-[#F5F5F5]" />;
      case 'apk':
        return <Package className="w-4 h-4 text-[#F5F5F5]" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-[#F5F5F5]" />;
      default:
        return <File className="w-4 h-4 text-[#F5F5F5]" />;
    }
  };

  const getPlatformIcon = (platform: string) => {
    if (platform.toLowerCase().includes('mac') || platform.toLowerCase().includes('windows')) {
      return <Laptop className="w-3.5 h-3.5 text-[#F5F5F5]" />;
    }
    return <Smartphone className="w-3.5 h-3.5 text-[#F5F5F5]" />;
  };

  const getStatusBadge = () => {
    switch (transfer.status) {
      case 'transferring':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] text-white text-[11px] font-medium border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Transferring {Math.round(transfer.progress)}%
          </span>
        );
      case 'preparing':
      case 'connecting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] text-[#A6A8AD] text-[11px] font-medium border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-ping" />
            {transfer.status === 'preparing' ? 'Preparing' : 'Connecting'}
          </span>
        );
      case 'queued':
        return (
          <span className="px-2.5 py-1 rounded-full bg-white/[0.04] text-[#A6A8AD] text-[11px] font-medium border border-white/10">
            Queued
          </span>
        );
      case 'paused':
        return (
          <span className="px-2.5 py-1 rounded-full bg-white/[0.06] text-[#A6A8AD] text-[11px] font-medium border border-white/15">
            Paused ({Math.round(transfer.progress)}%)
          </span>
        );
      case 'interrupted':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/[0.12] text-amber-300 text-[11px] font-medium border border-amber-500/30">
            <AlertCircle className="w-3 h-3 text-amber-300" />
            Connection interrupted
          </span>
        );
      case 'reconnecting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/[0.12] text-blue-300 text-[11px] font-medium border border-blue-500/30">
            <RefreshCw className="w-3 h-3 text-blue-300 animate-spin" />
            Reconnecting {transfer.reconnectAttempt ? `(${transfer.reconnectAttempt}/5)` : '…'}
          </span>
        );
      case 'resuming':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/[0.12] text-emerald-300 text-[11px] font-medium border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Resuming • {Math.round(transfer.progress)}%
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.1] text-white text-[11px] font-medium border border-white/20">
            <CheckCircle2 className="w-3 h-3 text-white" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] text-[#A6A8AD] text-[11px] font-medium border border-white/15">
            <AlertCircle className="w-3 h-3 text-[#A6A8AD]" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full bg-white/[0.04] text-[#686B72] text-[11px] font-medium border border-white/10">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pt-20 sm:pt-24 bg-black/70 backdrop-blur-md"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        variants={settings.reducedMotion ? undefined : modalContentVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[32px] smoked-glass-card border border-white/15 shadow-2xl p-6 sm:p-7 flex flex-col space-y-6"
      >
        {/* Header with Working Dedicated GlassCloseButton */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10">
              {renderFileIcon(primaryFile.type)}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#F5F5F5] tracking-tight">Transfer Details</h2>
              <p className="text-xs text-[#A6A8AD]">Inspection & metadata overview</p>
            </div>
          </div>
          <GlassCloseButton onClose={onClose} ariaLabel="Close transfer details" title="Close transfer details" />
        </div>

        {/* Primary File Info & Status */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between">
          <div className="min-w-0 pr-3">
            <div className="text-sm font-semibold text-[#F5F5F5] truncate">{primaryFile.name}</div>
            <div className="text-xs text-[#A6A8AD] flex items-center gap-2 mt-0.5">
              <span>{transfer.totalSizeFormatted}</span>
              <span>•</span>
              <span>{transfer.files.length} {transfer.files.length === 1 ? 'file' : 'files'}</span>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Large File Banner (>1 GB) */}
        {isLargeFile && (
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/15 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-white/[0.08] text-white mt-0.5">
              <Package className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5">
                <span>Large file</span>
                <span className="text-[10px] text-[#A6A8AD] px-1.5 py-0.5 rounded bg-white/[0.06]">
                  &gt;1 GB
                </span>
              </div>
              <p className="text-[11px] text-[#A6A8AD] mt-0.5 leading-relaxed">
                Resume support will be provided by the native transfer engine.
              </p>
            </div>
          </div>
        )}

        {/* Recovery / Checkpoint Status Card */}
        {(transfer.status === 'interrupted' || transfer.status === 'reconnecting' || transfer.status === 'resuming' || transfer.isReconnecting) && (
          <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/15 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#F5F5F5]">
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                Resume Checkpoint
              </span>
              <span className="text-[10px] text-[#A6A8AD] font-mono">
                {transfer.reconnectAttempt ? `Attempt ${transfer.reconnectAttempt}/5` : 'Active'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] text-[#A6A8AD]">Confirmed Bytes</div>
                <div className="font-mono font-bold text-emerald-400">
                  {formatBytes(transfer.transferredSize)}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="text-[10px] text-[#A6A8AD]">Remaining to Resume</div>
                <div className="font-mono font-bold text-amber-300">
                  {formatBytes(Math.max(0, transfer.totalSize - transfer.transferredSize))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Source Device */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#686B72]">Source</div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F5F5F5] truncate">
              {getPlatformIcon(transfer.sourceDevice.platform)}
              <span className="truncate">{transfer.sourceDevice.deviceName}</span>
            </div>
            <div className="text-[11px] text-[#A6A8AD]">{transfer.sourceDevice.userName}</div>
          </div>

          {/* Destination Device */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#686B72]">Destination</div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F5F5F5] truncate">
              {getPlatformIcon(transfer.destinationDevice.platform)}
              <span className="truncate">{transfer.destinationDevice.deviceName}</span>
            </div>
            <div className="text-[11px] text-[#A6A8AD]">{transfer.destinationDevice.userName}</div>
          </div>

          {/* Transfer Mode */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#686B72]">Transfer Mode</div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F5F5F5]">
              {transfer.mode === 'direct' ? <Zap className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>{transfer.mode === 'direct' ? '⚡ Direct Nearby' : '📶 Local Wi-Fi'}</span>
            </div>
          </div>

          {/* Direction */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#686B72]">Direction</div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F5F5F5]">
              {transfer.direction === 'send' ? (
                <>
                  <ArrowUp className="w-3.5 h-3.5" />
                  <span>Outbound Send</span>
                </>
              ) : (
                <>
                  <ArrowDown className="w-3.5 h-3.5" />
                  <span>Inbound Receive</span>
                </>
              )}
            </div>
          </div>

          {/* Speed & Duration */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#686B72]">Transfer Speed</div>
            <div className="text-xs font-mono font-bold text-[#F5F5F5]">
              {transfer.speed > 0 ? `${transfer.speed} MB/s` : '--'}
            </div>
          </div>

          {/* Duration */}
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-[10px] font-mono uppercase text-[#686B72]">Duration</div>
            <div className="text-xs font-mono font-bold text-[#F5F5F5]">
              {formatDuration(transfer.durationSeconds)}
            </div>
          </div>
        </div>

        {/* Multi-file list if >1 file */}
        {transfer.files.length > 1 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider flex items-center justify-between">
              <span>Files ({transfer.files.length})</span>
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {transfer.files.map((file: TransferFile) => (
                <div
                  key={file.id}
                  className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div className="p-1.5 rounded-lg bg-white/[0.04]">
                      {renderFileIcon(file.type)}
                    </div>
                    <div className="truncate font-medium text-[#F5F5F5]">{file.name}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-[#A6A8AD]">{file.sizeFormatted}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        file.status === 'completed'
                          ? 'bg-white/10 text-white font-semibold'
                          : file.status === 'transferring'
                          ? 'bg-white/[0.06] text-white animate-pulse'
                          : 'text-[#686B72]'
                      }`}
                    >
                      {file.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 59: Transfer Telemetry Diagnostics */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#F5F5F5]">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#A6A8AD]" />
              Transfer Telemetry
            </span>
            <span className="text-[10px] text-[#A6A8AD] font-mono capitalize">
              {health.state || 'Stable'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-0.5">
              <span className="text-[10px] text-[#686B72] block">Current Speed</span>
              <span className="font-mono text-white font-medium">
                {transfer.speed > 0 ? `${transfer.speed} MB/s` : health.currentSpeedMBps > 0 ? `${health.currentSpeedMBps} MB/s` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-0.5">
              <span className="text-[10px] text-[#686B72] block">Rolling Avg</span>
              <span className="font-mono text-white font-medium">
                {health.averageSpeedMBps > 0 ? `${health.averageSpeedMBps} MB/s` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-0.5">
              <span className="text-[10px] text-[#686B72] block">Peak Speed</span>
              <span className="font-mono text-white font-medium">
                {health.peakSpeedMBps > 0 ? `${health.peakSpeedMBps} MB/s` : '—'}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-0.5">
              <span className="text-[10px] text-[#686B72] block">Latency (RTT)</span>
              <span className="font-mono text-white font-medium">
                {health.latencyMs > 0 ? `${health.latencyMs} ms` : '—'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#686B72] font-mono pt-0.5">
            <span>Reconnects: {health.reconnectAttempts || 0}</span>
            <span>Mode: {transfer.mode === 'direct' ? 'Direct P2P' : 'Local Wi-Fi'}</span>
          </div>
        </div>


        {/* Security / Native Note & Connection Health Trigger */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#F5F5F5]" />
            <span className="text-xs font-semibold text-[#F5F5F5]">Native transfer security</span>
          </div>
          <button
            type="button"
            onClick={openConnectionHealth}
            className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-medium text-[#F5F5F5] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Activity className="w-3 h-3 text-[#A6A8AD]" />
            <span>Connection Health</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          {transfer.status === 'transferring' && (
            <button
              onClick={() => pauseTransfer(transfer.id)}
              className="flex-1 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Transfer</span>
            </button>
          )}

          {transfer.status === 'paused' && (
            <button
              onClick={() => resumeTransfer(transfer.id)}
              className="flex-1 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Resume Transfer</span>
            </button>
          )}

          {(transfer.status === 'failed' || transfer.status === 'cancelled') && (
            <button
              onClick={() => retryTransfer(transfer.id)}
              className="flex-1 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Transfer</span>
            </button>
          )}

          {(transfer.status === 'transferring' || transfer.status === 'paused' || transfer.status === 'queued') && (
            <button
              onClick={() => {
                cancelTransfer(transfer.id);
                onClose();
              }}
              className="px-5 py-2.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#A6A8AD] hover:text-white border border-white/10 text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel Transfer
            </button>
          )}

          {(transfer.status === 'completed' || transfer.status === 'failed' || transfer.status === 'cancelled') && (
            <button
              onClick={() => {
                removeTransfer(transfer.id);
                onClose();
              }}
              className="px-4 py-2.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-[#A6A8AD] hover:text-white border border-white/10 text-xs font-medium cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
