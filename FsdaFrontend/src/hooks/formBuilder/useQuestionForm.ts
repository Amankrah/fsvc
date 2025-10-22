/**
 * useQuestionForm Hook
 * Manages question form state and validation
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Question, RespondentType, ResponseType } from '../../types';
import { DEFAULT_QUESTION_STATE } from '../../constants/formBuilder';

export const useQuestionForm = () => {
  const [newQuestion, setNewQuestion] = useState<any>(DEFAULT_QUESTION_STATE);
  const [optionInput, setOptionInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Text');
  const [selectedTargetedRespondents, setSelectedTargetedRespondents] = useState<RespondentType[]>([]);
  const [selectedCommodities, setSelectedCommodities] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  // Conditional logic state
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [parentQuestionId, setParentQuestionId] = useState('');
  const [conditionOperator, setConditionOperator] = useState('equals');
  const [conditionValue, setConditionValue] = useState('');

  const resetForm = useCallback(() => {
    setNewQuestion(DEFAULT_QUESTION_STATE);
    setOptionInput('');
    setSelectedTargetedRespondents([]);
    setSelectedCommodities([]);
    setSelectedCountries([]);
    setIsFollowUp(false);
    setParentQuestionId('');
    setConditionOperator('equals');
    setConditionValue('');
  }, []);

  const loadQuestionForEdit = useCallback((question: Question) => {
    setNewQuestion({
      question_text: question.question_text,
      question_category: question.question_category || 'production',
      response_type: question.response_type,
      is_required: question.is_required,
      allow_multiple: question.allow_multiple || false,
      options: question.options || [],
      validation_rules: question.validation_rules || {},
      targeted_respondents: question.targeted_respondents || [],
      targeted_commodities: question.targeted_commodities || [],
      targeted_countries: question.targeted_countries || [],
      data_source: question.data_source || 'internal',
      research_partner_name: question.research_partner_name || '',
      research_partner_contact: question.research_partner_contact || '',
      work_package: question.work_package || '',
      priority_score: question.priority_score || 5,
      is_active: question.is_active !== undefined ? question.is_active : true,
      tags: question.tags || [],
      is_follow_up: question.is_follow_up || false,
      conditional_logic: question.conditional_logic || null,
    });
    setSelectedTargetedRespondents(question.targeted_respondents || []);
    setSelectedCommodities(question.targeted_commodities || []);
    setSelectedCountries(question.targeted_countries || []);

    // Populate conditional logic fields
    const isFollowUpQuestion = question.is_follow_up || false;
    setIsFollowUp(isFollowUpQuestion);
    if (isFollowUpQuestion && question.conditional_logic) {
      setParentQuestionId(question.conditional_logic.parent_question_id || '');
      setConditionOperator(question.conditional_logic.show_if?.operator || 'equals');
      setConditionValue(question.conditional_logic.show_if?.value || '');
    } else {
      setParentQuestionId('');
      setConditionOperator('equals');
      setConditionValue('');
    }
  }, []);

  const validateQuestion = useCallback(() => {
    if (!newQuestion.question_text.trim()) {
      Alert.alert('Validation Error', 'Please enter a question text');
      return false;
    }

    if (!selectedTargetedRespondents || selectedTargetedRespondents.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one targeted respondent');
      return false;
    }

    const requiresOptions = ['choice_single', 'choice_multiple'].includes(newQuestion.response_type);
    if (requiresOptions && (!newQuestion.options || newQuestion.options.length < 2)) {
      Alert.alert('Validation Error', 'Please add at least 2 options for choice questions');
      return false;
    }

    return true;
  }, [newQuestion, selectedTargetedRespondents]);

  const buildQuestionData = useCallback(() => {
    // Build conditional logic object if this is a follow-up question
    let conditionalLogic = null;
    if (isFollowUp && parentQuestionId && conditionOperator && conditionValue) {
      conditionalLogic = {
        enabled: true,
        parent_question_id: parentQuestionId,
        show_if: {
          operator: conditionOperator,
          value: conditionValue,
        },
      };
    }

    return {
      question_text: newQuestion.question_text,
      question_category: newQuestion.question_category,
      targeted_respondents: selectedTargetedRespondents.length > 0 ? selectedTargetedRespondents : [],
      targeted_commodities: selectedCommodities,
      targeted_countries: selectedCountries,
      response_type: newQuestion.response_type,
      is_required: newQuestion.is_required,
      allow_multiple: newQuestion.allow_multiple,
      options: newQuestion.options,
      validation_rules: newQuestion.validation_rules,
      data_source: newQuestion.data_source,
      research_partner_name: newQuestion.research_partner_name,
      research_partner_contact: newQuestion.research_partner_contact,
      work_package: newQuestion.work_package,
      priority_score: newQuestion.priority_score,
      is_active: newQuestion.is_active,
      tags: newQuestion.tags,
      is_follow_up: isFollowUp,
      conditional_logic: conditionalLogic,
    };
  }, [
    newQuestion,
    selectedTargetedRespondents,
    selectedCommodities,
    selectedCountries,
    isFollowUp,
    parentQuestionId,
    conditionOperator,
    conditionValue,
  ]);

  const addOption = useCallback(() => {
    if (optionInput.trim()) {
      setNewQuestion((prev: any) => ({
        ...prev,
        options: [...(prev.options || []), optionInput.trim()],
      }));
      setOptionInput('');
    }
  }, [optionInput]);

  const removeOption = useCallback((index: number) => {
    setNewQuestion((prev: any) => {
      const updatedOptions = [...(prev.options || [])];
      updatedOptions.splice(index, 1);
      return { ...prev, options: updatedOptions };
    });
  }, []);

  return {
    // Form state
    newQuestion,
    setNewQuestion,
    optionInput,
    setOptionInput,
    selectedCategory,
    setSelectedCategory,
    selectedTargetedRespondents,
    setSelectedTargetedRespondents,
    selectedCommodities,
    setSelectedCommodities,
    selectedCountries,
    setSelectedCountries,

    // Conditional logic state
    isFollowUp,
    setIsFollowUp,
    parentQuestionId,
    setParentQuestionId,
    conditionOperator,
    setConditionOperator,
    conditionValue,
    setConditionValue,

    // Methods
    resetForm,
    loadQuestionForEdit,
    validateQuestion,
    buildQuestionData,
    addOption,
    removeOption,
  };
};
