/**
 * Conditional Logic Engine for Follow-up Questions
 *
 * This module handles the evaluation of conditional logic for follow-up questions
 * based on user responses.
 */

import { getCategorySortIndex } from '../constants/formBuilder';

export interface ConditionalLogic {
  enabled: boolean;
  parent_question_id: string;
  show_if: ShowCondition;
}

export interface ShowCondition {
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty' | 'between';
  value?: any;
  values?: any[]; // For 'in', 'not_in', 'between' operators
}

/**
 * Evaluate if a question should be shown based on conditional logic
 */
export function evaluateConditionalLogic(
  conditional: ConditionalLogic | null | undefined,
  responses: { [questionId: string]: any }
): boolean {
  // If no conditional logic or not enabled, show the question
  if (!conditional || !conditional.enabled) {
    return true;
  }

  const { parent_question_id, show_if } = conditional;

  // Get the parent question's response
  const parentResponse = responses[parent_question_id];

  // Evaluate the condition
  return evaluateCondition(parentResponse, show_if);
}

/**
 * Evaluate a single condition
 */
function evaluateCondition(response: any, condition: ShowCondition): boolean {
  const { operator, value, values } = condition;

  switch (operator) {
    case 'equals':
      return evaluateEquals(response, value);

    case 'not_equals':
      return !evaluateEquals(response, value);

    case 'contains':
      return evaluateContains(response, value);

    case 'not_contains':
      return !evaluateContains(response, value);

    case 'greater_than':
      return evaluateGreaterThan(response, value);

    case 'less_than':
      return evaluateLessThan(response, value);

    case 'greater_or_equal':
      return evaluateGreaterOrEqual(response, value);

    case 'less_or_equal':
      return evaluateLessOrEqual(response, value);

    case 'in':
      return evaluateIn(response, values);

    case 'not_in':
      return !evaluateIn(response, values);

    case 'is_empty':
      return evaluateIsEmpty(response);

    case 'is_not_empty':
      return !evaluateIsEmpty(response);

    case 'between':
      return evaluateBetween(response, values);

    default:
      console.warn(`Unknown operator: ${operator}`);
      return true; // Default to showing the question if operator is unknown
  }
}

/**
 * Evaluate equals condition
 */
function evaluateEquals(response: any, value: any): boolean {
  if (response === null || response === undefined) {
    return false;
  }

  // Handle array responses (multiple choice)
  if (Array.isArray(response)) {
    return response.some((item) => item === value);
  }

  // Handle string comparison (case-insensitive)
  if (typeof response === 'string' && typeof value === 'string') {
    return response.toLowerCase() === value.toLowerCase();
  }

  // Handle numeric comparison
  if (typeof response === 'number' || typeof value === 'number') {
    return Number(response) === Number(value);
  }

  // Default comparison
  return response === value;
}

/**
 * Evaluate contains condition (for text responses)
 */
function evaluateContains(response: any, value: any): boolean {
  if (!response) {
    return false;
  }

  // Handle array responses
  if (Array.isArray(response)) {
    return response.some((item) =>
      String(item).toLowerCase().includes(String(value).toLowerCase())
    );
  }

  // Handle string responses
  return String(response).toLowerCase().includes(String(value).toLowerCase());
}

/**
 * Evaluate greater than condition
 */
function evaluateGreaterThan(response: any, value: any): boolean {
  if (response === null || response === undefined) {
    return false;
  }

  const numResponse = Number(response);
  const numValue = Number(value);

  if (isNaN(numResponse) || isNaN(numValue)) {
    return false;
  }

  return numResponse > numValue;
}

/**
 * Evaluate less than condition
 */
function evaluateLessThan(response: any, value: any): boolean {
  if (response === null || response === undefined) {
    return false;
  }

  const numResponse = Number(response);
  const numValue = Number(value);

  if (isNaN(numResponse) || isNaN(numValue)) {
    return false;
  }

  return numResponse < numValue;
}

/**
 * Evaluate greater or equal condition
 */
function evaluateGreaterOrEqual(response: any, value: any): boolean {
  if (response === null || response === undefined) {
    return false;
  }

  const numResponse = Number(response);
  const numValue = Number(value);

  if (isNaN(numResponse) || isNaN(numValue)) {
    return false;
  }

  return numResponse >= numValue;
}

/**
 * Evaluate less or equal condition
 */
function evaluateLessOrEqual(response: any, value: any): boolean {
  if (response === null || response === undefined) {
    return false;
  }

  const numResponse = Number(response);
  const numValue = Number(value);

  if (isNaN(numResponse) || isNaN(numValue)) {
    return false;
  }

  return numResponse <= numValue;
}

/**
 * Evaluate in condition (response matches one of the provided values)
 */
function evaluateIn(response: any, values: any[] | undefined): boolean {
  if (!values || values.length === 0) {
    return false;
  }

  // Handle array responses (multiple choice)
  if (Array.isArray(response)) {
    return response.some((item) => values.includes(item));
  }

  return values.includes(response);
}

/**
 * Evaluate is empty condition
 */
function evaluateIsEmpty(response: any): boolean {
  if (response === null || response === undefined || response === '') {
    return true;
  }

  if (Array.isArray(response)) {
    return response.length === 0;
  }

  if (typeof response === 'object') {
    return Object.keys(response).length === 0;
  }

  return false;
}

