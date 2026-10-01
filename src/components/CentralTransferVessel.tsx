import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Wifi,
  Smartphone,
  Laptop,
  Check,
  ShieldCheck,
  File,
  Image as ImageIcon,
  Video,
  FileText,
  Package,
  Folder,
  X,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Plus,
  Radio,
  Lock,
  Download,
  Share2,
  ArrowDown,
} from 'lucide-react';
import type { TransferMode } from './FloatingNavPill';

import { TransferProgressVessel } from './TransferProgressVessel';
import { TransferHistoryScreen } from './TransferHistoryScreen';
import { type TransferHistoryItem } from '../context/TransferHistoryContext';
import { ProfileScreen } from './ProfileScreen';
import { SettingsScreen } from './SettingsScreen';
import { DeviceDiscoveryVessel } from './DeviceDiscoveryVessel';
import { NewTransferScreen } from './NewTransferScreen';
import { TransferDestinationScreen } from './TransferDestinationScreen';
import { TransferReviewScreen } from './TransferReviewScreen';
import { TransferQueueScreen } from './TransferQueueScreen';
import { useProfileDevice, type Device } from '../context/ProfileDeviceContext';
import { useTransferQueue } from '../context/TransferQueueContext';
import { useIncomingTransfer } from '../context/IncomingTransferContext';
import { useConnectionHealth } from '../context/ConnectionHealthContext';
import { useSettings } from '../context/SettingsContext';
import { pageTransitionVariants, reducedPageTransitionVariants } from '../core/motion/motionTokens';

export type VesselState =
  | 'discovery'
  | 'new_transfer'
  | 'destination'
  | 'connected'
  | 'pairing'
  | 'file_selection'
  | 'review'
  | 'queue'
  | 'transferring'
  | 'complete'
  | 'history'
  | 'profile'
  | 'settings'
  | 'receive_waiting'
  | 'receive_incoming'
  | 'receive_accepting';

export interface FileItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document' | 'apk' | 'folder' | 'other';
  typeLabel: string;
  sizeBytes: number;
  sizeFormatted: string;
  itemCount?: number;
}

const INITIAL_FILES: FileItem[] = [
  {
    id: 'f-1',
    name: 'vacation.jpg',
    type: 'image',
    typeLabel: 'Image',
    sizeBytes: 4.8 * 1024 * 1024,
    sizeFormatted: '4.8 MB',
  },
  {
    id: 'f-2',
    name: 'travel-video.mp4',
    type: 'video',
    typeLabel: 'Video',
    sizeBytes: 1.7 * 1024 * 1024 * 1024,
    sizeFormatted: '1.7 GB',
  },
  {
    id: 'f-3',
    name: 'project-report.pdf',
    type: 'document',
    typeLabel: 'Document',
    sizeBytes: 12.4 * 1024 * 1024,
    sizeFormatted: '12.4 MB',
  },
  {
    id: 'f-4',
    name: 'app-release.apk',
    type: 'apk',
    typeLabel: 'Android application package',
    sizeBytes: 1.1 * 1024 * 1024 * 1024,
    sizeFormatted: '1.1 GB',
  },
];

interface CentralTransferVesselProps {
  currentMode: TransferMode;
  onSwitchMode: (mode: TransferMode) => void;
  externalState?: VesselState | null;
  onStateChange?: (state: VesselState) => void;
}

