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

  const loadGeneratedQuestions = useCallback(async (page: number = 1, pageSize: number = 100, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      }

      // Check if online
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Fetch from server when online with pagination
        console.log(`🌐 Loading generated questions - page ${page}`);
        const questionsData = await apiService.getQuestions(projectId);

        // Check if response is paginated
        if (questionsData.results) {
          // Paginated response from Django REST Framework
          const questionsList: Question[] = questionsData.results;
          // Backend returns { total, links: { next, previous }, results }
          const hasMorePages = !!(questionsData.links?.next || questionsData.next);
          const total = questionsData.total || questionsData.count || questionsList.length;

          console.log('📊 Generated Questions Pagination Info:', {
            page,
            total: questionsData.total,
            count: questionsData.count,
            resultsLength: questionsList.length,
            hasNext: hasMorePages,
            totalCount: total
          });

          setHasMore(hasMorePages);
          setCurrentPage(page);
          setTotalCount(total);

          // Cache for offline use (only cache full dataset on first page)
          if (page === 1) {
            try {
              await offlineQuestionCache.cacheGeneratedQuestions(projectId, questionsList as any);
              console.log(`✓ Cached ${questionsList.length} generated questions for offline use`);
            } catch (cacheError) {
              console.warn('Failed to cache generated questions:', cacheError);
            }
          }

          // Update state - append or replace
          if (append) {
            setGeneratedQuestions(prev => [...prev, ...questionsList]);
          } else {
            setGeneratedQuestions(questionsList);
          }

          console.log(`✓ Loaded ${questionsList.length} generated questions (page ${page}), hasMore: ${hasMorePages}`);
          return questionsList;
        } else {
          // Non-paginated response - simulate pagination
          const allQuestions: Question[] = Array.isArray(questionsData)
            ? questionsData
            : questionsData.results || [];

          // Simulate pagination client-side
          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const questionsList = allQuestions.slice(start, end);
          const hasMorePages = end < allQuestions.length;

          setHasMore(hasMorePages);
          setCurrentPage(page);
          setTotalCount(allQuestions.length);

          // Cache for offline use (only on first page)
          if (page === 1) {
            try {
              await offlineQuestionCache.cacheGeneratedQuestions(projectId, allQuestions as any);
              console.log(`✓ Cached ${allQuestions.length} generated questions for offline use`);
            } catch (cacheError) {
              console.warn('Failed to cache generated questions:', cacheError);
            }
          }

          // Update state
          if (append) {
            setGeneratedQuestions(prev => [...prev, ...questionsList]);
          } else {
            setGeneratedQuestions(questionsList);
          }

          return questionsList;
        }
      } else {
        // Load from cache when offline with client-side pagination
        console.log(`📴 Offline - loading generated questions from cache (page ${page})`);
        const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);

        if (cachedQuestions.length > 0) {
          // Simulate pagination
          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const questionsList = cachedQuestions.slice(start, end) as any as Question[];
          const hasMorePages = end < cachedQuestions.length;

          setHasMore(hasMorePages);
          setCurrentPage(page);

          // Update state
          if (append) {
            setGeneratedQuestions(prev => [...prev, ...questionsList]);
          } else {
            setGeneratedQuestions(questionsList);
          }

          if (page === 1) {
            showAlert(
              'Offline Mode',
              `Loaded ${questionsList.length} of ${cachedQuestions.length} generated questions from cache.`,
              [{ text: 'OK' }]
            );
          }
          return questionsList;
        } else {
          setHasMore(false);
          showAlert(
            'No Cached Data',
            'No generated questions cached for offline use. You can still generate questions from cached Question Bank.'
          );
          return [];
        }
      }
    } catch (error: any) {
      console.error('Error loading generated questions:', error);

      // Try to load from cache as fallback
      try {
        const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);
        if (cachedQuestions.length > 0) {
          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const questionsList = cachedQuestions.slice(start, end) as any as Question[];
          const hasMorePages = end < cachedQuestions.length;

          setHasMore(hasMorePages);
          setCurrentPage(page);

          if (append) {
            setGeneratedQuestions(prev => [...prev, ...questionsList]);
          } else {
            setGeneratedQuestions(questionsList);
          }

          showAlert(
            'Loaded from Cache',
            `Failed to fetch from server, but loaded ${questionsList.length} questions from cache.`
          );
          return questionsList;
        }
      } catch (cacheError) {
        console.error('Failed to load from cache:', cacheError);
      }

      setHasMore(false);
      showAlert('Error', 'Failed to load generated questions');
      return [];
    } finally {
      if (append) {
        setLoadingMore(false);
      }
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
        // Delete all questions one by one (or use a bulk delete API if available)
        const deletePromises = generatedQuestions.map(q =>
          apiService.deleteQuestion(q.id)
        );

        await Promise.all(deletePromises);
        await loadGeneratedQuestions();
        showSuccess(`Successfully deleted ${generatedQuestions.length} generated questions`);
      } catch (error: any) {
        console.error('Error deleting questions:', error);
        showError(error.response?.data?.error || 'Failed to delete all questions');
        throw error;
      }
    }
  }, [generatedQuestions, loadGeneratedQuestions]);

  // Load more questions for pagination
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) {
      return;
    }

    const nextPage = currentPage + 1;
    await loadGeneratedQuestions(nextPage, 100, true); // append=true
  }, [hasMore, loadingMore, currentPage, loadGeneratedQuestions]);

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
