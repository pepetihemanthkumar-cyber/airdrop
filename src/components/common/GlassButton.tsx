import React from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';
import { EASE_SNAPPY } from '../../core/motion/motionTokens';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

const variantClasses = {
  primary: 'bg-[#F5F5F5] hover:bg-white text-[#08090B] border border-white/90 shadow-[0_4px_16px_rgba(255,255,255,0.15)] font-semibold',
  secondary: 'bg-white/[0.045] hover:bg-white/[0.08] active:bg-white/[0.12] text-[#F5F5F5] border border-white/12 hover:border-white/20 shadow-[0_4px_14px_rgba(0,0,0,0.4)] font-medium',
  ghost: 'bg-transparent hover:bg-white/[0.05] active:bg-white/[0.08] text-[#A6A8AD] hover:text-[#F5F5F5] border border-transparent hover:border-white/10 font-medium',
  danger: 'bg-white/[0.04] hover:bg-white/[0.08] text-[#F5F5F5] border border-white/20 hover:border-white/30 font-medium',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 min-h-[36px] text-xs rounded-full gap-1.5',
  md: 'px-4 py-2.5 min-h-[40px] min-w-[40px] text-xs sm:text-sm rounded-full gap-2',
  lg: 'px-6 py-3 min-h-[48px] min-w-[48px] text-sm sm:text-base rounded-full gap-2.5',
};

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled = false,
  isLoading = false,
  onClick,
  type = 'button',
  ...rest
}) => {
  const { settings } = useSettings();
  const isReducedMotion = settings?.reducedMotion ?? false;

  return (
    <motion.button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      whileTap={isReducedMotion || disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.1, ease: EASE_SNAPPY }}
      className={`relative inline-flex items-center justify-center transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...(rest as any)}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : icon ? (
        <span className="shrink-0 flex items-center">{icon}</span>
      ) : null}
      <span>{children}</span>
    </motion.button>
  );
};