export const CentralTransferVessel: React.FC<CentralTransferVesselProps> = ({
  currentMode,
  externalState,
  onStateChange,
}) => {
  const { userProfile, devices } = useProfileDevice();
  const { addTransfer, transfers, activeTransfer } = useTransferQueue();
  const { simulateIncomingRequest, pendingCount, currentRequest, openRequestModal } = useIncomingTransfer();
  const { health, openPanel: openConnectionHealth } = useConnectionHealth();
  const { settings } = useSettings();
  const transitionVariants = settings.reducedMotion ? reducedPageTransitionVariants : pageTransitionVariants;
  const [transferAction, setTransferAction] = useState<'send' | 'receive'>('send');
  const [internalState, setInternalState] = useState<VesselState>('discovery');
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [isReversedDirection, setIsReversedDirection] = useState(false);
  
  // Find macOS device as default local device
  const macDevice = devices.find((d) => d.platform === 'macOS') || devices[0];
  const initialRemoteDevice = devices.find((d) => d.id === 'dev-android-01') || devices[1];
  const [selectedRemoteDevice, setSelectedRemoteDevice] = useState<Device>(initialRemoteDevice);

  const currentState = externalState || internalState;
  const setCurrentState = (state: VesselState) => {
    setInternalState(state);
    if (onStateChange) onStateChange(state);
  };

  const getPlatformIcon = (platform: Device['platform']) => {
    switch (platform) {
      case 'macOS':
        return <Laptop className="w-5 h-5 text-[#F5F5F5]" />;
      case 'Android':
        return <Smartphone className="w-5 h-5 text-[#F5F5F5]" />;
      case 'iOS':
        return <Smartphone className="w-5 h-5 text-[#F5F5F5]" />;
      case 'Windows':
        return <Laptop className="w-5 h-5 text-[#F5F5F5]" />;
      default:
        return <Laptop className="w-5 h-5 text-[#F5F5F5]" />;
    }
  };

  // Local sender profile
  const localDevice = {
    userName: userProfile.name,
    userHandle: userProfile.username,
    platform: macDevice.platform,
    deviceName: macDevice.name,
    icon: <Laptop className="w-5 h-5 text-[#F5F5F5]" />,
  };

  // Remote discovered / connected device
  const remoteDevice = {
    userName: selectedRemoteDevice.ownerName || selectedRemoteDevice.name,
    userHandle: selectedRemoteDevice.userHandle || (selectedRemoteDevice.isUnknown ? 'Unverified' : '@peer'),
    platform: selectedRemoteDevice.platform,
    deviceName: selectedRemoteDevice.deviceName || selectedRemoteDevice.name,
    icon: getPlatformIcon(selectedRemoteDevice.platform),
  };

  // Direction handling
  const activeSender =
    transferAction === 'receive'
      ? remoteDevice
      : isReversedDirection
      ? remoteDevice
      : localDevice;

  const activeReceiver =
    transferAction === 'receive'
      ? localDevice
      : isReversedDirection
      ? localDevice
      : remoteDevice;

  // Compute total sizes
  const totalSizeBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // File icon helper
  const renderFileIcon = (type: FileItem['type']) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-[#F5F5F5]" />;
      case 'video':
        return <Video className="w-4 h-4 text-[#F5F5F5]" />;
      case 'document':
        return <FileText className="w-4 h-4 text-[#F5F5F5]" />;
      case 'apk':
        return <Package className="w-4 h-4 text-[#F5F5F5]" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-[#F5F5F5]" />;
      default:
        return <File className="w-4 h-4 text-[#A6A8AD]" />;
    }
  };

  // State pagination step list
  const stateSteps: { key: VesselState; label: string }[] = [
    { key: 'discovery', label: 'Discovery' },
    { key: 'new_transfer', label: 'New Transfer' },
    { key: 'queue', label: 'Queue' },
    { key: 'connected', label: 'Connected' },
    { key: 'pairing', label: 'Pairing' },
    { key: 'file_selection', label: 'Files' },
    { key: 'review', label: 'Review' },
    { key: 'transferring', label: 'Transfer' },
    { key: 'complete', label: 'Complete' },
    { key: 'history', label: 'History' },
    { key: 'profile', label: 'Profile' },
    { key: 'settings', label: 'Settings' },
    { key: 'receive_waiting', label: 'Receive' },
  ];

  return (
    <div className="relative z-10 w-full min-h-screen flex flex-col items-center justify-between pt-24 sm:pt-28 pb-8 px-4 sm:px-6 max-w-5xl mx-auto">
      
      {/* ========================================================= */}
      {/* 1. HERO HEADLINE & SEND / RECEIVE ACTION SWITCHER         */}
      {/* ========================================================= */}
      {currentState !== 'history' &&
        currentState !== 'profile' &&
        currentState !== 'settings' &&
        currentState !== 'new_transfer' &&
        currentState !== 'destination' &&
        currentState !== 'queue' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center my-3 sm:my-5 shrink-0 flex flex-col items-center"
        >
          {/* Main Hero Title */}
          {transferAction === 'send' ? (
            currentState === 'discovery' ? (
              <>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#F5F5F5] leading-tight sm:leading-none">
                  Find nearby devices
                </h1>
                <h2 className="text-sm sm:text-base md:text-lg font-light tracking-tight text-[#A6A8AD] mt-1 sm:mt-2">
                  {currentMode === 'direct'
                    ? 'Looking for nearby devices...'
                    : 'Looking for devices on your local network...'}
                </h2>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#F5F5F5] leading-tight sm:leading-none">
                  Send anything.
                </h1>
                <h2 className="text-3xl sm:text-5xl md:text-6xl font-light tracking-tight text-[#A6A8AD] mt-1 sm:mt-2">
                  Anywhere nearby.
                </h2>
              </>
            )
          ) : (
            <>
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#F5F5F5] leading-tight sm:leading-none">
                Ready to receive
              </h1>
              <h2 className="text-sm sm:text-base md:text-lg font-light tracking-tight text-[#A6A8AD] mt-1 sm:mt-2 max-w-md">
                Waiting for a nearby device to send files directly.
              </h2>
            </>
          )}

          {/* Minimal Floating Glass Segmented Control: [ Send ] [ Receive ] */}
          {currentState !== 'transferring' && currentState !== 'complete' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.10] shadow-md mt-4 pointer-events-auto"
            >
              <button
                onClick={() => {
                  setTransferAction('send');
                  setCurrentState('discovery');
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  transferAction === 'send'
                    ? 'bg-white text-[#08090B] shadow-md'
                    : 'text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
              <button
                onClick={() => {
                  setTransferAction('receive');
                  setCurrentState('receive_waiting');
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  transferAction === 'receive'
                    ? 'bg-white text-[#08090B] shadow-md'
                    : 'text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/[0.04]'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Receive</span>
              </button>
            </motion.div>
          )}

          {/* Contextual Incoming Transfer Request Pill on Discovery Screen */}
          {currentState === 'discovery' && pendingCount > 0 && currentRequest && (
            <motion.button
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => openRequestModal(currentRequest.id)}
              className="mt-3.5 px-4 py-1.5 rounded-full smoked-glass-pill text-xs font-semibold text-white flex items-center gap-2 cursor-pointer border border-white/25 bg-white/[0.08] shadow-lg hover:border-white/40 transition-all pointer-events-auto"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Incoming transfer from {currentRequest.senderProfile.name}</span>
              <ArrowRight className="w-3 h-3 text-white" />
            </motion.button>
          )}

          {/* Contextual Active Transfer Status Pill on Discovery Screen */}
          {currentState === 'discovery' && pendingCount === 0 && (activeTransfer || transfers.length > 0) && (
            <motion.button
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setCurrentState('queue')}
              className="mt-3.5 px-3.5 py-1.5 rounded-full smoked-glass-pill text-xs font-medium text-[#F5F5F5] flex items-center gap-2 cursor-pointer border border-white/15 hover:border-white/25 transition-all pointer-events-auto"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>
                {activeTransfer
                  ? `${activeTransfer.files[0]?.name || 'Active Transfer'} • ${Math.round(activeTransfer.progress)}%`
                  : `${transfers.length} transfers in queue`}
              </span>
              <ArrowRight className="w-3 h-3 text-[#A6A8AD]" />
            </motion.button>
          )}
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* 2. CENTRAL VESSEL & FLOW STATES                           */}
      {/* ========================================================= */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentState}
          variants={transitionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="w-full flex-1 flex flex-col items-center justify-center min-h-[480px]"
        >
          {currentState === 'new_transfer' ? (
            <NewTransferScreen
              currentMode={currentMode}
              onProceedToDestination={() => setCurrentState('destination')}
              onBackToDiscovery={() => setCurrentState('discovery')}
            />
      ) : currentState === 'destination' ? (
        <TransferDestinationScreen
          currentMode={currentMode}
          onBackToFileSelection={() => setCurrentState('new_transfer')}
          onProceedToReview={(targetDevice) => {
            setSelectedRemoteDevice(targetDevice);
            setCurrentState('review');
          }}
          onProceedToPairing={(targetDevice) => {
            setSelectedRemoteDevice(targetDevice);
            setCurrentState('pairing');
          }}
        />
      ) : currentState === 'review' ? (
        <TransferReviewScreen
          onBack={() => setCurrentState('destination')}
          onEditFiles={() => setCurrentState('new_transfer')}
          onChangeDevice={() => setCurrentState('destination')}
          onProceedToQueue={() => setCurrentState('queue')}
          onProceedToPairing={(targetDevice) => {
            setSelectedRemoteDevice(targetDevice);
            setCurrentState('pairing');
          }}
        />
      ) : currentState === 'settings' ? (
        <SettingsScreen
          onBack={() => setCurrentState('discovery')}
        />
      ) : currentState === 'profile' ? (
        <ProfileScreen
          onBack={() => setCurrentState('discovery')}
          onStartTransfer={() => {
            setTransferAction('send');
            setCurrentState('new_transfer');
          }}
        />
      ) : currentState === 'queue' ? (
        <TransferQueueScreen
          onBackToHome={() => setCurrentState('discovery')}
          onStartNewTransfer={() => {
            setFiles(INITIAL_FILES);
            setTransferAction('send');
            setCurrentState('new_transfer');
          }}
          onViewHistory={() => setCurrentState('history')}
        />
      ) : currentState === 'history' ? (
        <TransferHistoryScreen
          onBack={() => setCurrentState('discovery')}
          onStartNewTransfer={() => {
            setFiles(INITIAL_FILES);
            setTransferAction('send');
            setCurrentState('new_transfer');
          }}
          onRetryTransfer={(item: TransferHistoryItem) => {
            addTransfer({
              direction: item.direction === 'sent' ? 'send' : 'receive',
              mode: item.mode,
              destinationDevice: {
                id: item.receiver.deviceId,
                userName: item.receiver.name,
                userHandle: item.receiver.username,
                deviceName: item.receiver.deviceName,
                platform: item.receiver.platform,
              },
              sourceDevice: {
                id: item.sender.deviceId,
                userName: item.sender.name,
                userHandle: item.sender.username,
                deviceName: item.sender.deviceName,
                platform: item.sender.platform,
              },
              files: item.files.map((f) => ({
                id: f.id,
                name: f.name,
                type: f.type as any,
                typeLabel: f.typeLabel || f.type,
                sizeBytes: f.sizeBytes,
                sizeFormatted: f.sizeFormatted,
                status: 'queued',
                progress: 0,
              })),
              totalSize: item.totalBytes,
              status: 'queued',
            });
            setCurrentState('queue');
          }}
        />
      ) : currentState === 'transferring' || currentState === 'complete' ? (
        <TransferProgressVessel
          key={`${currentState}-${transferAction}`}
          activeSender={activeSender}
          activeReceiver={activeReceiver}
          isReversedDirection={transferAction === 'receive' ? false : isReversedDirection}
          files={files}
          totalSizeBytes={totalSizeBytes}
          formatSize={formatSize}
          initialComplete={currentState === 'complete'}
          isReceiving={transferAction === 'receive'}
          onComplete={() => setCurrentState('complete')}
          onNewTransfer={() => {
            setFiles(INITIAL_FILES);
            setTransferAction('send');
            setCurrentState('new_transfer');
          }}
          onViewHistory={() => setCurrentState('history')}
          onViewTransfers={() => setCurrentState('queue')}
        />
      ) : (
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-2xl p-6 sm:p-8 rounded-[36px] smoked-glass-hero flex flex-col my-auto shadow-2xl overflow-hidden pointer-events-auto"
        >
          {/* Subtle internal reflective light glint */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-32 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

          {/* ======================================================= */}
          {/* STATE: RECEIVE WAITING (Step 8)                         */}
          {/* ======================================================= */}
          {currentState === 'receive_waiting' && (
            <motion.div
              key="vessel-receive-waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full py-4 space-y-6 text-center"
            >
              {/* Top Status Header */}
              <div className="flex items-center justify-between w-full pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-[#F5F5F5]">
                    ● Ready to Receive
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#A6A8AD]">
                  {currentMode === 'direct' ? <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" /> : <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />}
                  <span>{currentMode === 'direct' ? 'Direct 30m' : 'Local Wi-Fi'}</span>
                </div>
              </div>

              {/* Central Receiving Radar Pulse & Glass Field */}
              <div className="relative w-36 h-36 flex items-center justify-center my-2">
                {/* Ripple ring 1 */}
                <motion.div
                  animate={{ scale: [0.8, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border border-white/20"
                />
                {/* Ripple ring 2 */}
                <motion.div
                  animate={{ scale: [0.8, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: 0.8, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border border-white/15"
                />
                {/* Center glass circular vessel */}
                <div className="relative w-20 h-20 rounded-full bg-white/[0.06] border border-white/20 flex flex-col items-center justify-center shadow-[0_0_24px_rgba(255,255,255,0.15)]">
                  <ArrowDown className="w-7 h-7 text-[#F5F5F5] animate-bounce" />
                </div>
              </div>

              {/* Status Message */}
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-[#F5F5F5] tracking-tight">
                  Waiting for device...
                </h3>
                <p className="text-xs text-[#A6A8AD] max-w-xs mx-auto">
                  No incoming transfer yet. Make sure the sender selects this device nearby.
                </p>
              </div>

              {/* Local Device Identity Badge */}
              <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-[#F5F5F5]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-[#F5F5F5]">
                    {localDevice.userName}
                    <span className="text-[10px] text-[#A6A8AD] ml-1.5 px-1.5 py-0.2 rounded bg-white/[0.06]">
                      {localDevice.platform}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#686B72]">
                    Visible as {localDevice.deviceName}
                  </div>
                </div>
              </div>

              {/* Helper triggers: Simulate incoming transfer */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => simulateIncomingRequest('trusted')}
                  className="px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-[#A6A8AD] hover:text-[#F5F5F5] cursor-pointer transition-colors"
                >
                  Simulate Trusted (MacBook) →
                </button>
                <button
                  type="button"
                  onClick={() => simulateIncomingRequest('unknown')}
                  className="px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] text-[#A6A8AD] hover:text-[#F5F5F5] cursor-pointer transition-colors"
                >
                  Simulate Unknown (Android) →
                </button>
              </div>
            </motion.div>
          )}

          {/* ======================================================= */}
          {/* STATE: RECEIVE INCOMING CONNECTION (Step 8)             */}
          {/* ======================================================= */}
          {currentState === 'receive_incoming' && (
            <motion.div
              key="vessel-receive-incoming"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full space-y-6 text-center py-2"
            >
              {/* Header with Security Badge */}
              <div className="flex items-center justify-between w-full pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-[#F5F5F5]">
                    ● Incoming transfer
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#F5F5F5] bg-white/[0.05] px-2.5 py-1 rounded-full border border-white/10">
                  <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  <span>Connection verified</span>
                </div>
              </div>

              {/* Sender Glass Profile */}
              <div className="flex flex-col items-center space-y-2">
                <div className="w-16 h-16 rounded-3xl bg-white/[0.06] border border-white/20 flex items-center justify-center text-[#F5F5F5] shadow-[0_0_24px_rgba(255,255,255,0.12)]">
                  <Laptop className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#F5F5F5] tracking-tight">
                    {remoteDevice.userName}
                  </h3>
                  <div className="text-xs text-[#A6A8AD] font-mono">
                    {remoteDevice.userHandle} • {remoteDevice.deviceName}
                  </div>
                </div>
              </div>

              {/* Wants to send you file card */}
              <div className="w-full max-w-sm p-4 rounded-2xl bg-white/[0.035] border border-white/[0.10] flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-[11px] text-[#A6A8AD]">wants to send you</div>
                    <div className="text-sm font-semibold text-[#F5F5F5] truncate max-w-[180px]">
                      Cinematic_Cut.mp4
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono font-medium text-[#D0D3DA] px-2 py-1 rounded bg-white/[0.05]">
                  2.4 GB
                </div>
              </div>

              {/* Actions: Accept or Reject */}
              <div className="flex items-center justify-center gap-3 w-full pt-2">
                <button
                  onClick={() => setCurrentState('receive_waiting')}
                  className="w-1/3 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer hover:bg-white/[0.08] transition-all"
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    setCurrentState('receive_accepting');
                    setTimeout(() => {
                      setCurrentState('transferring');
                    }, 650);
                  }}
                  className="w-1/2 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-lg hover:scale-105 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ======================================================= */}
          {/* STATE: RECEIVE ACCEPTING TRANSITION (Step 8)            */}
          {/* ======================================================= */}
          {currentState === 'receive_accepting' && (
            <motion.div
              key="vessel-receive-accepting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full py-8 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-[#F5F5F5]">
                  Preparing to receive
                </h3>
                <p className="text-xs text-[#A6A8AD]">
                  Establishing secure direct channel...
                </p>
              </div>
            </motion.div>
          )}

          {/* ======================================================= */}
          {/* STATE 1: DISCOVERY (Step 10 Enhanced Discovery Engine)  */}
          {/* ======================================================= */}
          {currentState === 'discovery' && (
            <motion.div
              key="vessel-discovery-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center"
            >
              <DeviceDiscoveryVessel
                currentMode={currentMode}
                transferAction={transferAction}
                onSelectDevice={(device) => setSelectedRemoteDevice(device)}
                onProceedToConnected={(device) => {
                  setSelectedRemoteDevice(device);
                  setCurrentState('connected');
                }}
              />
            </motion.div>
          )}

          {/* ======================================================= */}
          {/* STATE 2: DEVICE CONNECTED (Send Flow)                   */}
          {/* ======================================================= */}
          {currentState === 'connected' && (
            <motion.div
              key="vessel-connected"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full space-y-6"
            >
              {/* Top Status Header */}
              <div className="flex items-center justify-between w-full pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-[#F5F5F5]">
                    ● Connected · {health.quality}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openConnectionHealth}
                    className="text-[11px] font-medium text-[#A6A8AD] hover:text-[#F5F5F5] px-2.5 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors cursor-pointer"
                  >
                    Diagnostics →
                  </button>
                  <div className="flex items-center gap-1 text-xs text-[#A6A8AD]">
                    {currentMode === 'direct' ? <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" /> : <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />}
                    <span>{currentMode === 'direct' ? 'Direct 30m' : 'Local Wi-Fi'}</span>
                  </div>
                </div>
              </div>

              {/* SENDER ⇄ RECEIVER FLOW */}
              <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4 py-2">
                
                {/* SENDER */}
                <div className="w-full sm:w-5/12 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                    {activeSender.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                      {activeSender.userName}
                    </div>
                    <div className="text-xs text-[#A6A8AD] font-mono">
                      {activeSender.platform}
                    </div>
                    <div className="text-[11px] text-[#686B72] truncate mt-0.5">
                      {activeSender.deviceName}
                    </div>
                  </div>
                </div>

                {/* MONOCHROME LIGHT DATA CONDUIT */}
                <div className="flex flex-col items-center justify-center my-1 relative">
                  <div className="relative w-28 h-6 flex items-center justify-center">
                    <div className="absolute inset-x-0 h-[2px] rounded-full bg-white/15" />
                    
                    {/* Flowing soft white particle */}
                    <motion.div
                      animate={{
                        x: isReversedDirection ? [28, -28] : [-28, 28],
                        opacity: [0, 1, 1, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="absolute w-6 h-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                    />

                    <div className="relative z-10 w-7 h-7 rounded-full bg-[#0E0F13] border border-white/20 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" />
                    </div>
                  </div>
                </div>

                {/* RECEIVER */}
                <div className="w-full sm:w-5/12 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0">
                    {activeReceiver.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                      {activeReceiver.userName}
                    </div>
                    <div className="text-xs text-[#A6A8AD] font-mono">
                      {activeReceiver.platform}
                    </div>
                    <div className="text-[11px] text-[#686B72] truncate mt-0.5">
                      {activeReceiver.deviceName}
                    </div>
                  </div>
                </div>
              </div>

              {/* Direction reverse switch */}
              <button
                onClick={() => setIsReversedDirection(!isReversedDirection)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 transition-colors cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Reverse Direction</span>
              </button>

              {/* Direct Mode Discovery Details */}
              <div className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs text-[#A6A8AD]">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#F5F5F5] animate-pulse" />
                  <span>
                    Encrypted Direct Link active • High-speed channel
                  </span>
                </div>
                <span className="font-mono text-[#F5F5F5]">
                  {currentMode === 'direct' ? '30m Range' : 'Wi-Fi Local'}
                </span>
              </div>
            </motion.div>
          )}

          {/* ======================================================= */}
          {/* STATE 3: PAIRING                                        */}
          {/* ======================================================= */}
          {currentState === 'pairing' && (
            <motion.div
              key="vessel-pairing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full space-y-6"
            >
              <div className="flex items-center justify-between w-full pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-[#F5F5F5]" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-[#F5F5F5]">
                    Pairing Authentication
                  </span>
                </div>
                <span className="text-xs text-[#A6A8AD] font-mono">TLS 1.3 / AES-GCM</span>
              </div>

              <div className="flex flex-col items-center text-center space-y-2 py-4">
                <div className="p-3 rounded-2xl bg-white/[0.05] border border-white/10 mb-2">
                  <ShieldCheck className="w-8 h-8 text-[#F5F5F5]" />
                </div>
                <h3 className="text-lg font-bold text-[#F5F5F5]">
                  Pairing with {activeReceiver.deviceName}
                </h3>
                <p className="text-xs text-[#A6A8AD] max-w-sm">
                  Confirm the one-time authentication code shown on both screens matches.
                </p>

                {/* 6-Digit PIN in glass pill */}
                <div className="flex items-center gap-2 pt-4">
                  {'849216'.split('').map((char, index) => (
                    <div
                      key={index}
                      className="w-10 h-12 rounded-xl bg-white/[0.05] border border-white/15 flex items-center justify-center font-mono text-xl font-bold text-[#F5F5F5] shadow-inner"
                    >
                      {char}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ======================================================= */}
          {/* STATE 4: FILE SELECTION                                 */}
          {/* ======================================================= */}
          {currentState === 'file_selection' && (
            <motion.div
              key="vessel-file-selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col w-full space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-[#F5F5F5]" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-[#F5F5F5]">
                    Selected Items ({files.length})
                  </span>
                </div>
                <span className="text-xs font-mono text-[#F5F5F5] font-semibold">
                  {formatSize(totalSizeBytes)}
                </span>
              </div>

              {/* Selected Files List */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-white/[0.05] border border-white/10 shrink-0">
                        {renderFileIcon(file.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#F5F5F5] truncate">
                          {file.name}
                        </div>
                        <div className="text-xs text-[#A6A8AD]">{file.typeLabel}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-[#A6A8AD]">{file.sizeFormatted}</span>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 rounded-full text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add more files mock button */}
              <button
                onClick={() => {
                  const newFile: FileItem = {
                    id: `f-${Date.now()}`,
                    name: 'Design-System-Assets.fig',
                    type: 'document',
                    typeLabel: 'Figma File',
                    sizeBytes: 850 * 1024 * 1024,
                    sizeFormatted: '850 MB',
                  };
                  setFiles((prev) => [...prev, newFile]);
                }}
                className="w-full py-2.5 rounded-2xl border border-dashed border-white/20 hover:border-white/40 text-xs font-medium text-[#A6A8AD] hover:text-[#F5F5F5] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add more files or folders</span>
              </button>
            </motion.div>
          )}

        </motion.div>
      )}

      {/* ========================================================= */}
      {/* 3. BOTTOM WORKFLOW CONTROLS                               */}
      {/* ========================================================= */}
      {currentState !== 'transferring' &&
        currentState !== 'complete' &&
        currentState !== 'history' &&
        currentState !== 'profile' &&
        currentState !== 'settings' &&
        currentState !== 'receive_waiting' &&
        currentState !== 'receive_incoming' &&
        currentState !== 'receive_accepting' &&
        currentState !== 'discovery' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-3 sm:my-4 z-20 pointer-events-auto"
          >
            <div className="flex items-center gap-3 p-1.5 rounded-full smoked-glass-pill shadow-xl">
              <button
                onClick={() => {
                  if (currentState === 'connected') setCurrentState('discovery');
                  if (currentState === 'pairing') setCurrentState('connected');
                  if (currentState === 'file_selection') setCurrentState('pairing');
                  if (currentState === 'review') setCurrentState('file_selection');
                }}
                className="px-4 py-2 rounded-full smoked-btn-secondary text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              {currentState === 'connected' && (
                <button
                  onClick={() => setCurrentState('pairing')}
                  className="px-6 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 transition-all"
                >
                  <span>Start Secure Pairing</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {currentState === 'pairing' && (
                <button
                  onClick={() => setCurrentState('file_selection')}
                  className="px-6 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 transition-all"
                >
                  <span>Verify & Select Files</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {currentState === 'file_selection' && (
                <button
                  onClick={() => setCurrentState('review')}
                  disabled={files.length === 0}
                  className="px-6 py-2.5 rounded-full smoked-btn-primary text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg hover:scale-105 transition-all disabled:opacity-40"
                >
                  <span>Review Transfer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}

              {currentState === 'review' && (
                <button
                  onClick={() => {
                    addTransfer({
                      direction: transferAction,
                      mode: currentMode,
                      destinationDevice: {
                        id: selectedRemoteDevice.id,
                        userName: selectedRemoteDevice.ownerName || selectedRemoteDevice.name,
                        userHandle: selectedRemoteDevice.userHandle,
                        deviceName: selectedRemoteDevice.deviceName || selectedRemoteDevice.name,
                        platform: selectedRemoteDevice.platform,
                      },
                      sourceDevice: {
                        id: macDevice.id,
                        userName: userProfile.name,
                        userHandle: userProfile.username,
                        deviceName: macDevice.name,
                        platform: macDevice.platform,
                      },
                      files: files.map((f) => ({
                        id: f.id,
                        name: f.name,
                        type: f.type === 'image' ? 'image' : f.type === 'video' ? 'video' : f.type === 'document' ? 'document' : f.type === 'apk' ? 'apk' : 'other',
                        typeLabel: f.typeLabel,
                        sizeBytes: f.sizeBytes,
                        sizeFormatted: f.sizeFormatted,
                        status: 'queued',
                        progress: 0,
                      })),
                      totalSize: totalSizeBytes,
                      status: 'transferring',
                    });
                    setCurrentState('queue');
                  }}
                  className="px-8 py-2.5 rounded-full smoked-btn-primary text-xs font-bold flex items-center gap-2 cursor-pointer shadow-2xl hover:scale-105 transition-all"
                >
                  <span>Send {formatSize(totalSizeBytes)}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
        </motion.div>
      </AnimatePresence>

      {/* ========================================================= */}
      {/* 4. RIGHT VERTICAL PAGINATION DOTS                         */}
      {/* ========================================================= */}
      <div className="fixed right-6 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-3 pointer-events-auto">
        {stateSteps.map((step) => {
          const isActive = currentState === step.key;
          return (
            <button
              key={step.key}
              onClick={() => {
                if (step.key === 'receive_waiting') {
                  setTransferAction('receive');
                } else if (step.key !== 'history') {
                  setTransferAction('send');
                }
                setCurrentState(step.key);
              }}
              title={step.label}
              className="group flex items-center gap-2 cursor-pointer relative"
            >
              <span
                className={`text-[10px] uppercase tracking-wider font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute right-6 text-[#A6A8AD] whitespace-nowrap`}
              >
                {step.label}
              </span>
              <span
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-2 h-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]'
                    : 'bg-white/20 hover:bg-white/50'
                }`}
              />
            </button>
          );
        })}
      </div>

    </div>
  );
};
