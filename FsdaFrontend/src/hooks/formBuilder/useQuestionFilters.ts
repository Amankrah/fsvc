/**
 * useQuestionFilters Hook
 * Manages filtering and searching of questions
 */

import { useState, useEffect, useMemo } from 'react';
import { Question } from '../../types';

export const useQuestionFilters = (questions: Question[]) => {
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);
  const [selectedRespondentFilters, setSelectedRespondentFilters] = useState<string[]>([]);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Apply filters whenever questions or filter criteria change
  useEffect(() => {
    let filtered = [...questions];

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((q) =>
        q.question_text.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filters (multi-select)
    if (selectedCategoryFilters.length > 0) {
      filtered = filtered.filter((q) =>
        selectedCategoryFilters.includes(q.question_category || '')
      );
    }

    // Apply respondent filters (multi-select)
    if (selectedRespondentFilters.length > 0) {
      filtered = filtered.filter((q) =>
        q.targeted_respondents?.some((r) => selectedRespondentFilters.includes(r))
      );
    }

    setFilteredQuestions(filtered);
  }, [questions, searchQuery, selectedCategoryFilters, selectedRespondentFilters]);

  const toggleCategoryFilter = (category: string) => {
    setSelectedCategoryFilters((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const toggleRespondentFilter = (respondent: string) => {
    setSelectedRespondentFilters((prev) =>
      prev.includes(respondent) ? prev.filter((r) => r !== respondent) : [...prev, respondent]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategoryFilters([]);
    setSelectedRespondentFilters([]);
  };

  const hasActiveFilters = useMemo(
    () => Boolean(searchQuery) || selectedCategoryFilters.length > 0 || selectedRespondentFilters.length > 0,
    [searchQuery, selectedCategoryFilters, selectedRespondentFilters]
  );

  const activeFiltersCount = useMemo(
    () =>
      selectedCategoryFilters.length +
      selectedRespondentFilters.length +
      (searchQuery ? 1 : 0),
    [searchQuery, selectedCategoryFilters, selectedRespondentFilters]
  );

  return {
    filteredQuestions,
    searchQuery,
    setSearchQuery,
    selectedCategoryFilters,
    selectedRespondentFilters,
    isFilterExpanded,
    setIsFilterExpanded,
    toggleCategoryFilter,
    toggleRespondentFilter,
    clearAllFilters,
    hasActiveFilters,
    activeFiltersCount,
  };
};
