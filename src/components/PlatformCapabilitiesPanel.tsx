import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Cpu,
  Radio,
  Wifi,
  Folder,
  Layers,
  KeyRound,
  Bell,
  HardDrive,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import type { PlatformType } from '../core/platform/PlatformAdapter';
import type { CapabilityAvailability, CapabilityPath } from '../core/platform/capabilities';
import { CapabilityResolver } from '../core/platform/CapabilityResolver';
import { useSettings } from '../context/SettingsContext';

const PLATFORMS: PlatformType[] = ['macOS', 'Windows', 'Android', 'iOS', 'Web'];

interface CapabilityRow {
  label: string;
  path: CapabilityPath;
  icon: React.ReactNode;
  category: 'Transport' | 'Discovery' | 'Security' | 'Files' | 'System';
}

const CAPABILITY_ROWS: CapabilityRow[] = [
  {
    label: 'Direct Nearby Transfer',
    path: 'transferModes.direct',
    icon: <Radio className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Transport',
  },
  {
    label: 'Local Wi-Fi Transfer',
    path: 'transferModes.wifi',
    icon: <Wifi className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Transport',
  },
  {
    label: 'Nearby Proximity Discovery',
    path: 'discovery.nearby',
    icon: <Radio className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Discovery',
  },
  {
    label: 'Local Subnet mDNS Discovery',
    path: 'discovery.localNetwork',
    icon: <Wifi className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Discovery',
  },
  {
    label: 'PIN Code Verification',
    path: 'pairing.pin',
    icon: <KeyRound className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Security',
  },
  {
    label: 'QR Code Pairing Contract',
    path: 'pairing.qr',
    icon: <KeyRound className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Security',
  },
  {
    label: 'Native File Picker',
    path: 'files.filePicker',
    icon: <Folder className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Files',
  },
  {
    label: 'Folder Picker & Tree Transfer',
    path: 'files.folderPicker',
    icon: <Folder className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Files',
  },
  {
    label: 'Background Transfer Persistence',
    path: 'transfer.background',
    icon: <Layers className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Transport',
  },
  {
    label: 'Large File Chunking (>4 GB)',
    path: 'transfer.largeFiles',
    icon: <HardDrive className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'Transport',
  },
  {
    label: 'System Notification Alerts',
    path: 'system.notifications',
    icon: <Bell className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'System',
  },
  {
    label: 'Storage Quota Inspection',
    path: 'system.storageInfo',
    icon: <HardDrive className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'System',
  },
  {
    label: 'Reveal in OS File Explorer',
    path: 'system.revealInFolder',
    icon: <ExternalLink className="w-4 h-4 text-[#F5F5F5]" />,
    category: 'System',
  },
];

interface PlatformCapabilitiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlatformCapabilitiesPanel: React.FC<PlatformCapabilitiesPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>('macOS');
  const { settings } = useSettings();
  const isReducedMotion = settings.reducedMotion;

  if (!isOpen) return null;

  const strategy = CapabilityResolver.getPlatformStrategy(selectedPlatform);

  const renderBadge = (status: CapabilityAvailability) => {
    switch (status) {
      case 'supported':
        return (
          <span className="px-2 py-0.5 rounded-full bg-white/[0.12] border border-white/20 text-[10px] font-mono text-[#F5F5F5]">
            Supported
          </span>
        );
      case 'requiresNative':
        return (
          <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono text-[#A6A8AD]">
            Requires Native
          </span>
        );
      case 'mockOnly':
        return (
          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono text-[#686B72]">
            Mock Only
          </span>
        );
      case 'restricted':
        return (
          <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/15 text-[10px] font-mono text-[#A6A8AD]">
            Restricted
          </span>
        );
      case 'unsupported':
        return (
          <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-mono text-[#686B72]">
            Unsupported
          </span>
        );
      case 'notImplemented':
        return (
          <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-mono text-[#686B72]">
            Not Implemented
          </span>
        );
      case 'unknown':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-black/40 border border-white/5 text-[10px] font-mono text-[#686B72]">
            Unknown
          </span>
        );
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none">
        <motion.div
          initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
          animate={isReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-labelledby="capabilities-matrix-title"
          className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-[#0E1013]/95 backdrop-blur-2xl border border-white/15 p-5 sm:p-7 shadow-[0_24px_80px_rgba(0,0,0,0.85)] text-[#F5F5F5] space-y-6"
        >
          {/* Top Reflection Line */}
          <div className="absolute top-0 inset-x-12 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

          {/* Header */}
          <div className="flex items-start justify-between pb-3 border-b border-white/[0.08]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#F5F5F5]" />
                <h2 id="capabilities-matrix-title" className="text-xl font-bold tracking-tight text-[#F5F5F5]">
                  Platform Capability Matrix
                </h2>
              </div>
              <p className="text-xs text-[#A6A8AD]">
                Architecture capability targets & native integration strategies.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Platform Tab Selector */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.07] overflow-x-auto">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPlatform(p)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  selectedPlatform === p
                    ? 'bg-white/15 text-[#F5F5F5] shadow-md border border-white/20'
                    : 'text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Platform Notice */}
          <div className="p-3.5 rounded-2xl bg-white/[0.025] border border-white/[0.06] flex items-start gap-3 text-xs">
            <ShieldAlert className="w-4 h-4 text-[#A6A8AD] shrink-0 mt-0.5" />
            <div className="text-[#A6A8AD] leading-relaxed">
              <span className="font-semibold text-[#F5F5F5]">{selectedPlatform} Profile: </span>
              {selectedPlatform === 'Web'
                ? 'Web browser is strictly a development preview. Real direct peer-to-peer and socket discovery require compiled native applications.'
                : `Target specifications for future native ${selectedPlatform} adapter. Development runtime currently executes mock simulation.`}
            </div>
          </div>

          {/* Capability Matrix List */}
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-[#686B72]">
              Architectural Capabilities
            </div>

            <div className="divide-y divide-white/[0.04] rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              {CAPABILITY_ROWS.map((row) => {
                const status = CapabilityResolver.getCapabilityAvailability(
                  selectedPlatform,
                  row.path
                );
                const reason = CapabilityResolver.getUnavailableReason(
                  selectedPlatform,
                  row.path
                );

                return (
                  <div
                    key={row.path}
                    className="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 shrink-0">
                        {row.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#F5F5F5] truncate">{row.label}</div>
                        {reason && (
                          <div className="text-[11px] text-[#686B72] truncate mt-0.5">
                            {reason}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">{renderBadge(status)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategy Identifiers Section */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2.5 text-xs">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#686B72]">
              Native Integration Strategy ({selectedPlatform})
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <span className="text-[#686B72]">Direct:</span>
                <span className="text-[#F5F5F5] truncate ml-2">{strategy.directTransport}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <span className="text-[#686B72]">Wi-Fi:</span>
                <span className="text-[#F5F5F5] truncate ml-2">{strategy.wifiTransport}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <span className="text-[#686B72]">Discovery:</span>
                <span className="text-[#F5F5F5] truncate ml-2">{strategy.discoveryStrategy}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                <span className="text-[#686B72]">Files:</span>
                <span className="text-[#F5F5F5] truncate ml-2">{strategy.fileStrategy}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] text-xs">
            <span className="text-[11px] text-[#686B72] font-mono">Development Diagnostic Mode</span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
