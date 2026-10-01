import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Wifi,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Image as ImageIcon,
  Video,
  FileText,
  Package,
  Folder,
  Music,
  Archive,
  File,
  X,
  Check,
  Smartphone,
  Laptop,
  Monitor,
  Lock,
  Clock,
  HardDrive,
  Edit3,
  Eye,
} from 'lucide-react';
import { useTransferComposer, type TransferItem } from '../context/TransferComposerContext';
import { useTransferQueue } from '../context/TransferQueueContext';
import { useDeviceTrust } from '../context/DeviceTrustContext';
import { useProfileDevice, type Device } from '../context/ProfileDeviceContext';
import { useSettings, type DownloadLocation } from '../context/SettingsContext';
import { useConnectionHealth } from '../context/ConnectionHealthContext';
import { usePlatformReadiness } from '../context/PlatformReadinessContext';
import { useSecurity } from '../context/SecurityContext';
import { deriveSessionBoundSas } from '../core/security/crypto/SasDerivation';

export interface TransferReviewScreenProps {
  onBack?: () => void;
  onEditFiles?: () => void;
  onChangeDevice?: () => void;
  onProceedToQueue?: () => void;
  onProceedToPairing?: (targetDevice: Device) => void;
  // Optional direct overrides for incoming/custom reviews
  customDirection?: 'send' | 'receive';
  customDestinationDevice?: Device | null;
  customFiles?: TransferItem[];
}

const MOCK_SAVE_LOCATIONS: { name: DownloadLocation; path: string }[] = [
  { name: 'Downloads', path: '~/Downloads' },
  { name: 'Desktop', path: '~/Desktop' },
  { name: 'Documents', path: '~/Documents' },
  { name: 'Pictures', path: '~/Pictures' },
];

