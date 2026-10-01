import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Wifi,
  Search,
  X,
  ChevronDown,
  Check,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useProfileDevice } from '../context/ProfileDeviceContext';
import { useTransferQueue } from '../context/TransferQueueContext';
import { useIncomingTransfer } from '../context/IncomingTransferContext';
import { navIndicatorTransition } from '../core/motion/motionTokens';

export type TransferMode = 'direct' | 'wifi';

export type NavTabId = 'home' | 'new' | 'queue' | 'history' | 'profile' | 'settings';

interface FloatingNavPillProps {
  currentMode: TransferMode;
  currentTab?: string;
  onModeChange: (mode: TransferMode) => void;
  onResetToHome: () => void;
  onNavigateToNewTransfer?: () => void;
  onNavigateToQueue?: () => void;
  onNavigateToHistory?: () => void;
  onNavigateToProfile?: () => void;
  onNavigateToSettings?: () => void;
}

function normalizeNavTab(tab?: string): NavTabId {
  if (!tab || tab === 'discovery' || tab === 'receive_waiting' || tab === 'receive_incoming' || tab === 'receive_accepting' || tab === 'connected' || tab === 'pairing' || tab === 'home') {
    return 'home';
  }
  if (tab === 'new' || tab === 'new_transfer' || tab === 'destination' || tab === 'file_selection' || tab === 'review') {
    return 'new';
  }
  if (tab === 'queue' || tab === 'transferring' || tab === 'complete') {
    return 'queue';
  }
  if (tab === 'history') return 'history';
  if (tab === 'profile') return 'profile';
  if (tab === 'settings') return 'settings';
  return 'home';
}

