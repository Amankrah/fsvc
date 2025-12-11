/**
 * useQuestions Hook
 * Manages question loading and dynamic generation
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { showAlert, showConfirm, showSuccess, showError, showInfo } from '../../utils/alert';
import apiService from '../../services/api';
import { Question, RespondentType, CommodityType, DynamicQuestionGenerationResult } from '../../types';
import { offlineProjectCache, offlineQuestionCache, networkMonitor } from '../../services';
import { getCategorySortIndex } from '../../constants/formBuilder';

interface UseQuestionsProps {
  projectId: string;
  selectedRespondentType: RespondentType | '';
  selectedCommodities: CommodityType[];
  selectedCountry: string;
  useProjectBankOnly?: boolean;
}

export const useQuestions = ({
  projectId,
  selectedRespondentType,
  selectedCommodities,
  selectedCountry,
  useProjectBankOnly = true,
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

  const loadExistingQuestions = useCallback(async (page: number = 1, pageSize: number = 100, append: boolean = false) => {
    if (!selectedRespondentType) {
      return [];
    }

    try {
      setLoadingQuestions(true);

      // Check network connection
      const isOnline = await networkMonitor.checkConnection();

      const commodityStr = selectedCommodities.join(',') || '';
      const countryStr = selectedCountry || '';

      let questionsList: Question[] = [];
      let hasMore = false;

      if (isOnline) {
        // Online: Fetch from API using optimized filtered endpoint with pagination
        try {
          console.log(`🌐 Online - fetching page ${page} of filtered questions from API`);
          const response = await apiService.getQuestionsForRespondent(
            projectId,
            {
              assigned_respondent_type: selectedRespondentType,
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
            const matchesRespondent = q.assigned_respondent_type === selectedRespondentType;
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
          const matchesRespondent = q.assigned_respondent_type === selectedRespondentType;
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
        respondentType: selectedRespondentType,
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
        setQuestions(prev => [...prev, ...sortedQuestions]);
      } else {
        setQuestions(sortedQuestions);
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

        // Check if questions already exist
        if (!forceRegenerate) {
          const existingQuestions = await loadExistingQuestions();

          if (existingQuestions.length > 0) {
            setQuestions(existingQuestions);
            setQuestionsGenerated(true);

            if (!silent) {
              showAlert(
                'Questions Loaded!',
                `Found ${existingQuestions.length} existing questions for ${selectedRespondentType} respondents with these criteria.\n\nThese questions were previously generated and are ready to use.`,
                [
                  {
                    text: 'Use These',
                    onPress: () => {},
                  },
                  {
                    text: 'Regenerate',
                    onPress: () => generateDynamicQuestions(true, false),
                    style: 'destructive',
                  },
                ]
              );
            }
            return existingQuestions;
          }
        }

        // Generate new questions
        const commoditiesText =
          selectedCommodities.length > 0 ? selectedCommodities.join(', ') : 'all commodities';

        const generationData = {
          project: projectId,
          respondent_type: selectedRespondentType,
          commodity: selectedCommodities.length > 0 ? selectedCommodities.join(',') : undefined,
          country: selectedCountry || undefined,
          use_project_bank_only: useProjectBankOnly,
          replace_existing: false,
          notes: `Dynamic generation for ${selectedRespondentType} respondent, ${commoditiesText}${
            selectedCountry ? `, ${selectedCountry}` : ''
          }`,
        };

        const result: DynamicQuestionGenerationResult = await apiService.generateDynamicQuestions(
          generationData
        );

        // Load all questions for this context
        const allContextQuestions = await loadExistingQuestions();
        setQuestions(allContextQuestions);
        setQuestionsGenerated(true);

        const message =
          result.summary.questions_generated > 0
            ? `Successfully generated ${result.summary.questions_generated} new question${
                result.summary.questions_generated !== 1 ? 's' : ''
              } for ${selectedRespondentType} respondents.\n\nTotal questions available: ${
                allContextQuestions.length
              }`
            : `No new questions generated. All questions for this combination already exist.\n\nUsing ${
                allContextQuestions.length
              } existing question${allContextQuestions.length !== 1 ? 's' : ''}.`;

        showAlert('Questions Ready!', message, [{ text: 'OK' }]);
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

  // Auto-load questions when specifications change
  useEffect(() => {
    const autoLoadQuestions = async () => {
      if (selectedRespondentType && !generatingQuestions) {
        setCurrentPage(1); // Reset to first page
        const existingQuestions = await loadExistingQuestions(1, 100, false); // Load first page
        if (existingQuestions.length > 0) {
          setQuestionsGenerated(true);
          console.log(`Auto-loaded ${existingQuestions.length} existing questions for ${selectedRespondentType}`);
        } else {
          setQuestionsGenerated(false);
        }
      }
    };

    autoLoadQuestions();
  }, [selectedRespondentType, selectedCommodities, selectedCountry, loadExistingQuestions, generatingQuestions]);

  const resetQuestions = useCallback(() => {
    setQuestions([]);
    setQuestionsGenerated(false);
    setCurrentPage(1);
    setHasMoreQuestions(false);
  }, []);

  /**
   * Cache generated questions for offline use
   * This allows users to explicitly cache questions after generation
   */
  const cacheForOffline = useCallback(async (): Promise<void> => {
    if (!selectedRespondentType) {
      showAlert('Required', 'Please select a respondent type first');
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
          `${existingQuestions.length} questions for this combination (${selectedRespondentType}${
            commodityStr ? `, ${commodityStr}` : ''
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
        `Successfully cached ${questionsToCache.length} questions for offline use.\n\nCombination: ${selectedRespondentType}${
          commodityStr ? `, ${commodityStr}` : ''
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
    loadAvailableOptions,
    generateDynamicQuestions,
    loadMoreQuestions,
    resetQuestions,
    cacheForOffline,
  };
};
