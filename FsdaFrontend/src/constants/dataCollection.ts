/**
 * Data Collection Constants
 * Centralized configuration for the Data Collection module
 */

export const IMAGE_QUALITY = 0.7;
export const IMAGE_PREVIEW_HEIGHT = 300;

export const DATE_FORMAT_OPTIONS = {
  date: {
    year: 'numeric' as const,
    month: 'long' as const,
    day: 'numeric' as const,
  },
  datetime: {
    year: 'numeric' as const,
    month: 'long' as const,
    day: 'numeric' as const,
    hour: '2-digit' as const,
    minute: '2-digit' as const,
  },
};

export const GPS_VALIDATION = {
  minLatitude: -90,
  maxLatitude: 90,
  minLongitude: -180,
  maxLongitude: 180,
};

export const DEVICE_INFO = {
  appVersion: '1.0.0',
};
