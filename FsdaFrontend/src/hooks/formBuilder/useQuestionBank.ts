/**
 * useQuestionBank Hook
 * Manages question bank data fetching and CRUD operations
 */

import { useState, useCallback } from 'react';
import apiService from '../../services/api';
import { offlineQuestionCache, networkMonitor } from '../../services';
import { Question, ResponseTypeInfo, RespondentType } from '../../types';
import { DEFAULT_QUESTION_STATE } from '../../constants/formBuilder';
import { showAlert, showConfirm, showSuccess, showError } from '../../utils/alert';

interface QuestionBankChoices {
  categories: Array<{ value: string; label: string }>;
  data_sources: Array<{ value: string; label: string }>;
  commodities: Array<{ value: string; label: string }>;
  respondent_types: Array<{ value: string; label: string }>;
}

export const useQuestionBank = (projectId: string) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [responseTypes, setResponseTypes] = useState<ResponseTypeInfo[]>([]);
  const [questionBankChoices, setQuestionBankChoices] = useState<QuestionBankChoices>({
    categories: [],
    data_sources: [],
    commodities: [],
    respondent_types: [],
  });

  const loadQuestions = useCallback(async () => {
    try {
      // Check if online
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Fetch question bank items from server
        const questionBankData = await apiService.getQuestionBank({
          project_id: projectId,
          page_size: 1000,
        });
        const questionsList = Array.isArray(questionBankData)
          ? questionBankData
          : questionBankData.results || [];

        // Cache for offline use
        try {
          await offlineQuestionCache.cacheQuestionBanks(projectId, questionsList);
          console.log(`✓ Cached ${questionsList.length} question banks for offline use`);
        } catch (cacheError) {
          console.warn('Failed to cache question banks:', cacheError);
          // Continue anyway - caching is optional
        }

        setQuestions(questionsList);
        return questionsList;
      } else {
        // Load from cache when offline
        console.log('📴 Offline - loading question banks from cache');
        const cachedQuestions = await offlineQuestionCache.getQuestionBanks(projectId);

        if (cachedQuestions.length > 0) {
          // Convert cached questions to Question type
          const questionsList = cachedQuestions as any as Question[];
          setQuestions(questionsList);
          showAlert(
            'Offline Mode',
            `Loaded ${cachedQuestions.length} questions from cache. You can view and edit questions, but changes will sync when you're back online.`,
            [{ text: 'OK' }]
          );
          return questionsList;
        } else {
          showAlert(
            'No Cached Data',
            'No question banks cached for offline use. Please connect to the internet to load questions.'
          );
          return [];
        }
      }
    } catch (error: any) {
      console.error('Error loading questions:', error);

      // Try to load from cache as fallback
      try {
        const cachedQuestions = await offlineQuestionCache.getQuestionBanks(projectId);
        if (cachedQuestions.length > 0) {
          const questionsList = cachedQuestions as any as Question[];
          setQuestions(questionsList);
          showAlert(
            'Loaded from Cache',
            `Failed to fetch from server, but loaded ${cachedQuestions.length} questions from cache.`
          );
          return questionsList;
        }
      } catch (cacheError) {
        console.error('Failed to load from cache:', cacheError);
      }

      showAlert('Error', 'Failed to load questions');
      return [];
    }
  }, [projectId]);

  const loadProjectAndQuestions = useCallback(async () => {
    try {
      setLoading(true);
      await loadQuestions();
    } catch (error: any) {
      console.error('Error loading project and questions:', error);
      showAlert('Error', 'Failed to load project data');
    } finally {
      setLoading(false);
    }
  }, [loadQuestions]);

  const loadResponseTypes = useCallback(async () => {
    try {
      const types = await apiService.getResponseTypes();
      setResponseTypes(types);
    } catch (error) {
      console.error('Error loading response types:', error);
    }
  }, []);

  const loadQuestionBankChoices = useCallback(async () => {
    try {
      const choices = await apiService.getQuestionBankChoices();
      setQuestionBankChoices(choices);
    } catch (error) {
      console.error('Error loading QuestionBank choices:', error);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProjectAndQuestions();
    setRefreshing(false);
  }, [loadProjectAndQuestions]);

  const createQuestion = useCallback(
    async (questionData: any) => {
      try {
        setSaving(true);
        const questionBankData = {
          ...questionData,
          project: projectId, // Changed from base_project to project (now required)
        };
        await apiService.createQuestionBankItem(questionBankData);
        await loadQuestions();
        showSuccess('Question added to your Question Bank');
        return true;
      } catch (error: any) {
        console.error('Error adding question:', error);
        showError(error.response?.data?.error || 'Failed to add question');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [projectId, loadQuestions]
  );

  const updateQuestion = useCallback(
    async (questionId: string, questionData: any) => {
      try {
        setSaving(true);
        await apiService.updateQuestionBankItem(questionId, questionData);
        await loadQuestions();
        showSuccess('Question updated successfully');
        return true;
      } catch (error: any) {
        console.error('Error updating question:', error);
        showError(error.response?.data?.error || 'Failed to update question');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadQuestions]
  );

  const deleteQuestion = useCallback(
    async (questionId: string) => {
      const confirmed = await showConfirm(
        'Confirm Delete',
        'Are you sure you want to delete this question from your Question Bank?',
        'Delete',
        'Cancel'
      );

      if (confirmed) {
        try {
          await apiService.deleteQuestionBankItem(questionId);
          await loadQuestions();
          showSuccess('Question deleted from Question Bank');
        } catch (error) {
          console.error('Error deleting question:', error);
          showError('Failed to delete question');
          throw error;
        }
      }
    },
    [loadQuestions]
  );

  const duplicateQuestion = useCallback(
    async (questionId: string) => {
      try {
        await apiService.duplicateQuestionBankItem(questionId);
        await loadQuestions();
        showAlert('Success', 'Question duplicated successfully');
      } catch (error) {
        console.error('Error duplicating question:', error);
        showAlert('Error', 'Failed to duplicate question');
      }
    },
    [loadQuestions]
  );

  const deleteAllQuestionBank = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      showAlert(
        'Delete All Question Bank Items',
        'This will permanently delete ALL questions from this project\'s Question Bank. Do you also want to delete questions generated from these items?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => reject() },
          {
            text: 'Delete Bank Only',
            style: 'destructive',
            onPress: async () => {
              try {
                setSaving(true);
                const result = await apiService.deleteAllQuestionBankItems(projectId, true, false);
                await loadQuestions();
                showAlert('Success', result.message || 'All Question Bank items deleted');
                resolve();
              } catch (error: any) {
                console.error('Error deleting Question Bank:', error);
                showAlert('Error', error.response?.data?.error || 'Failed to delete Question Bank items');
                reject(error);
              } finally {
                setSaving(false);
              }
            },
          },
          {
            text: 'Delete Bank & Generated',
            style: 'destructive',
            onPress: async () => {
              try {
                setSaving(true);
                const result = await apiService.deleteAllQuestionBankItems(projectId, true, true);
                await loadQuestions();
                showAlert(
                  'Success',
                  `${result.message || 'All Question Bank items deleted'}. Also deleted ${result.deleted_generated_questions || 0} generated questions.`
                );
                resolve();
              } catch (error: any) {
                console.error('Error deleting Question Bank:', error);
                showAlert('Error', error.response?.data?.error || 'Failed to delete Question Bank items');
                reject(error);
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
    });
  }, [projectId, loadQuestions]);

  return {
    questions,
    loading,
    refreshing,
    saving,
    responseTypes,
    questionBankChoices,
    loadProjectAndQuestions,
    loadResponseTypes,
    loadQuestionBankChoices,
    handleRefresh,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion,
    deleteAllQuestionBank,
  };
};
