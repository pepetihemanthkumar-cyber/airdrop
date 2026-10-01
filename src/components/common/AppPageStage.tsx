import React from 'react';
import { motion } from 'framer-motion';
import { useSettings } from '../../context/SettingsContext';
import { pageTransitionVariants, reducedPageTransitionVariants } from '../../core/motion/motionTokens';
import { LAYOUT_TOKENS, Z_INDEX } from '../../core/layout/layoutTokens';

export interface AppPageStageProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl' | 'full';
  animate?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  full: 'max-w-full',
};

export const AppPageStage: React.FC<AppPageStageProps> = ({
  children,
  className = '',
  maxWidth = '4xl',
  animate = true,
}) => {
  const { settings } = useSettings();
  const isReducedMotion = settings.reducedMotion;

  const content = (
    <div
      className={`w-full ${maxWidthClasses[maxWidth]} mx-auto px-4 sm:px-6 md:px-8 pb-16 flex flex-col items-center ${className}`}
      style={{ zIndex: Z_INDEX.mainStage }}
    >
      {children}
    </div>
  );

  if (!animate) {
    return (
      <main className={`relative w-full min-h-screen ${LAYOUT_TOKENS.mainStagePaddingTopClass} flex flex-col`}>
        {content}
      </main>
    );
  }

  return (
    <motion.main
      className={`relative w-full min-h-screen ${LAYOUT_TOKENS.mainStagePaddingTopClass} flex flex-col`}
      variants={isReducedMotion ? reducedPageTransitionVariants : pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {content}
    </motion.main>
  );
};
