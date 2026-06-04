/**
 * useRespondents Hook
 * Manages respondent data fetching with server-side pagination and server-side filtering.
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
  respondent_type?: string[];
  commodity?: string[];
  country?: string[];
  /** Pass the user's numeric id (as string) to restrict to that user's submissions */
  created_by?: string;
  /** Free-text search forwarded to the DRF SearchFilter backend */
  search?: string;
}

export interface FilterOptions {
  respondent_types: string[];
  commodities: string[];
  countries: string[];
}

const PAGE_SIZE = 20;

export const useRespondents = (projectId: string, _filters?: RespondentFilters) => {
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    respondent_types: [],
    commodities: [],
    countries: [],
  });

  // filtersRef holds the active server-side filters so goToPage always uses
  // the latest value without needing it in its dependency array.
  const filtersRef = useRef<RespondentFilters>({});
  const isFetchingRef = useRef(false);

  const fetchPage = useCallback(
    async (page: number, filters: RespondentFilters) => {
      const data = await apiService.getRespondentsPaginated(projectId, page, PAGE_SIZE, filters);
      const results: Respondent[] = Array.isArray(data)
        ? data
        : Array.isArray(data.results)
          ? data.results
          : [];
      const count: number = data.count ?? data.total ?? results.length;
      return { results, count };
    },
    [projectId]
  );

  /** Navigate to an arbitrary page using the current active filters */
  const goToPage = useCallback(async (page: number) => {
    if (page < 1 || (totalPages > 0 && page > totalPages)) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setLoading(true);

    try {
      const { results, count } = await fetchPage(page, filtersRef.current);
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

  /**
   * Apply a new set of server-side filters and immediately reload from page 1.
   * Uses the latest filter snapshot even if a previous fetch is in flight
   * (stale responses are discarded via the filtersRef comparison).
   */
  const setFilters = useCallback(async (newFilters: RespondentFilters) => {
    filtersRef.current = newFilters;
    setLoading(true);

    try {
      const { results, count } = await fetchPage(1, newFilters);
      // Discard if another setFilters call superseded this one while in flight
      if (filtersRef.current !== newFilters) return;
      setRespondents(results);
      setTotalCount(count);
      setCurrentPage(1);
      setTotalPages(Math.ceil(count / PAGE_SIZE) || 1);
    } catch (error) {
      if (filtersRef.current !== newFilters) return;
      console.error('Error applying filters:', error);
      showAlert('Error', 'Failed to apply filters');
    } finally {
      if (filtersRef.current === newFilters) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [fetchPage]);

  /** Initial load — always resets to page 1 with whatever filters are currently active */
  const loadData = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  /** Pull-to-refresh */
  const handleRefresh = useCallback(async () => {
    if (isFetchingRef.current) return;
    setRefreshing(true);
    await goToPage(1);
    setRefreshing(false);
  }, [goToPage]);

  /**
   * Fetch the full set of distinct filter values for the project from the
   * dedicated backend endpoint so dropdowns show ALL available options,
   * not just those on the current page.
   */
  const loadFilterOptions = useCallback(async () => {
    try {
      const options = await apiService.getRespondentFilterOptions(projectId);
      setFilterOptions({
        respondent_types: options.respondent_types || [],
        commodities: options.commodities || [],
        countries: options.countries || [],
      });
    } catch (error) {
      console.warn('Failed to load filter options:', error);
    }
  }, [projectId]);

  const nextPage = useCallback(() => goToPage(currentPage + 1), [goToPage, currentPage]);
  const prevPage = useCallback(() => goToPage(currentPage - 1), [goToPage, currentPage]);

  return {
    respondents,
    totalCount,
    loading,
    refreshing,
    currentPage,
    totalPages,
    filterOptions,
    loadData,
    handleRefresh,
    goToPage,
    nextPage,
    prevPage,
    setFilters,
    loadFilterOptions,
  };
};
