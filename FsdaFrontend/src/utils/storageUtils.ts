/**
 * Storage Utilities
 *
 * Provides utilities for managing AsyncStorage size and compression
 */

/**
 * Calculate the size of a string in bytes
 */
export const getStringSize = (str: string): number => {
  return new Blob([str]).size;
};

/**
 * Calculate the size of an object when serialized to JSON
 */
export const getObjectSize = (obj: any): number => {
  try {
    const jsonString = JSON.stringify(obj);
    return getStringSize(jsonString);
  } catch (error) {
    console.error('Error calculating object size:', error);
    return 0;
  }
};

/**
 * Format bytes to human readable size
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Check if data size exceeds a threshold
 */
export const exceedsStorageLimit = (data: any, limitMB: number = 5): boolean => {
  const size = getObjectSize(data);
  const limitBytes = limitMB * 1024 * 1024;
  return size > limitBytes;
};

/**
 * Simple data compression by removing unnecessary fields
 */
export const compressQuestionData = (questions: any[]): any[] => {
  return questions.map(q => {
    // Create a copy with only essential fields
    const compressed: any = {
      id: q.id,
      project_id: q.project_id,
      question_text: q.question_text,
      response_type: q.response_type,
      is_required: q.is_required,
    };

    // Add optional fields only if they have values
    if (q.options && q.options.length > 0) compressed.options = q.options;
    if (q.question_category) compressed.question_category = q.question_category;
    if (q.assigned_respondent_type) compressed.assigned_respondent_type = q.assigned_respondent_type;
    if (q.assigned_commodity) compressed.assigned_commodity = q.assigned_commodity;
    if (q.assigned_country) compressed.assigned_country = q.assigned_country;
    if (q.targeted_respondents && q.targeted_respondents.length > 0) compressed.targeted_respondents = q.targeted_respondents;
    if (q.targeted_commodities && q.targeted_commodities.length > 0) compressed.targeted_commodities = q.targeted_commodities;
    if (q.targeted_countries && q.targeted_countries.length > 0) compressed.targeted_countries = q.targeted_countries;
    if (q.order_index !== undefined) compressed.order_index = q.order_index;
    if (q.is_follow_up) compressed.is_follow_up = q.is_follow_up;
    if (q.conditional_logic) compressed.conditional_logic = q.conditional_logic;
    if (q.section_header) compressed.section_header = q.section_header;
    if (q.section_preamble) compressed.section_preamble = q.section_preamble;
    if (q.source_question_bank_id) compressed.source_question_bank_id = q.source_question_bank_id;

    return compressed;
  });
};

/**
 * Chunk data into smaller pieces to avoid quota errors
 */
export const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

/**
 * Estimate how many items can fit in storage limit
 */
export const estimateChunkSize = (sampleItem: any, limitMB: number = 2): number => {
  const itemSize = getObjectSize(sampleItem);
  const limitBytes = limitMB * 1024 * 1024;

  if (itemSize === 0) return 100; // Default fallback

  // Conservative estimate: use 80% of limit to account for overhead
  const maxItems = Math.floor((limitBytes * 0.8) / itemSize);
  return Math.max(10, maxItems); // At least 10 items per chunk
};

/**
 * Remove duplicate generated questions based on project, respondent type, commodity, and country
 * Keeps the first occurrence of each unique combination
 */
export const deduplicateGeneratedQuestions = (questions: any[]): any[] => {
  const seen = new Set<string>();
  const deduplicated: any[] = [];

  for (const question of questions) {
    // Create a unique key based on identifying fields
    const key = `${question.project_id}|${question.assigned_respondent_type}|${question.assigned_commodity}|${question.assigned_country}|${question.source_question_bank_id || question.question_text}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(question);
    }
  }

  const removedCount = questions.length - deduplicated.length;
  if (removedCount > 0) {
    console.log(`🧹 Removed ${removedCount} duplicate generated questions`);
  }

  return deduplicated;
};
