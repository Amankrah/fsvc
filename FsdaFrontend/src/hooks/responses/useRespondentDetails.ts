/**
 * useRespondentDetails Hook
 * Manages individual respondent responses
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { showshowConfirm, showSuccess, showError, showInfo } from '../../utils/alert';
import apiService from '../../services/api';
import { Respondent } from './useRespondents';

export interface QuestionDetail {
  id: string;
  question_text: string;
  response_type: string;
}

export interface ResponseDetail {
  response_id: string;
  question: string;
  question_details: QuestionDetail;
  response_value: string;
  collected_at: string;
  is_validated: boolean;
}

export const useRespondentDetails = () => {
  const [selectedRespondent, setSelectedRespondent] = useState<Respondent | null>(null);
  const [respondentResponses, setRespondentResponses] = useState<ResponseDetail[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRespondentResponses = useCallback(async (respondent: Respondent) => {
    try {
      setLoading(true);
      setSelectedRespondent(respondent);
      const data = await apiService.getRespondentResponses(respondent.id);
      setRespondentResponses(data.responses || []);
    } catch (error) {
      console.error('Error loading respondent responses:', error);
      showAlert('Error', 'Failed to load respondent responses');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRespondent(null);
    setRespondentResponses([]);
  }, []);

  return {
    selectedRespondent,
    respondentResponses,
    loading,
    loadRespondentResponses,
    clearSelection,
  };
};
