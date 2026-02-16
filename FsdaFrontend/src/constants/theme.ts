/**
 * Application Theme - Color Palette and Design Tokens
 *
 * Unified light theme with Indigo primary palette.
 * All screens should import from this file — no hardcoded hex values in screens.
 */

export const colors = {
  // Primary colors - Indigo palette for a modern, professional feel
  primary: {
    main: '#4338CA',      // Indigo 700 - primary actions, headers
    light: '#6366F1',     // Indigo 500 - hover/focus states
    dark: '#3730A3',      // Indigo 800 - pressed/active states
    contrast: '#ffffff',  // Text on primary background
    faint: 'rgba(67, 56, 202, 0.08)',  // Very subtle primary tint for backgrounds
    muted: 'rgba(67, 56, 202, 0.15)',  // Slightly stronger primary tint for cards
  },

  // Secondary/Accent colors - Warm tones for CTAs and important actions
  accent: {
    orange: '#F59E0B',    // Amber 500 - primary CTAs
    amber: '#FBBF24',     // Amber 400 - secondary CTAs
    lightOrange: '#FCD34D', // Amber 300 - hover
    darkOrange: '#D97706', // Amber 600 - active
  },

  // Status colors - Semantic feedback colors
  status: {
    success: '#10B981',   // Emerald 500
    warning: '#F59E0B',   // Amber 500
    error: '#EF4444',     // Red 500
    info: '#06B6D4',      // Cyan 500
  },

  // Neutral colors - Slate scale for text and backgrounds
  neutral: {
    white: '#ffffff',
    black: '#000000',
    gray100: '#F8FAFC',   // Slate 50 - page backgrounds
    gray200: '#E2E8F0',   // Slate 200 - borders, dividers
    gray300: '#CBD5E1',   // Slate 300 - disabled states
    gray400: '#94A3B8',   // Slate 400 - placeholder text
    gray500: '#64748B',   // Slate 500 - secondary text
    gray600: '#475569',   // Slate 600 - body text
    gray700: '#334155',   // Slate 700 - headings
    gray800: '#1E293B',   // Slate 800 - primary text
  },

  // Semantic text colors
  text: {
    primary: '#1E293B',   // Slate 800
    secondary: '#64748B', // Slate 500
    disabled: '#94A3B8',  // Slate 400
    inverse: '#ffffff',
    hint: '#94A3B8',      // Slate 400 - for placeholders
  },

  // Background colors
  background: {
    default: '#F8FAFC',   // Slate 50 - page background
    paper: '#ffffff',     // Card/surface backgrounds
    elevated: '#ffffff',  // Elevated surfaces (modals, dialogs)
    subtle: '#F1F5F9',   // Slate 100 - slightly tinted sections
  },

  // Data visualization colors - Diverse palette for charts and stats
  visualization: {
    purple: '#4338CA',    // Indigo 700
    teal: '#14B8A6',      // Teal 500
    orange: '#F59E0B',    // Amber 500
    cyan: '#06B6D4',      // Cyan 500
    green: '#10B981',     // Emerald 500
    amber: '#FBBF24',     // Amber 400
    blue: '#3B82F6',      // Blue 500
    pink: '#EC4899',      // Pink 500
    red: '#EF4444',       // Red 500
    indigo: '#6366F1',    // Indigo 500
  },

  // Border colors
  border: {
    light: '#E2E8F0',     // Slate 200
    medium: '#CBD5E1',    // Slate 300
    dark: '#94A3B8',      // Slate 400
    focus: '#4338CA',     // Indigo 700 - focused inputs
  },

  // Shadow colors
  shadow: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.10)',
    dark: 'rgba(0, 0, 0, 0.20)',
  },

  // Role-specific colors (for MembersScreen etc.)
  roles: {
    owner: '#4338CA',     // Indigo - primary
    member: '#10B981',    // Emerald - success
    partner: '#F59E0B',   // Amber - accent
  },
};

// Spacing system
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Typography
export const typography = {
  fontSize: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    huge: 28,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// Border radius
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  round: 50,
};

// Elevation/Shadow presets
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: colors.shadow.light,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.shadow.medium,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  large: {
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 8,
  },
};

// Button style presets (for consistent button hierarchy)
export const buttonPresets = {
  primary: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary.main,
  },
  danger: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.status.error,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.lg,
  },
};

// Card style presets
export const cardPresets = {
  default: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...elevation.small,
  },
  elevated: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    ...elevation.medium,
  },
  outlined: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.medium,
    ...elevation.none,
  },
};

// Export a default theme object
export const theme = {
  colors,
  spacing,
  typography,
  borderRadius,
  elevation,
  buttonPresets,
  cardPresets,
};

export default theme;
