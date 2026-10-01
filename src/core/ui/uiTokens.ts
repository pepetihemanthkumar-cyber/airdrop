/**
 * NearShare Centralized UI Tokens
 *
 * Defines the canonical monochromatic smoked-liquid-glass design tokens:
 * - Color palette (backgrounds, glass, borders, typography)
 * - Radius, spacing, shadows, blur levels
 * - Control heights, content max widths, touch targets
 * - Transition durations & curves
 */

export const UI_COLORS = {
  // Monochromatic Dark Stage Backgrounds
  background: {
    primary: '#08090B',
    secondary: '#101114',
    tertiary: '#17191D',
  },
  
  // Smoked Glass Surfaces (Strictly Monochrome)
  glass: {
    base: 'rgba(255, 255, 255, 0.035)',
    subtle: 'rgba(255, 255, 255, 0.05)',
    card: 'rgba(255, 255, 255, 0.06)',
    active: 'rgba(255, 255, 255, 0.09)',
    hover: 'rgba(255, 255, 255, 0.075)',
    pressed: 'rgba(255, 255, 255, 0.045)',
  },

  // Borders (Silver / Translucent White)
  border: {
    hairline: 'rgba(255, 255, 255, 0.08)',
    subtle: 'rgba(255, 255, 255, 0.12)',
    standard: 'rgba(255, 255, 255, 0.16)',
    prominent: 'rgba(255, 255, 255, 0.20)',
    focus: 'rgba(255, 255, 255, 0.40)',
  },

  // Typography
  text: {
    primary: '#F5F5F5',
    secondary: '#A6A8AD',
    muted: '#686B72',
    contrast: '#FFFFFF',
    dark: '#0B0C0E',
  },
} as const;

export const UI_RADIUS = {
  sm: '0.375rem', // 6px
  md: '0.625rem', // 10px
  lg: '0.875rem', // 14px
  xl: '1.25rem',  // 20px
  '2xl': '1.75rem', // 28px
  full: '9999px',
} as const;

export const UI_BLUR = {
  sm: '4px',
  md: '12px',
  lg: '20px',
  xl: '32px',
} as const;

export const UI_SHADOWS = {
  sm: '0 2px 8px rgba(0, 0, 0, 0.35)',
  md: '0 8px 24px rgba(0, 0, 0, 0.45)',
  lg: '0 16px 40px rgba(0, 0, 0, 0.55)',
  glowSubtle: '0 0 24px rgba(255, 255, 255, 0.04)',
} as const;

export const UI_SPACING = {
  navTopOffset: '1.25rem', // 20px
  navEstimatedHeight: '3rem', // 48px
  navToContentGap: '2.5rem', // 40px
  stagePaddingTop: 'pt-24 sm:pt-28 md:pt-32',
  contentMaxWidth: 'max-w-4xl',
  panelMaxWidth: 'max-w-xl',
  modalMaxWidth: 'max-w-lg',
  vesselMaxWidth: 'max-w-md',
} as const;

export const UI_CONTROLS = {
  minTouchTargetSize: 40, // 40x40px minimum click hit area
  buttonHeightSm: '2rem', // 32px
  buttonHeightMd: '2.5rem', // 40px
  buttonHeightLg: '3rem', // 48px
  inputHeight: '2.75rem', // 44px
} as const;

export const UI_MOTION = {
  durationEnter: 0.24,
  durationExit: 0.18,
  durationFast: 0.12,
  easePremium: [0.22, 1, 0.36, 1] as [number, number, number, number],
  easeSnappy: [0.16, 1, 0.3, 1] as [number, number, number, number],
} as const;
