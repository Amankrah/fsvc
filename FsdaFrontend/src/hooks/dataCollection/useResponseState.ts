/**
 * useResponseState Hook
 * Manages form responses and navigation
 */

import { useState, useCallback, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import apiService from '../../services/api';
import { filterQuestionsWithConditions } from '../../utils/conditionalLogic';
import { Question } from '../../types';
import { DEVICE_INFO } from '../../constants/dataCollection';

interface ResponseData {
  [questionId: string]: string | string[];
}

export const useResponseState = (
  questions: Question[],
  projectId: string,
  respondentData: {
    respondentId: string;
    respondentType: string;
    commodities: string[];
    country: string;
  }
) => {
  const [responses, setResponses] = useState<ResponseData>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Filter questions based on conditional logic
  const visibleQuestions = useMemo(() => {
    return filterQuestionsWithConditions(questions, responses);
  }, [questions, responses]);

  const handleResponseChange = useCallback((questionId: string, value: string | string[]) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value,
    }));
  }, []);

  const handleNext = useCallback(() => {
    const currentQuestion = visibleQuestions[currentQuestionIndex];
    if (currentQuestion.is_required && !responses[currentQuestion.id]) {
      Alert.alert('Required', 'This question is required');
      return;
    }
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }, [currentQuestionIndex, visibleQuestions, responses]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  }, [currentQuestionIndex]);

  const handleSubmit = useCallback(
    async (onSuccess: () => void) => {
      // Check if all required visible questions are answered
      const unansweredRequired = visibleQuestions.filter(
        q => q.is_required && !responses[q.id]
      );

      if (unansweredRequired.length > 0) {
        Alert.alert(
          'Incomplete Form',
          `Please answer all required questions. ${unansweredRequired.length} required question(s) remaining.`
        );
        return;
      }

      try {
        setSubmitting(true);

        // Create or get the respondent
        const respondent = await apiService.createRespondent({
          respondent_id: respondentData.respondentId,
          project: projectId,
          is_anonymous: true,
          consent_given: true,
          respondent_type: respondentData.respondentType || null,
          commodity: respondentData.commodities.length > 0 ? respondentData.commodities.join(',') : null,
          country: respondentData.country || null,
        });

        // Submit all responses
        const responsePromises = Object.entries(responses).map(async ([questionId, value]) => {
          const responseValue = Array.isArray(value) ? JSON.stringify(value) : value;
          const question = questions.find(q => q.id === questionId);

          try {
            return await apiService.submitResponse({
              project: projectId,
              question: questionId,
              respondent: respondent.id,
              response_value: responseValue,
              device_info: {
                platform: Platform.OS,
                app_version: DEVICE_INFO.appVersion,
              },
            });
          } catch (error: any) {
            console.error(`Error submitting response for question "${question?.question_text}":`, error);
            throw new Error(
              `Failed to submit response for: "${question?.question_text}". ${
                error.response?.data?.response_value?.[0] || error.message
              }`
            );
          }
        });

        await Promise.all(responsePromises);

        Alert.alert('Success', 'Response submitted successfully! Ready for next respondent.', [
          {
            text: 'Continue Collecting',
            onPress: onSuccess,
          },
          {
            text: 'Finish & Go Back',
            onPress: () => {},
            style: 'cancel',
          },
        ]);
      } catch (error: any) {
        console.error('Error submitting responses:', error);
        const errorMessage =
          error.message ||
          error.response?.data?.error ||
          error.response?.data?.respondent_id?.[0] ||
          'Failed to submit responses';
        Alert.alert('Error', errorMessage);
      } finally {
        setSubmitting(false);
      }
    },
    [visibleQuestions, responses, respondentData, projectId, questions]
  );

  const resetResponses = useCallback(() => {
    setResponses({});
    setCurrentQuestionIndex(0);
  }, []);

  const progress = useMemo(
    () => (visibleQuestions.length > 0 ? (currentQuestionIndex + 1) / visibleQuestions.length : 0),
    [currentQuestionIndex, visibleQuestions.length]
  );

  return {
    responses,
    currentQuestionIndex,
    submitting,
    visibleQuestions,
    progress,
    handleResponseChange,
    handleNext,
    handlePrevious,
    handleSubmit,
    resetResponses,
  };
};
