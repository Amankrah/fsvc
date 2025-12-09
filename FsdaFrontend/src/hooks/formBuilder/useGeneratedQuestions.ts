/**
 * useGeneratedQuestions Hook
 * Manages Generated Questions (Question instances) with reorder functionality
 * These are project-specific questions created from the Question Bank for data collection
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import apiService from '../../services/api';
import { Question } from '../../types';

export const useGeneratedQuestions = (projectId: string) => {
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderedQuestions, setReorderedQuestions] = useState<Question[]>([]);

  const loadGeneratedQuestions = useCallback(async () => {
    try {
      const questionsData = await apiService.getQuestions(projectId);
      const questionsList: Question[] = Array.isArray(questionsData)
        ? questionsData
        : questionsData.results || [];

      // Questions are already sorted by order_index from the backend
      setGeneratedQuestions(questionsList);
      return questionsList;
    } catch (error: any) {
      console.error('Error loading generated questions:', error);
      Alert.alert('Error', 'Failed to load generated questions');
      return [];
    }
  }, [projectId]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await loadGeneratedQuestions();
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
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
        Alert.alert('Error', 'No questions to reorder');
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
        Alert.alert(
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

      Alert.alert('Success', 'Question order updated successfully for this generation bundle');
    } catch (error: any) {
      console.error('Error saving question order:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save question order');
    }
  }, [projectId, reorderedQuestions, loadGeneratedQuestions]);

  return {
    generatedQuestions,
    loading,
    refreshing,
    loadData,
    handleRefresh,
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
