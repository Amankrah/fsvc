/**
 * useGeneratedQuestions Hook
 * Manages Generated Questions (Question instances) with reorder functionality
 * These are project-specific questions created from the Question Bank for data collection
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { showshowConfirm, showSuccess, showError, showInfo } from '../../utils/alert';
import apiService from '../../services/api';
import { offlineQuestionCache, networkMonitor } from '../../services';
import { Question } from '../../types';

export const useGeneratedQuestions = (projectId: string) => {
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderedQuestions, setReorderedQuestions] = useState<Question[]>([]);

  const loadGeneratedQuestions = useCallback(async () => {
    try {
      // Check if online
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Fetch from server when online
        const questionsData = await apiService.getQuestions(projectId);
        const questionsList: Question[] = Array.isArray(questionsData)
          ? questionsData
          : questionsData.results || [];

        // Cache for offline use
        try {
          await offlineQuestionCache.cacheGeneratedQuestions(projectId, questionsList as any);
          console.log(`✓ Cached ${questionsList.length} generated questions for offline use`);
        } catch (cacheError) {
          console.warn('Failed to cache generated questions:', cacheError);
          // Continue anyway - caching is optional
        }

        // Questions are already sorted by order_index from the backend
        setGeneratedQuestions(questionsList);
        return questionsList;
      } else {
        // Load from cache when offline
        console.log('📴 Offline - loading generated questions from cache');
        const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);

        if (cachedQuestions.length > 0) {
          const questionsList = cachedQuestions as any as Question[];
          setGeneratedQuestions(questionsList);
          showAlert(
            'Offline Mode',
            `Loaded ${cachedQuestions.length} generated questions from cache.`,
            [{ text: 'OK' }]
          );
          return questionsList;
        } else {
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
          const questionsList = cachedQuestions as any as Question[];
          setGeneratedQuestions(questionsList);
          showAlert(
            'Loaded from Cache',
            `Failed to fetch from server, but loaded ${cachedQuestions.length} questions from cache.`
          );
          return questionsList;
        }
      } catch (cacheError) {
        console.error('Failed to load from cache:', cacheError);
      }

      showAlert('Error', 'Failed to load generated questions');
      return [];
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

  return {
    generatedQuestions,
    loading,
    refreshing,
    loadData,
    handleRefresh,
    generateQuestionsOffline, // NEW: Offline question generation
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
