/**
 * useQuestions Hook
 * Manages question loading and dynamic generation
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import apiService from '../../services/api';
import { Question, RespondentType, CommodityType, DynamicQuestionGenerationResult } from '../../types';

interface UseQuestionsProps {
  projectId: string;
  selectedRespondentType: RespondentType | '';
  selectedCommodities: CommodityType[];
  selectedCountry: string;
}

export const useQuestions = ({
  projectId,
  selectedRespondentType,
  selectedCommodities,
  selectedCountry,
}: UseQuestionsProps) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [questionsGenerated, setQuestionsGenerated] = useState(false);
  const [availableRespondentTypes, setAvailableRespondentTypes] = useState<Array<{ value: string; display: string }>>([]);
  const [availableCommodities, setAvailableCommodities] = useState<Array<{ value: string; display: string }>>([]);
  const [availableCountries, setAvailableCountries] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const loadAvailableOptions = useCallback(async () => {
    try {
      setLoadingOptions(true);
      const response = await apiService.getAvailableQuestionBankOptions(projectId);

      setAvailableRespondentTypes(response.available_options.respondent_types || []);
      setAvailableCommodities(response.available_options.commodities || []);
      setAvailableCountries(response.available_options.countries || []);

      console.log('Available options loaded:', response.summary);
    } catch (error: any) {
      console.error('Error loading available options:', error);
      Alert.alert(
        'Warning',
        'Could not load available question options. Question generation may not work properly.'
      );
    } finally {
      setLoadingOptions(false);
    }
  }, [projectId]);

  const loadExistingQuestions = useCallback(async () => {
    if (!selectedRespondentType) {
      return [];
    }

    try {
      const allQuestions = await apiService.getQuestions(projectId);
      const questionsList: Question[] = Array.isArray(allQuestions)
        ? allQuestions
        : allQuestions.results || [];

      const commodityStr = selectedCommodities.join(',') || '';
      const countryStr = selectedCountry || '';

      const matchingQuestions = questionsList.filter((q: Question) => {
        const matchesRespondent = q.assigned_respondent_type === selectedRespondentType;
        const matchesCommodity = q.assigned_commodity === commodityStr;
        const matchesCountry = q.assigned_country === countryStr;

        return matchesRespondent && matchesCommodity && matchesCountry;
      });

      return matchingQuestions.sort((a, b) => a.order_index - b.order_index);
    } catch (error) {
      console.error('Error loading existing questions:', error);
      return [];
    }
  }, [projectId, selectedRespondentType, selectedCommodities, selectedCountry]);

  const generateDynamicQuestions = useCallback(
    async (forceRegenerate: boolean = false, silent: boolean = false) => {
      if (!selectedRespondentType) {
        Alert.alert('Required', 'Please select a respondent type');
        return;
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
              Alert.alert(
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
            return;
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

        Alert.alert('Questions Ready!', message, [{ text: 'OK' }]);
      } catch (error: any) {
        console.error('Error generating dynamic questions:', error);
        Alert.alert(
          'Generation Failed',
          error.response?.data?.error || 'Failed to generate questions. Please try again.'
        );
      } finally {
        setGeneratingQuestions(false);
      }
    },
    [selectedRespondentType, selectedCommodities, selectedCountry, projectId, loadExistingQuestions]
  );

  // Auto-load questions when specifications change
  useEffect(() => {
    const autoLoadQuestions = async () => {
      if (selectedRespondentType && !generatingQuestions) {
        const existingQuestions = await loadExistingQuestions();
        if (existingQuestions.length > 0) {
          setQuestions(existingQuestions);
          setQuestionsGenerated(true);
          console.log(`Auto-loaded ${existingQuestions.length} existing questions for ${selectedRespondentType}`);
        } else {
          setQuestions([]);
          setQuestionsGenerated(false);
        }
      }
    };

    autoLoadQuestions();
  }, [selectedRespondentType, selectedCommodities, selectedCountry, loadExistingQuestions, generatingQuestions]);

  const resetQuestions = useCallback(() => {
    setQuestions([]);
    setQuestionsGenerated(false);
  }, []);

  return {
    questions,
    generatingQuestions,
    questionsGenerated,
    availableRespondentTypes,
    availableCommodities,
    availableCountries,
    loadingOptions,
    loadAvailableOptions,
    generateDynamicQuestions,
    resetQuestions,
  };
};
