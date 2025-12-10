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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [responseTypes, setResponseTypes] = useState<ResponseTypeInfo[]>([]);
  const [questionBankChoices, setQuestionBankChoices] = useState<QuestionBankChoices>({
    categories: [],
    data_sources: [],
    commodities: [],
    respondent_types: [],
  });

  const loadQuestions = useCallback(async (page: number = 1, pageSize: number = 100, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      }

      // Check if online
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Fetch question bank items from server with pagination
        console.log(`🌐 Loading question banks - page ${page}`);
        const questionBankData = await apiService.getQuestionBank({
          project_id: projectId,
          page,
          page_size: pageSize,
        });

        // Check if response is paginated
        if (questionBankData.results) {
          // Paginated response
          const questionsList = questionBankData.results;
          // Backend returns { total, links: { next, previous }, results }
          const hasMorePages = !!(questionBankData.links?.next || questionBankData.next);
          const total = questionBankData.total || questionBankData.count || questionsList.length;

          console.log('📊 Question Bank Pagination Info:', {
            page,
            total: questionBankData.total,
            count: questionBankData.count,
            resultsLength: questionsList.length,
            hasNext: hasMorePages,
            totalCount: total
          });

          setHasMore(hasMorePages);
          setCurrentPage(page);
          setTotalCount(total);

          // Cache for offline use (only on first page)
          if (page === 1) {
            try {
              await offlineQuestionCache.cacheQuestionBanks(projectId, questionsList);
              console.log(`✓ Cached ${questionsList.length} question banks for offline use`);
            } catch (cacheError) {
              console.warn('Failed to cache question banks:', cacheError);
            }
          }

          // Update state
          if (append) {
            setQuestions(prev => [...prev, ...questionsList]);
          } else {
            setQuestions(questionsList);
          }

          console.log(`✓ Loaded ${questionsList.length} question banks (page ${page}), hasMore: ${hasMorePages}`);
          return questionsList;
        } else {
          // Non-paginated - simulate pagination
          const allQuestions = Array.isArray(questionBankData)
            ? questionBankData
            : questionBankData.results || [];

          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const questionsList = allQuestions.slice(start, end);
          const hasMorePages = end < allQuestions.length;

          setHasMore(hasMorePages);
          setCurrentPage(page);
          setTotalCount(allQuestions.length);

          // Cache (only on first page)
          if (page === 1) {
            try {
              await offlineQuestionCache.cacheQuestionBanks(projectId, allQuestions);
              console.log(`✓ Cached ${allQuestions.length} question banks for offline use`);
            } catch (cacheError) {
              console.warn('Failed to cache question banks:', cacheError);
            }
          }

          // Update state
          if (append) {
            setQuestions(prev => [...prev, ...questionsList]);
          } else {
            setQuestions(questionsList);
          }

          return questionsList;
        }
      } else {
        // Load from cache when offline with pagination
        console.log(`📴 Offline - loading question banks from cache (page ${page})`);
        const cachedQuestions = await offlineQuestionCache.getQuestionBanks(projectId);

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
            setQuestions(prev => [...prev, ...questionsList]);
          } else {
            setQuestions(questionsList);
          }

          if (page === 1) {
            showAlert(
              'Offline Mode',
              `Loaded ${questionsList.length} of ${cachedQuestions.length} questions from cache. You can view and edit questions, but changes will sync when you're back online.`,
              [{ text: 'OK' }]
            );
          }
          return questionsList;
        } else {
          setHasMore(false);
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
          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const questionsList = cachedQuestions.slice(start, end) as any as Question[];
          const hasMorePages = end < cachedQuestions.length;

          setHasMore(hasMorePages);
          setCurrentPage(page);

          if (append) {
            setQuestions(prev => [...prev, ...questionsList]);
          } else {
            setQuestions(questionsList);
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
      showAlert('Error', 'Failed to load questions');
      return [];
    } finally {
      if (append) {
        setLoadingMore(false);
      }
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

  // Load more questions for pagination
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) {
      return;
    }

    const nextPage = currentPage + 1;
    await loadQuestions(nextPage, 100, true); // append=true
  }, [hasMore, loadingMore, currentPage, loadQuestions]);

  return {
    questions,
    loading,
    refreshing,
    saving,
    loadingMore,
    hasMore,
    totalCount,
    responseTypes,
    questionBankChoices,
    loadProjectAndQuestions,
    loadResponseTypes,
    loadQuestionBankChoices,
    handleRefresh,
    loadMore,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion,
    deleteAllQuestionBank,
  };
};
