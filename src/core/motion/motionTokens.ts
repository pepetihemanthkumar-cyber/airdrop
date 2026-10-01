/**
 * NearShare Motion & Transition Tokens
 *
 * Provides centralized, GPU-accelerated motion tokens, easing curves, and
 * transition variants to ensure zero-layout-shift and continuous native smoothness.
 *
 * DESIGN CONSTRAINTS:
 * 1. Subtle & Physically Coherent: No large translations, spins, elastic bounce, or jarring slides.
 * 2. GPU-Accelerated: Strictly animates opacity and transform (translateY/scale); avoids width/height reflows.
 * 3. Respects Reduced Motion: Provides instant/opacity-only fallbacks when reducedMotion is enabled.
 */

import type { Variants, Transition } from 'framer-motion';

// Premium Apple-inspired cubic-bezier easing curve
export const EASE_PREMIUM: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const EASE_SNAPPY: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Timing durations (in seconds)
export const MOTION_DURATIONS = {
  pageEnter: 0.28,
  pageExit: 0.18,
  cardEnter: 0.22,
  cardExit: 0.14,
  modalEnter: 0.24,
  modalExit: 0.18,
  navPill: 0.24,
  instant: 0.08,
} as const;

// Standard Page Transition
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.pageEnter,
      ease: EASE_PREMIUM,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: MOTION_DURATIONS.pageExit,
      ease: EASE_PREMIUM,
    },
  },
};

// Reduced Motion Page Transition
export const reducedPageTransitionVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: MOTION_DURATIONS.instant },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION_DURATIONS.instant },
  },
};

// Card / Item Subtle Entrance
export const cardEntranceVariants: Variants = {
  initial: {
    opacity: 0,
    y: 4,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.cardEnter,
      ease: EASE_PREMIUM,
    },
  },
  exit: {
    opacity: 0,
    y: -2,
    transition: {
      duration: MOTION_DURATIONS.cardExit,
    },
  },
};

// Modal Overlay & Container Variants
export const modalOverlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16 },
  },
};

export const modalContentVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.985,
    y: 6,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.modalEnter,
      ease: EASE_PREMIUM,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.985,
    y: -4,
    transition: {
      duration: MOTION_DURATIONS.modalExit,
      ease: EASE_PREMIUM,
    },
  },
};

// Shared Navigation Active Indicator Transition
export const navIndicatorTransition: Transition = {
  type: 'spring',
  stiffness: 480,
  damping: 38,
  mass: 0.8,
};

// Subtle interactive tap response for buttons
export const buttonTapMotion = {
  whileTap: { scale: 0.985 },
  transition: { duration: 0.12, ease: EASE_SNAPPY },
};
