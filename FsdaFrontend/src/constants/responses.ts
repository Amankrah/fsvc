/**
 * Responses Constants
 * Centralized configuration for the Responses module
 */

export const ITEMS_PER_PAGE = 10;

export const IMAGE_HEIGHT = 300;

export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
} as const;

export const VIEW_MODES = {
  LIST: 'list',
  DETAIL: 'detail',
} as const;
