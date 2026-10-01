import React, { useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Zap, Wifi, ArrowRight } from 'lucide-react';
import { CapabilityResolver } from '../core/platform/CapabilityResolver';
import { PlatformRegistry } from '../core/platform/PlatformRegistry';

export type TransferMode = 'direct' | 'wifi';

interface ModeSelectionScreenProps {
  onSelectMode: (mode: TransferMode) => void;
}

export const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({ onSelectMode }) => {
  const [hoveredCard, setHoveredCard] = useState<TransferMode | null>(null);

  const platform = PlatformRegistry.getInstance().getAdapter().getPlatform();
  const directAvailable = CapabilityResolver.isCapabilityAvailable(platform, 'transferModes.direct');
  const wifiAvailable = CapabilityResolver.isCapabilityAvailable(platform, 'transferModes.wifi');

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      transition: { duration: 0.3, ease: 'easeInOut' },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 14 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative z-10 w-full h-full min-h-screen flex flex-col justify-between items-center px-4 sm:px-8 py-6 md:py-10 select-none overflow-hidden"
    >
      {/* Top Branding Section */}
      <motion.header variants={itemVariants} className="flex flex-col items-center text-center">
        <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F5F5F5] font-sans">
          NearShare
        </div>
        <p className="text-xs sm:text-sm text-[#A6A8AD] font-normal tracking-wide mt-1.5">
          Send anything. Anywhere nearby.
        </p>
      </motion.header>

      {/* Center Main Selection Section */}
      <main className="w-full max-w-4xl flex flex-col items-center my-auto">
        {/* Main Headings */}
        <motion.div variants={itemVariants} className="text-center mb-8 sm:mb-11">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#F5F5F5] leading-tight">
            How do you want to transfer?
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-[#A6A8AD] font-normal">
            Choose a connection mode to get started.
          </p>
        </motion.div>

        {/* Two Large Smoked-Glass Cards */}
        <motion.div
          variants={itemVariants}
          className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-stretch"
        >
          {/* CARD 1 — DIRECT MODE */}
          <motion.div
            layout
            whileHover={{ y: -6 }}
            onHoverStart={() => setHoveredCard('direct')}
            onHoverEnd={() => setHoveredCard(null)}
            onClick={() => onSelectMode('direct')}
            className="group relative cursor-pointer rounded-3xl p-7 sm:p-9 flex flex-col justify-between apple-glass-card border border-white/[0.1] hover:border-white/30 transition-all duration-300"
          >
            {/* Top specular reflection accent */}
            <div className="absolute top-0 inset-x-10 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

            <div>
              {/* Icon */}
              <motion.div 
                animate={hoveredCard === 'direct' ? { scale: 1.06 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-[#F5F5F5] shadow-[0_0_24px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_36px_rgba(255,255,255,0.1)] group-hover:border-white/30 transition-all duration-300 mb-6"
              >
                <Zap className="w-7 h-7 text-[#F5F5F5]" />
              </motion.div>

              {/* Label */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#F5F5F5]">
                  DIRECT MODE
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[#A6A8AD]">
                  {directAvailable ? 'Available' : 'Available in native app'}
                </span>
              </div>

              {/* Description */}
              <h2 className="text-xl sm:text-2xl font-semibold text-[#F5F5F5] tracking-tight mb-4 leading-snug">
                Direct nearby transfer
              </h2>

              {/* Information Bullets */}
              <div className="text-xs sm:text-sm text-[#A6A8AD] font-normal">
                No router <span className="mx-2 text-[#686B72]">•</span> No internet <span className="mx-2 text-[#686B72]">•</span> Up to 30 m
              </div>
            </div>

            {/* Primary Button */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <button
                type="button"
                className="w-full py-3.5 px-5 rounded-2xl apple-glass-button-primary font-semibold text-sm flex items-center justify-center gap-2 group-hover:gap-3 transition-all cursor-pointer"
              >
                <span>Use Direct Mode</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>

          {/* CARD 2 — WI-FI MODE */}
          <motion.div
            layout
            whileHover={{ y: -6 }}
            onHoverStart={() => setHoveredCard('wifi')}
            onHoverEnd={() => setHoveredCard(null)}
            onClick={() => onSelectMode('wifi')}
            className="group relative cursor-pointer rounded-3xl p-7 sm:p-9 flex flex-col justify-between apple-glass-card border border-white/[0.1] hover:border-white/30 transition-all duration-300"
          >
            {/* Top specular reflection accent */}
            <div className="absolute top-0 inset-x-10 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />

            <div>
              {/* Icon */}
              <motion.div 
                animate={hoveredCard === 'wifi' ? { scale: 1.06 } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/15 flex items-center justify-center text-[#F5F5F5] shadow-[0_0_24px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_36px_rgba(255,255,255,0.1)] group-hover:border-white/30 transition-all duration-300 mb-6"
              >
                <Wifi className="w-7 h-7 text-[#F5F5F5]" />
              </motion.div>

              {/* Label */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-[#F5F5F5]">
                  WI-FI MODE
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[#A6A8AD]">
                  {wifiAvailable ? 'Available' : 'Available in native app'}
                </span>
              </div>

              {/* Description */}
              <h2 className="text-xl sm:text-2xl font-semibold text-[#F5F5F5] tracking-tight mb-4 leading-snug">
                Local network transfer
              </h2>

              {/* Information Bullets */}
              <div className="text-xs sm:text-sm text-[#A6A8AD] font-normal">
                Same network <span className="mx-2 text-[#686B72]">•</span> Fast <span className="mx-2 text-[#686B72]">•</span> Reliable
              </div>
            </div>

            {/* Primary Button */}
            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <button
                type="button"
                className="w-full py-3.5 px-5 rounded-2xl apple-glass-button-secondary font-semibold text-sm flex items-center justify-center gap-2 group-hover:gap-3 transition-all cursor-pointer"
              >
                <span>Use Wi-Fi Mode</span>
                <ArrowRight className="w-4 h-4 text-[#A6A8AD] transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </main>

      {/* Subtle Bottom Ambient Indicator */}
      <motion.footer variants={itemVariants} className="text-center">
        <span className="text-[11px] text-[#686B72] font-medium tracking-wide">
          Secure pairing verified • Peer-to-peer • No data leaves your devices
        </span>
      </motion.footer>
    </motion.div>
  );
};