/**
 * Evaluate between condition (for numeric ranges)
 */
function evaluateBetween(response: any, values: any[] | undefined): boolean {
  if (!values || values.length < 2) {
    return false;
  }

  const numResponse = Number(response);
  const min = Number(values[0]);
  const max = Number(values[1]);

  if (isNaN(numResponse) || isNaN(min) || isNaN(max)) {
    return false;
  }

  return numResponse >= min && numResponse <= max;
}

/**
 * Sort questions so follow-up questions appear immediately after their parent
 * This ensures proper question flow during data collection
 * Supports nested follow-ups (follow-ups of follow-ups)
 */
export function sortQuestionsWithFollowUps(questions: any[]): any[] {
  // Build a map of parent_id -> follow-up questions
  const followUpMap = new Map<string, any[]>();
  const rootQuestions: any[] = [];

  // Separate root questions from follow-ups
  questions.forEach((question) => {
    if (question.is_follow_up && question.conditional_logic?.parent_question_id) {
      const parentId = question.conditional_logic.parent_question_id;
      if (!followUpMap.has(parentId)) {
        followUpMap.set(parentId, []);
      }
      followUpMap.get(parentId)!.push(question);
    } else {
      rootQuestions.push(question);
    }
  });

  // Sort follow-ups by their original order_index within each parent
  followUpMap.forEach((followUps) => {
    followUps.sort((a, b) => a.order_index - b.order_index);
  });

  // Recursive function to add a question and all its follow-ups
  const addQuestionWithFollowUps = (question: any, result: any[]): void => {
    result.push(question);

    // Recursively add follow-ups for this question
    const followUps = followUpMap.get(question.id);
    if (followUps) {
      followUps.forEach((followUp) => {
        addQuestionWithFollowUps(followUp, result);
      });
    }
  };

  // Build the final ordered list
  const sortedQuestions: any[] = [];

  // Sort root questions by category first, then order_index
  rootQuestions.sort((a, b) => {
    const categoryA = a.question_category || '';
    const categoryB = b.question_category || '';
    const categoryIndexA = getCategorySortIndex(categoryA);
    const categoryIndexB = getCategorySortIndex(categoryB);

    if (categoryIndexA !== categoryIndexB) {
      return categoryIndexA - categoryIndexB;
    }

    // Within same category, maintain original order
    return a.order_index - b.order_index;
  });

  // For each root question, add it and all its nested follow-ups
  rootQuestions.forEach((question) => {
    addQuestionWithFollowUps(question, sortedQuestions);
  });

  return sortedQuestions;
}

/**
 * Filter questions based on conditional logic
 * Returns only questions that should be shown based on current responses
 */
export function filterQuestionsWithConditions(
  questions: any[],
  responses: { [questionId: string]: any }
): any[] {
  // First, sort questions to ensure follow-ups come after their parents
  const sortedQuestions = sortQuestionsWithFollowUps(questions);

  // Then filter based on conditional logic
  return sortedQuestions.filter((question) => {
    // Always show questions without conditional logic
    if (!question.conditional_logic || !question.is_follow_up) {
      return true;
    }

    // Evaluate conditional logic
    return evaluateConditionalLogic(question.conditional_logic, responses);
  });
}

/**
 * Get the next question index to show, skipping hidden follow-up questions
 */
export function getNextVisibleQuestionIndex(
  currentIndex: number,
  questions: any[],
  responses: { [questionId: string]: any }
): number {
  for (let i = currentIndex + 1; i < questions.length; i++) {
    const question = questions[i];

    if (evaluateConditionalLogic(question.conditional_logic, responses)) {
      return i;
    }
  }

  // No more visible questions
  return -1;
}

/**
 * Check if there are any more visible questions after the current index
 */
export function hasMoreVisibleQuestions(
  currentIndex: number,
  questions: any[],
  responses: { [questionId: string]: any }
): boolean {
  return getNextVisibleQuestionIndex(currentIndex, questions, responses) !== -1;
}

/**
 * Get all visible questions up to and including the current index
 */
export function getVisibleQuestions(
  questions: any[],
  responses: { [questionId: string]: any },
  upToIndex?: number
): any[] {
  const maxIndex = upToIndex !== undefined ? upToIndex : questions.length - 1;

  return questions.slice(0, maxIndex + 1).filter((question) =>
    evaluateConditionalLogic(question.conditional_logic, responses)
  );
}

/**
 * Validate conditional logic configuration
 */
export function validateConditionalLogic(conditional: ConditionalLogic): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!conditional.enabled) {
    return { valid: true, errors: [] };
  }

  if (!conditional.parent_question_id) {
    errors.push('Parent question ID is required');
  }

  if (!conditional.show_if) {
    errors.push('Show condition is required');
  } else {
    const { operator, value, values } = conditional.show_if;

    if (!operator) {
      errors.push('Operator is required');
    }

    // Validate value/values based on operator
    if (['in', 'not_in', 'between'].includes(operator)) {
      if (!values || values.length === 0) {
        errors.push(`Operator '${operator}' requires a values array`);
      }

      if (operator === 'between' && values && values.length < 2) {
        errors.push('Between operator requires at least 2 values (min and max)');
      }
    } else if (!['is_empty', 'is_not_empty'].includes(operator)) {
      if (value === null || value === undefined) {
        errors.push(`Operator '${operator}' requires a value`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
