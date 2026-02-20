/**
 * useRespondents Hook
 * Manages respondent data fetching with server-side pagination (infinite scroll)
 */

import { useState, useCallback, useRef } from 'react';
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
  created_by?: number;
  created_by_details?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface RespondentFilters {
  respondent_type?: string;
  commodity?: string;
  country?: string;
}

const PAGE_SIZE = 20;

export const useRespondents = (projectId: string, _filters?: RespondentFilters) => {
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const isFetchingRef = useRef(false);

  /**
   * Fetch a specific page from the backend.
   * Returns the raw API response so callers can decide how to merge.
   */
  const fetchPage = useCallback(
    async (page: number) => {
      const data = await apiService.getRespondentsPaginated(projectId, page, PAGE_SIZE);
      const results: Respondent[] = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
          ? data.results
          : [];

      const count: number = data.count ?? data.total ?? results.length;
      const next: string | null = data.next ?? data.links?.next ?? null;

      return { results, count, next };
    },
    [projectId]
  );

  /** Load a specific page */
  const goToPage = useCallback(async (page: number) => {
    if (page < 1 || (totalPages > 0 && page > totalPages)) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setLoading(true);

    try {
      const { results, count } = await fetchPage(page);
      setRespondents(results);
      setTotalCount(count);
      setCurrentPage(page);
      setTotalPages(Math.ceil(count / PAGE_SIZE) || 1);
    } catch (error) {
      console.error('Error loading page:', error);
      showAlert('Error', 'Failed to load responses');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [fetchPage, totalPages]);

  /** Initial load — always loads page 1 */
  const loadData = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  /** Pull-to-refresh — resets back to page 1 */
  const handleRefresh = useCallback(async () => {
    if (isFetchingRef.current) return;
    setRefreshing(true);
    await goToPage(1);
    setRefreshing(false);
  }, [goToPage]);

  return {
    respondents,
    totalCount,
    loading,
    refreshing,
    currentPage,
    totalPages,
    loadData,
    handleRefresh,
    goToPage,
    nextPage: () => goToPage(currentPage + 1),
    prevPage: () => goToPage(currentPage - 1),
  };
};
