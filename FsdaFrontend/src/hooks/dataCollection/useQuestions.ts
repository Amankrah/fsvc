/**
 * useQuestions Hook
 * Manages question loading and dynamic generation
 */

import { useState, useCallback, useEffect } from 'react';
import { showAlert } from '../../utils/alert';
import apiService from '../../services/api';
import { Question, RespondentType, CommodityType, DynamicQuestionGenerationResult } from '../../types';
import { offlineQuestionCache, networkMonitor } from '../../services';
import { getCategorySortIndex } from '../../constants/formBuilder';

interface UseQuestionsProps {
  projectId: string;
  selectedRespondentType: RespondentType | '';
  selectedCommodities: CommodityType[];
  selectedCountry: string;
  useProjectBankOnly?: boolean;
  isSurveyRunning?: boolean; // New prop to indicate if survey is active
}

export const useQuestions = ({
  projectId,
  selectedRespondentType,
  selectedCommodities,
  selectedCountry,
  useProjectBankOnly = true,
  isSurveyRunning = false, // Default to false
}: UseQuestionsProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [questionsGenerated, setQuestionsGenerated] = useState(false);
  const [availableRespondentTypes, setAvailableRespondentTypes] = useState<Array<{ value: string; display: string }>>([]);
  const [availableCommodities, setAvailableCommodities] = useState<Array<{ value: string; display: string }>>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [cachingForOffline, setCachingForOffline] = useState(false);
  const [cachedOfflineCount, setCachedOfflineCount] = useState(0);

  // Track the filters that were used to load the current questions
  // This prevents unwanted reloads when filters change after questions are loaded
  const [loadedWithFilters, setLoadedWithFilters] = useState<{
    respondentType: string;
    commodities: string[];
    country: string;
  } | null>(null);

  const loadAvailableOptions = useCallback(async () => {
    try {
      setLoadingOptions(true);

      // Check network connection
      const isOnline = await networkMonitor.checkConnection();

      if (isOnline) {
        // Online: Load from API
        try {
          const response = await apiService.getAvailableQuestionBankOptions(projectId);

          setAvailableRespondentTypes(response.available_options.respondent_types || []);
          setAvailableCommodities(response.available_options.commodities || []);
          setAvailableCountries(response.available_options.countries || []);

          console.log('Available options loaded:', response.summary);
        } catch (error: any) {
          // Network error - fall back to cached project data
          console.log('Network error loading options, falling back to cache');
          await loadOptionsFromCache();
        }
      } else {
        // Offline: Load from cached project data
        console.log('Offline mode - loading options from cache');
        await loadOptionsFromCache();
      }
    } catch (error: any) {
      console.error('Error loading available options:', error);
      showAlert(
        'Warning',
        'Could not load available question options. Question generation may not work properly.'
      );
    } finally {
      setLoadingOptions(false);
    }
  }, [projectId]);

  const loadOptionsFromCache = async () => {
    try {
      // Load options from cached generated questions instead of project targeted fields
      const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);

      console.log('📦 Cached generated questions count:', cachedQuestions.length);

      if (cachedQuestions.length > 0) {
        // Extract unique respondent types, commodities, and countries from generated questions
        const respondentTypesSet = new Set<string>();
        const commoditiesSet = new Set<string>();
        const countriesSet = new Set<string>();

        cachedQuestions.forEach((question: any) => {
          if (question.assigned_respondent_type) {
            respondentTypesSet.add(question.assigned_respondent_type);
          }
          if (question.assigned_commodity) {
            // Handle comma-separated commodities
            const commodities = question.assigned_commodity.split(',').map((c: string) => c.trim());
            commodities.forEach((c: string) => {
              if (c) commoditiesSet.add(c);
            });
          }
          if (question.assigned_country) {
            countriesSet.add(question.assigned_country);
          }
        });

        // Convert to UI format
        const respondentTypes = Array.from(respondentTypesSet).map(type => ({
          value: type,
          display: type,
        }));

        const commodities = Array.from(commoditiesSet).map(commodity => ({
          value: commodity,
          display: commodity,
        }));

        const countries = Array.from(countriesSet);

        console.log('🔄 Extracted options from generated questions:', {
          respondentTypes,
          commodities,
          countries,
        });

        setAvailableRespondentTypes(respondentTypes);
        setAvailableCommodities(commodities);
        setAvailableCountries(countries);

        console.log('✓ Loaded options from cache:', {
          respondentTypes: respondentTypes.length,
          commodities: commodities.length,
          countries: countries.length,
        });
      } else {
        console.warn('No cached generated questions found');
        showAlert(
          'Warning',
          'No generated questions cached. Please generate questions while online first.'
        );
      }
    } catch (error) {
      console.error('Error loading options from cache:', error);
      throw error;
    }
  };

  const loadExistingQuestions = useCallback(async (
    page: number = 1,
    pageSize: number = 100,
    append: boolean = false,
    // Accept optional filter overrides to prevent stale closure issues
    filterOverrides?: {
      respondentType?: string;
      commodities?: string[];
      country?: string;
    }
  ) => {
    // Use overrides if provided, otherwise use current state
    const effectiveRespondentType = filterOverrides?.respondentType ?? selectedRespondentType;
    const effectiveCommodities = filterOverrides?.commodities ?? selectedCommodities;
    const effectiveCountry = filterOverrides?.country ?? selectedCountry;

    // STRICT REQUIREMENT: All 3 filters must be provided
    if (!effectiveRespondentType) {
      console.log('⚠️ Cannot load questions: respondent type is required');
      return [];
    }

    if (!effectiveCommodities || effectiveCommodities.length === 0) {
      console.log('⚠️ Cannot load questions: at least one commodity is required');
      return [];
    }

    if (!effectiveCountry) {
      console.log('⚠️ Cannot load questions: country is required');
      return [];
    }

    try {
      setLoadingQuestions(true);

      // Check network connection
      const isOnline = await networkMonitor.checkConnection();

      const commodityStr = effectiveCommodities.join(',') || '';
      const countryStr = effectiveCountry || '';

      console.log(`📊 Filter criteria for loading questions:`, {
        effectiveRespondentType,
        effectiveCommodities,
        commodityStr,
        effectiveCountry,
        countryStr,
        page,
        usingOverrides: !!filterOverrides,
      });

      let questionsList: Question[] = [];
      let hasMore = false;

      if (isOnline) {
        // Online: Fetch from API using optimized filtered endpoint with pagination
        try {
          console.log(`🌐 Online - fetching page ${page} of filtered questions from API`);
          const response = await apiService.getQuestionsForRespondent(
            projectId,
            {
              assigned_respondent_type: effectiveRespondentType,
              assigned_commodity: commodityStr,
              assigned_country: countryStr,
            },
            {
              page,
              page_size: pageSize,
            }
          );

          // Handle paginated response from Django REST Framework
          if (response.results) {
            questionsList = response.results;
            hasMore = !!response.next; // Has next page if "next" URL exists
            console.log(`✓ Loaded ${questionsList.length} questions (page ${page}/${Math.ceil(response.count / pageSize)}), hasMore: ${hasMore}`);
          } else {
            // Fallback for non-paginated response
            questionsList = Array.isArray(response)
              ? response
              : response.questions || [];
            hasMore = false;
            console.log(`✓ Loaded ${questionsList.length} questions from filtered API endpoint`);
          }
        } catch (error) {
          console.error('Error fetching questions from API, falling back to cache:', error);
          // Fall back to cache if API fails - load ALL questions (no pagination)
          const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);
          const allQuestions = cachedQuestions as any as Question[];

          // Filter cached questions client-side
          const filtered = allQuestions.filter((q: Question) => {
            const matchesRespondent = q.assigned_respondent_type === effectiveRespondentType;
            const matchesCommodity = q.assigned_commodity === commodityStr;
            const matchesCountry = q.assigned_country === countryStr;
            return matchesRespondent && matchesCommodity && matchesCountry;
          });

          // Return ALL filtered questions from cache (no pagination when falling back)
          questionsList = filtered;
          hasMore = false; // No pagination for cached fallback

          console.log(`📦 Loaded ${questionsList.length} questions from cache fallback (all questions)`);
        }
      } else {
        // Offline: Load ALL questions from cache (no pagination for offline)
        console.log(`📴 Offline - loading ALL questions from cache`);
        const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);
        const allQuestions = cachedQuestions as any as Question[];

        const filtered = allQuestions.filter((q: Question) => {
          const matchesRespondent = q.assigned_respondent_type === effectiveRespondentType;
          const matchesCommodity = q.assigned_commodity === commodityStr;
          const matchesCountry = q.assigned_country === countryStr;
          return matchesRespondent && matchesCommodity && matchesCountry;
        });

        // Return ALL filtered questions when offline (no pagination)
        questionsList = filtered;
        hasMore = false; // No more pages when offline - all questions loaded

        console.log(`📦 Loaded ${questionsList.length} matching questions from cache (all questions)`);
      }

      console.log(`✓ Found ${questionsList.length} matching questions for criteria:`, {
        respondentType: effectiveRespondentType,
        commodity: commodityStr,
        country: countryStr,
        page,
      });

      // Sort by category order first, then by order_index within each category
      // Note: Backend already sorts by category, but we apply it here for cached/offline data
      const sortedQuestions = questionsList.sort((a, b) => {
        const categoryA = a.question_category || '';
        const categoryB = b.question_category || '';
        const categoryIndexA = getCategorySortIndex(categoryA);
        const categoryIndexB = getCategorySortIndex(categoryB);

        if (categoryIndexA !== categoryIndexB) {
          return categoryIndexA - categoryIndexB;
        }

        // Within same category, maintain original order
        return a.order_index - b.order_index;
      });

      // Update state
      setHasMoreQuestions(hasMore);
      if (append) {
        // Prevent duplicates when appending
        setQuestions(prev => {
          const existingIds = new Set(prev.map(q => q.id));
          const newQuestions = sortedQuestions.filter(q => !existingIds.has(q.id));
          if (newQuestions.length > 0) {
            console.log(`Appending ${newQuestions.length} new questions (filtered ${sortedQuestions.length - newQuestions.length} duplicates)`);
          }
          return [...prev, ...newQuestions];
        });
      } else {
        // Only update if questions actually changed (prevent unnecessary re-renders)
        setQuestions(prevQuestions => {
          const prevIds = prevQuestions.map(q => q.id).sort().join(',');
          const newIds = sortedQuestions.map(q => q.id).sort().join(',');
          if (prevIds === newIds) {
            console.log('Questions unchanged, keeping same reference');
            return prevQuestions; // Same questions, keep same reference
          }
          return sortedQuestions;
        });
      }

      return sortedQuestions;
    } catch (error) {
      console.error('Error loading existing questions:', error);
      return [];
    } finally {
      setLoadingQuestions(false);
    }
  }, [projectId, selectedRespondentType, selectedCommodities, selectedCountry]);

  const generateDynamicQuestions = useCallback(
    async (forceRegenerate: boolean = false, silent: boolean = false): Promise<Question[]> => {
      if (!selectedRespondentType) {
        showAlert('Required', 'Please select a respondent type');
        return [];
      }

      try {
        setGeneratingQuestions(true);

        // Check if questions already exist (force fresh load to avoid stale cache)
        if (!forceRegenerate) {
          console.log('🔍 Checking for existing questions with fresh API call...');
          // Force a fresh load by clearing current page and reloading
          setCurrentPage(1);
          // Pass current filter values explicitly to prevent stale closure issues
          const existingQuestions = await loadExistingQuestions(1, 100, false, {
            respondentType: selectedRespondentType,
            commodities: selectedCommodities,
            country: selectedCountry,
          });

          if (existingQuestions.length > 0) {
            console.log(`Found ${existingQuestions.length} existing questions for this bundle`);
            setQuestions(existingQuestions);
            setQuestionsGenerated(true);
            // Track which filters we used
            setLoadedWithFilters({
              respondentType: selectedRespondentType,
              commodities: [...selectedCommodities],
              country: selectedCountry,
            });

            if (!silent) {
              const commoditiesText = selectedCommodities.length > 0
                ? selectedCommodities.join(', ')
                : 'All Commodities';
              const countryText = selectedCountry || 'All Countries';

              showAlert(
                'Questions Already Exist',
                `Found ${existingQuestions.length} existing questions for this filter combination:\n\n` +
                `• Respondent Type: ${selectedRespondentType}\n` +
                `• Commodities: ${commoditiesText}\n` +
                `• Country: ${countryText}\n\n` +
                `These questions were previously generated and are ready to use.\n\n` +
                `Click OK to REGENERATE and replace all questions.\n` +
                `Click Cancel to keep the existing questions.`,
                [
                  {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => { },
                  },
                  {
                    text: 'Regenerate (Replace All)',
                    onPress: () => generateDynamicQuestions(true, false),
                    style: 'destructive',
                  },
                ]
              );
            }
            return existingQuestions;
          } else {
            console.log('✓ No existing questions found, proceeding with generation');
          }
        }

        // Generate new questions
        const commoditiesForNotes =
          selectedCommodities.length > 0 ? selectedCommodities.join(', ') : 'all commodities';

        const generationData = {
          project: projectId,
          respondent_type: selectedRespondentType,
          commodity: selectedCommodities.length > 0 ? selectedCommodities.join(',') : undefined,
          country: selectedCountry || undefined,
          use_project_bank_only: useProjectBankOnly,
          replace_existing: forceRegenerate, // Use forceRegenerate to control replace_existing
          notes: `Dynamic generation for ${selectedRespondentType} respondent, ${commoditiesForNotes}${selectedCountry ? `, ${selectedCountry}` : ''
            }`,
        };

        const result: DynamicQuestionGenerationResult = await apiService.generateDynamicQuestions(
          generationData
        );

        // Load all questions for this context - CRITICAL: Pass current filter values explicitly
        // to prevent stale closure from loading questions with wrong filters
        const allContextQuestions = await loadExistingQuestions(1, 100, false, {
          respondentType: selectedRespondentType,
          commodities: selectedCommodities,
          country: selectedCountry,
        });
        setQuestions(allContextQuestions);
        setQuestionsGenerated(true);
        // Track which filters we used
        setLoadedWithFilters({
          respondentType: selectedRespondentType,
          commodities: [...selectedCommodities],
          country: selectedCountry,
        });

        // Check if existing questions were returned vs new ones generated
        const returnedExisting = (result.summary as any).returned_existing || false;
        const commoditiesText = selectedCommodities.length > 0
          ? selectedCommodities.join(', ')
          : 'All Commodities';
        const countryText = selectedCountry || 'All Countries';

        if (returnedExisting) {
          // Backend returned existing questions - offer regenerate option
          const message =
            `This filter combination already exists:\n\n` +
            `• Respondent Type: ${selectedRespondentType}\n` +
            `• Commodities: ${commoditiesText}\n` +
            `• Country: ${countryText}\n\n` +
            `Found ${allContextQuestions.length} existing question${allContextQuestions.length !== 1 ? 's' : ''
            }.\n\n` +
            `Click OK to REGENERATE and replace all questions.\n` +
            `Click Cancel to keep the existing questions.`;

          if (!silent) {
            showAlert(
              'Questions Already Exist',
              message,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => { },
                },
                {
                  text: 'Regenerate (Replace All)',
                  onPress: () => generateDynamicQuestions(true, false),
                  style: 'destructive',
                },
              ]
            );
          }
        } else {
          // New questions were generated
          const message =
            `Successfully generated ${result.summary.questions_generated} new question${result.summary.questions_generated !== 1 ? 's' : ''
            } for:\n\n` +
            `• Respondent Type: ${selectedRespondentType}\n` +
            `• Commodities: ${commoditiesText}\n` +
            `• Country: ${countryText}\n\n` +
            `Total questions available: ${allContextQuestions.length}`;

          if (!silent) {
            showAlert('Questions Generated!', message, [{ text: 'OK' }]);
          }
        }

        return allContextQuestions;
      } catch (error: any) {
        console.error('Error generating dynamic questions:', error);
        showAlert(
          'Generation Failed',
          error.response?.data?.error || 'Failed to generate questions. Please try again.'
        );
        return [];
      } finally {
        setGeneratingQuestions(false);
      }
    },
    [selectedRespondentType, selectedCommodities, selectedCountry, projectId, loadExistingQuestions]
  );

  // Load more questions for pagination/infinite scroll
  const loadMoreQuestions = useCallback(async () => {
    if (!hasMoreQuestions || loadingQuestions) {
      return;
    }

    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    await loadExistingQuestions(nextPage, 100, true); // append=true
  }, [hasMoreQuestions, loadingQuestions, currentPage, loadExistingQuestions]);

  // Auto-load questions when specifications change (ONLY when in form mode, not during survey)
  useEffect(() => {
    const autoLoadQuestions = async () => {
      console.log(`🔄 Auto-load effect triggered:`, {
        selectedRespondentType,
        selectedCommodities,
        selectedCountry,
        questionsGenerated,
        questionsCount: questions.length,
        generatingQuestions,
        loadedWithFilters,
        isSurveyRunning,
      });

      // CRITICAL: Don't reload if questions are already generated AND survey is running
      // This prevents mid-survey reloads while allowing updates during setup
      if (questionsGenerated && questions.length > 0 && isSurveyRunning) {
        console.log('✋ Survey is running with generated questions, skipping auto-reload');
        return;
      }

      // Additional safeguard: If we've already loaded questions with specific filters,
      // don't reload with different/empty filters (prevents race condition bug)
      // BUT only if survey is running - otherwise let the user change filters freely
      if (loadedWithFilters && questions.length > 0 && isSurveyRunning) {
        const filtersChanged =
          loadedWithFilters.respondentType !== selectedRespondentType ||
          JSON.stringify(loadedWithFilters.commodities) !== JSON.stringify(selectedCommodities) ||
          loadedWithFilters.country !== selectedCountry;

        if (filtersChanged) {
          console.log('⚠️ Filters changed during active survey, ignoring to prevent unwanted reload:', {
            loaded: loadedWithFilters,
            current: { selectedRespondentType, selectedCommodities, selectedCountry }
          });
          return;
        }
      }

      // STRICT REQUIREMENT: Only auto-load when ALL 3 filters are provided
      if (selectedRespondentType &&
        selectedCommodities.length > 0 &&
        selectedCountry &&
        !generatingQuestions) {
        setCurrentPage(1); // Reset to first page
        // Pass current filter values explicitly to ensure correct filters are used
        const existingQuestions = await loadExistingQuestions(1, 100, false, {
          respondentType: selectedRespondentType,
          commodities: selectedCommodities,
          country: selectedCountry,
        });
        if (existingQuestions.length > 0) {
          setQuestionsGenerated(true);
          // Track which filters we used to load these questions
          setLoadedWithFilters({
            respondentType: selectedRespondentType,
            commodities: [...selectedCommodities],
            country: selectedCountry,
          });
          console.log(`Auto-loaded ${existingQuestions.length} existing questions for ${selectedRespondentType}`);
        } else {
          setQuestionsGenerated(false);
          setLoadedWithFilters(null);
        }
      } else if (selectedRespondentType || selectedCommodities.length > 0 || selectedCountry) {
        // User is still selecting filters - clear questions until all 3 are provided
        console.log('⏳ Waiting for all 3 filters (respondent, commodity, country) before loading questions');
        setQuestions([]);
        setQuestionsGenerated(false);
        setLoadedWithFilters(null);
      }
    };

    autoLoadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRespondentType, selectedCommodities, selectedCountry, generatingQuestions, isSurveyRunning]);
  // Note: loadExistingQuestions removed from deps to prevent mid-survey reloads (it's stable via useCallback)

  const resetQuestions = useCallback(() => {
    setQuestions([]);
    setQuestionsGenerated(false);
    setCurrentPage(1);
    setHasMoreQuestions(false);
    setLoadedWithFilters(null); // Clear the tracked filters
  }, []);

  /**
   * Cache generated questions for offline use
   * This allows users to explicitly cache questions after generation
   */
  const cacheForOffline = useCallback(async (): Promise<void> => {
    // STRICT REQUIREMENT: All 3 filters must be provided
    if (!selectedRespondentType) {
      showAlert('Required', 'Please select a respondent type first');
      return;
    }

    if (!selectedCommodities || selectedCommodities.length === 0) {
      showAlert('Required', 'Please select at least one commodity first');
      return;
    }

    if (!selectedCountry) {
      showAlert('Required', 'Please select a country first');
      return;
    }

    try {
      setCachingForOffline(true);

      // Check network connection
      const isOnline = await networkMonitor.checkConnection();

      if (!isOnline) {
        showAlert('Offline', 'You need to be online to cache questions for offline use. Please connect to the internet and try again.');
        return;
      }

      // Construct commodity string
      const commodityStr = selectedCommodities.join(',') || '';

      // Check if questions with this exact combination already exist in cache
      const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);
      const existingQuestions = cachedQuestions.filter(
        (q: any) =>
          q.assigned_respondent_type === selectedRespondentType &&
          q.assigned_commodity === commodityStr &&
          q.assigned_country === selectedCountry
      );

      if (existingQuestions.length > 0) {
        showAlert(
          'Already Cached',
          `${existingQuestions.length} questions for this combination (${selectedRespondentType}${commodityStr ? `, ${commodityStr}` : ''
          }${selectedCountry ? `, ${selectedCountry}` : ''}) are already cached for offline use.\n\nYou can use these questions even without internet connection.`
        );
        setCachedOfflineCount(existingQuestions.length);
        return;
      }

      // Fetch ALL questions for this combination from the API (not paginated)
      const response = await apiService.getQuestionsForRespondent(
        projectId,
        {
          assigned_respondent_type: selectedRespondentType,
          assigned_commodity: commodityStr,
          assigned_country: selectedCountry || '',
        },
        {
          page: 1,
          page_size: 10000, // Get all questions
        }
      );

      const questionsToCache = response.results || response.questions || [];

      if (questionsToCache.length === 0) {
        showAlert(
          'No Questions',
          'No questions found for this combination. Please generate questions first using the "Generate Questions" button.'
        );
        return;
      }

      // Cache the questions (offlineQuestionCache already handles deduplication)
      await offlineQuestionCache.cacheGeneratedQuestions(projectId, [
        ...cachedQuestions,
        ...questionsToCache,
      ]);

      // Update cached count
      setCachedOfflineCount(questionsToCache.length);

      showAlert(
        'Cached for Offline!',
        `Successfully cached ${questionsToCache.length} questions for offline use.\n\nCombination: ${selectedRespondentType}${commodityStr ? `, ${commodityStr}` : ''
        }${selectedCountry ? `, ${selectedCountry}` : ''}\n\nYou can now collect data with these questions even without internet connection.`,
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      console.error('Error caching questions for offline:', error);
      showAlert(
        'Caching Failed',
        error.response?.data?.error || 'Failed to cache questions for offline use. Please try again.'
      );
    } finally {
      setCachingForOffline(false);
    }
  }, [selectedRespondentType, selectedCommodities, selectedCountry, projectId]);

  /**
   * Load offline cache statistics
   */
  useEffect(() => {
    const loadCacheStats = async () => {
      try {
        const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);
        const commodityStr = selectedCommodities.join(',') || '';

        const matchingCached = cachedQuestions.filter(
          (q: any) =>
            q.assigned_respondent_type === selectedRespondentType &&
            q.assigned_commodity === commodityStr &&
            q.assigned_country === selectedCountry
        );

        setCachedOfflineCount(matchingCached.length);
      } catch (error) {
        console.error('Error loading cache stats:', error);
      }
    };

    if (selectedRespondentType) {
      loadCacheStats();
    }
  }, [projectId, selectedRespondentType, selectedCommodities, selectedCountry]);

  /**
   * Directly inject a pre-fetched set of questions into the hook's state.
   * Used by the draft resume path so questions are available immediately
   * before the survey view renders — avoiding the race with the auto-load effect.
   */
  const setQuestionsDirectly = useCallback((qs: Question[]) => {
    setQuestions(qs);
    setQuestionsGenerated(qs.length > 0);
  }, []);

  // ── Prepare All Profiles for Offline ────────────────────────────────────
  // State for the bulk sync operation
  const [preparingAll, setPreparingAll] = useState(false);
  const [prepareAllProgress, setPrepareAllProgress] = useState<{
    current: number;
    total: number;
    label: string;
    generated: number;
    cached: number;
    skipped: number;
  } | null>(null);

  /**
   * Iterates every respondent × commodity × country combo, generates
   * questions server-side for any combo that doesn't already have them,
   * then caches ALL combos locally for offline use.
   */
  const prepareAllForOffline = useCallback(async (): Promise<void> => {
    const isOnline = await networkMonitor.checkConnection();
    if (!isOnline) {
      showAlert('Offline', 'You need an internet connection to prepare profiles for offline use.');
      return;
    }

    if (availableRespondentTypes.length === 0 || availableCommodities.length === 0 || availableCountries.length === 0) {
      showAlert('No Options', 'Respondent types, commodities, or countries have not loaded yet. Please wait and try again.');
      return;
    }

    try {
      setPreparingAll(true);

      // Build every combination
      const combos: Array<{ respondentType: string; commodity: string; country: string }> = [];
      for (const rt of availableRespondentTypes) {
        for (const comm of availableCommodities) {
          for (const country of availableCountries) {
            combos.push({ respondentType: rt.value, commodity: comm.value, country });
          }
        }
      }

      let generated = 0;
      let cached = 0;
      let skipped = 0;

      // Pre-load the existing local cache once
      const localCache = await offlineQuestionCache.getGeneratedQuestions(projectId);

      // Build a Set of already-cached combo keys for fast lookup
      const cachedComboKeys = new Set<string>();
      for (const q of localCache) {
        cachedComboKeys.add(`${q.assigned_respondent_type}|${q.assigned_commodity}|${q.assigned_country}`);
      }

      // Accumulate new questions in a batch buffer, flushing every 10 combos
      // so that progress is checkpointed incrementally (crash-safe).
      // We only pass NEW questions to each flush and let the cache service
      // merge with existing data to avoid duplicating the entire cache.
      const BATCH_FLUSH_INTERVAL = 10;
      let batchBuffer: any[] = [];

      const flushBatch = async () => {
        if (batchBuffer.length === 0) return;
        // Read current cache, append only new items, and write back
        const currentCache = await offlineQuestionCache.getGeneratedQuestions(projectId);
        const existingIds = new Set(currentCache.map((q: any) => q.id));
        const newQuestions = batchBuffer.filter((q: any) => !existingIds.has(q.id));
        if (newQuestions.length > 0) {
          await offlineQuestionCache.cacheGeneratedQuestions(projectId, [...currentCache, ...newQuestions]);
          console.log(`✓ Batch checkpoint: added ${newQuestions.length} new questions (${currentCache.length + newQuestions.length} total)`);
        } else {
          console.log(`✓ Batch checkpoint: no new questions to add (${currentCache.length} total)`);
        }
        batchBuffer = [];
      };

      for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        const label = `${combo.respondentType} · ${combo.commodity} · ${combo.country}`;
        setPrepareAllProgress({ current: i + 1, total: combos.length, label, generated, cached, skipped });

        const comboKey = `${combo.respondentType}|${combo.commodity}|${combo.country}`;

        // 1. Check if questions exist on server for this combo
        let serverQuestions: any[] = [];
        try {
          const resp = await apiService.getQuestionsForRespondent(
            projectId,
            {
              assigned_respondent_type: combo.respondentType,
              assigned_commodity: combo.commodity,
              assigned_country: combo.country,
            },
            { page: 1, page_size: 10000 }
          );
          serverQuestions = resp.results || resp.questions || [];
        } catch (e) {
          console.warn(`Failed to check server for ${label}:`, e);
        }

        // 2. If none exist on server, generate them
        if (serverQuestions.length === 0) {
          try {
            await apiService.generateDynamicQuestions({
              project: projectId,
              respondent_type: combo.respondentType,
              commodity: combo.commodity,
              country: combo.country,
              use_project_bank_only: useProjectBankOnly,
              replace_existing: false,
              notes: `Bulk offline prep: ${label}`,
            });

            // Re-fetch after generation
            const resp2 = await apiService.getQuestionsForRespondent(
              projectId,
              {
                assigned_respondent_type: combo.respondentType,
                assigned_commodity: combo.commodity,
                assigned_country: combo.country,
              },
              { page: 1, page_size: 10000 }
            );
            serverQuestions = resp2.results || resp2.questions || [];
            generated++;
          } catch (genErr) {
            console.warn(`Generation failed for ${label}:`, genErr);
            skipped++;
            continue;
          }
        }

        if (serverQuestions.length === 0) {
          skipped++;
          continue;
        }

        // 3. Check if already cached locally
        if (!cachedComboKeys.has(comboKey)) {
          batchBuffer.push(...serverQuestions);
          cachedComboKeys.add(comboKey);
          cached++;
        } else {
          skipped++;
        }

        // Flush every BATCH_FLUSH_INTERVAL combos
        if ((i + 1) % BATCH_FLUSH_INTERVAL === 0) {
          await flushBatch();
        }
      }

      // Final flush for remaining items
      await flushBatch();

      // Final progress update
      setPrepareAllProgress({ current: combos.length, total: combos.length, label: 'Done', generated, cached, skipped });

      showAlert(
        'All Profiles Ready!',
        `Processed ${combos.length} profile combinations:\n\n` +
        `• ${generated} newly generated on server\n` +
        `• ${cached} newly cached for offline\n` +
        `• ${skipped} already up-to-date\n\n` +
        `All profiles are now available for offline data collection.`
      );
    } catch (error: any) {
      console.error('Error in prepareAllForOffline:', error);
      showAlert('Error', error.message || 'Failed to prepare all profiles for offline.');
    } finally {
      setPreparingAll(false);
      setPrepareAllProgress(null);
    }
  }, [projectId, availableRespondentTypes, availableCommodities, availableCountries, useProjectBankOnly]);

  return {
    questions,
    generatingQuestions,
    questionsGenerated,
    availableRespondentTypes,
    availableCommodities,
    availableCountries,
    loadingOptions,
    loadingQuestions,
    hasMoreQuestions,
    cachingForOffline,
    cachedOfflineCount,
    preparingAll,
    prepareAllProgress,
    loadAvailableOptions,
    generateDynamicQuestions,
    loadMoreQuestions,
    resetQuestions,
    cacheForOffline,
    prepareAllForOffline,
    setQuestionsDirectly,
  };
};
