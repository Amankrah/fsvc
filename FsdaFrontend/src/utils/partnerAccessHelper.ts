/**
 * Partner Access Helper Utilities
 *
 * Provides helper functions for filtering questions and responses based on
 * partner member access control.
 */

import { Question, ProjectMember, Project } from '../types';

/**
 * Get accessible question sources for the current user
 *
 * @param project - The current project
 * @param userId - Current user's ID
 * @returns Array of accessible question source names
 */
export function getAccessibleQuestionSources(
  project: Project | null,
  userId: string | undefined
): string[] {
  if (!project || !userId) {
    return ['owner']; // Default to owner-only access
  }

  // Find current user in team members
  const currentMember = project.team_members?.find(m => m.id === userId);

  if (!currentMember) {
    // User not a member - return owner only
    return ['owner'];
  }

  // Use the accessible_question_sources from backend if available
  if (currentMember.accessible_question_sources) {
    return currentMember.accessible_question_sources;
  }

  // Fallback logic based on role
  if (currentMember.role === 'owner' || currentMember.role === 'collaborator' || currentMember.role === 'analyst') {
    // Full access - can see all question sources
    const sources = ['owner'];
    if (project.partner_organizations) {
      project.partner_organizations.forEach(partner => {
        sources.push(partner.name);
      });
    }
    return sources;
  } else if (currentMember.role === 'partner' && currentMember.partner_organization) {
    // Partner member - only see their own partner's questions
    return [currentMember.partner_organization];
  } else {
    // Regular member - only see owner questions
    return ['owner'];
  }
}

/**
 * Filter questions based on user's accessible question sources
 *
 * @param questions - Array of questions to filter
 * @param accessibleSources - Array of question source names user can access
 * @returns Filtered array of questions
 */
export function filterQuestionsByAccess(
  questions: Question[],
  accessibleSources: string[]
): Question[] {
  return questions.filter(question => {
    // If question has no question_sources defined, assume it's an owner question
    if (!question.question_sources || question.question_sources.length === 0) {
      return accessibleSources.includes('owner');
    }

    // Check if question has any source that user can access
    return question.question_sources.some(source =>
      accessibleSources.includes(source)
    );
  });
}

/**
 * Check if user can access a specific question
 *
 * @param question - Question to check
 * @param accessibleSources - Array of question source names user can access
 * @returns true if user can access the question
 */
export function canAccessQuestion(
  question: Question,
  accessibleSources: string[]
): boolean {
  if (!question.question_sources || question.question_sources.length === 0) {
    return accessibleSources.includes('owner');
  }

  return question.question_sources.some(source =>
    accessibleSources.includes(source)
  );
}

/**
 * Get a user-friendly description of access level
 *
 * @param accessibleSources - Array of accessible question sources
 * @param project - Current project
 * @returns Human-readable description
 */
export function getAccessLevelDescription(
  accessibleSources: string[],
  project: Project | null
): string {
  if (!accessibleSources || accessibleSources.length === 0) {
    return 'No access';
  }

  const hasOwner = accessibleSources.includes('owner');
  const partnerSources = accessibleSources.filter(s => s !== 'owner');

  if (hasOwner && partnerSources.length === 0) {
    return 'Owner questions only';
  } else if (!hasOwner && partnerSources.length === 1) {
    return `${partnerSources[0]} questions only`;
  } else if (!hasOwner && partnerSources.length > 1) {
    return `${partnerSources.join(', ')} questions only`;
  } else if (hasOwner && partnerSources.length > 0) {
    // Check if user has access to all partners
    const allPartnerCount = project?.partner_organizations?.length || 0;
    if (partnerSources.length === allPartnerCount) {
      return 'All questions (full access)';
    } else {
      return `Owner + ${partnerSources.join(', ')} questions`;
    }
  }

  return 'Custom access';
}

/**
 * Check if current user is a partner member
 *
 * @param project - Current project
 * @param userId - Current user's ID
 * @returns true if user is a partner member
 */
export function isPartnerMember(
  project: Project | null,
  userId: string | undefined
): boolean {
  if (!project || !userId) {
    return false;
  }

  const currentMember = project.team_members?.find(m => m.id === userId);
  return currentMember?.is_partner === true || currentMember?.role === 'partner';
}

/**
 * Get partner organization name for current user
 *
 * @param project - Current project
 * @param userId - Current user's ID
 * @returns Partner organization name or null
 */
export function getPartnerOrganization(
  project: Project | null,
  userId: string | undefined
): string | null {
  if (!project || !userId) {
    return null;
  }

  const currentMember = project.team_members?.find(m => m.id === userId);
  return currentMember?.partner_organization || null;
}
