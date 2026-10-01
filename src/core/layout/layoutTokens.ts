import { EASE_PREMIUM, MOTION_DURATIONS } from '../motion/motionTokens';

export const Z_INDEX = {
  background: 0,
  mainStage: 10,
  pageOverlay: 20,
  floatingNav: 40,
  modalBackdrop: 50,
  modalPanel: 55,
  toast: 60,
  criticalDialog: 70,
} as const;

export const LAYOUT_TOKENS = {
  // Navigation Pill Dimensions
  navTopOffset: '1.25rem', // 20px (top-5)
  navEstimatedHeight: '3rem', // 48px
  
  // Mandatory breathing space between FloatingNavPill and MainStage
  navToContentGap: '2.5rem', // 40px
  navToContentGapPx: 40,
  
  // MainStage Top Padding = navTopOffset (20px) + navHeight (48px) + gap (40px) = 108px
  mainStagePaddingTop: 'pt-24 sm:pt-28 md:pt-32',
  mainStagePaddingTopClass: 'pt-24 sm:pt-28',
  modalOverlayPaddingTopClass: 'pt-20 sm:pt-24',

  // Hit Target Constraints
  minTouchTargetSize: 40, // 40x40px minimum click hit area
  closeButtonMinTouchTarget: 40,
} as const;

export const MODAL_MOTION_TOKENS = {
  duration: MOTION_DURATIONS.modalEnter, // 0.24s
  ease: EASE_PREMIUM,
  initial: { opacity: 0, scale: 0.96, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 10 },
  reducedInitial: { opacity: 0 },
  reducedAnimate: { opacity: 1 },
  reducedExit: { opacity: 0 },
} as const;
