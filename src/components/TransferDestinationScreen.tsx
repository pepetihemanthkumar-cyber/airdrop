import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  Wifi,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Check,
  Star,
  User,
  Radio,
} from 'lucide-react';
import { useTransferComposer } from '../context/TransferComposerContext';
import { useProfileDevice, type Device } from '../context/ProfileDeviceContext';
import { useSettings } from '../context/SettingsContext';
import type { TransferMode } from './FloatingNavPill';

interface TransferDestinationScreenProps {
  currentMode: TransferMode;
  onBackToFileSelection: () => void;
  onProceedToReview: (device: Device) => void;
  onProceedToPairing: (device: Device) => void;
}

export const TransferDestinationScreen: React.FC<TransferDestinationScreenProps> = ({
  currentMode,
  onBackToFileSelection,
  onProceedToReview,
  onProceedToPairing,
}) => {
  const {
    selectedFiles,
    totalPayloadFormatted,
    destinationDevice,
    selectDestination,
  } = useTransferComposer();

  const { devices } = useProfileDevice();
  const { settings } = useSettings();

  const [selectedTarget, setSelectedTarget] = useState<Device | null>(destinationDevice);
  const [activeTab, setActiveTab] = useState<'nearby' | 'myself'>('nearby');

  // Filter out blocked devices and apply settings filters
  const discoverableDevices = devices
    .filter((d) => {
      if (d.isBlocked || d.status === 'offline') return false;
      if (settings.trustedOnly && !d.isTrusted) return false;
      if (!settings.allowUnknownDevices && d.isUnknown) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.isTrusted && !b.isTrusted) return -1;
      if (!a.isTrusted && b.isTrusted) return 1;
      return 0;
    });

  // User's own registered devices for "Send to Myself"
  const myDevices = devices.filter((d) => !d.isBlocked && d.isTrusted);

  const renderPlatformIcon = (platform: Device['platform']) => {
    switch (platform) {
      case 'macOS':
        return <Laptop className="w-5 h-5 text-[#F5F5F5]" />;
      case 'Android':
        return <Smartphone className="w-5 h-5 text-[#F5F5F5]" />;
      case 'iOS':
        return <Tablet className="w-5 h-5 text-[#F5F5F5]" />;
      case 'Windows':
        return <Monitor className="w-5 h-5 text-[#F5F5F5]" />;
      default:
        return <Laptop className="w-5 h-5 text-[#A6A8AD]" />;
    }
  };

  const handleDeviceClick = (device: Device) => {
    setSelectedTarget(device);
    selectDestination(device);
  };

  const handleContinue = () => {
    if (!selectedTarget) return;
    selectDestination(selectedTarget);
    if (selectedTarget.isTrusted) {
      onProceedToReview(selectedTarget);
    } else {
      onProceedToPairing(selectedTarget);
    }
  };

  return (
    <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center space-y-6 py-6 px-4 pointer-events-auto">
      
      {/* ========================================================= */}
      {/* 1. HERO HEADLINE & TAB SWITCHER                           */}
      {/* ========================================================= */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F5F5F5]">
          Send to
        </h1>
        <p className="text-sm sm:text-base font-light text-[#A6A8AD]">
          Choose a nearby device or transfer to your own hardware.
        </p>

        {/* Minimal Glass Segment: [ Nearby Devices ] [ Send to Myself ] */}
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.10] shadow-md mt-2">
          <button
            onClick={() => setActiveTab('nearby')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'nearby'
                ? 'bg-white text-[#08090B] shadow'
                : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Nearby Devices</span>
          </button>
          <button
            onClick={() => setActiveTab('myself')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'myself'
                ? 'bg-white text-[#08090B] shadow'
                : 'text-[#A6A8AD] hover:text-[#F5F5F5]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Send to Myself</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CENTRAL DESTINATION VESSEL                             */}
      {/* ========================================================= */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-2xl p-6 sm:p-8 rounded-[36px] smoked-glass-hero flex flex-col space-y-6 shadow-2xl border border-white/[0.14] overflow-hidden"
      >
        {/* Subtle internal reflective light glint */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-28 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

        {/* Top Destination Status Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[#F5F5F5]">
              {activeTab === 'nearby'
                ? `${discoverableDevices.length} Devices Available`
                : `${myDevices.length} Personal Devices`}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#A6A8AD]">
            {currentMode === 'direct' ? <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" /> : <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />}
            <span>{currentMode === 'direct' ? 'Direct 30m' : 'Local Wi-Fi'}</span>
          </div>
        </div>

        {/* Devices List */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {(activeTab === 'nearby' ? discoverableDevices : myDevices).map((device) => {
            const isSelected = selectedTarget?.id === device.id;
            const isCompact = settings.compactDeviceCards;

            return (
              <motion.div
                key={device.id}
                whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
                whileTap={{ scale: 0.99 }}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 shadow-md group cursor-pointer ${
                  isSelected
                    ? 'bg-white/[0.09] border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.08)]'
                    : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20'
                }`}
                onClick={() => handleDeviceClick(device)}
              >
                {/* Left: Avatar & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`relative ${
                      isCompact ? 'w-9 h-9 rounded-xl' : 'w-11 h-11 rounded-2xl'
                    } bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 shadow-inner`}
                  >
                    {device.isUnknown ? (
                      renderPlatformIcon(device.platform)
                    ) : (
                      <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-bold text-[#F5F5F5]`}>
                        {device.avatar || device.ownerName?.[0] || 'D'}
                      </span>
                    )}

                    {device.isFavorite && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#17191D] border border-white/20 flex items-center justify-center shadow">
                        <Star className="w-2.5 h-2.5 text-[#F5F5F5] fill-white" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-semibold text-[#F5F5F5] truncate`}>
                        {device.isUnknown ? device.name : device.ownerName || device.name}
                      </span>
                      {device.isTrusted && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] text-[#A6A8AD] border border-white/10">
                          <Check className="w-2.5 h-2.5 text-white" />
                          <span>Trusted</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-[#A6A8AD] truncate">
                      {device.userHandle && <span>{device.userHandle}</span>}
                      {device.userHandle && <span className="text-[#686B72]">•</span>}
                      <span className="truncate">{device.deviceName}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#686B72] mt-0.5">
                      <span className="text-[#A6A8AD]">
                        ● {device.connectionQuality || 'Excellent'}
                      </span>
                      {currentMode === 'direct' && settings.showDistance && device.distance && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[#A6A8AD]">{device.distance}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="font-mono text-[#686B72]">{device.platform}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Select indicator */}
                <div className="shrink-0 flex items-center gap-2">
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-white border-white text-[#08090B]'
                        : 'border-white/20 bg-white/[0.03]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Selected Target Summary Card */}
        {selectedTarget && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.12] flex items-center justify-between gap-3 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                {renderPlatformIcon(selectedTarget.platform)}
              </div>
              <div>
                <div className="text-xs font-semibold text-[#F5F5F5]">
                  Sending {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} ({totalPayloadFormatted})
                </div>
                <div className="text-[11px] text-[#A6A8AD]">
                  Target: {selectedTarget.ownerName || selectedTarget.name} • {selectedTarget.deviceName}
                </div>
              </div>
            </div>

            <div className="text-xs font-mono font-medium text-[#F5F5F5]">
              {selectedTarget.isTrusted ? 'Verified Link' : 'Pairing Required'}
            </div>
          </motion.div>
        )}

        {/* ======================================================= */}
        {/* 3. FOOTER ACTIONS                                       */}
        {/* ======================================================= */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
          <button
            onClick={onBackToFileSelection}
            className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-medium flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Files</span>
          </button>

          <button
            onClick={handleContinue}
            disabled={!selectedTarget}
            className="px-6 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 transition-all disabled:opacity-40 disabled:hover:scale-100"
          >
            <span>Continue to Review</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

    </div>
  );
};