export const TransferReviewScreen: React.FC<TransferReviewScreenProps> = ({
  onBack,
  onEditFiles,
  onChangeDevice,
  onProceedToQueue,
  onProceedToPairing,
  customDirection,
  customDestinationDevice,
  customFiles,
}) => {
  const {
    selectedFiles: composerFiles,
    destinationDevice: composerDestination,
    direction: composerDirection,
    transferMode,
    setTransferMode,
  } = useTransferComposer();

  const { addTransfer } = useTransferQueue();
  const { userProfile, devices } = useProfileDevice();
  const { isDeviceBlocked, isDeviceTrusted, isDevicePaired, completePairing } = useDeviceTrust();
  const { getSecurityState, canEstablishSession } = useSecurity();
  const { settings, updateSettings } = useSettings();
  const { openPanel: openConnectionHealth } = useConnectionHealth();
  const { checkModeReadiness, checkStorageReadiness, openReadinessScreen } = usePlatformReadiness();
  const isReducedMotion = settings.reducedMotion;

  // Active Direction & Items
  const direction = customDirection || composerDirection || 'send';
  const rawFiles = customFiles || composerFiles;
  const rawDestination = customDestinationDevice || composerDestination;

  // Local user device profile
  const localDevice = devices.find((d) => d.platform === 'macOS') || devices[0];

  // Active Remote Device (defaults to primary paired remote if not selected)
  const remoteDevice = rawDestination || devices.find((d) => d.id !== localDevice.id && !d.isBlocked) || devices[1];

  // Source & Destination based on direction
  const sourcePerson = direction === 'send' ? userProfile.name : (remoteDevice?.ownerName || 'Alex Turner');
  const sourceHandle = direction === 'send' ? userProfile.username : (remoteDevice?.userHandle || '@alex_t');
  const sourceDeviceName = direction === 'send' ? localDevice.name : (remoteDevice?.name || 'Alex\'s Poco F7');
  const sourcePlatform = direction === 'send' ? localDevice.platform : (remoteDevice?.platform || 'Android');

  const destPerson = direction === 'send' ? (remoteDevice?.ownerName || 'Alex Turner') : userProfile.name;
  const destHandle = direction === 'send' ? (remoteDevice?.userHandle || '@alex_t') : userProfile.username;
  const destDeviceName = direction === 'send' ? (remoteDevice?.name || 'Alex\'s Poco F7') : localDevice.name;
  const destPlatform = direction === 'send' ? (remoteDevice?.platform || 'Android') : localDevice.platform;

  // Modals & local state
  const [showAllFilesModal, setShowAllFilesModal] = useState(false);
  const [showSaveLocationModal, setShowSaveLocationModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<TransferItem | null>(null);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [dynamicSasCode, setDynamicSasCode] = useState<string>('— — — — — —');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Escape key handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAllFilesModal) setShowAllFilesModal(false);
        else if (showSaveLocationModal) setShowSaveLocationModal(false);
        else if (isPairingModalOpen) setIsPairingModalOpen(false);
        else if (previewFile) setPreviewFile(null);
        else if (onBack) onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAllFilesModal, showSaveLocationModal, isPairingModalOpen, previewFile, onBack]);

  // Trust & Availability Calculation
  const targetDeviceId = remoteDevice?.id || 'dev-android-01';

  React.useEffect(() => {
    if (isPairingModalOpen && targetDeviceId) {
      deriveSessionBoundSas(`review_pair_${targetDeviceId}`, localDevice.id, targetDeviceId)
        .then((res) => {
          setDynamicSasCode(res.rawCode);
        })
        .catch(() => {
          setDynamicSasCode('— — — — — —');
        });
    }
  }, [isPairingModalOpen, targetDeviceId, localDevice.id]);
  const isBlocked = isDeviceBlocked(targetDeviceId);
  const isTrusted = isDeviceTrusted(targetDeviceId) || remoteDevice?.isTrusted;
  const isPaired = isDevicePaired(targetDeviceId) || isTrusted;
  const securityState = getSecurityState(targetDeviceId);
  const isOffline = remoteDevice?.status === 'offline' || isBlocked;
  const connectionQuality = remoteDevice?.connectionQuality || (transferMode === 'direct' ? 'Excellent' : 'Good');

  // Payload stats & calculations
  const totalSizeBytes = useMemo(() => rawFiles.reduce((acc, f) => acc + f.size, 0), [rawFiles]);

  const totalSizeFormatted = useMemo(() => {
    if (totalSizeBytes === 0) return '0 B';
    if (totalSizeBytes >= 1024 * 1024 * 1024) return `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (totalSizeBytes >= 1024 * 1024) return `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(totalSizeBytes / 1024).toFixed(1)} KB`;
  }, [totalSizeBytes]);

  const hasFolder = rawFiles.some((f) => f.isFolder || f.type === 'archive');
  const totalItemsCount = rawFiles.reduce((acc, f) => acc + (f.itemCount || 1), 0);
  const isLargeTransfer = totalSizeBytes > 1024 * 1024 * 1024 || rawFiles.some((f) => f.size > 1024 * 1024 * 1024);

  // Transfer duration estimate based on mock bitrate
  const estimatedSeconds = useMemo(() => {
    const mockSpeedBytesPerSec = transferMode === 'direct' ? 42 * 1024 * 1024 : 18 * 1024 * 1024;
    return Math.max(1, Math.round(totalSizeBytes / mockSpeedBytesPerSec));
  }, [totalSizeBytes, transferMode]);

  const formatEstimatedTime = (seconds: number) => {
    if (seconds < 60) return `~${seconds} sec`;
    const mins = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `~${mins} min ${remaining > 0 ? `${remaining} sec` : ''}`;
  };

  // Pre-flight conditions
  const modeReadiness = checkModeReadiness(transferMode);
  const storageReadiness = checkStorageReadiness(totalSizeBytes);

  const hasFiles = rawFiles.length > 0;
  const hasDestination = !!remoteDevice && !isBlocked;
  const isDeviceAvailable = !isOffline;
  const isPairingVerified = isPaired || securityState.verified || canEstablishSession(targetDeviceId) || !settings.unknownDeviceProtection;
  const isPermissionsReady = modeReadiness.ready;
  const isStorageReady = storageReadiness.ready;

  const isReadyToSend =
    hasFiles &&
    hasDestination &&
    isDeviceAvailable &&
    isPairingVerified &&
    isPermissionsReady &&
    isStorageReady;

  // File icon helper
  const renderFileIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="w-4 h-4 text-[#F5F5F5]" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-[#F5F5F5]" />;
      case 'audio':
        return <Music className="w-4 h-4 text-[#F5F5F5]" />;
      case 'document':
        return <FileText className="w-4 h-4 text-[#F5F5F5]" />;
      case 'apk':
        return <Package className="w-4 h-4 text-[#F5F5F5]" />;
      case 'archive':
        return <Archive className="w-4 h-4 text-[#F5F5F5]" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-[#F5F5F5]" />;
      default:
        return <File className="w-4 h-4 text-[#F5F5F5]" />;
    }
  };

  const renderPlatformIcon = (platform: string) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('mac')) return <Laptop className="w-4 h-4 text-[#F5F5F5]" />;
    if (p.includes('win')) return <Monitor className="w-4 h-4 text-[#F5F5F5]" />;
    return <Smartphone className="w-4 h-4 text-[#F5F5F5]" />;
  };

  // Handoff to TransferQueueContext
  const handleConfirmTransfer = () => {
    if (!isReadyToSend || isSubmitting) return;

    setIsSubmitting(true);

    setTimeout(() => {
      addTransfer({
        direction: direction === 'send' ? 'send' : 'receive',
        mode: transferMode,
        sourceDevice: {
          id: direction === 'send' ? localDevice.id : (remoteDevice?.id || 'dev-remote-1'),
          userName: sourcePerson,
          userHandle: sourceHandle,
          deviceName: sourceDeviceName,
          platform: sourcePlatform as any,
        },
        destinationDevice: {
          id: direction === 'send' ? (remoteDevice?.id || 'dev-remote-1') : localDevice.id,
          userName: destPerson,
          userHandle: destHandle,
          deviceName: destDeviceName,
          platform: destPlatform as any,
        },
        files: rawFiles.map((f) => ({
          id: f.id,
          name: f.name,
          sizeBytes: f.size,
          sizeFormatted: f.sizeFormatted,
          type: f.type,
          typeLabel: f.isFolder ? 'Folder' : f.type.toUpperCase(),
          status: 'queued',
          progress: 0,
        })),
        totalSize: totalSizeBytes,
        status: 'queued',
      });

      if (onProceedToQueue) {
        onProceedToQueue();
      }
    }, 250);
  };

  return (
    <motion.div
      initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
      animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
      exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-2xl mx-auto px-3 sm:px-4 py-3 flex flex-col space-y-4 select-none pointer-events-auto"
    >
      {/* 1. Header & Back Action */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] transition-all cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F5]">
              {direction === 'send' ? 'Review Transfer' : 'Review Incoming Transfer'}
            </h2>
            <p className="text-xs text-[#A6A8AD] mt-0.5">
              {direction === 'send'
                ? 'Everything looks ready to send.'
                : 'Everything looks ready to receive.'}
            </p>
          </div>
        </div>

        {/* Transfer Mode Quick Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-white/[0.03] border border-white/10">
          <button
            type="button"
            onClick={() => setTransferMode('direct')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              transferMode === 'direct'
                ? 'bg-white/15 text-[#F5F5F5] shadow-sm'
                : 'text-[#A6A8AD] hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Direct</span>
          </button>
          <button
            type="button"
            onClick={() => setTransferMode('wifi')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              transferMode === 'wifi'
                ? 'bg-white/15 text-[#F5F5F5] shadow-sm'
                : 'text-[#A6A8AD] hover:text-white'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Wi-Fi</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MAIN TRANSFER REVIEW LIQUID-GLASS VESSEL               */}
      {/* ========================================================= */}
      <div className="relative rounded-[32px] smoked-glass-card border border-white/[0.14] p-5 sm:p-7 shadow-2xl space-y-6 overflow-hidden">
        {/* Subtle glass reflection highlight */}
        <div className="absolute top-0 left-1/3 w-1/3 h-20 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

        {/* TOP CONDUIT: SOURCE → PAYLOAD → DESTINATION */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
          {/* SOURCE CARD (Col 1-3) */}
          <div className="md:col-span-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center text-base font-bold text-[#F5F5F5] shadow-md shrink-0">
              {sourcePerson.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#686B72]">
                {direction === 'send' ? 'Sender (You)' : 'Sender'}
              </div>
              <div className="text-sm font-bold text-[#F5F5F5] truncate">{sourcePerson}</div>
              <div className="text-xs text-[#A6A8AD] font-mono truncate">{sourceHandle}</div>
              <div className="text-[11px] text-[#686B72] truncate mt-0.5 flex items-center gap-1">
                {renderPlatformIcon(sourcePlatform)}
                <span>{sourceDeviceName}</span>
              </div>
            </div>
          </div>

          {/* DIRECTION & PAYLOAD CONDUIT (Col 4) */}
          <div className="md:col-span-1 flex flex-col items-center justify-center py-1">
            <div className="relative w-full flex flex-col items-center justify-center">
              {/* Animated streaming silver particles */}
              {!isReducedMotion ? (
                <div className="flex flex-col items-center gap-1 py-1">
                  <motion.div
                    animate={{ y: [0, 6, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  />
                  <div className="w-0.5 h-8 bg-gradient-to-b from-white/40 via-white/80 to-white/20 rounded-full" />
                  <motion.div
                    animate={{ y: [0, 4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.3, ease: 'easeInOut' }}
                    className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-white/[0.05] border border-white/10 text-white">
                  <ArrowRight className="w-4 h-4 hidden md:block" />
                  <ArrowRight className="w-4 h-4 md:hidden rotate-90" />
                </div>
              )}

              <span className="text-[10px] font-mono text-[#A6A8AD] mt-1 whitespace-nowrap">
                {totalSizeFormatted}
              </span>
            </div>
          </div>

          {/* DESTINATION CARD (Col 5-7) */}
          <div className="md:col-span-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center text-base font-bold text-[#F5F5F5] shadow-md shrink-0">
                {destPerson.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#686B72]">
                  {direction === 'send' ? 'Recipient' : 'Recipient (You)'}
                </div>
                <div className="text-sm font-bold text-[#F5F5F5] truncate">{destPerson}</div>
                <div className="text-xs text-[#A6A8AD] font-mono truncate">{destHandle}</div>
                <div className="text-[11px] text-[#686B72] truncate mt-0.5 flex items-center gap-1">
                  {renderPlatformIcon(destPlatform)}
                  <span>{destDeviceName}</span>
                </div>
              </div>
            </div>

            {onChangeDevice && direction === 'send' && (
              <button
                type="button"
                onClick={onChangeDevice}
                title="Change Destination Device"
                className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-[#A6A8AD] hover:text-white cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3. FILE SUMMARY LIST & FOLDER DETAILS */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F5F5F5]">
              <span>
                {rawFiles.length} {rawFiles.length === 1 ? 'file' : 'files'}
                {hasFolder ? ` (${totalItemsCount} items)` : ''}
              </span>
              <span className="text-[#686B72]">•</span>
              <span className="font-mono text-[#A6A8AD]">{totalSizeFormatted} total</span>
            </div>

            <div className="flex items-center gap-2">
              {onEditFiles && direction === 'send' && (
                <button
                  type="button"
                  onClick={onEditFiles}
                  className="text-xs text-[#A6A8AD] hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
                >
                  Edit Files
                </button>
              )}
              {rawFiles.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllFilesModal(true)}
                  className="px-2.5 py-1 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-[#F5F5F5] cursor-pointer"
                >
                  View All ({rawFiles.length})
                </button>
              )}
            </div>
          </div>

          {/* Files preview list */}
          <div className="space-y-2">
            {rawFiles.slice(0, 3).map((file) => (
              <div
                key={file.id}
                onClick={() => setPreviewFile(file)}
                className="p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06] flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 text-[#F5F5F5]">
                    {renderFileIcon(file.type)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[#F5F5F5] truncate">{file.name}</div>
                    <div className="text-[11px] text-[#A6A8AD] font-mono">
                      {file.sizeFormatted} • {file.isFolder ? 'Folder transfer' : file.type.toUpperCase()}
                      {file.itemCount ? ` • ${file.itemCount} files` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[#A6A8AD]">
                  <Eye className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}

            {rawFiles.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllFilesModal(true)}
                className="w-full py-2 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer text-center"
              >
                + {rawFiles.length - 3} more files • Click to inspect all
              </button>
            )}
          </div>

          {/* Large file informational preview */}
          {isLargeTransfer && (
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5 text-xs text-[#A6A8AD]">
              <Package className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#F5F5F5]">Large transfer:</span> Large files will use chunked transfer and resume support in the native transfer engine.
              </div>
            </div>
          )}
        </div>

        {/* 4. METADATA & PARAMETERS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Transfer Mode Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#686B72]">
              Transfer Mode
            </div>
            <div className="text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5">
              {transferMode === 'direct' ? <Zap className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>{transferMode === 'direct' ? '⚡ Direct Nearby' : '📶 Local Wi-Fi'}</span>
            </div>
            <div className="text-[11px] text-[#A6A8AD]">
              {transferMode === 'direct'
                ? 'Nearby • Up to 30 m'
                : 'Local network transfer'}
            </div>
          </div>

          {/* Connection & Trust Status Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#686B72]">
              Connection & Trust
            </div>
            <div className="text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5">
              {isOffline ? (
                <span className="text-[#686B72]">○ Offline</span>
              ) : isTrusted ? (
                <span className="flex items-center gap-1 text-white">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  <span>✓ Trusted Device</span>
                </span>
              ) : isPaired ? (
                <span>Paired Device</span>
              ) : (
                <span className="text-[#A6A8AD]">Pairing Required</span>
              )}
            </div>
            <div className="text-[11px] text-[#A6A8AD] flex items-center justify-between gap-1 pt-0.5">
              <span>
                {isOffline
                  ? 'Device is unavailable'
                  : connectionQuality === 'Weak'
                  ? 'Speed may vary'
                  : `● ${connectionQuality} signal`}
              </span>
              <button
                type="button"
                onClick={openConnectionHealth}
                className="text-[10px] text-[#F5F5F5] underline underline-offset-2 hover:text-white cursor-pointer"
              >
                View connection details
              </button>
            </div>
          </div>

          {/* Estimated Transfer Time Card */}
          <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#686B72]">
              Estimated Time
            </div>
            <div className="text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#A6A8AD]" />
              <span>{formatEstimatedTime(estimatedSeconds)}</span>
            </div>
            <div className="text-[11px] text-[#A6A8AD]">
              {transferMode === 'direct' ? 'Peak ~42 MB/s' : 'Peak ~18 MB/s'}
            </div>
          </div>
        </div>

        {/* 5. DOWNLOAD DESTINATION (FOR INCOMING TRANSFERS) */}
        {direction === 'receive' && (
          <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.07] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <HardDrive className="w-4 h-4 text-[#A6A8AD] shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-mono tracking-wider text-[#686B72] block">
                  Save to Destination
                </span>
                <span className="font-semibold text-[#F5F5F5] truncate block">
                  {settings.downloadLocation || '~/Downloads'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSaveLocationModal(true)}
              className="px-3 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-[#F5F5F5] transition-colors cursor-pointer"
            >
              Change
            </button>
          </div>
        )}

        {/* 6. PRE-FLIGHT READINESS CHECKLIST */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#F5F5F5] uppercase tracking-wider font-mono">
            <span>Pre-Flight Verification</span>
            {(!isPermissionsReady || !isStorageReady) && (
              <button
                type="button"
                onClick={() => openReadinessScreen()}
                className="text-[10px] text-[#F5F5F5] hover:text-white underline underline-offset-2 cursor-pointer normal-case"
              >
                Review readiness →
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2">
              {hasFiles ? (
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-white/20" />
              )}
              <span className={hasFiles ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>
                Files selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              {hasDestination ? (
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-white/20" />
              )}
              <span className={hasDestination ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>
                Destination selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              <span className="text-[#F5F5F5]">Transfer mode ready</span>
            </div>

            <div className="flex items-center gap-2">
              {isDeviceAvailable ? (
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-white/20" />
              )}
              <span className={isDeviceAvailable ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>
                Device available
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isPairingVerified ? (
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-white/20" />
              )}
              <span className={isPairingVerified ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>
                Pairing verified
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isPermissionsReady ? (
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-white/20" />
              )}
              <span className={isPermissionsReady ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>
                Required permissions ready
              </span>
            </div>

            <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
              {isStorageReady ? (
                <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-white/20" />
              )}
              <span className={isStorageReady ? 'text-[#F5F5F5]' : 'text-[#686B72]'}>
                Storage available
              </span>
            </div>
          </div>
        </div>

        {/* 7. PRIMARY ACTIONS & PAIRING INTERCEPTION */}
        <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#A6A8AD] text-center sm:text-left">
            {isBlocked ? (
              <span className="text-[#686B72]">Destination device is blocked by your profile.</span>
            ) : isOffline ? (
              <span className="text-[#686B72]">Selected device is currently offline.</span>
            ) : !isPermissionsReady ? (
              <span className="text-[#A6A8AD]">Platform permission setup required before transfer.</span>
            ) : !isStorageReady ? (
              <span className="text-[#A6A8AD]">Insufficient storage to process transfer.</span>
            ) : !isPairingVerified ? (
              <span className="text-[#A6A8AD]">Security verification required before send.</span>
            ) : (
              <span className="text-[#A6A8AD]">Native transfer security active</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* If permissions or storage need setup, provide Review readiness button */}
            {(!isPermissionsReady || !isStorageReady) && (
              <button
                type="button"
                onClick={() => openReadinessScreen()}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Review readiness →</span>
              </button>
            )}

            {/* If pairing is required, show Verify Device CTA */}
            {isPermissionsReady && isStorageReady && !isPairingVerified && !isOffline && (
              <button
                type="button"
                onClick={() => {
                  if (onProceedToPairing && remoteDevice) {
                    onProceedToPairing(remoteDevice);
                  } else {
                    setIsPairingModalOpen(true);
                  }
                }}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Verify Device →</span>
              </button>
            )}

            {/* Main Action Button */}
            <button
              type="button"
              disabled={!isReadyToSend || isSubmitting}
              onClick={handleConfirmTransfer}
              className={`flex-1 sm:flex-none px-7 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl ${
                isReadyToSend
                  ? 'smoked-btn-primary hover:scale-[1.02]'
                  : 'bg-white/[0.04] text-[#686B72] border border-white/10 cursor-not-allowed opacity-60'
              }`}
            >
              {direction === 'send' ? (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Send ({totalSizeFormatted})</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Accept Transfer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: VIEW ALL FILES MODAL                             */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showAllFilesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 rounded-[32px] bg-[#101114] border border-white/15 shadow-2xl space-y-4 text-left select-none"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-[#F5F5F5]">
                    Selected Transfer Items ({rawFiles.length})
                  </h3>
                  <p className="text-xs text-[#A6A8AD] font-mono mt-0.5">
                    Total payload: {totalSizeFormatted}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllFilesModal(false)}
                  className="p-1.5 rounded-full text-[#A6A8AD] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {rawFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 text-[#F5F5F5]">
                        {renderFileIcon(file.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#F5F5F5] truncate">{file.name}</div>
                        <div className="text-[11px] text-[#A6A8AD] font-mono">
                          {file.sizeFormatted} • {file.type.toUpperCase()}
                          {file.itemCount ? ` • ${file.itemCount} files` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllFilesModal(false)}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: CHANGE SAVE LOCATION MODAL                       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showSaveLocationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-[32px] bg-[#101114] border border-white/15 shadow-2xl space-y-4 text-left select-none"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-base font-bold text-[#F5F5F5]">Save Destination</h3>
                <button
                  type="button"
                  onClick={() => setShowSaveLocationModal(false)}
                  className="p-1.5 rounded-full text-[#A6A8AD] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {MOCK_SAVE_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => {
                      updateSettings({ downloadLocation: loc.name });
                      setShowSaveLocationModal(false);
                    }}
                    className={`w-full p-3 rounded-2xl text-left text-xs border flex items-center justify-between transition-colors cursor-pointer ${
                      settings.downloadLocation === loc.name
                        ? 'bg-white/10 border-white/25 text-[#F5F5F5]'
                        : 'bg-white/[0.02] border-white/5 text-[#A6A8AD] hover:bg-white/[0.06]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-[#F5F5F5]">{loc.name}</div>
                      <div className="text-[11px] text-[#686B72] font-mono">{loc.path}</div>
                    </div>
                    {settings.downloadLocation === loc.name && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: INLINE PAIRING VERIFICATION MODAL                */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isPairingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-[32px] bg-[#101114] border border-white/20 shadow-2xl space-y-4 text-center select-none"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center mx-auto text-white">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F5F5F5]">Verify Pairing SAS</h3>
                <p className="text-xs text-[#A6A8AD] mt-1">
                  Confirm matching 6-digit SAS code on {destDeviceName}.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 py-2">
                {dynamicSasCode.replace(/\s+/g, '').split('').map((char, index) => (
                  <div
                    key={index}
                    className="w-9 h-11 rounded-xl bg-white/[0.05] border border-white/15 flex items-center justify-center font-mono text-lg font-bold text-[#F5F5F5]"
                  >
                    {char}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPairingModalOpen(false)}
                  className="flex-1 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    completePairing(targetDeviceId, 'pin', false);
                    setIsPairingModalOpen(false);
                  }}
                  className="flex-1 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Verify
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: FILE DETAILS PREVIEW MODAL                       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-[32px] bg-[#101114] border border-white/15 shadow-2xl space-y-4 text-left select-none"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                    {renderFileIcon(previewFile.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#F5F5F5] truncate max-w-[180px]">
                      {previewFile.name}
                    </h3>
                    <span className="text-[11px] text-[#A6A8AD] font-mono">
                      {previewFile.sizeFormatted}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 rounded-full text-[#A6A8AD] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs text-[#A6A8AD]">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span>Item Type</span>
                  <span className="capitalize text-[#F5F5F5] font-medium">{previewFile.type}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span>Raw Bytes</span>
                  <span className="font-mono text-[#F5F5F5]">{previewFile.size.toLocaleString()} bytes</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span>Modified Date</span>
                  <span className="text-[#F5F5F5]">{previewFile.modifiedDate || 'Today'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
