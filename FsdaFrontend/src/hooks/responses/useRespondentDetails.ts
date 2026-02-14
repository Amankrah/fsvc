/**
 * useRespondentDetails Hook
 * Manages individual respondent responses
 */

import { useState, useCallback } from 'react';
import { showAlert } from '../../utils/alert';
import apiService from '../../services/api';
import { Respondent } from './useRespondents';

export interface QuestionDetail {
  id: string;
  question_text: string;
  response_type: string;
}

export interface QuestionBankSummary {
  question_category?: string;
  data_source?: string;
  research_partner?: string;
  work_package?: string;
  is_owner_question?: boolean;
  question_sources?: string[];
  respondent_type?: string;
  commodity?: string;
  country?: string;
  assigned_respondent_type?: string;
  assigned_commodity?: string;
  assigned_country?: string;
}

export interface ResponseDetail {
  response_id: string;
  question: string;
  question_details: QuestionDetail;
  response_value: string;
  collected_at: string;
  is_validated: boolean;
  question_bank_summary?: QuestionBankSummary;
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
