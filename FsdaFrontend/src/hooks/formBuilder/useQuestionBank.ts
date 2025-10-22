/**
 * useQuestionBank Hook
 * Manages question bank data fetching and CRUD operations
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import apiService from '../../services/api';
import { Question, ResponseTypeInfo, RespondentType } from '../../types';
import { DEFAULT_QUESTION_STATE } from '../../constants/formBuilder';

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
      const questionBankData = await apiService.getQuestionBank({ page_size: 1000 });
      const questionsList = Array.isArray(questionBankData)
        ? questionBankData
        : questionBankData.results || [];
      setQuestions(questionsList);
      return questionsList;
    } catch (error: any) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'Failed to load questions');
      return [];
    }
  }, []);

  const loadProjectAndQuestions = useCallback(async () => {
    try {
      setLoading(true);
      await loadQuestions();
    } catch (error: any) {
      console.error('Error loading project and questions:', error);
      Alert.alert('Error', 'Failed to load project data');
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
          base_project: projectId,
        };
        await apiService.createQuestionBankItem(questionBankData);
        await loadQuestions();
        Alert.alert('Success', 'Question added to your Question Bank');
        return true;
      } catch (error: any) {
        console.error('Error adding question:', error);
        Alert.alert('Error', error.response?.data?.error || 'Failed to add question');
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
        Alert.alert('Success', 'Question updated successfully');
        return true;
      } catch (error: any) {
        console.error('Error updating question:', error);
        Alert.alert('Error', error.response?.data?.error || 'Failed to update question');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [loadQuestions]
  );

  const deleteQuestion = useCallback(
    async (questionId: string) => {
      return new Promise<void>((resolve, reject) => {
        Alert.alert(
          'Confirm Delete',
          'Are you sure you want to delete this question from your Question Bank?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => reject() },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await apiService.deleteQuestionBankItem(questionId);
                  await loadQuestions();
                  Alert.alert('Success', 'Question deleted from Question Bank');
                  resolve();
                } catch (error) {
                  console.error('Error deleting question:', error);
                  Alert.alert('Error', 'Failed to delete question');
                  reject(error);
                }
              },
            },
          ]
        );
      });
    },
    [loadQuestions]
  );

  const duplicateQuestion = useCallback(
    async (questionId: string) => {
      try {
        await apiService.duplicateQuestionBankItem(questionId);
        await loadQuestions();
        Alert.alert('Success', 'Question duplicated successfully');
      } catch (error) {
        console.error('Error duplicating question:', error);
        Alert.alert('Error', 'Failed to duplicate question');
      }
    },
    [loadQuestions]
  );

  const deleteAllQuestionBank = useCallback(async () => {
    return new Promise<void>((resolve, reject) => {
      Alert.alert(
        'Delete All Question Bank Items',
        'This will permanently delete ALL questions from your Question Bank. Do you also want to delete questions generated from these items in projects?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => reject() },
          {
            text: 'Delete Bank Only',
            style: 'destructive',
            onPress: async () => {
              try {
                setSaving(true);
                const result = await apiService.deleteAllQuestionBankItems(true, false);
                await loadQuestions();
                Alert.alert('Success', result.message || 'All Question Bank items deleted');
                resolve();
              } catch (error: any) {
                console.error('Error deleting Question Bank:', error);
                Alert.alert('Error', error.response?.data?.error || 'Failed to delete Question Bank items');
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
                const result = await apiService.deleteAllQuestionBankItems(true, true);
                await loadQuestions();
                Alert.alert(
                  'Success',
                  `${result.message || 'All Question Bank items deleted'}. Also deleted ${result.deleted_generated_questions || 0} generated questions.`
                );
                resolve();
              } catch (error: any) {
                console.error('Error deleting Question Bank:', error);
                Alert.alert('Error', error.response?.data?.error || 'Failed to delete Question Bank items');
                reject(error);
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
    });
  }, [loadQuestions]);

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
