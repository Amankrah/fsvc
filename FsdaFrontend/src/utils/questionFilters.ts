/**
 * CRITICAL SECURITY: Question Filter Validation Utilities
 *
 * Ensures that questions are NEVER loaded or generated without ALL 3 mandatory filters:
 * 1. Respondent Type
 * 2. Commodity
 * 3. Country
 *
 * This prevents:
 * - Data leakage across respondent types
 * - Cross-commodity data mixing
 * - Cross-country data contamination
 * - Incomplete question generation
 */

export interface QuestionFilters {
  respondent_type?: string | null;
  commodity?: string | null;
  country?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  missingFilters: string[];
}

/**
 * Validate that ALL 3 mandatory filters are present and non-empty
 */
export function validateQuestionFilters(
  respondentType?: string | null,
  commodity?: string | null,
  country?: string | null
): ValidationResult {
  const errors: string[] = [];
  const missingFilters: string[] = [];

  // Check respondent type
  if (!respondentType || respondentType.trim() === '') {
    errors.push('Respondent type is required');
    missingFilters.push('respondent_type');
  }

  // Check commodity
  if (!commodity || commodity.trim() === '') {
    errors.push('Commodity is required');
    missingFilters.push('commodity');
  }

  // Check country
  if (!country || country.trim() === '') {
    errors.push('Country is required');
    missingFilters.push('country');
  }

  const valid = errors.length === 0;

  if (!valid) {
    console.error('❌ CRITICAL VALIDATION FAILED:', {
      errors,
      missingFilters,
      provided: { respondentType, commodity, country }
    });
  } else {
    console.log('✅ Filter validation passed:', {
      respondentType,
      commodity,
      country
    });
  }

  return {
    valid,
    errors,
    missingFilters
  };
}

/**
 * Validate filters from an object
 */
export function validateQuestionFiltersObject(filters: QuestionFilters): ValidationResult {
  return validateQuestionFilters(
    filters.respondent_type,
    filters.commodity,
    filters.country
  );
}

/**
 * Guard function - throws error if validation fails
 */
export function requireAllFilters(
  respondentType?: string | null,
  commodity?: string | null,
  country?: string | null
): void {
  const validation = validateQuestionFilters(respondentType, commodity, country);

  if (!validation.valid) {
    const errorMessage =
      'CRITICAL SECURITY ERROR: Cannot load questions without all 3 mandatory filters. ' +
      `Missing: ${validation.missingFilters.join(', ')}. ` +
      'This is required to prevent data leakage and ensure data integrity.';

    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Check if filters are complete (returns boolean, doesn't throw)
 */
export function hasAllFilters(
  respondentType?: string | null,
  commodity?: string | null,
  country?: string | null
): boolean {
  return validateQuestionFilters(respondentType, commodity, country).valid;
}

/**
 * Get human-readable error message for missing filters
 */
export function getFilterErrorMessage(validation: ValidationResult): string {
  if (validation.valid) {
    return '';
  }

  const missing = validation.missingFilters.join(', ');
  return `Cannot proceed without all required information:\n\n${validation.errors.join('\n')}\n\nPlease select: ${missing}`;
}

/**
 * Log filter state for debugging
 */
export function logFilterState(
  context: string,
  respondentType?: string | null,
  commodity?: string | null,
  country?: string | null
): void {
  console.log(`[${context}] Filter State:`, {
    respondent_type: respondentType || 'NOT SET',
    commodity: commodity || 'NOT SET',
    country: country || 'NOT SET',
    valid: hasAllFilters(respondentType, commodity, country)
  });
}
