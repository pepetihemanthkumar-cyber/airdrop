import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Laptop,
  Smartphone,
  Monitor,
  ShieldCheck,
  Star,
  Edit3,
  Ban,
  Trash2,
  Lock,
  Zap,
  Wifi,
  Radio,
  ArrowRight,
  Check,
  BarChart3,
  Activity,
} from 'lucide-react';
import {
  useDeviceTrust,
  type DeviceRelationship,
} from '../context/DeviceTrustContext';
import { useSettings } from '../context/SettingsContext';
import { useConnectionHealth } from '../context/ConnectionHealthContext';
import { GlassCloseButton } from './common/GlassCloseButton';

interface DeviceTrustDetailsPanelProps {
  device: DeviceRelationship;
  onClose: () => void;
  onStartTransfer?: (deviceId: string) => void;
}

export const DeviceTrustDetailsPanel: React.FC<DeviceTrustDetailsPanelProps> = ({
  device: initialDevice,
  onClose,
  onStartTransfer,
}) => {
  const { openPanel: openConnectionHealth } = useConnectionHealth();
  const {
    getRelationship,
    renameDevice,
    setTrustState,
    toggleFavorite,
    blockDevice,
    unblockDevice,
    removeDevice,
    setPreferredConnectionMode,
  } = useDeviceTrust();

  const { settings } = useSettings();
  const isReducedMotion = settings.reducedMotion;

  // Track live relationship from context
  const currentDevice = getRelationship(initialDevice.deviceId) || initialDevice;

  // Modal states for action confirmations
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInput, setRenameInput] = useState(currentDevice.deviceName);
  const [renameError, setRenameError] = useState('');

  const [isTrustConfirmOpen, setIsTrustConfirmOpen] = useState(false);
  const [isUntrustConfirmOpen, setIsUntrustConfirmOpen] = useState(false);
  const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
  const [isUnblockConfirmOpen, setIsUnblockConfirmOpen] = useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  // Platform icon helper
  const renderPlatformIcon = (platform: DeviceRelationship['platform']) => {
    switch (platform) {
      case 'macOS':
        return <Laptop className="w-4 h-4 text-[#F5F5F5]" />;
      case 'Android':
      case 'iOS':
        return <Smartphone className="w-4 h-4 text-[#F5F5F5]" />;
      case 'Windows':
        return <Monitor className="w-4 h-4 text-[#F5F5F5]" />;
      default:
        return <Laptop className="w-4 h-4 text-[#F5F5F5]" />;
    }
  };

  // Rename handler with validation
  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renameInput.trim();
    if (!trimmed) {
      setRenameError('Device name cannot be empty');
      return;
    }
    if (trimmed.length > 40) {
      setRenameError('Device name cannot exceed 40 characters');
      return;
    }

    renameDevice(currentDevice.deviceId, trimmed);
    setIsRenameOpen(false);
    setRenameError('');
  };

  // Trust / Untrust handler
  const handleConfirmTrust = () => {
    setTrustState(currentDevice.deviceId, 'trusted');
    setIsTrustConfirmOpen(false);
  };

  const handleConfirmUntrust = () => {
    setTrustState(currentDevice.deviceId, 'paired');
    setIsUntrustConfirmOpen(false);
  };

  // Block / Unblock handler
  const handleConfirmBlock = () => {
    blockDevice(currentDevice.deviceId);
    setIsBlockConfirmOpen(false);
  };

  const handleConfirmUnblock = () => {
    unblockDevice(currentDevice.deviceId);
    setIsUnblockConfirmOpen(false);
  };

  // Remove handler
  const handleConfirmRemove = () => {
    removeDevice(currentDevice.deviceId);
    setIsRemoveConfirmOpen(false);
    onClose();
  };

  // Keyboard accessibility: Escape to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRenameOpen) setIsRenameOpen(false);
        else if (isTrustConfirmOpen) setIsTrustConfirmOpen(false);
        else if (isUntrustConfirmOpen) setIsUntrustConfirmOpen(false);
        else if (isBlockConfirmOpen) setIsBlockConfirmOpen(false);
        else if (isUnblockConfirmOpen) setIsUnblockConfirmOpen(false);
        else if (isRemoveConfirmOpen) setIsRemoveConfirmOpen(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRenameOpen, isTrustConfirmOpen, isUntrustConfirmOpen, isBlockConfirmOpen, isUnblockConfirmOpen, isRemoveConfirmOpen, onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pt-20 sm:pt-24 bg-black/60 backdrop-blur-md"
    >
      {/* Floating Liquid Glass Vessel */}
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-[#0c0d11]/90 backdrop-blur-2xl border border-white/15 p-6 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.8),0_0_40px_rgba(255,255,255,0.04)] text-[#F5F5F5] space-y-6 select-none"
      >
        {/* Subtle glass reflection highlight */}
        <div className="absolute top-0 left-1/4 w-1/2 h-20 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

        {/* 1. Header: Close + Favorite Star + More */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#686B72]">
              Device Trust Profile
            </span>
            {currentDevice.blocked && (
              <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono text-[#686B72]">
                Blocked
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!currentDevice.blocked && (
              <button
                type="button"
                onClick={() => toggleFavorite(currentDevice.deviceId)}
                title={currentDevice.favorite ? 'Remove Favorite' : 'Mark as Favorite'}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  currentDevice.favorite
                    ? 'bg-white/15 border-white/30 text-[#F5F5F5]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-[#686B72] hover:text-[#A6A8AD]'
                }`}
              >
                <Star
                  className={`w-4 h-4 ${currentDevice.favorite ? 'fill-[#F5F5F5]' : ''}`}
                />
              </button>
            )}
            <GlassCloseButton onClose={onClose} ariaLabel="Close device trust details" />
          </div>
        </div>

        {/* 2. Device Identity Vessel Card */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/15 to-white/5 border border-white/20 flex items-center justify-center text-xl font-bold text-[#F5F5F5] shadow-lg">
                {currentDevice.avatar || currentDevice.ownerName.charAt(0)}
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-[#08090B] border border-white/15 text-[#A6A8AD]">
                {renderPlatformIcon(currentDevice.platform)}
              </div>
            </div>

            {/* Names & Handle */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-[#F5F5F5] tracking-tight">
                  {currentDevice.ownerName}
                </h3>
                <span className="text-xs text-[#A6A8AD] font-mono">
                  {currentDevice.ownerUsername}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#A6A8AD]">
                <span className="font-semibold text-[#F5F5F5]">{currentDevice.deviceName}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] font-mono">
                  {currentDevice.platform}
                </span>
              </div>
              <div className="text-[10px] text-[#686B72] font-mono">
                ID: {currentDevice.profileId}
              </div>
            </div>
          </div>

          {/* Trust Status Pill */}
          <div className="self-stretch sm:self-center flex sm:flex-col items-center justify-between gap-1.5">
            {currentDevice.blocked ? (
              <span className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-[#686B72] flex items-center gap-1.5">
                <Ban className="w-3.5 h-3.5" />
                <span>Blocked</span>
              </span>
            ) : currentDevice.trustState === 'trusted' ? (
              <span className="px-3 py-1 rounded-full bg-white/[0.08] border border-white/25 text-xs font-semibold text-[#F5F5F5] flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,255,255,0.1)]">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>✓ Trusted</span>
              </span>
            ) : currentDevice.trustState === 'paired' ? (
              <span className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/15 text-xs font-medium text-[#A6A8AD] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Paired Device</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-[#686B72] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Pairing Required</span>
              </span>
            )}
          </div>
        </div>

        {/* 3. Activity & Connection Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#686B72]">
              Last Seen
            </div>
            <div className="text-xs font-semibold text-[#F5F5F5]">
              {currentDevice.lastSeenAt}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#686B72]">
              First Paired
            </div>
            <div className="text-xs font-semibold text-[#F5F5F5]">
              {currentDevice.firstPairedAt || 'Not paired'}
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.07] space-y-1 col-span-2 sm:col-span-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#686B72]">
              Last Transfer
            </div>
            <div className="text-xs font-semibold text-[#F5F5F5]">
              {currentDevice.lastTransferAt || 'Never'}
            </div>
          </div>
        </div>

        {/* 4. Transfer Statistics */}
        <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F5F5F5] flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-[#A6A8AD]" />
              <span>Transfer Statistics</span>
            </span>
            <button
              type="button"
              onClick={openConnectionHealth}
              className="text-[10px] text-[#A6A8AD] hover:text-[#F5F5F5] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-colors cursor-pointer"
            >
              <Activity className="w-3 h-3 text-[#A6A8AD]" />
              <span>Live Diagnostics</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="text-[10px] text-[#A6A8AD] font-mono">Total Transfers</div>
              <div className="text-lg font-bold text-[#F5F5F5] mt-0.5">
                {currentDevice.totalTransfers}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div className="text-[10px] text-[#A6A8AD] font-mono">Data Transferred</div>
              <div className="text-lg font-bold text-[#F5F5F5] mt-0.5">
                {currentDevice.totalBytesFormatted}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Preferred Transfer Mode */}
        <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F5F5F5]">Preferred Transfer Mode</span>
            <span className="text-[10px] font-mono text-[#A6A8AD]">
              Pairing: {currentDevice.pairingMethod === 'qr' ? 'QR Code' : 'Secure PIN'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPreferredConnectionMode(currentDevice.deviceId, 'direct')}
              className={`py-2 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                currentDevice.connectionMode === 'direct'
                  ? 'bg-white/10 border-white/25 text-[#F5F5F5]'
                  : 'bg-white/[0.02] border-white/5 text-[#A6A8AD] hover:bg-white/[0.05]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Direct Nearby</span>
            </button>
            <button
              type="button"
              onClick={() => setPreferredConnectionMode(currentDevice.deviceId, 'wifi')}
              className={`py-2 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                currentDevice.connectionMode === 'wifi'
                  ? 'bg-white/10 border-white/25 text-[#F5F5F5]'
                  : 'bg-white/[0.02] border-white/5 text-[#A6A8AD] hover:bg-white/[0.05]'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Wi-Fi Mesh</span>
            </button>
            <button
              type="button"
              onClick={() => setPreferredConnectionMode(currentDevice.deviceId, 'auto')}
              className={`py-2 px-2.5 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                currentDevice.connectionMode === 'auto'
                  ? 'bg-white/10 border-white/25 text-[#F5F5F5]'
                  : 'bg-white/[0.02] border-white/5 text-[#A6A8AD] hover:bg-white/[0.05]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Automatic</span>
            </button>
          </div>

          {currentDevice.connectionMode === 'auto' && (
            <div className="text-[11px] text-[#A6A8AD] italic">
              "NearShare will choose an available transfer mode in the native engine."
            </div>
          )}
        </div>

        {/* 6. Pairing & Relationship History Log */}
        <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F5F5F5]">Pairing & Trust History</span>
            <span className="text-[10px] font-mono text-[#686B72]">
              {currentDevice.pairingHistory.length} events
            </span>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {currentDevice.pairingHistory.length > 0 ? (
              currentDevice.pairingHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between p-2 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-[#F5F5F5] font-medium">{entry.description}</div>
                    <div className="text-[10px] font-mono text-[#686B72]">{entry.date}</div>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 mt-1.5" />
                </div>
              ))
            ) : (
              <div className="text-xs text-[#686B72] py-2 text-center">
                No pairing events recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* 7. Action Buttons Bar */}
        <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          {/* Left Actions (Rename, Trust/Untrust, Block/Unblock) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRenameInput(currentDevice.deviceName);
                setRenameError('');
                setIsRenameOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#F5F5F5] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#A6A8AD]" />
              <span>Rename</span>
            </button>

            {!currentDevice.blocked && (
              <>
                {currentDevice.trustState === 'trusted' ? (
                  <button
                    type="button"
                    onClick={() => setIsUntrustConfirmOpen(true)}
                    className="px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#A6A8AD]" />
                    <span>Untrust</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsTrustConfirmOpen(true)}
                    className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/20 text-xs font-medium text-[#F5F5F5] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    <span>Trust Device</span>
                  </button>
                )}
              </>
            )}

            {currentDevice.blocked ? (
              <button
                type="button"
                onClick={() => setIsUnblockConfirmOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/20 text-xs font-medium text-[#F5F5F5] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-[#A6A8AD]" />
                <span>Unblock</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsBlockConfirmOpen(true)}
                className="px-3.5 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-[#686B72] hover:text-[#A6A8AD] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Block</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsRemoveConfirmOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 text-xs font-medium text-[#686B72] hover:text-[#A6A8AD] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>

          {/* Right Action: Send Files (if not blocked) */}
          {!currentDevice.blocked && onStartTransfer && (
            <button
              type="button"
              onClick={() => {
                onStartTransfer(currentDevice.deviceId);
                onClose();
              }}
              className="px-4 py-1.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg hover:scale-105 transition-all"
            >
              <span>Send Files</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>

      {/* ======================================================= */}
      {/* ACTION CONFIRMATION MODALS                              */}
      {/* ======================================================= */}

      {/* 1. Rename Modal */}
      <AnimatePresence>
        {isRenameOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-[#101114] border border-white/20 shadow-2xl space-y-4 text-left"
            >
              <h4 className="text-base font-bold text-[#F5F5F5]">Rename Device</h4>
              <p className="text-xs text-[#A6A8AD]">
                Set a custom name for this device in your NearShare profile.
              </p>
              <form onSubmit={handleSaveRename} className="space-y-4">
                <div>
                  <input
                    type="text"
                    value={renameInput}
                    onChange={(e) => {
                      setRenameInput(e.target.value);
                      if (renameError) setRenameError('');
                    }}
                    maxLength={40}
                    placeholder="Device name"
                    className="w-full px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/15 text-sm text-[#F5F5F5] focus:outline-none focus:border-white/40"
                    autoFocus
                  />
                  {renameError && (
                    <p className="text-[11px] text-[#A6A8AD] mt-1">{renameError}</p>
                  )}
                  <div className="text-[10px] text-[#686B72] text-right font-mono mt-1">
                    {renameInput.length}/40
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRenameOpen(false)}
                    className="px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Trust Confirm Modal */}
      <AnimatePresence>
        {isTrustConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-[#101114] border border-white/20 shadow-2xl space-y-4 text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-white/[0.08] border border-white/15 flex items-center justify-center text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[#F5F5F5]">Trust Device?</h4>
                <p className="text-xs text-[#A6A8AD] mt-1">
                  Trusted devices can be accepted automatically when Auto-accept Trusted Devices is enabled.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTrustConfirmOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTrust}
                  className="px-4 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Trust Device
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Untrust Confirm Modal */}
      <AnimatePresence>
        {isUntrustConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-[#101114] border border-white/20 shadow-2xl space-y-4 text-left"
            >
              <div>
                <h4 className="text-base font-bold text-[#F5F5F5]">Remove trusted status?</h4>
                <p className="text-xs text-[#A6A8AD] mt-1">
                  The device will remain paired but will require normal approval for transfers.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUntrustConfirmOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUntrust}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-[#F5F5F5] cursor-pointer"
                >
                  Untrust
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Block Confirm Modal */}
      <AnimatePresence>
        {isBlockConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-[#101114] border border-white/20 shadow-2xl space-y-4 text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#A6A8AD]">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[#F5F5F5]">Block Device?</h4>
                <p className="text-xs text-[#A6A8AD] mt-1">
                  This device will no longer appear in discovery or send transfer requests.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBlockConfirmOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBlock}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-[#F5F5F5] cursor-pointer"
                >
                  Block Device
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Unblock Confirm Modal */}
      <AnimatePresence>
        {isUnblockConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-[#101114] border border-white/20 shadow-2xl space-y-4 text-left"
            >
              <div>
                <h4 className="text-base font-bold text-[#F5F5F5]">Unblock Device?</h4>
                <p className="text-xs text-[#A6A8AD] mt-1">
                  This device will become discoverable again when available.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUnblockConfirmOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnblock}
                  className="px-4 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
                >
                  Unblock
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Remove Confirm Modal */}
      <AnimatePresence>
        {isRemoveConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl bg-[#101114] border border-white/20 shadow-2xl space-y-4 text-left"
            >
              <div>
                <h4 className="text-base font-bold text-[#F5F5F5]">Remove Device?</h4>
                <p className="text-xs text-[#A6A8AD] mt-1">
                  This removes the saved relationship from your NearShare profile. Transfer history will be preserved.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRemoveConfirmOpen(false)}
                  className="px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRemove}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-[#F5F5F5] cursor-pointer"
                >
                  Remove Device
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
