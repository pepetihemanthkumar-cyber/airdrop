import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { EASE_SNAPPY } from '../../core/motion/motionTokens';

export interface GlassCloseButtonProps {
  onClose: (e?: React.MouseEvent) => void;
  ariaLabel?: string;
  className?: string;
  iconClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  autoFocus?: boolean;
}

export const GlassCloseButton: React.FC<GlassCloseButtonProps> = ({
  onClose,
  ariaLabel = 'Close',
  className = '',
  iconClassName = 'w-4 h-4',
  size = 'md',
  title = 'Close',
  autoFocus = false,
}) => {
  const { settings } = useSettings();
  const isReducedMotion = settings.reducedMotion;

  // Hit area styles guaranteeing minimum 40x40px hit box on desktop
  const sizeClasses = {
    sm: 'w-8 h-8 min-w-[32px] min-h-[32px]',
    md: 'w-10 h-10 min-w-[40px] min-h-[40px]',
    lg: 'w-11 h-11 min-w-[44px] min-h-[44px]',
  }[size];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <motion.button
      type="button"
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      title={title}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      whileTap={isReducedMotion ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.12, ease: EASE_SNAPPY }}
      className={`relative flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.10] active:bg-white/[0.14] text-[#A6A8AD] hover:text-[#F5F5F5] border border-white/10 hover:border-white/20 transition-colors cursor-pointer shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm ${sizeClasses} ${className}`}
    >
      <X className={`${iconClassName} pointer-events-none transition-transform duration-150`} />
    </motion.button>
  );
};
