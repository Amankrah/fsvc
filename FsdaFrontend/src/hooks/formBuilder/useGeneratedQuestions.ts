/**
 * useGeneratedQuestions Hook
 * Manages Generated Questions (Question instances) with reorder functionality
 * These are project-specific questions created from the Question Bank for data collection
 */

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { showAlert, showConfirm, showSuccess, showError } from '../../utils/alert';
import apiService from '../../services/api';
import { offlineQuestionCache, networkMonitor } from '../../services';
import { Question } from '../../types';

export const useGeneratedQuestions = (projectId: string) => {
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderedQuestions, setReorderedQuestions] = useState<Question[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});

  const loadGeneratedQuestions = useCallback(async () => {
    try {
      // FormBuilder should ALWAYS load ALL questions (no pagination)
      console.log('📋 FormBuilder: Loading ALL generated questions (pagination disabled)');

      setLoading(true);

      // Check if online
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Fetch ALL questions from server (no pagination in FormBuilder)
        console.log('🌐 Loading ALL generated questions from API (FormBuilder - no pagination)');
        const questionsData = await apiService.getQuestions(projectId);

        // Extract ALL questions (no pagination in FormBuilder)
        const questionsList: Question[] = Array.isArray(questionsData)
          ? questionsData
          : (questionsData.results || []);

        console.log(`✓ Loaded ${questionsList.length} generated questions (ALL - no pagination)`);

        setGeneratedQuestions(questionsList);
        setTotalCount(questionsList.length);
        setHasMore(false); // No pagination in FormBuilder
        setCurrentPage(1);

        // DON'T cache in FormBuilder - caching only happens in Data Collection screen
        // User should explicitly use "Cache for Offline" button when preparing for offline data collection

        return questionsList;
      } else {
        // Load ALL from cache when offline (no pagination)
        console.log('📴 Offline - loading ALL generated questions from cache');
        const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);
        const questionsList = cachedQuestions as any as Question[];

        setGeneratedQuestions(questionsList);
        setTotalCount(questionsList.length);
        setHasMore(false); // No pagination
        setCurrentPage(1);

        if (questionsList.length > 0) {
          console.log(`✓ Loaded ${questionsList.length} generated questions from cache (ALL)`);
        } else {
          showAlert(
            'No Cached Data',
            'No generated questions cached for offline use.'
          );
        }

        return questionsList;
      }
    } catch (error: any) {
      console.error('Error loading generated questions:', error);

      // Try to load ALL from cache as fallback (no pagination)
      try {
        console.log('📴 Error occurred - trying to load ALL from cache as fallback');
        const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);
        if (cachedQuestions.length > 0) {
          const questionsList = cachedQuestions as any as Question[];

          setGeneratedQuestions(questionsList);
          setTotalCount(questionsList.length);
          setHasMore(false); // No pagination
          setCurrentPage(1);

          showAlert(
            'Loaded from Cache',
            `Failed to fetch from server, but loaded ${questionsList.length} questions from cache (ALL).`
          );
          console.log(`✓ Loaded ${questionsList.length} questions from cache as fallback (ALL - no pagination)`);
          return questionsList;
        }
      } catch (cacheError) {
        console.error('Failed to load from cache:', cacheError);
      }

      setHasMore(false);
      showAlert('Error', 'Failed to load generated questions');
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await loadGeneratedQuestions();
    } catch (error: any) {
      console.error('Error loading data:', error);
      showAlert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [loadGeneratedQuestions]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Reorder mode functions
  const startReorderMode = useCallback((questionsToReorder?: Question[]) => {
    setIsReorderMode(true);
    setReorderedQuestions([...(questionsToReorder || generatedQuestions)]);
  }, [generatedQuestions]);

  const cancelReorderMode = useCallback(() => {
    setIsReorderMode(false);
    setReorderedQuestions([]);
  }, []);

  const moveQuestionUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newQuestions = [...reorderedQuestions];
      [newQuestions[index - 1], newQuestions[index]] = [
        newQuestions[index],
        newQuestions[index - 1],
      ];
      setReorderedQuestions(newQuestions);
    },
    [reorderedQuestions]
  );

  const moveQuestionDown = useCallback(
    (index: number) => {
      if (index === reorderedQuestions.length - 1) return;
      const newQuestions = [...reorderedQuestions];
      [newQuestions[index], newQuestions[index + 1]] = [
        newQuestions[index + 1],
        newQuestions[index],
      ];
      setReorderedQuestions(newQuestions);
    },
    [reorderedQuestions]
  );

  const saveQuestionOrder = useCallback(async () => {
    try {
      // Get the generation bundle context (all questions should have same tags)
      if (reorderedQuestions.length === 0) {
        showAlert('Error', 'No questions to reorder');
        return;
      }

      const firstQuestion = reorderedQuestions[0];
      const bundleRespondentType = firstQuestion.assigned_respondent_type;
      const bundleCommodity = firstQuestion.assigned_commodity;
      const bundleCountry = firstQuestion.assigned_country;

      // Verify all questions belong to the same bundle
      const allSameBundle = reorderedQuestions.every(
        (q) =>
          q.assigned_respondent_type === bundleRespondentType &&
          q.assigned_commodity === bundleCommodity &&
          q.assigned_country === bundleCountry
      );

      if (!allSameBundle) {
        showAlert(
          'Error',
          'Cannot reorder questions from different generation bundles. Please filter to a specific Respondent Type, Commodity, and Country combination first.'
        );
        return;
      }

      const questionIds = reorderedQuestions.map((q) => q.id);
      await apiService.reorderQuestions(projectId, questionIds);

      // Reload all questions to get the updated order
      await loadGeneratedQuestions();
      setIsReorderMode(false);
      setReorderedQuestions([]);

      showAlert('Success', 'Question order updated successfully for this generation bundle');
    } catch (error: any) {
      console.error('Error saving question order:', error);

      // Handle validation errors for follow-up questions
      const errorData = error.response?.data;

      if (errorData?.order_validation_errors) {
        // Follow-up question validation errors
        const errorMessage = `Cannot reorder: Follow-up questions must appear after their parent questions.\n\nIssues found:\n${errorData.order_validation_errors.join('\n')}`;
        showAlert('Validation Error', errorMessage);
      } else if (errorData?.message && errorData?.message.includes('follow-up')) {
        // Generic follow-up error
        showAlert('Validation Error', errorData.message);
      } else {
        // Generic error
        showAlert('Error', errorData?.error || errorData?.message || 'Failed to save question order');
      }
    }
  }, [projectId, reorderedQuestions, loadGeneratedQuestions]);

  // Generate questions offline using cached Question Bank
  const generateQuestionsOffline = useCallback(async (
    respondentType: string,
    commodity: string,
    country: string
  ) => {
    try {
      console.log('Generating questions offline...');

      const newQuestions = await offlineQuestionCache.generateQuestionsOffline(
        projectId,
        respondentType,
        commodity,
        country
      );

      if (newQuestions.length > 0) {
        // Refresh the list to show newly generated questions
        await loadGeneratedQuestions();

        showAlert(
          'Questions Generated Offline',
          `Generated ${newQuestions.length} questions. They will sync to the server when you're back online.`,
          [{ text: 'OK' }]
        );
      } else {
        showAlert(
          'No New Questions',
          'No matching questions found in the Question Bank, or all questions have already been generated for this combination.'
        );
      }

      return newQuestions;
    } catch (error) {
      console.error('Error generating questions offline:', error);
      showAlert(
        'Error',
        'Failed to generate questions offline. Make sure Question Bank is cached.'
      );
      return [];
    }
  }, [projectId, loadGeneratedQuestions]);

  // Delete single generated question
  const deleteGeneratedQuestion = useCallback(
    async (questionId: string) => {
      const confirmed = await showConfirm(
        'Delete Question',
        'Are you sure you want to delete this generated question? This will not affect the Question Bank.',
        'Delete',
        'Cancel'
      );

      if (confirmed) {
        try {
          await apiService.deleteQuestion(questionId);
          await loadGeneratedQuestions();
          showSuccess('Question deleted successfully');
        } catch (error) {
          console.error('Error deleting question:', error);
          showError('Failed to delete question');
          throw error;
        }
      }
    },
    [loadGeneratedQuestions]
  );

  // Bulk delete generated questions
  const deleteAllGeneratedQuestions = useCallback(async () => {
    const confirmed = await showConfirm(
      'Delete All Generated Questions',
      `This will permanently delete ALL ${generatedQuestions.length} generated questions for this project. The Question Bank will not be affected.\n\nAre you sure?`,
      'Delete All',
      'Cancel'
    );

    if (confirmed) {
      try {
        console.log(`Starting deletion of ${generatedQuestions.length} questions...`);

        // Delete questions sequentially to avoid SQLite database locking issues
        // Parallel deletes cause "database is locked" errors with SQLite
        let deletedCount = 0;
        const totalQuestions = generatedQuestions.length;

        for (const question of generatedQuestions) {
          try {
            await apiService.deleteQuestion(question.id);
            deletedCount++;

            // Log progress every 20 questions
            if (deletedCount % 20 === 0) {
              console.log(`Deleted ${deletedCount}/${totalQuestions} questions...`);
            }
          } catch (error: any) {
            console.error(`Failed to delete question ${question.id}:`, error.message);
            // Continue with next question even if one fails
          }
        }

        console.log(`✓ Completed deletion: ${deletedCount}/${totalQuestions} questions deleted`);

        await loadGeneratedQuestions();
        showSuccess(`Successfully deleted ${deletedCount} generated questions`);
      } catch (error: any) {
        console.error('Error deleting questions:', error);
        showError(error.response?.data?.error || 'Failed to delete all questions');
        throw error;
      }
    }
  }, [generatedQuestions, loadGeneratedQuestions]);

  // Load more questions - DISABLED (pagination removed from FormBuilder)
  const loadMore = useCallback(async () => {
    console.log('⚠️  LoadMore called but pagination is disabled in FormBuilder');
    // No-op: FormBuilder always loads ALL questions at once
    return;
  }, []);

  // Load response counts for questions
  const loadResponseCounts = useCallback(async () => {
    try {
      const data = await apiService.getQuestionResponseCounts(projectId);
      setResponseCounts(data.response_counts || {});
      console.log(`✓ Loaded response counts for ${Object.keys(data.response_counts || {}).length} questions`);
    } catch (error) {
      console.error('Error loading response counts:', error);
      // Don't show error to user - this is optional data
    }
  }, [projectId]);

  // Export generated questions as JSON
  const exportGeneratedQuestionsJSON = useCallback(async (
    filters?: {
      assigned_respondent_type?: string;
      assigned_commodity?: string;
      assigned_country?: string;
    }
  ) => {
    try {
      const blob = await apiService.exportGeneratedQuestionsJSON(projectId, filters);
      const fileName = `generated_questions_${new Date().toISOString().split('T')[0]}.json`;

      // Web download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showAlert('Success', 'JSON export downloaded successfully');
    } catch (error) {
      console.error('Error exporting JSON:', error);
      showAlert('Error', 'Failed to export questions as JSON');
    }
  }, [projectId]);

  return {
    generatedQuestions,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    totalCount,
    responseCounts, // Response counts per question
    loadData,
    handleRefresh,
    loadMore,
    loadResponseCounts, // Load response counts
    generateQuestionsOffline, // Offline question generation
    deleteGeneratedQuestion, // Single delete
    deleteAllGeneratedQuestions, // Bulk delete
    exportGeneratedQuestionsJSON, // Export as JSON
    // Reorder mode
    isReorderMode,
    reorderedQuestions,
    startReorderMode,
    cancelReorderMode,
    moveQuestionUp,
    moveQuestionDown,
    saveQuestionOrder,
  };
};