export const FloatingNavPill: React.FC<FloatingNavPillProps> = ({
  currentMode,
  currentTab,
  onModeChange,
  onResetToHome,
  onNavigateToNewTransfer,
  onNavigateToQueue,
  onNavigateToHistory,
  onNavigateToProfile,
  onNavigateToSettings,
}) => {
  const { userProfile } = useProfileDevice();
  const { transfers } = useTransferQueue();
  const { pendingCount } = useIncomingTransfer();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  
  const activeTab = normalizeNavTab(currentTab);

  const navItems: { id: NavTabId; label: string; onClick: () => void; badge?: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'Home',
      onClick: onResetToHome,
    },
    {
      id: 'new',
      label: 'New',
      onClick: () => {
        if (onNavigateToNewTransfer) onNavigateToNewTransfer();
      },
    },
    {
      id: 'queue',
      label: 'Transfers',
      onClick: () => {
        if (onNavigateToQueue) onNavigateToQueue();
      },
      badge: pendingCount > 0 ? (
        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-white/[0.12] border border-white/20 text-[10px] font-mono tabular-nums font-semibold text-white">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>{pendingCount}</span>
        </span>
      ) : transfers.length > 0 ? (
        <span className="px-1.5 py-0.2 rounded-full bg-white/[0.08] border border-white/10 text-[10px] font-mono tabular-nums font-semibold text-white">
          {transfers.length}
        </span>
      ) : null,
    },
    {
      id: 'history',
      label: 'History',
      onClick: () => {
        if (onNavigateToHistory) onNavigateToHistory();
      },
    },
    {
      id: 'profile',
      label: 'Profile',
      onClick: () => {
        if (onNavigateToProfile) onNavigateToProfile();
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      onClick: () => {
        if (onNavigateToSettings) onNavigateToSettings();
      },
    },
  ];

  return (
    <header className="fixed top-5 inset-x-0 z-40 flex items-center justify-center px-4 pointer-events-none">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 rounded-full smoked-glass-pill text-xs font-medium text-[#A6A8AD]"
      >
        {/* NearShare Minimal Brand */}
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={onResetToHome}
          className="flex items-center gap-2 pl-3 pr-2.5 py-1 text-sm font-semibold tracking-tight text-[#F5F5F5] hover:text-white transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          <span>NearShare</span>
        </motion.button>

        {/* Divider */}
        <div className="w-[1px] h-4 bg-white/10 mx-1 hidden sm:block" />

        {/* Nav Links with Continuous Fluid Active Bubble Indicator */}
        <nav className="hidden md:flex items-center gap-0.5 relative">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.985 }}
                onClick={item.onClick}
                className={`relative px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#F5F5F5] font-medium'
                    : 'text-[#A6A8AD] hover:text-[#F5F5F5] hover:bg-white/[0.02]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-pill-active-bubble"
                    transition={navIndicatorTransition}
                    className="absolute inset-0 rounded-full bg-white/[0.08] border border-white/10 shadow-sm pointer-events-none"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {item.label}
                  {item.badge}
                </span>
              </motion.button>
            );
          })}
        </nav>

        {/* Expandable Search Input */}
        <div className="relative flex items-center">
          <motion.div
            initial={false}
            animate={{
              width: isSearchOpen ? '220px' : '32px',
            }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-center h-8 rounded-full border transition-all ${
              isSearchOpen
                ? 'bg-white/[0.06] border-white/20 px-2.5 shadow-inner'
                : 'bg-white/[0.03] border-white/10 hover:border-white/20 justify-center'
            }`}
          >
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex items-center justify-center text-[#A6A8AD] hover:text-[#F5F5F5] cursor-pointer"
              title="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {isSearchOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center flex-1 ml-2 min-w-0"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search transfers, devices..."
                  className="w-full bg-transparent text-xs text-[#F5F5F5] placeholder-[#686B72] focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-0.5 rounded-full text-[#A6A8AD] hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Transfer Mode Switcher Dropdown */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.985 }}
            onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-[#F5F5F5] transition-all cursor-pointer border border-white/10 shadow-sm"
          >
            {currentMode === 'direct' ? (
              <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />
            )}
            <span>{currentMode === 'direct' ? 'Direct' : 'Wi-Fi'}</span>
            <ChevronDown
              className={`w-3 h-3 text-[#A6A8AD] transition-transform duration-200 ${
                isModeDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </motion.button>

          <AnimatePresence>
            {isModeDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsModeDropdownOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-48 rounded-2xl p-1.5 smoked-glass-card z-50 border border-white/15 shadow-2xl backdrop-blur-2xl bg-[#0E0F13]/95"
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[#686B72] uppercase tracking-wider">
                    Transfer Mode
                  </div>
                  <button
                    onClick={() => {
                      onModeChange('direct');
                      setIsModeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                      currentMode === 'direct'
                        ? 'bg-white/[0.08] text-[#F5F5F5]'
                        : 'text-[#A6A8AD] hover:bg-white/[0.04] hover:text-[#F5F5F5]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-[#F5F5F5]" />
                      <span>⚡ Direct</span>
                    </div>
                    {currentMode === 'direct' && <Check className="w-3.5 h-3.5 text-[#F5F5F5]" />}
                  </button>

                  <button
                    onClick={() => {
                      onModeChange('wifi');
                      setIsModeDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                      currentMode === 'wifi'
                        ? 'bg-white/[0.08] text-[#F5F5F5]'
                        : 'text-[#A6A8AD] hover:bg-white/[0.04] hover:text-[#F5F5F5]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Wifi className="w-3.5 h-3.5 text-[#F5F5F5]" />
                      <span>📶 Wi-Fi</span>
                    </div>
                    {currentMode === 'wifi' && <Check className="w-3.5 h-3.5 text-[#F5F5F5]" />}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Live Profile Button */}
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={() => {
            if (onNavigateToProfile) onNavigateToProfile();
          }}
          className="flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-[#F5F5F5] transition-all cursor-pointer border border-white/10"
        >
          <div className="w-5 h-5 rounded-full bg-white text-[#08090B] font-bold text-[10px] flex items-center justify-center shadow-sm">
            {userProfile.name.charAt(0)}
          </div>
          <span className="truncate max-w-[80px] font-semibold">{userProfile.name}</span>
        </motion.button>

        {/* Quick Settings Icon Button */}
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={() => {
            if (onNavigateToSettings) onNavigateToSettings();
          }}
          className="p-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.1] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 transition-colors cursor-pointer"
          title="Settings"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </motion.button>
      </motion.div>
    </header>
  );
};

