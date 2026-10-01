import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Zap,
  Wifi,
  Laptop,
  Smartphone,
  Check,
  Package,
  FileText,
  Video,
  Image as ImageIcon,
  Archive,
  Folder,
  File,
  ArrowDown,
  Lock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Eye,
  Radio,
  Clock,
  Music,
} from 'lucide-react';
import { useIncomingTransfer } from '../context/IncomingTransferContext';
import { useSettings } from '../context/SettingsContext';
import { useProfileDevice } from '../context/ProfileDeviceContext';
import { useDeviceTrust } from '../context/DeviceTrustContext';
import { usePlatformReadiness } from '../context/PlatformReadinessContext';
import { useSecurity } from '../context/SecurityContext';
import { formatStorageDisplay } from '../services/platformReadiness';
import { Ban, AlertCircle } from 'lucide-react';
import type { TransferFile } from '../context/TransferQueueContext';

export const IncomingTransferRequest: React.FC = () => {
  const {
    isModalOpen,
    currentRequest,
    pendingCount,
    activeRequestIndex,
    flowState,
    autoAcceptedNotice,
    acceptIncomingRequest,
    rejectIncomingRequest,
    dismissRequest,
    nextRequest,
    prevRequest,
    completePairingAndAccept,
    cancelPairing,
  } = useIncomingTransfer();

  const { settings } = useSettings();
  const { devices } = useProfileDevice();
  const { isDeviceBlocked, isDeviceTrusted, completePairing } = useDeviceTrust();
  const { canEstablishSession, getSecurityState } = useSecurity();
  const { checkStorageReadiness, openReadinessScreen } = usePlatformReadiness();
  const isReducedMotion = settings.reducedMotion;

  const [previewFile, setPreviewFile] = useState<TransferFile | null>(null);
  const [showAllFilesModal, setShowAllFilesModal] = useState(false);
  const [showRejectConfirmModal, setShowRejectConfirmModal] = useState(false);
  const [pairingDecisionStep, setPairingDecisionStep] = useState<'pin' | 'decision'>('pin');

  // Local user device profile
  const localMacDevice = devices.find((d) => d.platform === 'macOS') || devices[0];

  if (!isModalOpen || !currentRequest) return null;

  const { senderProfile, files, totalSizeFormatted, mode, expiresInSeconds, isTrustedSender, status, totalSize } = currentRequest;
  const isLargeFile = currentRequest.files.some((f) => f.sizeBytes > 1024 * 1024 * 1024);
  const isExpired = status === 'expired' || expiresInSeconds <= 0;
  const isBlocked = isDeviceBlocked(senderProfile.id) || isDeviceBlocked(senderProfile.deviceName);
  const securityState = getSecurityState(senderProfile.id);
  const effectiveIsTrusted = isDeviceTrusted(senderProfile.id) || isTrustedSender || canEstablishSession(senderProfile.id) || securityState.verified;
  const storageCheck = checkStorageReadiness(totalSize);

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

  const displayedFiles = files.length > 4 ? files.slice(0, 3) : files;
  const remainingFilesCount = files.length > 4 ? files.length - 3 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto pointer-events-auto bg-black/45 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl rounded-[36px] smoked-glass-hero border border-white/[0.18] p-6 sm:p-8 flex flex-col shadow-2xl overflow-hidden my-auto"
        style={{
          background:
            'linear-gradient(145deg, rgba(255, 255, 255, 0.055) 0%, rgba(15, 17, 22, 0.85) 50%, rgba(255, 255, 255, 0.025) 100%)',
          backdropFilter: 'blur(40px) saturate(140%)',
          WebkitBackdropFilter: 'blur(40px) saturate(140%)',
        }}
      >
        {/* Ambient Top Glint */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-28 bg-white/[0.05] rounded-full blur-2xl pointer-events-none" />

        {/* ========================================================= */}
        {/* STAGE BLOCKED: DEVICE IS BLOCKED BY USER PROFILE          */}
        {/* ========================================================= */}
        {isBlocked ? (
          <div className="flex flex-col items-center text-center space-y-5 py-4">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#686B72]">
              <Ban className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[#F5F5F5] tracking-tight">
                Blocked Device
              </h3>
              <p className="text-xs text-[#A6A8AD] max-w-sm">
                This device is blocked by your NearShare profile. Incoming transfer requests cannot be accepted.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-[#686B72] font-mono">
              Sender: {senderProfile.name} ({senderProfile.deviceName})
            </div>

            <button
              onClick={() => dismissRequest(currentRequest.id)}
              className="px-6 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : flowState === 'pairing' ? (
          /* ========================================================= */
          /* STAGE A: PAIRING VERIFICATION & TRUST DECISION            */
          /* ========================================================= */
          pairingDecisionStep === 'pin' ? (
            <div className="flex flex-col items-center text-center space-y-5 py-2">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/20 flex items-center justify-center shadow-inner">
                <Lock className="w-7 h-7 text-white" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#F5F5F5] tracking-tight">
                  Pairing with {senderProfile.name}
                </h3>
                <p className="text-xs text-[#A6A8AD] max-w-sm">
                  Pairing verification is required for unknown devices before files can be accepted.
                </p>
              </div>

              {/* 6-Digit Verification PIN */}
              <div className="flex items-center gap-2 py-2">
                {'582914'.split('').map((char, index) => (
                  <div
                    key={index}
                    className="w-10 h-12 rounded-xl bg-white/[0.05] border border-white/15 flex items-center justify-center font-mono text-xl font-bold text-[#F5F5F5] shadow-inner"
                  >
                    {char}
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-2 text-xs text-[#A6A8AD]">
                <ShieldCheck className="w-4 h-4 text-white shrink-0" />
                <span>Secure pairing verified • NearShare Local Handshake</span>
              </div>

              <div className="flex items-center gap-3 w-full pt-2">
                <button
                  onClick={cancelPairing}
                  className="flex-1 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setPairingDecisionStep('decision')}
                  className="flex-1 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>Verify PIN</span>
                </button>
              </div>
            </div>
          ) : (
            /* Post-pairing trust decision */
            <div className="flex flex-col items-center text-center space-y-5 py-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.08] border border-white/25 flex items-center justify-center text-white shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-bold text-[#F5F5F5] tracking-tight">
                  Device Paired
                </h3>
                <p className="text-xs text-[#A6A8AD] max-w-sm">
                  {senderProfile.deviceName} can now communicate with your NearShare profile.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-1 w-full max-w-sm text-left">
                <div className="text-sm font-semibold text-[#F5F5F5]">Trust this device?</div>
                <div className="text-xs text-[#A6A8AD]">
                  Trusted devices can be accepted automatically when Auto-accept Trusted Devices is enabled.
                </div>
              </div>

              <div className="flex items-center gap-3 w-full pt-2">
                <button
                  onClick={() => {
                    completePairing(senderProfile.id, 'pin', false);
                    setPairingDecisionStep('pin');
                    completePairingAndAccept();
                  }}
                  className="flex-1 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer"
                >
                  Not Now
                </button>
                <button
                  onClick={() => {
                    completePairing(senderProfile.id, 'pin', true);
                    setPairingDecisionStep('pin');
                    completePairingAndAccept();
                  }}
                  className="flex-1 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Trust Device</span>
                </button>
              </div>
            </div>
          )
        ) : flowState === 'connecting' ? (
          /* ========================================================= */
          /* STAGE B: CONNECTING / PREPARING STATE                     */
          /* ========================================================= */
          <div className="flex flex-col items-center text-center space-y-4 py-8">
            <div className="w-14 h-14 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#F5F5F5] tracking-tight">
                Connecting to {senderProfile.name}...
              </h3>
              <p className="text-xs text-[#A6A8AD]">
                Establishing direct channel & preparing transfer queue...
              </p>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* STAGE C: MAIN INCOMING TRANSFER REQUEST VESSEL            */
          /* ========================================================= */
          <div className="space-y-5">
            {/* Top Multi-Request Switcher & Expiration Notice */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-xs">
              {pendingCount > 1 ? (
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] text-white font-mono font-medium border border-white/15">
                    {activeRequestIndex + 1} of {pendingCount}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={prevRequest}
                      className="p-1 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-white border border-white/10 cursor-pointer"
                      title="Previous request"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={nextRequest}
                      className="p-1 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-white border border-white/10 cursor-pointer"
                      title="Next request"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="font-semibold text-[#F5F5F5] uppercase tracking-wider text-[11px]">
                    Incoming Transfer Request
                  </span>
                </div>
              )}

              {/* Countdown / Expiration */}
              <div className="flex items-center gap-1.5 font-mono text-[#A6A8AD] text-[11px]">
                <Clock className="w-3 h-3 text-[#A6A8AD]" />
                <span>{isExpired ? 'Expired' : `${expiresInSeconds}s`}</span>
              </div>
            </div>

            {/* Auto-Accepted Notice Banner */}
            {autoAcceptedNotice && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-2.5 rounded-xl bg-white/[0.08] border border-white/20 text-xs font-semibold text-white flex items-center justify-center gap-2 text-center"
              >
                <Radio className="w-3.5 h-3.5 animate-spin" />
                <span>{autoAcceptedNotice}</span>
              </motion.div>
            )}

            {/* 1. SENDER IDENTITY HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/[0.035] border border-white/[0.08]">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
                  {senderProfile.avatarInitial}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#F5F5F5] truncate">
                      {senderProfile.name}
                    </h2>
                    <span className="text-xs text-[#A6A8AD] font-mono">
                      {senderProfile.username}
                    </span>
                  </div>
                  <div className="text-xs text-[#A6A8AD] flex items-center gap-1.5 mt-0.5">
                    {getPlatformIcon(senderProfile.platform)}
                    <span className="truncate">{senderProfile.deviceName}</span>
                    <span>•</span>
                    <span>{senderProfile.platform}</span>
                  </div>
                </div>
              </div>

              {/* Trust Badge */}
              <div className="shrink-0 self-start sm:self-auto">
                {effectiveIsTrusted ? (
                  <div className="px-3 py-1 rounded-full bg-white/[0.08] border border-white/20 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-sm">
                    <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                    <span>Trusted Device</span>
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[#A6A8AD] text-[11px] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                    <span>New Device</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. TRANSFER DIRECTION WITH FLOWING SILVER PARTICLES */}
            <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs text-[#A6A8AD]">
              {/* Sender Device */}
              <div className="flex items-center gap-2 min-w-0 max-w-[40%]">
                <div className="p-1.5 rounded-lg bg-white/[0.06] shrink-0">
                  {getPlatformIcon(senderProfile.platform)}
                </div>
                <div className="truncate">
                  <div className="text-[10px] uppercase font-mono text-[#686B72]">From</div>
                  <div className="font-semibold text-[#F5F5F5] truncate">
                    {senderProfile.deviceName}
                  </div>
                </div>
              </div>

              {/* Animated Conduits / Particles Flowing Toward User */}
              <div className="flex flex-col items-center justify-center px-2">
                <div className="relative w-20 h-5 flex items-center justify-center">
                  <div className="absolute inset-x-0 h-[1.5px] rounded-full bg-white/15" />
                  {!isReducedMotion && (
                    <motion.div
                      animate={{ x: [-20, 20], opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute w-4 h-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                    />
                  )}
                  <div className="relative z-10 p-1 rounded-full bg-[#0E0F14] border border-white/20">
                    <ArrowDown className="w-3 h-3 text-white -rotate-90" />
                  </div>
                </div>
              </div>

              {/* User Local Device */}
              <div className="flex items-center gap-2 min-w-0 max-w-[40%] text-right justify-end">
                <div className="truncate">
                  <div className="text-[10px] uppercase font-mono text-[#686B72]">To You</div>
                  <div className="font-semibold text-[#F5F5F5] truncate">
                    {localMacDevice.name}
                  </div>
                </div>
                <div className="p-1.5 rounded-lg bg-white/[0.06] shrink-0">
                  <Laptop className="w-3.5 h-3.5 text-[#F5F5F5]" />
                </div>
              </div>
            </div>

            {/* 3. MODE & TRUST NOTICE */}
            <div className="flex items-center justify-between text-xs text-[#A6A8AD] px-1">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-white/[0.06]">
                  {mode === 'direct' ? (
                    <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" />
                  ) : (
                    <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />
                  )}
                </span>
                <span className="font-semibold text-[#F5F5F5]">
                  {mode === 'direct' ? '⚡ Direct Nearby' : '📶 Local Wi-Fi'}
                </span>
                <span className="text-[#686B72]">•</span>
                <span className="text-[#A6A8AD]">
                  {mode === 'direct' ? 'Nearby device-to-device transfer' : 'Local network transfer'}
                </span>
              </div>
            </div>

            {/* 4. FILE SUMMARY & PREVIEW LIST */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                <span className="text-[#F5F5F5]">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </span>
                <span className="font-mono text-white">{totalSizeFormatted} total</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                {displayedFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setPreviewFile(file)}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 text-white shrink-0">
                        {renderFileIcon(file.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#F5F5F5] truncate group-hover:text-white">
                          {file.name}
                        </div>
                        <div className="text-[11px] text-[#A6A8AD]">{file.typeLabel}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-[#A6A8AD]">{file.sizeFormatted}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFile(file);
                        }}
                        className="p-1 rounded-full text-[#686B72] hover:text-white hover:bg-white/10 transition-colors"
                        title="Preview details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {remainingFilesCount > 0 && (
                  <button
                    onClick={() => setShowAllFilesModal(true)}
                    className="w-full py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] text-xs font-medium text-[#A6A8AD] hover:text-white transition-colors cursor-pointer"
                  >
                    + {remainingFilesCount} more files • View All Files
                  </button>
                )}
              </div>

              {/* Storage Warning Notice */}
              {!storageCheck.ready && (
                <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/20 flex items-start justify-between gap-2.5 text-xs">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertCircle className="w-4 h-4 text-white shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="font-bold text-white block">Not enough storage</span>
                      <span className="text-[#A6A8AD]">
                        Free up at least {formatStorageDisplay(currentRequest.totalSize)} before receiving this transfer.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReadinessScreen()}
                    className="px-2.5 py-1 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-semibold text-white cursor-pointer shrink-0"
                  >
                    Storage
                  </button>
                </div>
              )}

              {/* Large File Notice */}
              {isLargeFile && (
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5 text-xs text-[#A6A8AD]">
                  <Package className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <span>
                    Large file • Large files will use chunked transfer and resume support in the native transfer engine.
                  </span>
                </div>
              )}
            </div>

            {/* 5. ACTION BUTTONS */}
            <div className="flex items-center gap-3 pt-3 border-t border-white/10">
              {isExpired ? (
                <div className="w-full flex items-center justify-between">
                  <span className="text-xs text-[#A6A8AD]">
                    Incoming transfer request is no longer available.
                  </span>
                  <button
                    onClick={() => dismissRequest(currentRequest.id)}
                    className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setShowRejectConfirmModal(true)}
                    className="px-6 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer hover:bg-white/[0.08] transition-all"
                  >
                    Reject
                  </button>

                  <button
                    disabled={!storageCheck.ready}
                    onClick={() => acceptIncomingRequest(currentRequest.id)}
                    className={`flex-1 py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all ${
                      storageCheck.ready
                        ? 'smoked-btn-primary hover:scale-[1.02]'
                        : 'bg-white/[0.04] text-[#686B72] border border-white/10 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Accept Transfer</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* ========================================================= */}
      {/* MODAL 1: REJECT CONFIRMATION MODAL                        */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showRejectConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 rounded-[28px] smoked-glass-card border border-white/15 shadow-2xl space-y-4 text-center"
            >
              <h3 className="text-base font-bold text-[#F5F5F5]">Reject Transfer?</h3>
              <p className="text-xs text-[#A6A8AD] leading-relaxed">
                Files from this request will not be received.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowRejectConfirmModal(false)}
                  className="flex-1 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer"
                >
                  Keep
                </button>
                <button
                  onClick={() => {
                    setShowRejectConfirmModal(false);
                    rejectIncomingRequest(currentRequest.id);
                  }}
                  className="flex-1 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[#F5F5F5] border border-white/20 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: VIEW ALL FILES LIST MODAL                        */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showAllFilesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md p-6 rounded-[32px] smoked-glass-card border border-white/20 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="text-base font-bold text-[#F5F5F5]">All Incoming Files</h3>
                  <p className="text-xs text-[#A6A8AD]">
                    {files.length} items • {totalSizeFormatted}
                  </p>
                </div>
                <button
                  onClick={() => setShowAllFilesModal(false)}
                  className="p-1.5 rounded-full text-[#A6A8AD] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                {files.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => {
                      setPreviewFile(file);
                      setShowAllFilesModal(false);
                    }}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 text-white">
                        {renderFileIcon(file.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#F5F5F5] truncate">
                          {file.name}
                        </div>
                        <div className="text-[11px] text-[#A6A8AD]">{file.typeLabel}</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-[#A6A8AD]">{file.sizeFormatted}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowAllFilesModal(false)}
                className="w-full py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer"
              >
                Close List
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: FILE PREVIEW MODAL                               */}
      {/* ========================================================= */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 rounded-[32px] smoked-glass-card border border-white/20 shadow-2xl space-y-4 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center mx-auto text-white shadow-inner">
                {renderFileIcon(previewFile.type)}
              </div>

              <div>
                <h3 className="text-base font-bold text-[#F5F5F5] truncate px-2">
                  {previewFile.name}
                </h3>
                <p className="text-xs text-[#A6A8AD] mt-0.5">{previewFile.typeLabel}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-left pt-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="text-[10px] uppercase font-mono text-[#686B72]">Size</div>
                  <div className="font-semibold text-[#F5F5F5]">{previewFile.sizeFormatted}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="text-[10px] uppercase font-mono text-[#686B72]">Type</div>
                  <div className="font-semibold text-[#F5F5F5] uppercase">{previewFile.type}</div>
                </div>
              </div>

              <button
                onClick={() => setPreviewFile(null)}
                className="w-full py-2.5 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
              >
                Close Preview
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
