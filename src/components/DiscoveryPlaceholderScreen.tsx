import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wifi, ChevronDown, ArrowLeft, Check } from 'lucide-react';
import type { TransferMode } from './ModeSelectionScreen';

interface DiscoveryPlaceholderScreenProps {
  currentMode: TransferMode;
  onModeChange: (mode: TransferMode) => void;
  onBackToModeSelect: () => void;
}

export const DiscoveryPlaceholderScreen: React.FC<DiscoveryPlaceholderScreenProps> = ({
  currentMode,
  onModeChange,
  onBackToModeSelect,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="relative z-10 w-full h-full min-h-screen flex flex-col justify-between px-6 sm:px-10 py-6 md:py-8 select-none"
    >
      {/* Top Bar with Mode Switcher */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand & Mode Pill */}
        <div className="flex items-center gap-3">
          <span className="font-bold text-xl tracking-tight text-white/95">NearShare</span>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-400/25 text-[11px] font-medium text-purple-300">
            <Wifi className="w-3 h-3 text-purple-400" />
            <span>Wi-Fi</span>
          </div>
        </div>

        {/* Back and Mode Switch Control */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToModeSelect}
            className="px-3 py-1.5 rounded-xl apple-glass-pill hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-400/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/50 text-xs font-semibold tracking-wide transition-all shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)] cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5 text-purple-400" />
              <span>📶 Wi-Fi</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Mode Dropdown Menu */}
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
                    className="absolute right-0 mt-2 w-52 rounded-2xl apple-glass-card border border-white/15 p-1.5 z-50 shadow-2xl backdrop-blur-3xl bg-[#090b10]/95"
                  >
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onModeChange('direct');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium hover:bg-white/[0.06] text-slate-300 text-left cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-sky-400" />
                        <span>⚡ Direct</span>
                      </div>
                      {currentMode === 'direct' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onModeChange('wifi');
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold bg-purple-500/15 text-purple-200 border border-purple-400/30 text-left mt-1"
                    >
                      <div className="flex items-center gap-2">
                        <Wifi className="w-3.5 h-3.5 text-purple-400" />
                        <span>📶 Wi-Fi</span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-purple-400" />
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Center Discovery Minimal State */}
      <main className="w-full max-w-lg mx-auto flex flex-col items-center text-center my-auto">
        {/* Animated Pulse Rings */}
        <div className="relative w-36 h-36 flex items-center justify-center mb-8">
          <div className="absolute inset-0 rounded-full border border-purple-400/30 animate-ping opacity-30" />
          <div className="absolute w-28 h-28 rounded-full border border-purple-400/40 animate-pulse" />
          
          <div className="relative z-10 w-16 h-16 rounded-3xl apple-glass-card flex items-center justify-center border border-purple-400/50 text-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.35)]">
            <Wifi className="w-8 h-8 stroke-purple-300" />
          </div>
        </div>

        {/* Discovery Message */}
        <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-2">
          Searching local network…
        </h2>
        
        <p className="text-sm text-slate-400 max-w-sm">
          Ensure devices are connected to the same Wi-Fi network.
        </p>

        {/* Direct Mode Option */}
        <button
          onClick={() => onModeChange('direct')}
          className="mt-6 px-4 py-2 rounded-xl apple-glass-pill text-xs font-semibold text-sky-300 border border-sky-400/30 hover:bg-sky-500/15 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Switch to Direct Mode</span>
        </button>
      </main>

      {/* Bottom Footer */}
      <footer className="text-center text-xs text-slate-600">
        NearShare • Local Wi-Fi Transport
      </footer>
    </motion.div>
  );
};
