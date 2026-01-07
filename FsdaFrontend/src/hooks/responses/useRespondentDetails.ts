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
  const [page, setPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadRespondentResponses = useCallback(async (
    respondent: Respondent,
    pageNum?: number,
    append: boolean = false
  ) => {
    try {
      setLoading(true);
      setSelectedRespondent(respondent);

      const currentPage = pageNum || page;
      const data = await apiService.getRespondentResponses(respondent.id, {
        page: currentPage,
        page_size: pageSize,
      });

      const responses = data.responses || [];
      const pagination = data.pagination;

      if (append) {
        setRespondentResponses(prev => [...prev, ...responses]);
      } else {
        setRespondentResponses(responses);
      }

      if (pagination) {
        setTotalCount(pagination.total);
        setTotalPages(pagination.total_pages);
        setHasMore(!!pagination.next);
      } else {
        // No pagination, using all responses
        setTotalCount(responses.length);
        setTotalPages(1);
        setHasMore(false);
      }

      setPage(currentPage);
    } catch (error) {
      console.error('Error loading respondent responses:', error);
      showAlert('Error', 'Failed to load respondent responses');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const loadMore = useCallback(async () => {
    if (!selectedRespondent || !hasMore || loading) return;
    await loadRespondentResponses(selectedRespondent, page + 1, true);
  }, [selectedRespondent, hasMore, loading, page, loadRespondentResponses]);

  const clearSelection = useCallback(() => {
    setSelectedRespondent(null);
    setRespondentResponses([]);
    setPage(1);
    setTotalCount(0);
    setTotalPages(0);
    setHasMore(false);
  }, []);

  return {
    selectedRespondent,
    respondentResponses,
    loading,
    loadRespondentResponses,
    clearSelection,
    // Pagination
    page,
    pageSize,
    totalCount,
    totalPages,
    hasMore,
    loadMore,
  };
};
