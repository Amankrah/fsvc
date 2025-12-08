/**
 * Application Theme - Color Palette and Design Tokens
 *
 * This theme provides a cohesive color system with better visual hierarchy,
 * improved contrast, and warm accent colors for better user experience.
 */

export const colors = {
  // Primary colors - Deep purple with slightly darker shade for reduced eye strain
  primary: {
    main: '#5a00d6',      // Slightly darker purple (was #6200ee)
    light: '#7c4dff',     // Light purple for hover states
    dark: '#4a00b0',      // Dark purple for active states
    contrast: '#ffffff',  // Text on primary background
  },

  // Secondary/Accent colors - Warm tones for CTAs and important actions
  accent: {
    orange: '#ff6f00',    // Warm orange for primary CTAs
    amber: '#ffa726',     // Amber for secondary CTAs
    lightOrange: '#ff9e40', // Light orange for hover
    darkOrange: '#e65100', // Dark orange for active
  },

  // Status colors - Keep existing successful colors
  status: {
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#03dac6',
  },

  // Neutral colors - Grays for text and backgrounds
  neutral: {
    white: '#ffffff',
    black: '#000000',
    gray100: '#f8f9fa',   // Lightest gray - backgrounds
    gray200: '#e9ecef',   // Light gray - borders
    gray300: '#dee2e6',   // Medium-light gray
    gray400: '#ced4da',   // Medium gray
    gray500: '#6c757d',   // Medium-dark gray - secondary text
    gray600: '#495057',   // Dark gray
    gray700: '#343a40',   // Darker gray
    gray800: '#212529',   // Darkest gray - primary text
  },

  // Semantic colors - Context-specific colors
  text: {
    primary: '#212529',
    secondary: '#6c757d',
    disabled: '#adb5bd',
    inverse: '#ffffff',
  },

  background: {
    default: '#f8f9fa',
    paper: '#ffffff',
    elevated: '#ffffff',
  },

  // Data visualization colors - Diverse palette for charts and stats
  visualization: {
    purple: '#5a00d6',
    teal: '#03dac6',
    orange: '#ff6f00',
    cyan: '#00bcd4',
    green: '#4caf50',
    amber: '#ffa726',
    blue: '#2196f3',
    pink: '#e91e63',
  },

  // Border colors
  border: {
    light: '#e9ecef',
    medium: '#dee2e6',
    dark: '#ced4da',
  },

  // Shadow colors
  shadow: {
    light: 'rgba(0, 0, 0, 0.08)',
    medium: 'rgba(0, 0, 0, 0.15)',
    dark: 'rgba(0, 0, 0, 0.3)',
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
  round: 50,
};

// Elevation/Shadow presets
export const elevation = {
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
    shadowRadius: 3.84,
    elevation: 5,
  },
  large: {
    shadowColor: colors.shadow.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 8,
  },
};

// Export a default theme object
export const theme = {
  colors,
  spacing,
  typography,
  borderRadius,
  elevation,
};

export default theme;
