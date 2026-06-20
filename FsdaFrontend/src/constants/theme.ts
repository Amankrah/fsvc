/**
 * FSDA Application Theme — "Savanna Intelligence"
 *
 * Design direction: Refined field instrument.
 * Warm, trustworthy, precise. Built for researchers working across Africa
 * and Europe — generous sizing, high contrast, earthy palette.
 *
 * Color story:
 *   Forest green primary — anchors the agricultural/field research context.
 *   Harvest amber accent — drives attention and warmth for CTAs.
 *   Warm off-white backgrounds — life and warmth over sterile white.
 *
 * All existing color token paths are preserved for backward compatibility.
 * New tokens are additive. No screen import should break after this update.
 */

export const colors = {
  // ── Primary — Deep Forest Green ─────────────────────────────────────────
  primary: {
    main: '#1D7A52',                      // Forest green — primary actions, buttons
    light: '#26A86E',                     // Lighter green — hover, active, unread dot
    dark: '#0A3D2B',                      // Deep green — pressed, dark hero bands
    contrast: '#FFFFFF',                  // Text on primary backgrounds
    faint: 'rgba(29, 122, 82, 0.08)',    // Very subtle green tint (unread cards, etc.)
    muted: 'rgba(29, 122, 82, 0.14)',    // Slightly stronger tint (selected states)
    surface: '#EEF9F3',                   // Solid light green background
  },

  // ── Accent — Harvest Amber ───────────────────────────────────────────────
  // Legacy paths (colors.accent.orange / amber / etc.) preserved for all existing
  // screens that reference them. New code should prefer colors.accent.main.
  accent: {
    main: '#D97706',                      // Harvest amber — FABs, CTAs
    orange: '#D97706',                    // Legacy alias → same as main
    amber: '#F59E0B',                     // Legacy alias → lighter amber
    lightOrange: '#FCD34D',               // Legacy alias → amber-300
    darkOrange: '#B45309',                // Legacy alias → amber-700 (pressed)
    light: '#F59E0B',                     // Lighter amber
    dark: '#B45309',                      // Deep amber — pressed
    surface: '#FEF3C7',                   // Solid amber-tinted background
    contrast: '#FFFFFF',
  },

  // ── Status — Semantic feedback ───────────────────────────────────────────
  status: {
    success: '#059669',                   // Emerald
    successSurface: '#D1FAE5',
    warning: '#B45309',                   // Darker amber (accent.dark) — WCAG AA on warningSurface
    warningSurface: '#FEF3C7',
    error: '#DC2626',                     // Red
    errorSurface: '#FEE2E2',
    info: '#2563EB',                      // Blue
    infoSurface: '#EFF6FF',
  },

  // ── Sync status ──────────────────────────────────────────────────────────
  sync: {
    synced: '#059669',
    syncedSurface: '#D1FAE5',
    pending: '#B45309',                   // Darker amber — WCAG AA on pendingSurface
    pendingSurface: '#FEF3C7',
    error: '#DC2626',
    errorSurface: '#FEE2E2',
    offline: '#78716C',
    offlineSurface: '#F4F1EA',
  },

  // ── Neutrals — Warm stone scale ──────────────────────────────────────────
  neutral: {
    white: '#FFFFFF',
    black: '#0A0A0A',
    // New warm-toned scale
    50:  '#FAFAF7',
    100: '#F4F1EA',
    200: '#E8E3D8',
    300: '#D4CDB8',
    400: '#A89E89',
    500: '#7A7060',
    600: '#5C5340',
    700: '#3D3828',
    800: '#211E15',
    900: '#100F0A',
    // Legacy gray aliases (same structure, warm values)
    gray100: '#F4F1EA',   // was Slate 50 — now warm cream
    gray200: '#E8E3D8',   // was Slate 200 — now warm
    gray300: '#D4CDB8',   // was Slate 300
    gray400: '#A89E89',   // was Slate 400
    gray500: '#7A7060',   // was Slate 500
    gray600: '#5C5340',   // was Slate 600
    gray700: '#3D3828',   // was Slate 700
    gray800: '#211E15',   // was Slate 800
  },

  // ── Text ─────────────────────────────────────────────────────────────────
  text: {
    primary: '#1C1917',    // Warm near-black
    secondary: '#78716C',  // Warm gray
    tertiary: '#A8A29E',   // Light warm gray (new)
    disabled: '#C4BCB4',   // Warm disabled
    inverse: '#FFFFFF',
    hint: '#A8A29E',       // Legacy alias for placeholders
    accent: '#1D7A52',     // Green text for emphasis (new)
  },

  // ── Backgrounds ──────────────────────────────────────────────────────────
  background: {
    default: '#F7F6F2',    // Warm off-white page background
    paper: '#FFFFFF',      // Card / surface
    elevated: '#FFFFFF',   // Modals, dialogs
    subtle: '#F4F1EA',     // Warm tinted sections
    accent: '#EEF9F3',     // Green-tinted sections (new)
  },

  // ── Borders ──────────────────────────────────────────────────────────────
  border: {
    light: '#EDE9E0',      // Warm light border
    medium: '#D4CDB8',     // Warm medium border
    dark: '#A89E89',       // Warm dark border
    focus: '#1D7A52',      // Green focus ring
  },

  // ── Data visualization ───────────────────────────────────────────────────
  // Legacy structure preserved. Colors updated to new warm palette.
  visualization: {
    purple: '#4F46E5',     // Indigo (was primary — now a vis color)
    teal: '#0D9488',
    orange: '#EA580C',
    cyan: '#0891B2',
    green: '#059669',
    amber: '#D97706',
    blue: '#2563EB',
    pink: '#DB2777',
    red: '#DC2626',
    indigo: '#4F46E5',
    forest: '#1D7A52',     // New — primary green as vis color
    emerald: '#059669',    // New
    violet: '#7C3AED',     // New
  },

  // ── Role colors ──────────────────────────────────────────────────────────
  roles: {
    owner: '#1D7A52',      // Forest green
    member: '#059669',     // Emerald
    partner: '#D97706',    // Amber
    viewer: '#78716C',     // Stone (new)
  },

  // ── Shadow colors ────────────────────────────────────────────────────────
  // Warm-tinted shadows (replaces pure black)
  shadow: {
    light: 'rgba(28, 25, 23, 0.04)',
    medium: 'rgba(28, 25, 23, 0.08)',
    dark: 'rgba(28, 25, 23, 0.14)',
  },
};

