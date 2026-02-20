/**
 * useResponseState Hook
 * Manages form responses and navigation
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import apiService from '../../services/api';
import { syncManager } from '../../services/syncManager';
import { networkMonitor } from '../../services/networkMonitor';
import { filterQuestionsWithConditions } from '../../utils/conditionalLogic';
import { Question } from '../../types';
import { DEVICE_INFO } from '../../constants/dataCollection';
import { showAlert, showConfirm, showSuccess, showError, showInfo } from '../../utils/alert';
import { autoSaveService, AutoSaveData } from '../../services/autoSaveService';

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

  // Ref to track latest responses for auto-save (avoids stale closures)
  const responsesRef = useRef<ResponseData>(responses);
  const questionIndexRef = useRef(currentQuestionIndex);

  // Filter questions based on conditional logic
  const visibleQuestions = useMemo(() => {
    return filterQuestionsWithConditions(questions, responses);
  }, [questions, responses]);

  // Helper to build auto-save payload from current state
  const buildAutoSaveData = useCallback((): AutoSaveData => {
    return {
      projectId,
      respondentId: respondentData.respondentId,
      respondentType: respondentData.respondentType,
      commodities: respondentData.commodities,
      country: respondentData.country,
      responses: responsesRef.current,
      currentQuestionIndex: questionIndexRef.current,
      totalQuestions: questions.length,
      timestamp: new Date().toISOString(),
      existingRespondentDatabaseId: existingRespondentDatabaseId || null,
      preExistingResponseQuestionIds: preExistingResponseQuestionIds
        ? Array.from(preExistingResponseQuestionIds)
        : [],
    };
  }, [projectId, respondentData, questions.length, existingRespondentDatabaseId, preExistingResponseQuestionIds]);

  const handleResponseChange = useCallback((questionId: string, value: string | string[]) => {
    setResponses(prev => {
      const updated = { ...prev, [questionId]: value };
      responsesRef.current = updated;

      // Trigger debounced auto-save (2s after last change)
      const answeredCount = Object.keys(updated).length;
      const saveData: AutoSaveData = {
        projectId,
        respondentId: respondentData.respondentId,
        respondentType: respondentData.respondentType,
        commodities: respondentData.commodities,
        country: respondentData.country,
        responses: updated,
        currentQuestionIndex: questionIndexRef.current,
        totalQuestions: questions.length,
        timestamp: new Date().toISOString(),
        existingRespondentDatabaseId: existingRespondentDatabaseId || null,
        preExistingResponseQuestionIds: preExistingResponseQuestionIds
          ? Array.from(preExistingResponseQuestionIds)
          : [],
      };

      // Every 5 answered questions, save immediately
      if (autoSaveService.shouldSaveOnQuestionCount(answeredCount)) {
        autoSaveService.save(saveData);
      } else {
        autoSaveService.debouncedSave(saveData);
      }

      return updated;
    });
  }, [projectId, respondentData, questions.length, existingRespondentDatabaseId, preExistingResponseQuestionIds]);

  const validateCurrentQuestion = useCallback(() => {
    const currentQuestion = visibleQuestions[currentQuestionIndex];
    if (currentQuestion.is_required && !responses[currentQuestion.id]) {
      // showAlert('Required', 'This question is required'); // Don't show alert for swipe check, just return false
      return false;
    }
    return true;
  }, [currentQuestionIndex, visibleQuestions, responses]);

  const handleNext = useCallback(() => {
    if (!validateCurrentQuestion()) {
      showAlert('Required', 'This question is required');
      return;
    }
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      questionIndexRef.current = currentQuestionIndex + 1;
    }
  }, [currentQuestionIndex, visibleQuestions, validateCurrentQuestion]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      questionIndexRef.current = currentQuestionIndex - 1;
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

        // Use allSettled to track individual successes/failures
        const responseResults = await Promise.allSettled(
          newResponsesOnly.map(async ([questionId, value]) => {
            const responseValue = Array.isArray(value) ? JSON.stringify(value) : value;
            const question = questions.find(q => q.id === questionId);

            try {
              const result = await apiService.submitResponse({
                project: projectId,
                question: questionId,
                respondent: respondent.id,
                response_value: responseValue,
                device_info: {
                  platform: Platform.OS,
                  app_version: DEVICE_INFO.appVersion,
                },
              });
              return { questionId, questionText: question?.question_text, responseValue, result };
            } catch (error: any) {
              // Fix 6: If response already exists (unique constraint), treat as success
              if (error.response?.status === 400 &&
                (error.response?.data?.non_field_errors?.[0]?.includes('unique') ||
                  error.response?.data?.detail?.includes('already exists') ||
                  error.response?.data?.question?.[0]?.includes('unique'))) {
                console.log(`Response for question "${question?.question_text}" already exists, treating as success`);
                return { questionId, questionText: question?.question_text, responseValue, alreadyExists: true };
              }
              throw { questionId, questionText: question?.question_text, responseValue, error };
            }
          })
        );

        const succeeded = responseResults.filter(r => r.status === 'fulfilled');
        const failedResults = responseResults.filter(r => r.status === 'rejected');

        console.log(`Response results: ${succeeded.length} succeeded, ${failedResults.length} failed`);

        if (failedResults.length > 0 && succeeded.length > 0) {
          // Partial success: queue only the failed responses for offline sync
          console.log(`Partial success: ${succeeded.length} saved, ${failedResults.length} failed — queuing failures for offline sync`);

          const failedResponseData = {
            projectId,
            respondentData: {
              respondentId: respondentData.respondentId,
              respondentType: respondentData.respondentType,
              commodities: respondentData.commodities,
              country: respondentData.country,
            },
            responses: failedResults.map(r => {
              const reason = (r as PromiseRejectedResult).reason;
              return {
                questionId: reason.questionId,
                questionText: reason.questionText || '',
                responseValue: reason.responseValue,
              };
            }),
            timestamp: new Date().toISOString(),
          };

          try {
            await syncManager.queueOperation(
              'responses',
              `partial_${Date.now()}`,
              'create',
              failedResponseData,
              10
            );
            console.log(`Queued ${failedResults.length} failed responses for offline sync`);
          } catch (queueError) {
            console.error('Failed to queue partial responses:', queueError);
          }
        } else if (failedResults.length > 0 && succeeded.length === 0) {
          // Total failure: throw to trigger the existing offline queue logic below
          const firstReason = (failedResults[0] as PromiseRejectedResult).reason;
          throw firstReason.error || new Error('All responses failed to submit');
        }
        // All succeeded (or partial success already handled): continue to mark as completed

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

        const successMessage = failedResults.length > 0
          ? `${succeeded.length} responses saved. ${failedResults.length} will sync when online.`
          : 'Response submitted successfully! Ready for next respondent.';

        showAlert('Success', successMessage, [
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
        // Check if it's a network error
        let isNetworkError =
          error.message?.includes('Network') ||
          error.message?.includes('network') ||
          error.code === 'ECONNABORTED' ||
          error.code === 'ERR_NETWORK' ||
          !error.response;

        // Fix 7: If "respondent_id already exists", we should treat this as a sync conflict
        // and let the offline queue handle it (because _handle_offline_responses knows how to merge).
        if (error.response?.data?.respondent_id?.[0]?.includes('already exists')) {
          console.log('Respondent exists, treating as sync conflict -> routing to offline queue');
          isNetworkError = true;
        }

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
          console.error('Submission error details:', JSON.stringify(error.response?.data || error, null, 2));

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

        // Clear auto-save since we now have a proper draft
        autoSaveService.clearAll(projectId).catch(() => { });
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
    responsesRef.current = {};
    questionIndexRef.current = 0;
    // Clear auto-save when starting fresh
    autoSaveService.cancelPending();
    autoSaveService.clear(projectId, respondentData.respondentId).catch(() => { });
  }, [projectId, respondentData.respondentId]);

  const setQuestionIndex = useCallback((index: number) => {
    setCurrentQuestionIndex(index);
    questionIndexRef.current = index;
  }, []);

  const loadResponses = useCallback((loadedResponses: ResponseData) => {
    setResponses(loadedResponses);
    responsesRef.current = loadedResponses;
  }, []);

  // --- Auto-save recovery methods ---

  /** Check if there's an auto-save available for this project */
  const hasAutoSave = useCallback(async (): Promise<AutoSaveData | null> => {
    return autoSaveService.getMostRecent(projectId);
  }, [projectId]);

  /** Load auto-saved responses into state */
  const loadAutoSave = useCallback((data: AutoSaveData) => {
    setResponses(data.responses);
    responsesRef.current = data.responses;
    setCurrentQuestionIndex(data.currentQuestionIndex);
    questionIndexRef.current = data.currentQuestionIndex;
  }, []);

  /** Clear auto-save (e.g. after user dismisses recovery) */
  const clearAutoSave = useCallback(async () => {
    await autoSaveService.clearAll(projectId);
  }, [projectId]);

  /** Flush auto-save immediately (called on AppState → background) */
  const flushAutoSave = useCallback(async () => {
    if (Object.keys(responsesRef.current).length > 0) {
      await autoSaveService.flush(buildAutoSaveData());
    }
  }, [buildAutoSaveData]);

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
    // Auto-save
    hasAutoSave,
    loadAutoSave,
    clearAutoSave,
    flushAutoSave,
    validateCurrentQuestion,
  };
};

