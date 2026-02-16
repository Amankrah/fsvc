/**
 * useResponseState Hook
 * Manages form responses and navigation
 */

import { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import apiService from '../../services/api';
import { syncManager } from '../../services/syncManager';
import { networkMonitor } from '../../services/networkMonitor';
import { filterQuestionsWithConditions } from '../../utils/conditionalLogic';
import { Question } from '../../types';
import { DEVICE_INFO } from '../../constants/dataCollection';
import { showAlert, showConfirm, showSuccess, showError, showInfo } from '../../utils/alert';

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
  },
  existingRespondentDatabaseId?: string | null,  // Optional: database ID when resuming draft
  preExistingResponseQuestionIds?: Set<string>  // Optional: question IDs that already have responses in DB
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
      showAlert('Required', 'This question is required');
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
    async (onSuccess: () => void, onFinish?: () => void) => {
      // Check if all required visible questions are answered
      const unansweredRequired = visibleQuestions.filter(
        q => q.is_required && !responses[q.id]
      );

      if (unansweredRequired.length > 0) {
        showAlert(
          'Incomplete Form',
          `Please answer all required questions. ${unansweredRequired.length} required question(s) remaining.`
        );
        return;
      }

      try {
        setSubmitting(true);

        // Create or get the respondent
        let respondent;
        if (existingRespondentDatabaseId) {
          // Resuming from draft - use existing respondent
          console.log(`Using existing respondent: ${existingRespondentDatabaseId}`);
          respondent = { id: existingRespondentDatabaseId };
        } else {
          // New respondent - create it
          respondent = await apiService.createRespondent({
            respondent_id: respondentData.respondentId,
            project: projectId,
            is_anonymous: true,
            consent_given: true,
            respondent_type: respondentData.respondentType || null,
            commodity: respondentData.commodities.length > 0 ? respondentData.commodities.join(',') : null,
            country: respondentData.country || null,
          });
        }

        // Submit all responses (filter out pre-existing ones if resuming from draft)
        const responseEntries = Object.entries(responses);
        const newResponsesOnly = preExistingResponseQuestionIds
          ? responseEntries.filter(([questionId]) => !preExistingResponseQuestionIds.has(questionId))
          : responseEntries;

        console.log(`Total responses: ${responseEntries.length}`);
        console.log(`Pre-existing responses: ${preExistingResponseQuestionIds?.size || 0}`);
        console.log(`New responses to submit: ${newResponsesOnly.length}`);

        const responsePromises = newResponsesOnly.map(async ([questionId, value]) => {
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
              `Failed to submit response for: "${question?.question_text}". ${error.response?.data?.response_value?.[0] || error.message
              }`
            );
          }
        });

        await Promise.all(responsePromises);

        // Mark respondent as completed
        try {
          console.log(`Marking respondent ${respondent.id} as completed`);
          await apiService.updateRespondentStatus(respondent.id, 'completed');
          console.log(`✓ Respondent ${respondent.id} marked as completed`);
        } catch (statusError) {
          console.error('Failed to update respondent status:', statusError);
          console.error('Status error details:', JSON.stringify(statusError));
          // Don't fail the whole submission if status update fails
        }

        showAlert('Success', 'Response submitted successfully! Ready for next respondent.', [
          {
            text: 'Continue Collecting',
            onPress: onSuccess,
          },
          {
            text: 'Finish & Go Back',
            onPress: () => {
              if (onFinish) {
                onFinish();
              }
            },
            style: 'cancel',
          },
        ]);
      } catch (error: any) {
        console.error('Error submitting responses:', error);

        // Check if it's a network error
        const isNetworkError =
          error.message?.includes('Network') ||
          error.message?.includes('network') ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ERR_NETWORK' ||
          !error.response;

        // If network error and device is offline, queue for later sync
        const isOnline = await networkMonitor.checkConnection();

        if (isNetworkError || !isOnline) {
          // Queue the response submission for offline sync
          try {
            // Prepare response data for queueing
            const responseData = {
              projectId,
              respondentData: {
                respondentId: respondentData.respondentId,
                respondentType: respondentData.respondentType,
                commodities: respondentData.commodities,
                country: respondentData.country,
              },
              responses: Object.entries(responses).map(([questionId, value]) => {
                const question = questions.find(q => q.id === questionId);
                return {
                  questionId,
                  questionText: question?.question_text || '',
                  responseValue: Array.isArray(value) ? JSON.stringify(value) : value,
                };
              }),
              timestamp: new Date().toISOString(),
            };

            await syncManager.queueOperation(
              'responses',
              `temp_${Date.now()}`,
              'create',
              responseData,
              10 // High priority for survey responses
            );

            showAlert(
              'Queued for Sync',
              'You are offline. Response has been saved and will be submitted when you reconnect to the internet.',
              [
                {
                  text: 'Continue Collecting',
                  onPress: onSuccess,
                },
                {
                  text: 'Finish & Go Back',
                  onPress: () => {
                    if (onFinish) {
                      onFinish();
                    }
                  },
                  style: 'cancel',
                },
              ]
            );
          } catch (queueError) {
            console.error('Failed to queue response:', queueError);
            showAlert(
              'Error',
              'Failed to save response for offline sync. Please try again when you have internet connection.'
            );
          }
        } else {
          // Non-network error (validation, server error, etc.)
          const errorMessage =
            error.message ||
            error.response?.data?.error ||
            error.response?.data?.respondent_id?.[0] ||
            'Failed to submit responses';
          showAlert('Error', errorMessage);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [visibleQuestions, responses, respondentData, projectId, questions]
  );

  const handleSaveDraft = useCallback(
    async (onSuccess?: () => void, draftName?: string) => {
      // Check if there are any responses to save
      if (Object.keys(responses).length === 0) {
        showAlert('No Responses', 'Please answer at least one question before saving.');
        return;
      }

      try {
        setSubmitting(true);

        // Prepare responses data
        const responsesData = Object.entries(responses).map(([questionId, value]) => {
          const question = questions.find(q => q.id === questionId);
          return {
            question_id: questionId,
            response_value: Array.isArray(value) ? JSON.stringify(value) : value,
          };
        });

        // Save draft
        const result = await apiService.saveDraftResponse({
          project: projectId,
          respondent_id: respondentData.respondentId,
          respondent_data: {
            is_anonymous: true,
            consent_given: true,
            respondent_type: respondentData.respondentType || null,
            commodity: respondentData.commodities.length > 0 ? respondentData.commodities.join(',') : null,
            country: respondentData.country || null,
          },
          responses: responsesData,
          draft_name: draftName || '',
        });

        // Cache draft locally for offline access
        try {
          const { offlineDraftCache } = require('../../services/offlineDraftCache');
          await offlineDraftCache.cacheDraft({
            id: result.respondent_id,
            respondent_id: respondentData.respondentId,
            draft_name: draftName || '',
            project: projectId,
            respondent_type: respondentData.respondentType || null,
            commodity: respondentData.commodities.length > 0 ? respondentData.commodities.join(',') : null,
            country: respondentData.country || null,
            responses: responsesData,
            completion_status: 'draft',
            created_at: new Date().toISOString(),
            last_response_at: new Date().toISOString(),
          });
        } catch (cacheErr) {
          console.warn('Failed to cache draft locally:', cacheErr);
        }

        showAlert(
          'Draft Saved',
          `Progress saved successfully!${draftName ? ` Draft: "${draftName}"` : ''}\n\nResponses saved: ${result.responses_saved}`,
          [
            {
              text: 'OK',
              onPress: () => {
                if (onSuccess) {
                  onSuccess();
                }
              },
            },
          ]
        );
      } catch (error: any) {
        console.error('Error saving draft:', error);

        // Check if offline
        const isOnline = await networkMonitor.checkConnection();

        if (!isOnline) {
          // Queue for offline sync
          try {
            const draftData = {
              projectId,
              respondentData,
              responses: Object.entries(responses).map(([questionId, value]) => {
                const question = questions.find(q => q.id === questionId);
                return {
                  questionId,
                  questionText: question?.question_text || '',
                  responseValue: Array.isArray(value) ? JSON.stringify(value) : value,
                };
              }),
              isDraft: true,
              draftName: draftName || '',
              timestamp: new Date().toISOString(),
            };

            await syncManager.queueOperation(
              'draft_responses',
              `draft_${Date.now()}`,
              'create',
              draftData,
              5 // Normal priority for drafts
            );

            // Also cache locally for immediate offline access
            try {
              const { offlineDraftCache } = require('../../services/offlineDraftCache');
              const responsesData = Object.entries(responses).map(([questionId, value]) => ({
                question_id: questionId,
                response_value: Array.isArray(value) ? JSON.stringify(value) : value,
              }));
              await offlineDraftCache.cacheDraft({
                id: `offline_${Date.now()}`,
                respondent_id: respondentData.respondentId,
                draft_name: draftName || '',
                project: projectId,
                respondent_type: respondentData.respondentType || null,
                commodity: respondentData.commodities.length > 0 ? respondentData.commodities.join(',') : null,
                country: respondentData.country || null,
                responses: responsesData,
                completion_status: 'draft',
                created_at: new Date().toISOString(),
                last_response_at: new Date().toISOString(),
                is_offline: true,
              });
            } catch (cacheErr) {
              console.warn('Failed to cache draft locally:', cacheErr);
            }

            showAlert(
              'Queued for Sync',
              'You are offline. Draft has been saved locally and will sync when you reconnect.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    if (onSuccess) {
                      onSuccess();
                    }
                  },
                },
              ]
            );
          } catch (queueError) {
            console.error('Failed to queue draft:', queueError);
            showAlert('Error', 'Failed to save draft. Please try again.');
          }
        } else {
          const errorMessage =
            error.response?.data?.error || error.message || 'Failed to save draft';
          showAlert('Error', errorMessage);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [responses, respondentData, projectId, questions]
  );

  const resetResponses = useCallback(() => {
    setResponses({});
    setCurrentQuestionIndex(0);
  }, []);

  const setQuestionIndex = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
  }, []);

  const loadResponses = useCallback((loadedResponses: ResponseData) => {
    setResponses(loadedResponses);
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
    handleSaveDraft,
    resetResponses,
    setQuestionIndex,
    loadResponses,
  };
};