// ── Spacing ─────────────────────────────────────────────────────────────────
// Generous for outdoor / field use. Base increased slightly.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

// ── Typography ───────────────────────────────────────────────────────────────
// Larger base for outdoor readability. Fraunces for display, DM Sans for body.
export const typography = {
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,     // Base body — bumped from 14
    lg: 17,
    xl: 19,
    xxl: 22,
    xxxl: 26,
    huge: 32,
    display: 40,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
  fontWeight: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.3,
    wider: 0.6,
    widest: 1.2,
  },
  // Font families — must match names registered via useFonts in App.tsx
  fontFamily: {
    display: 'Fraunces-Bold',
    displayRegular: 'Fraunces-Regular',
    body: 'DMSans-Regular',
    bodyMedium: 'DMSans-Medium',
    bodySemibold: 'DMSans-SemiBold',
    bodyBold: 'DMSans-Bold',
  },
};

// ── Border radius ────────────────────────────────────────────────────────────
export const borderRadius = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  xxxl: 32,
  round: 999,
};

// ── Elevation / Shadow presets ───────────────────────────────────────────────
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 32,
    elevation: 16,
  },
};

// ── Card presets ─────────────────────────────────────────────────────────────
export const cardPresets = {
  default: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    ...elevation.sm,
  },
  elevated: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    ...elevation.md,
  },
  outlined: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.medium,
    ...elevation.none,
  },
  tinted: {
    backgroundColor: colors.background.accent,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary.muted,
    ...elevation.xs,
  },
};

// ── Button presets ───────────────────────────────────────────────────────────
export const buttonPresets = {
  primary: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  accent: {
    backgroundColor: colors.accent.main,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
  },
  danger: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.status.error,
  },
};

// ── React Native Paper MD3 theme override ────────────────────────────────────
// Use this in App.tsx: <PaperProvider theme={paperTheme}>
export const paperThemeColors = {
  primary: colors.primary.main,
  onPrimary: colors.primary.contrast,
  primaryContainer: colors.primary.surface,
  onPrimaryContainer: colors.primary.dark,
  secondary: colors.accent.main,
  onSecondary: colors.accent.contrast,
  secondaryContainer: colors.accent.surface,
  onSecondaryContainer: colors.accent.dark,
  error: colors.status.error,
  onError: '#FFFFFF',
  errorContainer: colors.status.errorSurface,
  background: colors.background.default,
  onBackground: colors.text.primary,
  surface: colors.background.paper,
  onSurface: colors.text.primary,
  surfaceVariant: colors.background.subtle,
  onSurfaceVariant: colors.text.secondary,
  outline: colors.border.medium,
  outlineVariant: colors.border.light,
  inverseSurface: colors.neutral[800],
  inverseOnSurface: colors.neutral[50],
  inversePrimary: colors.primary.light,
};

export const theme = {
  colors,
  spacing,
  typography,
  borderRadius,
  elevation,
  cardPresets,
  buttonPresets,
  paperThemeColors,
};

export default theme;
