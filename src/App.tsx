import { useState, useEffect, useRef } from 'react';
import { LiquidBackground } from './components/LiquidBackground';
import { FloatingNavPill, type TransferMode } from './components/FloatingNavPill';
import { CentralTransferVessel, type VesselState } from './components/CentralTransferVessel';
import { ProfileDeviceProvider } from './context/ProfileDeviceContext';
import { DeviceTrustProvider } from './context/DeviceTrustContext';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import { TransferComposerProvider } from './context/TransferComposerContext';
import { TransferQueueProvider, useTransferQueue } from './context/TransferQueueContext';
import { IncomingTransferProvider } from './context/IncomingTransferContext';
import { ConnectionHealthProvider } from './context/ConnectionHealthContext';
import { PlatformReadinessProvider } from './context/PlatformReadinessContext';
import { TransferHistoryProvider } from './context/TransferHistoryContext';
import { TransportProvider } from './context/TransportContext';
import { SecurityProvider } from './context/SecurityContext';
import { FileEngineProvider } from './context/FileEngineContext';
import { FileSystemProvider } from './context/FileSystemContext';
import { NativeBridgeProvider } from './context/NativeBridgeContext';
import { NativeShellProvider } from './context/NativeShellContext';
import { NativeTransportProvider } from './context/NativeTransportContext';
import { IncomingTransferRequest } from './components/IncomingTransferRequest';
import { ConnectionHealthPanel } from './components/ConnectionHealthPanel';
import { PlatformReadinessScreen } from './components/PlatformReadinessScreen';
import { ProtocolInspector } from './components/ProtocolInspector';
import { FileEngineInspector } from './components/FileEngineInspector';
import { FileSystemInspector } from './components/FileSystemInspector';
import { NativeBridgeInspector } from './components/NativeBridgeInspector';
import { NativeTransportInspector } from './components/NativeTransportInspector';
import { DirectModeInspector } from './components/DirectModeInspector';
import { PhysicalValidationInspector } from './components/PhysicalValidationInspector';
import { MacOSDirectValidationInspector } from './components/MacOSDirectValidationInspector';
import { InteroperabilityValidationInspector } from './components/InteroperabilityValidationInspector';
import { DesktopLifecycleManager } from './core/lifecycle/DesktopLifecycleManager';
import { hideMainWindow } from './core/native/tauri/TauriIpc';
import { AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCloseButton } from './components/common/GlassCloseButton';

