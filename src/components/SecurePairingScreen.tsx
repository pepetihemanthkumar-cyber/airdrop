import React, { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { 
  Zap, 
  Wifi, 
  ChevronDown, 
  ArrowLeft, 
  Check, 
  Copy, 
  Lock, 
  ShieldCheck, 
  QrCode, 
  ArrowRight,
  Laptop,
  Smartphone,
  Tablet,
  FileUp,
  FolderOpen
} from 'lucide-react';
import { GlassCloseButton } from './common/GlassCloseButton';
import type { NearbyDevice } from './DirectDiscoveryScreen';
import type { TransferMode } from './ModeSelectionScreen';
import { useSecurity } from '../context/SecurityContext';
import { useDeviceTrust } from '../context/DeviceTrustContext';
import { useSettings } from '../context/SettingsContext';

interface SecurePairingScreenProps {
  device: NearbyDevice;
  onBack: () => void;
  onReject: () => void;
  onSwitchMode: (mode: TransferMode) => void;
  onProceedToFileSelection: () => void;
}

type PairingStage = 'verify' | 'verifying_anim' | 'file_selection';

export const SecurePairingScreen: React.FC<SecurePairingScreenProps> = ({
  device,
  onBack,
  onReject,
  onSwitchMode,
  onProceedToFileSelection,
}) => {
  const { requestPairing, verifyPairing, rejectPairing, subscribe } = useSecurity();
  const { completePairing } = useDeviceTrust();
  const { settings } = useSettings();
  const isReducedMotion = settings.reducedMotion;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [pairingStage, setPairingStage] = useState<PairingStage>('verify');
  const [activePairingSessionId, setActivePairingSessionId] = useState<string | null>(null);
  const [sasDisplayCode, setSasDisplayCode] = useState<string>('— — —  — — —');

  // Eagerly request pairing on mount to generate the dynamic session SAS
  React.useEffect(() => {
    let mounted = true;
    requestPairing({
      id: device.id,
      name: device.userName,
      deviceName: device.deviceName,
    }).then((session) => {
      if (mounted) {
        setActivePairingSessionId(session.id);
      }
    }).catch(() => {});

    const unsub = subscribe((event) => {
      if (event.type === 'verificationRequired' && event.pairingId) {
        const req = (event as any).request;
        if (req?.displayCode && mounted) {
          setSasDisplayCode(req.displayCode);
        }
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [device.id, device.userName, device.deviceName, requestPairing, subscribe]);

  const handleCopyPin = () => {
    const raw = sasDisplayCode.replace(/\s+/g, '');
    if (raw && !raw.includes('—')) {
      navigator.clipboard.writeText(raw);
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    }
  };

  const handleAccept = async () => {
    setPairingStage('verifying_anim');
    try {
      const sessionId = activePairingSessionId ?? (await requestPairing({
        id: device.id,
        name: device.userName,
        deviceName: device.deviceName,
      })).id;
      setActivePairingSessionId(sessionId);
      // SAS will be emitted via verificationRequired event — wait for it, then verify
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      // Use the live SAS code received from the event
      await verifyPairing(sessionId, { pin: sasDisplayCode.replace(/\s+/g, '') });
      completePairing(device.id, 'pin', trustDevice);
    } catch {
      // Pairing failed — stay in verify stage so user can retry
      setPairingStage('verify');
      return;
    }

    setTimeout(() => {
      setPairingStage('file_selection');
    }, isReducedMotion ? 100 : 2200);
  };

  const handleRejectClick = () => {
    rejectPairing(device.id).catch(() => {});
    onReject();
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.04,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.25, ease: 'easeInOut' },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, ease: 'easeOut' },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative z-10 w-full h-full min-h-screen flex flex-col justify-between px-4 sm:px-8 py-5 md:py-7 select-none overflow-x-hidden"
    >
      {/* HEADER */}
      <motion.header variants={itemVariants} className="w-full max-w-5xl mx-auto flex items-center justify-between">
        {/* Top-Left: Brand & Mode Pill */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-[#F5F5F5] font-sans">
            NearShare
          </span>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/15 text-[11px] font-medium text-[#F5F5F5]">
            <Zap className="w-3 h-3 text-[#F5F5F5]" />
            <span>Direct</span>
          </div>
        </div>

        {/* Top-Right: Back & Mode Switch Dropdown */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl smoked-glass-pill hover:bg-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5] transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {/* Mode Switcher Pill */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/15 text-[#F5F5F5] hover:bg-white/[0.1] hover:border-white/25 text-xs font-semibold tracking-wide transition-all shadow-sm cursor-pointer"
            >
              <Zap className="w-3 h-3 text-[#F5F5F5]" />
              <span>⚡ Direct</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-52 rounded-2xl smoked-glass-card border border-white/15 p-1.5 z-50 shadow-2xl backdrop-blur-3xl bg-[#0E0F13]/95"
                  >
                    <button
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold bg-white/[0.08] text-[#F5F5F5] border border-white/15 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        <span>⚡ Direct</span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-[#F5F5F5]" />
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onSwitchMode('wifi');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium hover:bg-white/[0.06] text-[#A6A8AD] hover:text-[#F5F5F5] text-left mt-1 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />
                        <span>📶 Wi-Fi</span>
                      </div>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {/* STAGE CONTROLLER */}
      <AnimatePresence mode="wait">
        {/* STAGE 1: VERIFY THIS DEVICE / PAIRING SCREEN */}
        {pairingStage === 'verify' && (
          <motion.main
            key="pairing-verify-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center py-3 sm:py-5 my-auto"
          >
            {/* Heading & Subtitle */}
            <div className="text-center mb-5 sm:mb-6">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight">
                Verify this device
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-400 font-normal">
                Confirm the connection before sharing files.
              </p>
            </div>

            {/* Main Content Layout: Left Device Profile Card | Right Pairing Options */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
              
              {/* LEFT: SELECTED DEVICE CARD (5 cols) */}
              <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-7 rounded-3xl smoked-glass-card border border-white/15 shadow-2xl">
                <div>
                  {/* Top Mode Badge & Status */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/15 text-[11px] font-semibold text-[#F5F5F5] uppercase tracking-wider">
                      <Zap className="w-3 h-3 text-[#F5F5F5]" />
                      <span>Direct</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#F5F5F5] bg-white/[0.06] px-2.5 py-0.5 rounded-full border border-white/15">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>Nearby device</span>
                    </div>
                  </div>

                  {/* Profile Avatar & Identity */}
                  <div className="flex flex-col items-center text-center my-3">
                    <div className="w-20 h-20 rounded-3xl bg-white/[0.06] border border-white/20 flex items-center justify-center shadow-xl mb-3 relative text-[#F5F5F5]">
                      {device.iconType === 'laptop' && <Laptop className="w-9 h-9" />}
                      {device.iconType === 'phone' && <Smartphone className="w-9 h-9" />}
                      {device.iconType === 'tablet' && <Tablet className="w-9 h-9" />}
                      
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#08090B] border border-white/20 flex items-center justify-center">
                        <Lock className="w-3 h-3 text-[#F5F5F5]" />
                      </div>
                    </div>

                    {/* Person's Name */}
                    <h2 className="text-xl sm:text-2xl font-bold text-[#F5F5F5] tracking-tight">
                      {device.userName}
                    </h2>

                    {/* Username */}
                    <div className="text-xs text-[#A6A8AD] font-mono font-medium mt-0.5">
                      @{device.userName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}
                    </div>

                    {/* Device Name & Platform */}
                    <div className="text-xs sm:text-sm text-[#A6A8AD] font-medium mt-2">
                      {device.deviceName} <span className="text-[#686B72]">•</span> {device.platform}
                    </div>
                  </div>

                  {/* Security Indicator */}
                  <div className="mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#F5F5F5] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-[#F5F5F5]">
                        🔒 Secure connection
                      </div>
                      <div className="text-[11px] text-[#A6A8AD] leading-relaxed mt-0.5">
                        Your connection is verified before files are shared.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trusted Device Toggle */}
                <div className="mt-5 pt-3 border-t border-white/[0.06]">
                  <label 
                    onClick={() => setTrustDevice(!trustDevice)}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <div className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center border transition-all ${
                      trustDevice 
                        ? 'bg-[#F5F5F5] border-white text-[#08090B]' 
                        : 'border-white/30 bg-white/[0.05] group-hover:border-white/50'
                    }`}>
                      {trustDevice && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#F5F5F5] group-hover:text-white transition-colors">
                        ✓ Trust this device
                      </div>
                      <div className="text-[11px] text-[#A6A8AD] leading-snug mt-0.5">
                        Automatically approve this device for future transfers.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* RIGHT: PAIRING OPTIONS (7 cols) */}
              <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-7 rounded-3xl smoked-glass-card border border-white/15 shadow-2xl">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#A6A8AD]">
                      Pairing Methods
                    </span>
                    <span className="text-[11px] text-[#686B72]">
                      Choose QR or PIN to verify
                    </span>
                  </div>

                  {/* TWO PAIRING PANELS: QR & PIN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* OPTION 1 — QR PAIRING */}
                    <div className="p-4 sm:p-5 rounded-2xl smoked-glass-pill border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <QrCode className="w-4 h-4 text-[#F5F5F5]" />
                          <h3 className="text-sm font-semibold text-[#F5F5F5]">
                            Scan to connect
                          </h3>
                        </div>

                        {/* Realistic Mock QR Code Visual */}
                        <div className="w-full flex justify-center py-2">
                          <div 
                            onClick={() => setQrModalOpen(true)}
                            className="w-28 h-28 p-2 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center cursor-pointer hover:border-white/30 hover:bg-white/[0.09] transition-all group relative"
                            title="Click to expand QR code"
                          >
                            {/* SVG QR Pattern */}
                            <svg viewBox="0 0 100 100" className="w-full h-full fill-[#F5F5F5]">
                              {/* Top-Left Corner Box */}
                              <rect x="10" y="10" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                              <rect x="17" y="17" width="12" height="12" rx="2" fill="currentColor" />
                              {/* Top-Right Corner Box */}
                              <rect x="64" y="10" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                              <rect x="71" y="17" width="12" height="12" rx="2" fill="currentColor" />
                              {/* Bottom-Left Corner Box */}
                              <rect x="10" y="64" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                              <rect x="17" y="71" width="12" height="12" rx="2" fill="currentColor" />
                              {/* Center Pattern Bits */}
                              <rect x="42" y="12" width="6" height="6" />
                              <rect x="52" y="12" width="6" height="6" />
                              <rect x="42" y="24" width="6" height="6" />
                              <rect x="52" y="28" width="6" height="6" />
                              <rect x="14" y="44" width="6" height="6" />
                              <rect x="24" y="48" width="6" height="6" />
                              <rect x="44" y="44" width="12" height="12" rx="2" fill="#FFFFFF" />
                              <rect x="64" y="44" width="6" height="6" />
                              <rect x="76" y="44" width="6" height="6" />
                              <rect x="84" y="52" width="6" height="6" />
                              <rect x="44" y="64" width="6" height="6" />
                              <rect x="56" y="70" width="6" height="6" />
                              <rect x="70" y="66" width="6" height="6" />
                              <rect x="80" y="78" width="6" height="6" />
                              <rect x="48" y="82" width="6" height="6" />
                            </svg>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#A6A8AD] text-center mt-1">
                          Scan this code from the other device
                        </p>
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setQrModalOpen(true)}
                          className="w-full py-2 px-3 rounded-xl smoked-glass-pill hover:bg-white/[0.08] text-xs font-semibold text-[#A6A8AD] hover:text-[#F5F5F5] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5 text-[#F5F5F5]" />
                          <span>Show QR Code</span>
                        </button>
                      </div>
                    </div>

                    {/* OPTION 2 — PIN PAIRING */}
                    <div className="p-4 sm:p-5 rounded-2xl smoked-glass-pill border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Lock className="w-4 h-4 text-[#F5F5F5]" />
                          <h3 className="text-sm font-semibold text-[#F5F5F5]">
                            Confirm with PIN
                          </h3>
                        </div>

                        {/* Large Six-Digit Dynamic SAS Display */}
                        <div className="w-full flex justify-center py-3 sm:py-4">
                          <div className="flex items-center gap-2 bg-black/40 border border-white/15 px-4 py-2.5 rounded-2xl">
                            <span className="font-mono text-2xl sm:text-3xl font-bold tracking-widest text-[#F5F5F5] text-shadow-sm tabular-nums">
                              {sasDisplayCode}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#A6A8AD] text-center mt-1">
                          Verify matching SAS code on the other device to confirm connection.
                        </p>
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleCopyPin}
                          className="w-full py-2 px-3 rounded-xl smoked-glass-pill hover:bg-white/[0.08] text-xs font-semibold text-[#A6A8AD] hover:text-[#F5F5F5] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {pinCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span className="text-white">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-[#A6A8AD]" />
                              <span>Copy PIN</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* ACTIONS: Accept & Continue / Reject / Back */}
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row items-center gap-3">
                  {/* Primary CTA */}
                  <button
                    onClick={handleAccept}
                    className="w-full sm:flex-1 py-3 px-5 rounded-2xl smoked-btn-primary font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-xl transition-all"
                  >
                    <span>Accept & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Secondary Action: Reject */}
                  <button
                    onClick={handleRejectClick}
                    className="w-full sm:w-auto px-5 py-3 rounded-2xl smoked-glass-pill hover:bg-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 text-sm font-medium transition-all cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>

            </div>
          </motion.main>
        )}

        {/* STAGE 2: LIQUID-GLASS VERIFICATION ANIMATION */}
        {pairingStage === 'verifying_anim' && (
          <motion.main
            key="pairing-anim-main"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center items-center py-6 my-auto text-center"
          >
            <div className="w-full p-8 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl flex flex-col items-center">
              
              {/* Animated Lock Node */}
              <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full border border-white/20 bg-white/[0.04]"
                />
                <div className="relative z-10 w-14 h-14 rounded-2xl smoked-glass-card border border-white/25 flex items-center justify-center text-[#F5F5F5] shadow-lg">
                  <Lock className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              {/* Verification Steps Sequence */}
              <div className="w-full space-y-3 mb-6">
                <div className="text-xs font-semibold text-[#F5F5F5] flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span>Checking connection</span>
                </div>

                <div className="text-[#686B72] text-xs">↓</div>

                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-medium text-white flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Encrypted Peer Handshake Verified</span>
                </div>

                <div className="text-[#686B72] text-xs">↓</div>

                <div className="text-sm font-semibold text-[#F5F5F5]">
                  Device verified
                </div>
              </div>

              <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 2.1, ease: 'easeInOut' }}
                  className="h-full bg-white/60"
                />
              </div>
            </div>
          </motion.main>
        )}

        {/* STAGE 3: FILE SELECTION PLACEHOLDER STAGE */}
        {pairingStage === 'file_selection' && (
          <motion.main
            key="pairing-files-main"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35 }}
            className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center items-center py-6 my-auto text-center"
          >
            <div className="w-full p-7 sm:p-9 rounded-3xl smoked-glass-card border border-white/15 shadow-2xl flex flex-col items-center">
              
              {/* Icon */}
              <div className="w-16 h-16 rounded-3xl bg-white/[0.06] border border-white/20 flex items-center justify-center text-[#F5F5F5] mb-4 shadow-lg">
                <FileUp className="w-8 h-8" />
              </div>

              {/* Ready to share */}
              <h2 className="text-2xl sm:text-3xl font-semibold text-[#F5F5F5] tracking-tight mb-1">
                Ready to share
              </h2>

              <p className="text-xs text-[#A6A8AD] mb-6">
                Direct secure connection active
              </p>

              {/* Selected Device Badge */}
              <div className="w-full p-4 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between mb-6 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/15 flex items-center justify-center shadow-md shrink-0 text-[#F5F5F5]">
                    {device.iconType === 'laptop' && <Laptop className="w-5 h-5" />}
                    {device.iconType === 'phone' && <Smartphone className="w-5 h-5" />}
                    {device.iconType === 'tablet' && <Tablet className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#686B72] uppercase tracking-wider">
                      Selected Device
                    </div>
                    <div className="text-sm font-semibold text-[#F5F5F5]">
                      {device.userName}
                    </div>
                    <div className="text-xs text-[#A6A8AD]">
                      {device.deviceName} • {device.platform}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-medium text-[#F5F5F5] bg-white/[0.08] px-2.5 py-1 rounded-full border border-white/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span>Verified</span>
                </div>
              </div>

              {/* Choose Files Button */}
              <div className="w-full flex flex-col gap-3">
                <button
                  onClick={onProceedToFileSelection}
                  className="w-full py-3.5 px-5 rounded-2xl smoked-btn-primary font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Choose Files →</span>
                </button>

                <button
                  onClick={handleRejectClick}
                  className="w-full py-2.5 text-xs text-[#A6A8AD] hover:text-[#F5F5F5] transition-colors cursor-pointer"
                >
                  Disconnect & return to discovery
                </button>
              </div>

            </div>
          </motion.main>
        )}
      </AnimatePresence>

      {/* QR Code Enlarged Modal */}
      <AnimatePresence>
        {qrModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQrModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="relative z-10 w-full max-w-xs p-6 rounded-3xl smoked-glass-card border border-white/20 bg-[#0E0F13] flex flex-col items-center text-center shadow-2xl"
            >
              <GlassCloseButton
                onClose={() => setQrModalOpen(false)}
                className="absolute top-4 right-4"
              />

              <h3 className="text-base font-semibold text-[#F5F5F5] mb-1">
                Scan to Verify
              </h3>
              <p className="text-xs text-[#A6A8AD] mb-4">
                Point the other device's camera at this QR code
              </p>

              <div className="w-52 h-52 p-3 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full fill-white">
                  <rect x="10" y="10" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                  <rect x="17" y="17" width="12" height="12" rx="2" fill="currentColor" />
                  <rect x="64" y="10" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                  <rect x="71" y="17" width="12" height="12" rx="2" fill="currentColor" />
                  <rect x="10" y="64" width="26" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
                  <rect x="17" y="71" width="12" height="12" rx="2" fill="currentColor" />
                  <rect x="42" y="12" width="6" height="6" />
                  <rect x="52" y="12" width="6" height="6" />
                  <rect x="42" y="24" width="6" height="6" />
                  <rect x="52" y="28" width="6" height="6" />
                  <rect x="14" y="44" width="6" height="6" />
                  <rect x="24" y="48" width="6" height="6" />
                  <rect x="44" y="44" width="12" height="12" rx="2" fill="#FFFFFF" />
                  <rect x="64" y="44" width="6" height="6" />
                  <rect x="76" y="44" width="6" height="6" />
                  <rect x="84" y="52" width="6" height="6" />
                  <rect x="44" y="64" width="6" height="6" />
                  <rect x="56" y="70" width="6" height="6" />
                  <rect x="70" y="66" width="6" height="6" />
                  <rect x="80" y="78" width="6" height="6" />
                  <rect x="48" y="82" width="6" height="6" />
                </svg>
              </div>

              <div className="mt-4 font-mono text-xs text-[#F5F5F5] font-semibold bg-white/[0.08] px-3 py-1.5 rounded-lg border border-white/15 tabular-nums">
                SAS: {sasDisplayCode}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FOOTER */}
      <motion.footer variants={itemVariants} className="w-full max-w-5xl mx-auto flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-white/[0.04]">
        <span>NearShare Secure Enclave</span>
        <div className="flex items-center gap-3">
          <span>Zero Knowledge Authentication</span>
          <span>•</span>
          <span>Mutual Device Verification</span>
        </div>
      </motion.footer>
    </motion.div>
  );
};
