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
      response_type: question.response_type,
      is_required: question.is_required,
      allow_multiple: question.allow_multiple || false,
      options: question.options || [],
      validation_rules: question.validation_rules || {},
      targeted_respondents: question.targeted_respondents || [],
      targeted_commodities: question.targeted_commodities || [],
      targeted_countries: question.targeted_countries || [],
      data_source: question.data_source || 'internal',
      is_active: question.is_active !== undefined ? question.is_active : true,
      tags: question.tags || [],
      is_follow_up: question.is_follow_up || false,
      conditional_logic: question.conditional_logic || null,
      section_header: question.section_header || '',
      section_preamble: question.section_preamble || '',
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

    // Build the question data aligned with QuestionBank model structure
    const questionData: any = {
      question_text: newQuestion.question_text,
      // Note: question_category is auto-set by backend based on targeted_respondents[0]
      // See models.py:auto_set_category_from_respondents()
      targeted_respondents: selectedTargetedRespondents.length > 0 ? selectedTargetedRespondents : [],
      targeted_commodities: selectedCommodities || [],
      targeted_countries: selectedCountries || [],
      response_type: newQuestion.response_type,
      is_required: newQuestion.is_required ?? true,
      allow_multiple: newQuestion.allow_multiple ?? false,
      options: newQuestion.options || null,
      validation_rules: newQuestion.validation_rules || null,
      is_active: newQuestion.is_active ?? true,
      tags: newQuestion.tags || [],
      is_follow_up: isFollowUp,
      conditional_logic: conditionalLogic,
    };

    // Add optional fields only if they have values (otherwise backend will use defaults)
    if (newQuestion.data_source && newQuestion.data_source !== 'internal') {
      questionData.data_source = newQuestion.data_source;
    }
    if (newQuestion.research_partner_name?.trim()) {
      questionData.research_partner_name = newQuestion.research_partner_name.trim();
    }
    if (newQuestion.research_partner_contact?.trim()) {
      questionData.research_partner_contact = newQuestion.research_partner_contact.trim();
    }
    if (newQuestion.work_package?.trim()) {
      questionData.work_package = newQuestion.work_package.trim();
    }
    if (newQuestion.priority_score && newQuestion.priority_score !== 5) {
      questionData.priority_score = newQuestion.priority_score;
    }

    return questionData;
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
