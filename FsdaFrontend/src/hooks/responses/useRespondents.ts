/**
 * useRespondents Hook
 * Manages respondent data fetching and state
 */

import { useState, useCallback } from 'react';
import { showAlert } from '../../utils/alert';
import apiService from '../../services/api';

export interface Respondent {
  id: string;
  respondent_id: string;
  name?: string;
  email?: string;
  created_at: string;
  last_response_at?: string;
  response_count: number;
  completion_rate: number;
  respondent_type?: string;
  commodity?: string;
  country?: string;
}

export const useRespondents = (projectId: string) => {
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1); // Server uses 1-indexed pages
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const loadRespondents = useCallback(async (pageNum?: number) => {
    try {
      const currentPage = pageNum || page;
      const data = await apiService.getRespondents(projectId, currentPage, pageSize);

      // Extract paginated data and metadata
      const respondentList: Respondent[] = Array.isArray(data) ? data : data.results || [];
      const total = data.total || data.count || respondentList.length;
      const pages = data.total_pages || Math.ceil(total / pageSize);

      console.log(`📊 Loaded page ${currentPage}: ${respondentList.length} respondents (${total} total, ${pages} pages)`);

      setRespondents(respondentList);
      setTotalCount(total);
      setTotalPages(pages);

      return respondentList;
    } catch (error) {
      console.error('Error loading respondents:', error);
      throw error;
    }
  }, [projectId, page, pageSize]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await loadRespondents();
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('Error', 'Failed to load responses');
    } finally {
      setLoading(false);
    }
  }, [loadRespondents]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadRespondents();
    } catch (error) {
      // Error already logged
    } finally {
      setRefreshing(false);
    }
  }, [loadRespondents]);

  const goToPage = useCallback(async (pageNum: number) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    setPage(pageNum);
    setLoading(true);
    try {
      await loadRespondents(pageNum);
    } catch (error) {
      console.error('Error loading page:', error);
    } finally {
      setLoading(false);
    }
  }, [totalPages, loadRespondents]);

  const nextPage = useCallback(async () => {
    if (page < totalPages) {
      await goToPage(page + 1);
    }
  }, [page, totalPages, goToPage]);

  const previousPage = useCallback(async () => {
    if (page > 1) {
      await goToPage(page - 1);
    }
  }, [page, goToPage]);

  return {
    respondents,
    loading,
    refreshing,
    loadData,
    handleRefresh,
    // Pagination
    page,
    pageSize,
    totalCount,
    totalPages,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
