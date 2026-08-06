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
  question_details: QuestionDetail;
  response_value: string;
  collected_at: string;
  is_validated: boolean;
  question_bank_summary?: QuestionBankSummary;
}

const PAGE_SIZE = 20;

export const useRespondentDetails = () => {
  const [selectedRespondent, setSelectedRespondent] = useState<Respondent | null>(null);
  const [respondentResponses, setRespondentResponses] = useState<ResponseDetail[]>([]);
  const [loading, setLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPage = useCallback(async (respondent: Respondent, page: number) => {
    try {
      setLoading(true);
      const data = await apiService.getRespondentResponses(respondent.id, page, PAGE_SIZE);

      // Handle paginated response format from CustomPagination
      if (data.results) {
        setRespondentResponses(data.results);
        setTotalCount(data.total ?? 0);
        setTotalPages(data.total_pages ?? 1);
        setCurrentPage(data.current_page ?? page);
      } else {
        // Fallback for non-paginated response
        setRespondentResponses(data.responses || []);
        setTotalCount(data.responses?.length ?? 0);
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
