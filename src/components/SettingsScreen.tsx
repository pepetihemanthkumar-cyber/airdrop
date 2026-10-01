import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Zap,
  Wifi,
  Folder,
  Shield,
  ShieldCheck,
  RotateCw,
  Eye,
  Sparkles,
  History,
  Activity,
  HardDrive,
  Sliders,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import { useSettings, type DownloadLocation } from '../context/SettingsContext';
import { usePlatformReadiness } from '../context/PlatformReadinessContext';
import { ReadinessBadge } from './ReadinessBadge';
import { APP_METADATA } from '../core/appVersion';
import { exportSanitizedDiagnostics } from '../core/diagnostics/ReleaseHealth';

interface SettingsScreenProps {
  onBack: () => void;
  onClearHistory?: () => void;
}

interface SmokedSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}

const SmokedSwitch: React.FC<SmokedSwitchProps> = ({ checked, onChange, disabled }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out border focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      } ${
        checked
          ? 'bg-white border-white'
          : 'bg-white/[0.08] border-white/[0.15] hover:bg-white/[0.12]'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-colors duration-200 ${
          checked ? 'bg-[#08090B] translate-x-5' : 'bg-[#A6A8AD] translate-x-1'
        }`}
      />
    </button>
  );
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onClearHistory }) => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { openReadinessScreen } = usePlatformReadiness();

  // Modal states
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Diagnostics state
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<{ label: string; status: 'pending' | 'done' }[]>([]);
  const [diagnosticsCompleted, setDiagnosticsCompleted] = useState(false);
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);

  const handleExportDiagnostics = async () => {
    try {
      const sanitizedJson = await exportSanitizedDiagnostics();
      await navigator.clipboard.writeText(sanitizedJson);
      setDiagnosticsCopied(true);
      setTimeout(() => setDiagnosticsCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const folderOptions: { name: DownloadLocation; path: string; icon: string }[] = [
    { name: 'Downloads', path: '~/Downloads', icon: '📥' },
    { name: 'Desktop', path: '~/Desktop', icon: '🖥️' },
    { name: 'Documents', path: '~/Documents', icon: '📄' },
    { name: 'Pictures', path: '~/Pictures', icon: '🖼️' },
  ];

  const handleRunDiagnostics = () => {
    setIsRunningDiagnostics(true);
    setDiagnosticsCompleted(false);
    setDiagnosticSteps([
      { label: 'Checking profile identity...', status: 'pending' },
    ]);

    setTimeout(() => {
      setDiagnosticSteps((prev) => [
        { ...prev[0], status: 'done' },
        { label: 'Checking discovery engine...', status: 'pending' },
      ]);
    }, 600);

    setTimeout(() => {
      setDiagnosticSteps((prev) => [
        prev[0],
        { ...prev[1], status: 'done' },
        { label: 'Checking transfer queue...', status: 'pending' },
      ]);
    }, 1200);

    setTimeout(() => {
      setDiagnosticSteps((prev) => [
        prev[0],
        prev[1],
        { ...prev[2], status: 'done' },
        { label: 'Checking history system...', status: 'pending' },
      ]);
    }, 1800);

    setTimeout(() => {
      setDiagnosticSteps((prev) => [
        prev[0],
        prev[1],
        prev[2],
        { ...prev[3], status: 'done' },
      ]);
      setDiagnosticsCompleted(true);
      setIsRunningDiagnostics(false);
    }, 2400);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto flex flex-col space-y-8 py-6 px-4 pointer-events-auto">
      
      {/* ========================================================= */}
      {/* 1. TOP HEADER & BACK NAVIGATION                           */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 transition-colors cursor-pointer"
            title="Back to transfer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F5]">
              Settings
            </h1>
            <p className="text-xs sm:text-sm text-[#A6A8AD]">
              Control how NearShare discovers, connects, and transfers files.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsResetModalOpen(true)}
          className="px-3.5 py-1.5 rounded-full bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
        >
          Reset Preferences
        </button>
      </div>

      {/* ========================================================= */}
      {/* 2. SECTION: TRANSFER PREFERENCES                          */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="p-5 sm:p-6 rounded-[28px] smoked-glass-card border border-white/[0.12] space-y-6 shadow-xl"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
          <HardDrive className="w-4 h-4 text-[#F5F5F5]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5F5F5]">
            Transfer Preferences
          </h2>
        </div>

        {/* Setting 1: Default Transfer Mode */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-[#F5F5F5]">Default Transfer Mode</div>
            <div className="text-xs text-[#A6A8AD]">
              Choose which transfer mode opens by default.
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.10]">
            <button
              onClick={() => updateSettings({ defaultTransferMode: 'direct' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                settings.defaultTransferMode === 'direct'
                  ? 'bg-white text-[#08090B] shadow'
                  : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Direct Nearby</span>
            </button>
            <button
              onClick={() => updateSettings({ defaultTransferMode: 'wifi' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                settings.defaultTransferMode === 'wifi'
                  ? 'bg-white text-[#08090B] shadow'
                  : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>📶 Wi-Fi</span>
            </button>
          </div>
        </div>

        {/* Setting 2: Download Location */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-[#F5F5F5]">Download Location</div>
            <div className="text-xs font-mono text-[#A6A8AD]">
              {settings.downloadLocation} (~/{settings.downloadLocation})
            </div>
          </div>

          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 text-xs font-medium text-[#F5F5F5] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Change</span>
          </button>
        </div>

        {/* Setting 3: Auto-accept Trusted Devices */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Auto-accept Trusted Devices</div>
            <div className="text-xs text-[#A6A8AD]">
              Automatically accept incoming transfers from trusted devices.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.autoAcceptTrusted}
            onChange={(checked) => updateSettings({ autoAcceptTrusted: checked })}
          />
        </div>

        {/* Setting 4: Auto-reconnect */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Auto-reconnect</div>
            <div className="text-xs text-[#A6A8AD]">
              Automatically reconnect when a temporary connection is interrupted.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.autoReconnect}
            onChange={(checked) => updateSettings({ autoReconnect: checked })}
          />
        </div>

        {/* Setting 5: Run in Background */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Run in Background</div>
            <div className="text-xs text-[#A6A8AD]">
              Keep transfers running when the main window is closed.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.runInBackground}
            onChange={(checked) => updateSettings({ runInBackground: checked })}
          />
        </div>

        {/* Setting 6: System Tray / Menu Bar Icon */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Show Menu Bar / Tray Icon</div>
            <div className="text-xs text-[#A6A8AD]">
              Display NearShare status and quick actions in the native system menu bar.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.showTrayIcon}
            onChange={(checked) => updateSettings({ showTrayIcon: checked })}
          />
        </div>

        {/* Setting 7: Completion Notifications */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Notify on Completion</div>
            <div className="text-xs text-[#A6A8AD]">
              Show desktop notifications when file transfers finish successfully.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.notifyOnComplete}
            onChange={(checked) => updateSettings({ notifyOnComplete: checked })}
          />
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 3. SECTION: DISCOVERY & VISIBILITY                        */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="p-5 sm:p-6 rounded-[28px] smoked-glass-card border border-white/[0.12] space-y-6 shadow-xl"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
          <Eye className="w-4 h-4 text-[#F5F5F5]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5F5F5]">
            Discovery & Visibility
          </h2>
        </div>

        {/* Setting: Device Visibility */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-[#F5F5F5]">Device Visibility</div>
            <div className="text-xs text-[#A6A8AD]">
              Control whether your devices appear in NearShare discovery.
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.10]">
            <button
              onClick={() => updateSettings({ deviceVisibility: 'visible' })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                settings.deviceVisibility === 'visible'
                  ? 'bg-white text-[#08090B] shadow'
                  : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
              }`}
            >
              Visible to Nearby
            </button>
            <button
              onClick={() => updateSettings({ deviceVisibility: 'hidden' })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                settings.deviceVisibility === 'hidden'
                  ? 'bg-white text-[#08090B] shadow'
                  : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
              }`}
            >
              Hidden
            </button>
          </div>
        </div>

        {/* Setting: Allow Unknown Devices */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Allow Unknown Devices</div>
            <div className="text-xs text-[#A6A8AD]">
              Allow unknown devices to appear in discovery. Pairing is still required before transfer.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.allowUnknownDevices}
            onChange={(checked) => updateSettings({ allowUnknownDevices: checked })}
          />
        </div>

        {/* Setting: Show Connection Distance */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Show Connection Distance</div>
            <div className="text-xs text-[#A6A8AD]">
              Show estimated nearby distance when available (mock UI values).
            </div>
          </div>
          <SmokedSwitch
            checked={settings.showDistance}
            onChange={(checked) => updateSettings({ showDistance: checked })}
          />
        </div>

        {/* Setting: Trusted Devices Only */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Trusted Devices Only</div>
            <div className="text-xs text-[#A6A8AD]">
              Only show devices you have previously trusted in discovery.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.trustedOnly}
            onChange={(checked) => updateSettings({ trustedOnly: checked })}
          />
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 4. SECTION: PRIVACY & SECURITY                            */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="p-5 sm:p-6 rounded-[28px] smoked-glass-card border border-white/[0.12] space-y-6 shadow-xl"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
          <Shield className="w-4 h-4 text-[#F5F5F5]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5F5F5]">
            Privacy & Security
          </h2>
        </div>

        {/* Informational: Pairing Protection */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-[#F5F5F5]">Pairing Protection</div>
            <div className="text-xs text-[#A6A8AD]">
              Devices must be verified before transfers begin.
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-mono text-[#F5F5F5] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Enabled</span>
          </span>
        </div>

        {/* Setting: Incoming Transfer Approval */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Incoming Transfer Approval</div>
            <div className="text-xs text-[#A6A8AD]">
              Ask for confirmation before accepting an incoming transfer.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.incomingApproval}
            onChange={(checked) => updateSettings({ incomingApproval: checked })}
          />
        </div>

        {/* Setting: Unknown Device Protection */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Unknown Device Protection</div>
            <div className="text-xs text-[#A6A8AD]">
              Require pairing verification for unknown devices.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.unknownDeviceProtection}
            onChange={(checked) => updateSettings({ unknownDeviceProtection: checked })}
          />
        </div>

        {/* Informational Card */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#F5F5F5]">NearShare Device Pairing</span>
            <span className="text-[10px] font-mono uppercase text-[#686B72] px-1.5 py-0.5 rounded bg-white/[0.05]">
              Frontend preview
            </span>
          </div>
          <p className="text-[#A6A8AD] leading-relaxed">
            NearShare uses secure device pairing before transfer. Security transport will be provided by the native transfer engine.
          </p>
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 5. SECTION: EXPERIENCE                                    */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="p-5 sm:p-6 rounded-[28px] smoked-glass-card border border-white/[0.12] space-y-6 shadow-xl"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
          <Sparkles className="w-4 h-4 text-[#F5F5F5]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5F5F5]">
            Experience
          </h2>
        </div>

        {/* Setting: Reduced Motion */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Reduced Motion</div>
            <div className="text-xs text-[#A6A8AD]">
              Reduce liquid animations, scanning waves, and transition effects.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.reducedMotion}
            onChange={(checked) => updateSettings({ reducedMotion: checked })}
          />
        </div>

        {/* Setting: Sound Effects */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Sound Effects</div>
            <div className="text-xs text-[#A6A8AD]">
              Play subtle sounds for connection and transfer events (mock simulation).
            </div>
          </div>
          <SmokedSwitch
            checked={settings.soundEffects}
            onChange={(checked) => updateSettings({ soundEffects: checked })}
          />
        </div>

        {/* Setting: Compact Device Cards */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Compact Device Cards</div>
            <div className="text-xs text-[#A6A8AD]">
              Use smaller device cards during discovery.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.compactDeviceCards}
            onChange={(checked) => updateSettings({ compactDeviceCards: checked })}
          />
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 6. SECTION: DATA & HISTORY                                */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="p-5 sm:p-6 rounded-[28px] smoked-glass-card border border-white/[0.12] space-y-6 shadow-xl"
      >
        <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
          <History className="w-4 h-4 text-[#F5F5F5]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5F5F5]">
            Transfer History
          </h2>
        </div>

        {/* Setting: Save Transfer History */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 pr-4">
            <div className="text-sm font-medium text-[#F5F5F5]">Save Transfer History</div>
            <div className="text-xs text-[#A6A8AD]">
              Keep completed and failed transfers in your local history.
            </div>
          </div>
          <SmokedSwitch
            checked={settings.saveHistory}
            onChange={(checked) => updateSettings({ saveHistory: checked })}
          />
        </div>

        {/* Action: Clear Transfer History */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-[#F5F5F5]">Clear Transfer History</div>
            <div className="text-xs text-[#A6A8AD]">
              Permanently remove all transfer records from NearShare.
            </div>
          </div>
          <button
            onClick={() => setIsClearHistoryModalOpen(true)}
            className="px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 transition-colors cursor-pointer"
          >
            Clear History
          </button>
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 7. SECTION: DEVICE ACCESS (Permissions & Storage)         */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.22 }}
        className="p-5 sm:p-6 rounded-[28px] smoked-glass-card border border-white/[0.12] space-y-6 shadow-xl"
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#F5F5F5]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5F5F5]">
              Device Access
            </h2>
          </div>
          <ReadinessBadge />
        </div>

        {/* Setting: Permissions & Storage */}
        <div
          onClick={() => openReadinessScreen()}
          className="p-4 rounded-2xl bg-white/[0.025] hover:bg-white/[0.05] border border-white/[0.06] flex items-center justify-between gap-3 transition-colors cursor-pointer group"
        >
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-[#F5F5F5] group-hover:text-white flex items-center gap-2">
              <span>Permissions & Storage</span>
            </div>
            <div className="text-xs text-[#A6A8AD]">
              Review access required for transfers, download destinations, and disk storage readiness.
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2 text-[#A6A8AD] group-hover:text-white transition-colors">
            <span className="text-xs font-medium">Configure</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 8. SECTION: DIAGNOSTICS                                   */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="p-5 sm:p-6 rounded-[28px] smoked-glass-card border border-white/[0.12] space-y-6 shadow-xl"
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#F5F5F5]" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#F5F5F5]">
              Diagnostics
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#686B72]">Simulation Mode</span>
        </div>

        {/* Read-only Information Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">NearShare</div>
            <div className="text-xs font-semibold text-[#F5F5F5]">Frontend Preview</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Discovery Engine</div>
            <div className="text-xs font-semibold text-[#F5F5F5]">Mock</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Direct Transport</div>
            <div className="text-xs font-semibold text-[#A6A8AD]">Not connected</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Wi-Fi Transport</div>
            <div className="text-xs font-semibold text-[#A6A8AD]">Not connected</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Transfer Engine</div>
            <div className="text-xs font-semibold text-[#F5F5F5]">Frontend Simulation</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Profile System</div>
            <div className="text-xs font-semibold text-[#F5F5F5]">Connected</div>
          </div>
        </div>

        {/* Live Diagnostics Runner */}
        <div className="pt-2 border-t border-white/[0.04] space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[#A6A8AD]">
              Test system modules and integrity state.
            </div>
            <button
              onClick={handleRunDiagnostics}
              disabled={isRunningDiagnostics}
              className="px-4 py-1.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
              <span>{isRunningDiagnostics ? 'Running...' : 'Run Diagnostics →'}</span>
            </button>
          </div>

          {/* Diagnostic Log Output */}
          {(diagnosticSteps.length > 0 || diagnosticsCompleted) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-2 text-xs font-mono"
            >
              {diagnosticSteps.map((step, idx) => (
                <div key={idx} className="flex items-center justify-between text-[#A6A8AD]">
                  <span>{step.label}</span>
                  <span>{step.status === 'done' ? <Check className="w-3.5 h-3.5 text-white inline" /> : '...'}</span>
                </div>
              ))}
              {diagnosticsCompleted && (
                <div className="pt-2 border-t border-white/[0.06] text-[#F5F5F5] font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-white" />
                  <span>System ready. All modules functioning normally.</span>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* 6. ABOUT & RELEASE METADATA CARD                          */}
      {/* ========================================================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="p-6 rounded-3xl smoked-glass-card border border-white/10 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-[#F5F5F5]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#F5F5F5]">About NearShare</h2>
              <p className="text-xs text-[#A6A8AD]">
                High-performance, local-first cross-platform file transfer
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-white/[0.06] border border-white/10 text-[#F5F5F5]">
            v{APP_METADATA.version}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Product</div>
            <div className="text-xs font-semibold text-[#F5F5F5]">{APP_METADATA.name}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Build</div>
            <div className="text-xs font-semibold capitalize text-[#F5F5F5]">{APP_METADATA.buildType}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Protocol</div>
            <div className="text-xs font-semibold text-[#F5F5F5]">v{APP_METADATA.protocolVersion}</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] space-y-0.5">
            <div className="text-[10px] uppercase font-mono text-[#686B72]">Desktop Shell</div>
            <div className="text-xs font-semibold text-[#F5F5F5]">Tauri v{APP_METADATA.tauriVersion}</div>
          </div>
        </div>

        <div className="pt-2 border-t border-white/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-[#686B72]">
            Local-first zero-cloud direct cryptographic transfers.
          </div>
          <button
            onClick={handleExportDiagnostics}
            className="px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            title="Copy safe diagnostics report to clipboard"
          >
            {diagnosticsCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Diagnostics Copied!</span>
              </>
            ) : (
              <>
                <Sliders className="w-3.5 h-3.5" />
                <span>Export Diagnostics</span>
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* ========================================================= */}
      {/* MODAL 1: DOWNLOAD LOCATION CHOOSER                        */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isFolderModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md p-6 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-[#F5F5F5]" />
                  <h3 className="text-base font-semibold text-[#F5F5F5]">Select Download Location</h3>
                </div>
                <button
                  onClick={() => setIsFolderModalOpen(false)}
                  className="p-1 rounded-full text-[#A6A8AD] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                {folderOptions.map((folder) => {
                  const isSelected = settings.downloadLocation === folder.name;
                  return (
                    <button
                      key={folder.name}
                      onClick={() => {
                        updateSettings({ downloadLocation: folder.name });
                        setIsFolderModalOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white/[0.08] border-white/30 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-[#A6A8AD] hover:bg-white/[0.05] hover:text-[#F5F5F5]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-base">{folder.icon}</span>
                        <div className="text-left">
                          <div className="text-xs font-semibold text-[#F5F5F5]">{folder.name}</div>
                          <div className="text-[10px] font-mono text-[#686B72]">{folder.path}</div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 text-[11px] text-[#686B72] text-center">
                Frontend preview location selector. No real filesystem accessed.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: CLEAR HISTORY CONFIRMATION                       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isClearHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm p-6 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto text-[#F5F5F5]">
                <History className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#F5F5F5]">
                  Clear Transfer History?
                </h3>
                <p className="text-xs text-[#A6A8AD]">
                  This will remove all saved transfer records from NearShare.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsClearHistoryModalOpen(false)}
                  className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (onClearHistory) onClearHistory();
                    setIsClearHistoryModalOpen(false);
                  }}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer shadow"
                >
                  Clear History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: RESET PREFERENCES CONFIRMATION                   */}
      {/* ========================================================= */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-sm p-6 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto text-[#F5F5F5]">
                <RotateCw className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#F5F5F5]">
                  Reset Preferences?
                </h3>
                <p className="text-xs text-[#A6A8AD]">
                  Restore NearShare preferences to their default values. Profile and history will not be affected.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    resetSettings();
                    setIsResetModalOpen(false);
                  }}
                  className="px-5 py-2 rounded-full smoked-btn-primary text-xs font-semibold cursor-pointer shadow"
                >
                  Reset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
