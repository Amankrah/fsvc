/**
 * useSearch Hook
 * Manages search and filtering of respondents
 */

import { useState, useCallback, useEffect } from 'react';
import { Respondent } from './useRespondents';

export const useSearch = (respondents: Respondent[]) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRespondents, setFilteredRespondents] = useState<Respondent[]>([]);

  // Update filtered list when respondents or search query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRespondents(respondents);
      return;
    }

    const lowercaseQuery = searchQuery.toLowerCase();
    const filtered = respondents.filter(
      (r) =>
        r.respondent_id.toLowerCase().includes(lowercaseQuery) ||
        r.name?.toLowerCase().includes(lowercaseQuery) ||
        r.email?.toLowerCase().includes(lowercaseQuery)
    );
    setFilteredRespondents(filtered);
  }, [respondents, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return {
    searchQuery,
    filteredRespondents,
    handleSearch,
  };
};