function AppContent() {
  const [currentMode, setCurrentMode] = useState<TransferMode>('direct');
  const [appState, setAppState] = useState<VesselState | null>(null);
  const [quitModalActiveCount, setQuitModalActiveCount] = useState<number | null>(null);

  const { settings } = useSettings();
  const transferQueue = useTransferQueue();

  const lifecycleManagerRef = useRef<DesktopLifecycleManager | null>(null);

  const handleModeChange = (mode: TransferMode) => {
    setCurrentMode(mode);
  };

  const handleResetToHome = () => {
    setCurrentMode('direct');
    setAppState('discovery');
  };

  const handleNavigateToNewTransfer = () => {
    setAppState('new_transfer');
  };

  const handleNavigateToQueue = () => {
    setAppState('queue');
  };

  const handleNavigateToHistory = () => {
    setAppState('history');
  };

  const handleNavigateToProfile = () => {
    setAppState('profile');
  };

  const handleNavigateToSettings = () => {
    setAppState('settings');
  };

  // Initialize Desktop Lifecycle & Tray Manager
  useEffect(() => {
    const manager = new DesktopLifecycleManager(
      {
        runInBackground: settings.runInBackground,
        showTrayIcon: settings.showTrayIcon,
        notifyOnComplete: settings.notifyOnComplete,
        notifyOnFailure: settings.notifyOnFailure,
        notifyOnIncoming: true,
      },
      transferQueue.recoveryManager.checkpointStore
    );
    lifecycleManagerRef.current = manager;

    const cleanup = manager.initialize(
      (target) => {
        if (target === 'home') handleResetToHome();
        else if (target === 'new_transfer') handleNavigateToNewTransfer();
        else if (target === 'queue') handleNavigateToQueue();
        else if (target === 'settings') handleNavigateToSettings();
      },
      (activeCount) => {
        setQuitModalActiveCount(activeCount);
      }
    );

    return () => {
      cleanup();
      manager.destroy();
    };
  }, [transferQueue.recoveryManager]);

  // Update config when settings change
  useEffect(() => {
    if (lifecycleManagerRef.current) {
      lifecycleManagerRef.current.updateConfig({
        runInBackground: settings.runInBackground,
        showTrayIcon: settings.showTrayIcon,
        notifyOnComplete: settings.notifyOnComplete,
        notifyOnFailure: settings.notifyOnFailure,
      });
    }
  }, [settings.runInBackground, settings.showTrayIcon, settings.notifyOnComplete, settings.notifyOnFailure]);

  // Sync transfer queue state with tray icon & notification manager
  useEffect(() => {
    if (lifecycleManagerRef.current) {
      lifecycleManagerRef.current.syncTransferQueueState(transferQueue.transfers);
    }
  }, [transferQueue.transfers]);

  const handleConfirmBackground = async () => {
    setQuitModalActiveCount(null);
    await hideMainWindow();
  };

  const handleConfirmQuit = async () => {
    setQuitModalActiveCount(null);
    if (lifecycleManagerRef.current) {
      await lifecycleManagerRef.current.executeSafeShutdown(true);
    }
  };

  return (
    <div className="relative w-full min-h-screen flex flex-col bg-[#08090B] text-[#F5F5F5] selection:bg-white/20 selection:text-white font-sans overflow-x-hidden">
      {/* 1. Monochromatic Smoked Ambient Background & 3D Floating Droplets */}
      <LiquidBackground />

      {/* 2. Top-Center Floating Glass Pill Navigation */}
      <FloatingNavPill
        currentMode={currentMode}
        currentTab={appState || 'home'}
        onModeChange={handleModeChange}
        onResetToHome={handleResetToHome}
        onNavigateToNewTransfer={handleNavigateToNewTransfer}
        onNavigateToQueue={handleNavigateToQueue}
        onNavigateToHistory={handleNavigateToHistory}
        onNavigateToProfile={handleNavigateToProfile}
        onNavigateToSettings={handleNavigateToSettings}
      />

      {/* 3. Central Liquid-Smoked-Glass Object & Flow Experience */}
      <main className="relative z-10 w-full flex-1 flex flex-col items-center justify-center pointer-events-none">
        <CentralTransferVessel
          currentMode={currentMode}
          onSwitchMode={handleModeChange}
          externalState={appState}
          onStateChange={(st) => setAppState(st)}
        />
      </main>

      {/* 4. Incoming Transfer Request Vessel Modal */}
      <IncomingTransferRequest />

      {/* 5. Connection Health Diagnostic Panel & Modal */}
      <ConnectionHealthPanel />

      {/* 6. Platform Permissions & Storage Readiness Screen */}
      <PlatformReadinessScreen />

      {/* 7. Safe Quit Confirmation Modal */}
      <AnimatePresence>
        {quitModalActiveCount !== null && (
          <div
            onClick={() => setQuitModalActiveCount(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20 sm:pt-24 bg-black/70 backdrop-blur-md"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md p-6 rounded-3xl smoked-glass-card border border-white/20 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5 text-[#F5F5F5]">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold">Transfers in Progress</h3>
                </div>
                <GlassCloseButton onClose={() => setQuitModalActiveCount(null)} ariaLabel="Close quit confirmation" />
              </div>

              <p className="text-xs sm:text-sm text-[#A6A8AD] leading-relaxed">
                You have <strong className="text-white">{quitModalActiveCount} active transfer{quitModalActiveCount === 1 ? '' : 's'}</strong>.
                NearShare can continue transferring files in the background, or save checkpoints and exit.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={handleConfirmBackground}
                  className="px-4 py-2.5 rounded-full smoked-btn-secondary text-xs font-semibold cursor-pointer text-center"
                >
                  Keep in Background
                </button>
                <button
                  onClick={handleConfirmQuit}
                  className="px-4 py-2.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-xs font-semibold cursor-pointer transition-colors text-center"
                >
                  Cancel & Quit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Development Diagnostic Inspectors (Excluded in Production Builds) */}
      {import.meta.env.DEV && (
        <>
          {/* 8. Protocol Inspector */}
          <ProtocolInspector />

          {/* 9. File Engine Inspector */}
          <FileEngineInspector />

          {/* 10. Filesystem Adapter Inspector */}
          <FileSystemInspector />

          {/* 11. Native Bridge Inspector */}
          <NativeBridgeInspector />

          {/* 12. Native Transport & Shell Inspector */}
          <NativeTransportInspector />

          {/* 13. Direct Mode Native Inspector */}
          <DirectModeInspector />

          {/* 14. Physical Validation Inspector */}
          <PhysicalValidationInspector />

          {/* 15. macOS Direct Validation & Observability Inspector */}
          <MacOSDirectValidationInspector />

          {/* 16. Cross-Platform Interoperability Validation Inspector */}
          <InteroperabilityValidationInspector />
        </>
      )}
    </div>
  );
}

export function App() {
  return (
    <SettingsProvider>
      <ProfileDeviceProvider>
        <DeviceTrustProvider>
          <SecurityProvider>
            <NativeShellProvider>
              <NativeBridgeProvider>
                <FileSystemProvider>
                  <FileEngineProvider>
                    <NativeTransportProvider>
                      <TransferHistoryProvider>
                        <TransportProvider>
                          <TransferComposerProvider>
                            <TransferQueueProvider>
                              <IncomingTransferProvider>
                                <ConnectionHealthProvider>
                                  <PlatformReadinessProvider>
                                    <AppContent />
                                  </PlatformReadinessProvider>
                                </ConnectionHealthProvider>
                              </IncomingTransferProvider>
                            </TransferQueueProvider>
                          </TransferComposerProvider>
                        </TransportProvider>
                      </TransferHistoryProvider>
                    </NativeTransportProvider>
                  </FileEngineProvider>
                </FileSystemProvider>
              </NativeBridgeProvider>
            </NativeShellProvider>
          </SecurityProvider>
        </DeviceTrustProvider>
      </ProfileDeviceProvider>
    </SettingsProvider>
  );
}

export default App;

