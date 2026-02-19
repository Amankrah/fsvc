/**
 * Utility functions for generating respondent IDs
 */

/**
 * Generate a unique respondent ID with format: PROJ_<projectId>_<timestamp>
 * @param projectId - The project UUID
 * @returns Generated respondent ID
 *
 * Example output: PROJ_A3B5C7D9_1738234567890
 */
export const generateRespondentId = (projectId: string): string => {
  const shortProjectId = projectId.slice(0, 8).toUpperCase();
  const timestamp = Date.now();
  // 6 random hex chars (~16.7M permutations) eliminates same-millisecond collisions
  const random = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `PROJ_${shortProjectId}_${timestamp}${random}`;
};

/**
 * Generate a human-readable respondent ID with format: RESP-<projectCode>-<sequence>
 * @param projectId - The project UUID
 * @param sequence - Optional sequence number (default: random 4-digit number)
 * @returns Generated respondent ID
 *
 * Example output: RESP-A3B5-1234
 */
export const generateHumanReadableId = (projectId: string, sequence?: number): string => {
  const shortProjectId = projectId.slice(0, 4).toUpperCase();
  const seq = sequence !== undefined ? sequence.toString().padStart(4, '0') : Math.floor(1000 + Math.random() * 9000);
  return `RESP-${shortProjectId}-${seq}`;
};

/**
 * Generate a short random respondent ID
 * @returns Generated respondent ID
 *
 * Example output: R7X9K2M4
 */
export const generateShortId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking chars
  let result = 'R';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate a date-based respondent ID with format: <projectCode>_<YYYYMMDD>_<sequence>
 * @param projectId - The project UUID
 * @param sequence - Optional sequence number for the day
 * @returns Generated respondent ID
 *
 * Example output: A3B5_20250130_001
 */
export const generateDateBasedId = (projectId: string, sequence?: number): string => {
  const shortProjectId = projectId.slice(0, 4).toUpperCase();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = sequence !== undefined ? sequence.toString().padStart(3, '0') : Math.floor(1 + Math.random() * 999).toString().padStart(3, '0');
  return `${shortProjectId}_${dateStr}_${seq}`;
};

/**
 * Validate if a respondent ID matches expected format
 * @param id - The respondent ID to validate
 * @returns true if valid format, false otherwise
 */
export const validateRespondentId = (id: string): boolean => {
  // Allow alphanumeric characters, hyphens, underscores
  const pattern = /^[A-Za-z0-9_-]+$/;

  // Check pattern and length
  if (!pattern.test(id) || id.length < 3 || id.length > 255) {
    return false;
  }

  return true;
};

/**
 * Format a respondent ID for display (adds spacing for readability)
 * @param id - The respondent ID
 * @returns Formatted ID
 *
 * Example: PROJ_A3B5C7D9_1738234567890 -> PROJ A3B5C7D9 1738234567890
 */
export const formatRespondentIdForDisplay = (id: string): string => {
  return id.replace(/_/g, ' ');
};

/**
 * ID generation strategies enum
 */
export enum IdGenerationStrategy {
  TIMESTAMP = 'timestamp',
  HUMAN_READABLE = 'human_readable',
  SHORT = 'short',
  DATE_BASED = 'date_based',
}

/**
 * Generate respondent ID based on selected strategy
 * @param strategy - The generation strategy
 * @param projectId - The project UUID
 * @param sequence - Optional sequence number
 * @returns Generated respondent ID
 */
export const generateIdByStrategy = (
  strategy: IdGenerationStrategy,
  projectId: string,
  sequence?: number
): string => {
  switch (strategy) {
    case IdGenerationStrategy.TIMESTAMP:
      return generateRespondentId(projectId);
    case IdGenerationStrategy.HUMAN_READABLE:
      return generateHumanReadableId(projectId, sequence);
    case IdGenerationStrategy.SHORT:
      return generateShortId();
    case IdGenerationStrategy.DATE_BASED:
      return generateDateBasedId(projectId, sequence);
    default:
      return generateRespondentId(projectId);
  }
};