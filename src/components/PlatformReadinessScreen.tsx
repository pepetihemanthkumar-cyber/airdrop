import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Check,
  HardDrive,
  Radio,
  Wifi,
  Bell,
  Layers,
  FileText,
  AlertCircle,
  HelpCircle,
  Folder,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { usePlatformReadiness } from '../context/PlatformReadinessContext';
import { useSettings, type DownloadLocation } from '../context/SettingsContext';
import { useTransferComposer } from '../context/TransferComposerContext';
import {
  type PlatformPermission,
  type PermissionState,
  PLATFORM_EXPLANATORY_NOTES,
  formatStorageDisplay,
} from '../services/platformReadiness';
import { PlatformCapabilitiesPanel } from './PlatformCapabilitiesPanel';
import { GlassCloseButton } from './common/GlassCloseButton';

const MOCK_LOCATIONS: { name: DownloadLocation; path: string }[] = [
  { name: 'Downloads', path: '~/Downloads' },
  { name: 'Desktop', path: '~/Desktop' },
  { name: 'Documents', path: '~/Documents' },
  { name: 'Pictures', path: '~/Pictures' },
];

export const PlatformReadinessScreen: React.FC = () => {
  const {
    permissions,
    platform,
    availableStorageBytes,
    isReadinessScreenOpen,
    activePermissionDetail,
    closeReadinessScreen,
    openPermissionDetail,
    closePermissionDetail,
    requestPermission,
    setPermissionState,
    resetPermissions,
    checkStorageReadiness,
    simulateLowStorage,
    simulateInsufficientStorage,
  } = usePlatformReadiness();

  const { settings, updateSettings } = useSettings();
  const { selectedFiles } = useTransferComposer();
  const isReducedMotion = settings.reducedMotion;

  const [isChangeLocationOpen, setIsChangeLocationOpen] = useState(false);
  const [isCapabilitiesPanelOpen, setIsCapabilitiesPanelOpen] = useState(false);

  // Keyboard accessibility: Escape to close
  React.useEffect(() => {
    if (!isReadinessScreenOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activePermissionDetail) closePermissionDetail();
        else if (isChangeLocationOpen) setIsChangeLocationOpen(false);
        else if (isCapabilitiesPanelOpen) setIsCapabilitiesPanelOpen(false);
        else closeReadinessScreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReadinessScreenOpen, activePermissionDetail, isChangeLocationOpen, isCapabilitiesPanelOpen, closePermissionDetail, closeReadinessScreen]);

  // Calculate required transfer size from composer files or fallback mock
  const composerBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const requiredBytes = composerBytes > 0 ? composerBytes : 3.26 * 1024 * 1024 * 1024; // 3.26 GB default mock

  const storageCheck = checkStorageReadiness(requiredBytes);

  // Count required and granted permissions
  const requiredPermissions = permissions.filter((p) => p.required);
  const grantedRequired = requiredPermissions.filter((p) => p.state === 'granted');
  const allRequiredGranted = grantedRequired.length === requiredPermissions.length;

  const renderPermissionIcon = (id: PlatformPermission['id']) => {
    switch (id) {
      case 'file-access':
        return <Folder className="w-4 h-4 text-[#F5F5F5]" />;
      case 'nearby-devices':
        return <Radio className="w-4 h-4 text-[#F5F5F5]" />;
      case 'local-network':
        return <Wifi className="w-4 h-4 text-[#F5F5F5]" />;
      case 'notifications':
        return <Bell className="w-4 h-4 text-[#F5F5F5]" />;
      case 'background-transfer':
        return <Layers className="w-4 h-4 text-[#F5F5F5]" />;
      default:
        return <FileText className="w-4 h-4 text-[#F5F5F5]" />;
    }
  };

  const renderStateBadge = (state: PermissionState) => {
    switch (state) {
      case 'granted':
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-[#F5F5F5]">
            <Check className="w-3.5 h-3.5 text-white" />
            <span>Ready</span>
          </span>
        );
      case 'not-requested':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/20 text-xs font-medium text-white shadow-sm">
            Set up
          </span>
        );
      case 'denied':
      case 'restricted':
        return (
          <span className="flex items-center gap-1 text-xs font-semibold text-white">
            <AlertCircle className="w-3.5 h-3.5 text-white animate-pulse" />
            <span>Needs attention</span>
          </span>
        );
      case 'unavailable':
        return <span className="text-xs text-[#686B72]">— Unavailable</span>;
    }
  };

  if (!isReadinessScreenOpen) return null;

  return (
    <div
      onClick={closeReadinessScreen}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pt-20 sm:pt-24 bg-black/75 backdrop-blur-md pointer-events-auto"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 15 }}
        animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-labelledby="readiness-title"
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-[32px] bg-[#0E1013]/95 backdrop-blur-2xl border border-white/15 p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85),0_0_36px_rgba(255,255,255,0.03)] text-[#F5F5F5] space-y-6 select-none"
      >
        {/* Top subtle reflection */}
        <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

        {/* 1. Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#F5F5F5]" />
              <h2 id="readiness-title" className="text-xl sm:text-2xl font-bold tracking-tight text-[#F5F5F5]">
                Ready for nearby transfers.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#A6A8AD]">
              Check your device permissions and storage before sending files.
            </p>
          </div>
          <GlassCloseButton onClose={closeReadinessScreen} ariaLabel="Close Readiness Screen" />
        </div>

        {/* 2. Central Glass Readiness Vessel */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#686B72]">
              Platform Status
            </div>
            <div className="text-base sm:text-lg font-bold text-[#F5F5F5] flex items-center gap-2">
              <span>{allRequiredGranted ? 'READY' : 'SETUP REQUIRED'}</span>
              <span className="text-xs font-normal text-[#A6A8AD]">
                • {grantedRequired.length} of {requiredPermissions.length} required capabilities available
              </span>
            </div>
            <div className="text-xs text-[#A6A8AD] leading-relaxed">
              {allRequiredGranted
                ? 'Your device meets all platform requirements for high-speed local transfers.'
                : 'Configure required capabilities below to enable peer-to-peer sending and receiving.'}
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={closeReadinessScreen}
              className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Permission Cards Grid */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-[#F5F5F5] uppercase tracking-wider font-mono">
            <span>Capabilities & Permissions</span>
            <span className="text-[10px] text-[#686B72] normal-case">Click to view details</span>
          </div>

          <div className="space-y-2">
            {permissions.map((perm) => (
              <div
                key={perm.id}
                onClick={() => openPermissionDetail(perm)}
                className="p-3.5 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.07] flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 group-hover:border-white/20 transition-colors">
                    {renderPermissionIcon(perm.id)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#F5F5F5]">{perm.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          perm.required
                            ? 'bg-white/10 text-white font-medium'
                            : 'bg-white/[0.04] text-[#A6A8AD]'
                        }`}
                      >
                        {perm.required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#A6A8AD] truncate mt-0.5">
                      {perm.description}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {renderStateBadge(perm.state)}
                  <HelpCircle className="w-3.5 h-3.5 text-[#686B72] group-hover:text-[#A6A8AD] transition-colors" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Storage Readiness Section */}
        <div className="p-4 rounded-2xl bg-white/[0.025] border border-white/[0.08] space-y-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F5F5F5] flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-[#F5F5F5]" />
              <span>Storage Readiness</span>
            </span>

            <button
              type="button"
              onClick={() => setIsChangeLocationOpen(true)}
              className="text-xs text-[#A6A8AD] hover:text-white underline underline-offset-2 cursor-pointer transition-colors"
            >
              Change location
            </button>
          </div>

          {/* Metrics 3-column / stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-[#686B72]">Available Storage</div>
              <div className="text-sm font-bold text-[#F5F5F5]">
                {formatStorageDisplay(availableStorageBytes)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-[#686B72]">Storage Required</div>
              <div className="text-sm font-mono font-bold text-[#F5F5F5]">
                {formatStorageDisplay(requiredBytes)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
              <div className="text-[10px] font-mono uppercase text-[#686B72]">Destination</div>
              <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                {settings.downloadLocation || 'Downloads'}
              </div>
            </div>
          </div>

          {/* Storage Warning Banner (Low or Insufficient) */}
          {!storageCheck.ready && (
            <div className="p-3 rounded-xl bg-white/[0.06] border border-white/20 flex items-start gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 text-white shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="font-bold text-white">Not enough storage:</span> Free up at least{' '}
                {formatStorageDisplay(requiredBytes)} before receiving this transfer.
              </div>
            </div>
          )}

          {storageCheck.ready && storageCheck.storageState === 'low' && (
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/15 flex items-start gap-2.5 text-xs text-[#A6A8AD]">
              <AlertCircle className="w-4 h-4 text-[#F5F5F5] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#F5F5F5]">Low storage:</span>{' '}
                {formatStorageDisplay(storageCheck.remainingAfterBytes)} remaining after transfer.
              </div>
            </div>
          )}

          {storageCheck.ready && storageCheck.storageState === 'healthy' && (
            <div className="text-[11px] text-[#A6A8AD] flex items-center justify-between">
              <span>Estimated storage after transfer</span>
              <span className="font-mono text-[#F5F5F5]">
                {formatStorageDisplay(storageCheck.remainingAfterBytes)} available
              </span>
            </div>
          )}
        </div>

        {/* 5. Platform Explanatory Notes & Simulation Banner */}
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-[#A6A8AD] space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-[#F5F5F5] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#A6A8AD]" />
              <span>Platform Profile ({platform.toUpperCase()})</span>
            </div>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => setIsCapabilitiesPanelOpen(true)}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-[#F5F5F5] border border-white/10 transition-colors cursor-pointer"
              >
                Capability Matrix →
              </button>
            )}
          </div>
          <p className="text-[11px] leading-relaxed">
            {PLATFORM_EXPLANATORY_NOTES[platform]}
          </p>
          <div className="text-[10px] font-mono text-[#686B72] pt-1 border-t border-white/[0.04]">
            Native capabilities are simulated in this development environment.
          </div>
        </div>

        {/* 6. Simulation & Testing Controls */}
        <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const isDenied = permissions.some((p) => p.state === 'denied');
                if (isDenied) {
                  resetPermissions();
                } else {
                  setPermissionState('nearby-devices', 'denied');
                }
              }}
              className="px-3 py-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-[10px] font-mono text-[#A6A8AD] hover:text-white transition-colors cursor-pointer"
            >
              {permissions.some((p) => p.state === 'denied')
                ? 'Reset Permissions'
                : 'Simulate Denied Permission'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (availableStorageBytes < 1024 * 1024 * 1024) {
                  simulateLowStorage(false);
                } else {
                  simulateInsufficientStorage(true);
                }
              }}
              className="px-3 py-1 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 text-[10px] font-mono text-[#A6A8AD] hover:text-white transition-colors cursor-pointer"
            >
              {availableStorageBytes < 1024 * 1024 * 1024
                ? 'Restore Healthy Storage'
                : 'Simulate Insufficient Storage'}
            </button>
          </div>

          <button
            type="button"
            onClick={closeReadinessScreen}
            className="px-5 py-1.5 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>

      {/* Platform Capabilities Matrix Modal */}
      <PlatformCapabilitiesPanel
        isOpen={isCapabilitiesPanelOpen}
        onClose={() => setIsCapabilitiesPanelOpen(false)}
      />

      {/* ========================================================= */}
      {/* MODAL: PERMISSION DETAIL MODAL                            */}
      {/* ========================================================= */}
      <AnimatePresence>
        {activePermissionDetail && (
          <div
            onClick={closePermissionDetail}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md pointer-events-auto"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-labelledby="permission-modal-title"
              className="w-full max-w-md p-6 rounded-[32px] bg-[#101114] border border-white/20 shadow-2xl space-y-4 text-left text-[#F5F5F5] select-none"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white/[0.06] border border-white/10">
                    {renderPermissionIcon(activePermissionDetail.id)}
                  </div>
                  <div>
                    <h3 id="permission-modal-title" className="text-base font-bold text-[#F5F5F5]">
                      {activePermissionDetail.name}
                    </h3>
                    <p className="text-xs text-[#A6A8AD]">
                      {activePermissionDetail.required ? 'Required capability' : 'Optional feature'}
                    </p>
                  </div>
                </div>
                <GlassCloseButton onClose={closePermissionDetail} ariaLabel="Close Permission Detail" />
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-semibold text-[#F5F5F5] mb-1">Why NearShare needs it</div>
                  <p className="text-[#A6A8AD] leading-relaxed">{activePermissionDetail.whyNeeded}</p>
                </div>

                <div>
                  <div className="font-semibold text-[#F5F5F5] mb-1">If denied</div>
                  <p className="text-[#A6A8AD] leading-relaxed">
                    {activePermissionDetail.deniedConsequence}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-[10px] font-mono text-[#686B72]">Supported Modes</div>
                    <div className="font-semibold text-[#F5F5F5] mt-0.5 truncate">
                      {activePermissionDetail.supportedModes}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-[10px] font-mono text-[#686B72]">Current Status</div>
                    <div className="font-semibold text-[#F5F5F5] mt-0.5 capitalize">
                      {activePermissionDetail.state}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-[11px] text-[#A6A8AD]">
                  <span className="font-semibold text-[#F5F5F5]">Platform notes: </span>
                  {activePermissionDetail.platformNotes[platform]}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={closePermissionDetail}
                  className="px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] cursor-pointer"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => {
                    requestPermission(activePermissionDetail.id);
                    closePermissionDetail();
                  }}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer shadow-md"
                >
                  Set Up
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL: CHANGE DOWNLOAD LOCATION                           */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isChangeLocationOpen && (
          <div
            onClick={() => setIsChangeLocationOpen(false)}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md pointer-events-auto"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-labelledby="location-modal-title"
              className="w-full max-w-sm p-6 rounded-[32px] bg-[#101114] border border-white/15 shadow-2xl space-y-4 text-left select-none"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 id="location-modal-title" className="text-base font-bold text-[#F5F5F5]">
                  Save Destination
                </h3>
                <GlassCloseButton onClose={() => setIsChangeLocationOpen(false)} ariaLabel="Close destination modal" />
              </div>

              <div className="space-y-2">
                {MOCK_LOCATIONS.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => {
                      updateSettings({ downloadLocation: loc.name });
                      setIsChangeLocationOpen(false);
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
    </div>
  );
};
