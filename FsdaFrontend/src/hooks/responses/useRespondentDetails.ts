/**
 * useRespondentDetails Hook
 * Manages individual respondent responses with pagination
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
  question_text: string;  // From ResponseLightSerializer
  question_type: string;  // From ResponseLightSerializer
  question_category?: string;  // From ResponseLightSerializer
  question_details?: QuestionDetail;  // Optional for backward compatibility
  response_value: string;
  collected_at: string;
  collected_by_name?: string;  // From ResponseLightSerializer
  is_validated: boolean;
  sync_status?: string;
  database_routing_status?: any;
  question_bank_summary?: QuestionBankSummary;
}

const PAGE_SIZE = 100;

export const useRespondentDetails = () => {
  const [selectedRespondent, setSelectedRespondent] = useState<Respondent | null>(null);
  const [respondentResponses, setRespondentResponses] = useState<ResponseDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPage = useCallback(async (respondent: Respondent, page: number) => {
    try {
      setLoading(true);
      const data = await apiService.getRespondentResponses(respondent.id, {
        page,
        page_size: PAGE_SIZE,
      });

      const responses = data.responses || data.results || [];
      const pagination = data.pagination;

      setRespondentResponses(responses);

      if (pagination) {
        setTotalCount(pagination.total ?? 0);
        setTotalPages(pagination.total_pages ?? 1);
        setCurrentPage(pagination.current_page ?? page);
      } else if (data.results) {
        // CustomPagination format fallback
        setTotalCount(data.total ?? 0);
        setTotalPages(data.total_pages ?? 1);
        setCurrentPage(data.current_page ?? page);
      } else {
        setTotalCount(responses.length);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error loading respondent responses:', error);
      showAlert('Error', 'Failed to load respondent responses');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRespondentResponses = useCallback(async (respondent: Respondent) => {
    setSelectedRespondent(respondent);
    setCurrentPage(1);
    await fetchPage(respondent, 1);
  }, [fetchPage]);

  const nextPage = useCallback(() => {
    if (selectedRespondent && currentPage < totalPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      fetchPage(selectedRespondent, next);
    }
  }, [selectedRespondent, currentPage, totalPages, fetchPage]);

  const prevPage = useCallback(() => {
    if (selectedRespondent && currentPage > 1) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      fetchPage(selectedRespondent, prev);
    }
  }, [selectedRespondent, currentPage, fetchPage]);

  const clearSelection = useCallback(() => {
    setSelectedRespondent(null);
    setRespondentResponses([]);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalCount(0);
  }, []);

  return {
    selectedRespondent,
    respondentResponses,
    loading,
    currentPage,
    totalPages,
    totalCount,
    loadRespondentResponses,
    nextPage,
    prevPage,
    clearSelection,
  };
};
