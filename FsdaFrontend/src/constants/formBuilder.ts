/**
 * Form Builder Constants
 * Centralized configuration for the Form Builder module
 */

import { ResponseType } from '../types';

/**
 * Question Category Display Order
 * Defines the order in which question categories should be displayed in generated questions
 */
export const QUESTION_CATEGORY_ORDER = [
  'Sociodemographics',
  'Environmental LCA',
  'Social LCA',
  'Vulnerability',
  'Fairness',
  'Solutions',
  'Informations',
  'Proximity and Value',
];

/**
 * Get the sort index for a category
 * Returns the index in QUESTION_CATEGORY_ORDER, or a large number for unknown categories
 */
export const getCategorySortIndex = (category: string): number => {
  const index = QUESTION_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? 9999 : index; // Unknown categories go to the end
};

export const RESPONSE_TYPE_CATEGORIES = [
  {
    label: 'Text',
    icon: 'text',
    types: ['text_short', 'text_long'] as ResponseType[],
  },
  {
    label: 'Number',
    icon: 'numeric',
    types: ['numeric_integer', 'numeric_decimal', 'scale_rating'] as ResponseType[],
  },
  {
    label: 'Choice',
    icon: 'format-list-bulleted',
    types: ['choice_single', 'choice_multiple'] as ResponseType[],
  },
  {
    label: 'Date',
    icon: 'calendar',
    types: ['date', 'datetime'] as ResponseType[],
  },
  {
    label: 'Location',
    icon: 'map-marker',
    types: ['geopoint', 'geoshape'] as ResponseType[],
  },
  {
    label: 'Media',
    icon: 'camera',
    types: ['image', 'audio', 'video', 'file'] as ResponseType[],
  },
  {
    label: 'Special',
    icon: 'star',
    types: ['signature', 'barcode'] as ResponseType[],
  },
];

export const COUNTRY_OPTIONS = [
  'Ghana',
  'Nigeria',
  'Kenya',
  'Tanzania',
  'Uganda',
  'Ethiopia',
  'South Africa',
  'Senegal',
  'Mali',
  'Burkina Faso',
  "Côte d'Ivoire",
  'Cameroon',
  'Other',
];

export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'greater_than', label: '>' },
  { value: 'less_than', label: '<' },
  { value: 'greater_or_equal', label: '>=' },
  { value: 'less_or_equal', label: '<=' },
  { value: 'in', label: 'In List' },
  { value: 'not_in', label: 'Not In List' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

// Note: Priority scores are now auto-set to 5 by default, but kept here for reference
export const PRIORITY_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * DEFAULT_QUESTION_STATE - Simplified form state
 * Note: question_category can be set by user or left empty for auto-assignment based on respondents
 * Note: research_partner_name, research_partner_contact, work_package, priority_score
 *       are now optional and have sensible backend defaults
 */
export const DEFAULT_QUESTION_STATE = {
  question_text: '',
  question_category: '', // User-specified custom category (empty = auto-assign based on respondent)
  response_type: 'text_short' as ResponseType,
  is_required: true,
  allow_multiple: false,
  options: [],
  validation_rules: {},
  targeted_respondents: [],
  targeted_commodities: [],
  targeted_countries: [],
  data_source: 'internal',
  is_active: true,
  tags: [],
  is_follow_up: false,
  conditional_logic: null,
  section_header: '',
  section_preamble: '',
};
