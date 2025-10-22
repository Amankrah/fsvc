import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Button,
  TextInput,
  FAB,
  Portal,
  Dialog,
  Chip,
  IconButton,
  Switch,
  ActivityIndicator,
  Divider,
  ProgressBar,
} from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import apiService from '../services/api';
import { Question, ResponseType, ResponseTypeInfo, RespondentType } from '../types';

type RootStackParamList = {
  FormBuilder: { projectId: string; projectName: string };
};

type FormBuilderRouteProp = RouteProp<RootStackParamList, 'FormBuilder'>;

const RESPONSE_TYPE_CATEGORIES = [
  {
    label: 'Text',
    icon: 'text',
    types: ['text_short', 'text_long'],
  },
  {
    label: 'Number',
    icon: 'numeric',
    types: ['numeric_integer', 'numeric_decimal', 'scale_rating'],
  },
  {
    label: 'Choice',
    icon: 'format-list-bulleted',
    types: ['choice_single', 'choice_multiple'],
  },
  {
    label: 'Date',
    icon: 'calendar',
    types: ['date', 'datetime'],
  },
  {
    label: 'Location',
    icon: 'map-marker',
    types: ['geopoint', 'geoshape'],
  },
  {
    label: 'Media',
    icon: 'camera',
    types: ['image', 'audio', 'video', 'file'],
  },
  {
    label: 'Special',
    icon: 'star',
    types: ['signature', 'barcode'],
  },
];

const FormBuilderScreen: React.FC = () => {
  const route = useRoute<FormBuilderRouteProp>();
  const { projectId } = route.params;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [responseTypes, setResponseTypes] = useState<ResponseTypeInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilters, setSelectedCategoryFilters] = useState<string[]>([]);
  const [selectedRespondentFilters, setSelectedRespondentFilters] = useState<string[]>([]);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // New question form state - matching QuestionBank structure
  const [newQuestion, setNewQuestion] = useState<any>({
    question_text: '',
    question_category: 'production',
    response_type: 'text_short',
    is_required: true,
    allow_multiple: false,
    options: [],
    validation_rules: {},
    targeted_respondents: [],
    targeted_commodities: [],
    targeted_countries: [],
    data_source: 'internal',
    research_partner_name: '',
    research_partner_contact: '',
    work_package: '',
    priority_score: 5,
    is_active: true,
    tags: [],
    is_follow_up: false,
    conditional_logic: null,
  });
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
  
  // QuestionBank field choices
  const [questionBankChoices, setQuestionBankChoices] = useState<any>({
    categories: [],
    data_sources: [],
    commodities: [],
    respondent_types: [],
  });

  // Import/Export state
  const [showImportExportDialog, setShowImportExportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    loadProjectAndQuestions();
    loadResponseTypes();
    loadQuestionBankChoices();
  }, []);

  const loadProjectAndQuestions = async () => {
    try {
      setLoading(true);
      const questionBankData = await apiService.getQuestionBank({ page_size: 1000 });
      // Extract questions from QuestionBank response
      const questionsList = Array.isArray(questionBankData) 
        ? questionBankData 
        : questionBankData.results || [];
      setQuestions(questionsList);
      setFilteredQuestions(questionsList);
    } catch (error: any) {
      console.error('Error loading project and questions:', error);
      Alert.alert('Error', 'Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

  // Filter questions based on search and filters
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
        q.targeted_respondents?.some(r => selectedRespondentFilters.includes(r))
      );
    }

    setFilteredQuestions(filtered);
  }, [questions, searchQuery, selectedCategoryFilters, selectedRespondentFilters]);

  const toggleCategoryFilter = (category: string) => {
    setSelectedCategoryFilters(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleRespondentFilter = (respondent: string) => {
    setSelectedRespondentFilters(prev =>
      prev.includes(respondent)
        ? prev.filter(r => r !== respondent)
        : [...prev, respondent]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategoryFilters([]);
    setSelectedRespondentFilters([]);
  };

  const hasActiveFilters = searchQuery || 
    selectedCategoryFilters.length > 0 || 
    selectedRespondentFilters.length > 0;

  const loadQuestions = async () => {
    try {
      const data = await apiService.getQuestionBank({ page_size: 1000 });
      const questionsList = Array.isArray(data) ? data : data.results || [];
      setQuestions(questionsList);
    } catch (error: any) {
      console.error('Error loading questions:', error);
    }
  };

  const loadResponseTypes = async () => {
    try {
      const types = await apiService.getResponseTypes();
      setResponseTypes(types);
    } catch (error) {
      console.error('Error loading response types:', error);
    }
  };

  const loadQuestionBankChoices = async () => {
    try {
      const choices = await apiService.getQuestionBankChoices();
      setQuestionBankChoices(choices);
    } catch (error) {
      console.error('Error loading QuestionBank choices:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProjectAndQuestions();
    setRefreshing(false);
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.question_text.trim()) {
      Alert.alert('Validation Error', 'Please enter a question text');
      return;
    }

    if (!selectedTargetedRespondents || selectedTargetedRespondents.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one targeted respondent');
      return;
    }

    const requiresOptions = ['choice_single', 'choice_multiple'].includes(newQuestion.response_type);
    if (requiresOptions && (!newQuestion.options || newQuestion.options.length < 2)) {
      Alert.alert('Validation Error', 'Please add at least 2 options for choice questions');
      return;
    }

    try {
      setSaving(true);

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

      const questionBankData = {
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
        base_project: projectId,
      };

      await apiService.createQuestionBankItem(questionBankData);
      await loadQuestions();

      // Reset form
      setNewQuestion({
        question_text: '',
        question_category: 'production',
        response_type: 'text_short',
        is_required: true,
        allow_multiple: false,
        options: [],
        validation_rules: {},
        targeted_respondents: [],
        targeted_commodities: [],
        targeted_countries: [],
        data_source: 'internal',
        research_partner_name: '',
        research_partner_contact: '',
        work_package: '',
        priority_score: 5,
        is_active: true,
        tags: [],
        is_follow_up: false,
        conditional_logic: null,
      });
      setOptionInput('');
      setSelectedTargetedRespondents([]);
      setSelectedCommodities([]);
      setSelectedCountries([]);
      setIsFollowUp(false);
      setParentQuestionId('');
      setConditionOperator('equals');
      setConditionValue('');
      setShowAddDialog(false);
      Alert.alert('Success', 'Question added to your Question Bank');
    } catch (error: any) {
      console.error('Error adding question:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add question');
    } finally {
      setSaving(false);
    }
  };

  const COUNTRY_OPTIONS = ['Ghana', 'Nigeria', 'Kenya', 'Tanzania', 'Uganda', 'Ethiopia', 'South Africa', 'Senegal', 'Mali', 'Burkina Faso', 'Côte d\'Ivoire', 'Cameroon', 'Other'];

  const handleOpenEditDialog = (question: any) => {
    setEditingQuestion(question);
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

    // Set category based on response type
    const category = RESPONSE_TYPE_CATEGORIES.find(cat =>
      cat.types.includes(question.response_type)
    );
    if (category) {
      setSelectedCategory(category.label);
    }

    setShowEditDialog(true);
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion || !newQuestion.question_text.trim()) {
      Alert.alert('Validation Error', 'Please enter a question text');
      return;
    }

    if (!selectedTargetedRespondents || selectedTargetedRespondents.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one targeted respondent');
      return;
    }

    const requiresOptions = ['choice_single', 'choice_multiple'].includes(newQuestion.response_type);
    if (requiresOptions && (!newQuestion.options || newQuestion.options.length < 2)) {
      Alert.alert('Validation Error', 'Please add at least 2 options for choice questions');
      return;
    }

    try {
      setSaving(true);

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

      const questionBankData = {
        question_text: newQuestion.question_text,
        question_category: newQuestion.question_category,
        response_type: newQuestion.response_type,
        is_required: newQuestion.is_required,
        allow_multiple: newQuestion.allow_multiple,
        options: newQuestion.options,
        validation_rules: newQuestion.validation_rules,
        targeted_respondents: selectedTargetedRespondents,
        targeted_commodities: selectedCommodities,
        targeted_countries: selectedCountries,
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

      await apiService.updateQuestionBankItem(editingQuestion.id, questionBankData);
      await loadQuestions();

      // Reset form
      setNewQuestion({
        question_text: '',
        question_category: 'production',
        response_type: 'text_short',
        is_required: true,
        allow_multiple: false,
        options: [],
        validation_rules: {},
        targeted_respondents: [],
        targeted_commodities: [],
        targeted_countries: [],
        data_source: 'internal',
        research_partner_name: '',
        research_partner_contact: '',
        work_package: '',
        priority_score: 5,
        is_active: true,
        tags: [],
        is_follow_up: false,
        conditional_logic: null,
      });
      setOptionInput('');
      setSelectedTargetedRespondents([]);
      setSelectedCommodities([]);
      setSelectedCountries([]);
      setIsFollowUp(false);
      setParentQuestionId('');
      setConditionOperator('equals');
      setConditionValue('');
      setEditingQuestion(null);
      setShowEditDialog(false);
      Alert.alert('Success', 'Question updated successfully');
    } catch (error: any) {
      console.error('Error updating question:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to update question');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this question from your Question Bank?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteQuestionBankItem(questionId);
            await loadQuestions();
            Alert.alert('Success', 'Question deleted from Question Bank');
          } catch (error) {
            console.error('Error deleting question:', error);
            Alert.alert('Error', 'Failed to delete question');
          }
        },
      },
    ]);
  };

  const handleDuplicateQuestion = async (questionId: string) => {
    try {
      await apiService.duplicateQuestionBankItem(questionId);
      await loadQuestions();
      Alert.alert('Success', 'Question duplicated successfully');
    } catch (error) {
      console.error('Error duplicating question:', error);
      Alert.alert('Error', 'Failed to duplicate question');
    }
  };

  const handleDeleteAllQuestionBank = async () => {
    Alert.alert(
      'Delete All Question Bank Items',
      'This will permanently delete ALL questions from your Question Bank. Do you also want to delete questions generated from these items in projects?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Bank Only',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const result = await apiService.deleteAllQuestionBankItems(true, false);
              await loadQuestions();
              Alert.alert('Success', result.message || 'All Question Bank items deleted');
            } catch (error: any) {
              console.error('Error deleting Question Bank:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete Question Bank items');
            } finally {
              setSaving(false);
            }
          },
        },
        {
          text: 'Delete Bank & Generated',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const result = await apiService.deleteAllQuestionBankItems(true, true);
              await loadQuestions();
              Alert.alert(
                'Success',
                `${result.message || 'All Question Bank items deleted'}. Also deleted ${result.deleted_generated_questions || 0} generated questions.`
              );
            } catch (error: any) {
              console.error('Error deleting Question Bank:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete Question Bank items');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllProjectQuestions = async () => {
    Alert.alert(
      'Delete All Project Questions',
      'This will delete ALL questions generated for this project. Question Bank items will remain. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const result = await apiService.deleteAllProjectQuestions(projectId);
              await loadQuestions();
              Alert.alert('Success', result.message || 'All project questions deleted');
            } catch (error: any) {
              console.error('Error deleting project questions:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete project questions');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  // Import/Export handlers - Platform agnostic
  const handleDownloadTemplate = async (format: 'csv' | 'excel') => {
    try {
      setSaving(true);
      const blob = format === 'csv'
        ? await apiService.downloadCSVTemplate()
        : await apiService.downloadExcelTemplate();

      const fileName = `question_template_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;

      if (Platform.OS === 'web') {
        // Web download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        Alert.alert('Success', `${format.toUpperCase()} template downloaded successfully`);
      } else {
        // Mobile: Save to device using expo-file-system and share
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];

          // Save file
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Check if sharing is available
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(fileUri, {
              mimeType: format === 'csv'
                ? 'text/csv'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              dialogTitle: 'Save Question Template',
              UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'org.openxmlformats.spreadsheetml.sheet',
            });
            Alert.alert('Success', `${format.toUpperCase()} template ready. Choose where to save it.`);
          } else {
            Alert.alert('Success', `Template saved to: ${fileUri}`);
          }
        };
      }
    } catch (error) {
      console.error(`Error downloading ${format} template:`, error);
      Alert.alert('Error', `Failed to download ${format.toUpperCase()} template`);
    } finally {
      setSaving(false);
      setShowImportExportDialog(false);
    }
  };

  const handleImportQuestions = async () => {
    try {
      // Use expo-document-picker for cross-platform file selection
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];

      if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
        Alert.alert('Invalid File', 'Please select a CSV or Excel file (.csv, .xlsx, .xls)');
        return;
      }

      // Start import
      setImporting(true);
      setImportProgress(0.1);
      setImportResult(null);

      try {
        // Create file object for upload
        let fileToUpload: File;

        if (Platform.OS === 'web') {
          // On web, fetch the URI and create File object
          const response = await fetch(file.uri);
          const blob = await response.blob();
          fileToUpload = new File([blob], file.name, { type: file.mimeType || '' });
        } else {
          // On mobile, create FormData compatible object
          fileToUpload = {
            uri: file.uri,
            name: file.name,
            type: file.mimeType || 'application/octet-stream',
          } as any;
        }

        setImportProgress(0.3);

        // Upload and import to QuestionBank
        const result = await apiService.importQuestions(fileToUpload);

        setImportProgress(1.0);
        setImportResult(result);

        // Reload questions from QuestionBank
        await loadQuestions();

        // Show success with details
        Alert.alert(
          'Import Successful! 🎉',
          `✅ Created: ${result.created} questions\n✅ Updated: ${result.updated} questions${
            result.errors && result.errors.length > 0
              ? `\n⚠️  Errors: ${result.errors.length}`
              : ''
          }`,
          [{ text: 'OK', onPress: () => {
            setImporting(false);
            setImportResult(null);
            setShowImportExportDialog(false);
          } }]
        );

      } catch (error: any) {
        console.error('Error importing questions:', error);

        let errorMessage = 'Failed to import questions to Question Bank';
        const details: string[] = [];

        if (error.details && Array.isArray(error.details)) {
          details.push(...error.details.slice(0, 10));
          if (error.details.length > 10) {
            details.push(`... and ${error.details.length - 10} more errors`);
          }
        } else if (error.error) {
          details.push(error.error);
        }

        setImportResult({
          created: 0,
          updated: 0,
          errors: details,
          error: true,
        });

        Alert.alert('Import Failed', errorMessage + '\n\n' + details.join('\n'));
      } finally {
        setImporting(false);
        setImportProgress(0);
      }

    } catch (error: any) {
      console.error('Error in import handler:', error);
      if (error.message !== 'User cancelled document picker') {
        Alert.alert('Error', 'Failed to select file');
      }
    }
  };

  const addOption = () => {
    if (optionInput.trim()) {
      setNewQuestion({
        ...newQuestion,
        options: [...(newQuestion.options || []), optionInput.trim()],
      });
      setOptionInput('');
    }
  };

  const removeOption = (index: number) => {
    const updatedOptions = [...(newQuestion.options || [])];
    updatedOptions.splice(index, 1);
    setNewQuestion({ ...newQuestion, options: updatedOptions });
  };

  const getResponseTypeDisplay = (type: ResponseType) => {
    const typeInfo = responseTypes.find((rt) => rt.value === type);
    return typeInfo?.display_name || type;
  };

  const renderQuestionItem = (question: Question, index: number) => {
    const getCategoryDisplay = (category: string) => {
      const cat = questionBankChoices.categories?.find((c: any) => c.value === category);
      return cat?.label || category;
    };

    const getDataSourceDisplay = (source: string) => {
      const src = questionBankChoices.data_sources?.find((s: any) => s.value === source);
      return src?.label || source;
    };

    return (
      <TouchableOpacity key={question.id} style={styles.questionCardWrapper} activeOpacity={0.95}>
        <View style={styles.questionCard}>
          <View style={styles.cardOverlay} />
          <View style={styles.questionContent}>
            <View style={styles.questionHeader}>
              <View style={styles.questionHeaderLeft}>
                <View style={styles.modernChip}>
                  <Text style={styles.modernChipText}>{index + 1}</Text>
                </View>
                <View style={styles.typeChipModern}>
                  <Text style={styles.typeChipText}>
                    {getResponseTypeDisplay(question.response_type)}
                  </Text>
                </View>
                {question.question_category && (
                  <View style={styles.categoryChipDisplay}>
                    <Text style={styles.categoryChipDisplayText}>
                      {getCategoryDisplay(question.question_category)}
                    </Text>
                  </View>
                )}
                {question.priority_score && question.priority_score >= 7 && (
                  <View style={styles.priorityChip}>
                    <Text style={styles.priorityChipText}>
                      ⭐ {question.priority_score}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.questionActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenEditDialog(question)}
                >
                  <IconButton
                    icon="pencil"
                    size={18}
                    iconColor="#ffffff"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDuplicateQuestion(question.id)}
                >
                  <IconButton
                    icon="content-copy"
                    size={18}
                    iconColor="#ffffff"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteQuestion(question.id)}
                >
                  <IconButton
                    icon="delete"
                    size={18}
                    iconColor="#ffffff"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Text variant="bodyLarge" style={styles.questionText}>
              {question.question_text}
            </Text>

            {/* QuestionBank Metadata */}
            <View style={styles.questionMetaRow}>
              {question.data_source && question.data_source !== 'internal' && (
                <View style={styles.dataSourceBadge}>
                  <Text style={styles.dataSourceBadgeText}>
                    🤝 {getDataSourceDisplay(question.data_source)}
                  </Text>
                </View>
              )}
              {question.work_package && (
                <View style={styles.workPackageBadge}>
                  <Text style={styles.workPackageBadgeText}>
                    📦 {question.work_package}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.questionMeta}>
              {question.is_required && (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Required</Text>
                </View>
              )}
              {question.allow_multiple && (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>Multiple</Text>
                </View>
              )}
              {question.options && question.options.length > 0 && (
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>{question.options.length} options</Text>
                </View>
              )}
            </View>

            {/* Targeted Information */}
            {((question.targeted_respondents?.length ?? 0) > 0 || 
              (question.targeted_commodities?.length ?? 0) > 0 || 
              (question.targeted_countries?.length ?? 0) > 0) && (
              <View style={styles.targetedInfoSection}>
                {question.targeted_respondents && question.targeted_respondents.length > 0 && (
                  <View style={styles.targetedRow}>
                    <Text style={styles.targetedLabel}>👥 Respondents:</Text>
                    <Text style={styles.targetedValue} numberOfLines={1}>
                      {question.targeted_respondents.slice(0, 2).join(', ')}
                      {question.targeted_respondents.length > 2 && ` +${question.targeted_respondents.length - 2}`}
                    </Text>
                  </View>
                )}
                {question.targeted_commodities && question.targeted_commodities.length > 0 && (
                  <View style={styles.targetedRow}>
                    <Text style={styles.targetedLabel}>🌾 Commodities:</Text>
                    <Text style={styles.targetedValue} numberOfLines={1}>
                      {question.targeted_commodities.slice(0, 3).join(', ')}
                      {question.targeted_commodities.length > 3 && ` +${question.targeted_commodities.length - 3}`}
                    </Text>
                  </View>
                )}
                {question.targeted_countries && question.targeted_countries.length > 0 && (
                  <View style={styles.targetedRow}>
                    <Text style={styles.targetedLabel}>🌍 Countries:</Text>
                    <Text style={styles.targetedValue} numberOfLines={1}>
                      {question.targeted_countries.slice(0, 3).join(', ')}
                      {question.targeted_countries.length > 3 && ` +${question.targeted_countries.length - 3}`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {question.options && question.options.length > 0 && (
              <View style={styles.optionsPreview}>
                {question.options.slice(0, 3).map((option, idx) => (
                  <Text key={idx} variant="bodySmall" style={styles.optionText}>
                    • {option}
                  </Text>
                ))}
                {question.options.length > 3 && (
                  <Text variant="bodySmall" style={styles.moreOptions}>
                    +{question.options.length - 3} more
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAddDialog = () => {
    const currentCategory = RESPONSE_TYPE_CATEGORIES.find((cat) => cat.label === selectedCategory);
    const requiresOptions = ['choice_single', 'choice_multiple'].includes(newQuestion.response_type);

    return (
      <Portal>
        <Dialog
          visible={showAddDialog}
          onDismiss={() => setShowAddDialog(false)}
          style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Add New Question</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogInner}>
                <TextInput
                  label="Question Text *"
                  value={newQuestion.question_text}
                  onChangeText={(text) => setNewQuestion({ ...newQuestion, question_text: text })}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  style={styles.input}
                  textColor="#ffffff"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />

                <Text variant="labelLarge" style={styles.label}>
                  Question Category *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {questionBankChoices.categories && questionBankChoices.categories.map((cat: any) => (
                    <Chip
                      key={cat.value}
                      selected={newQuestion.question_category === cat.value}
                      onPress={() => setNewQuestion({ ...newQuestion, question_category: cat.value })}
                      style={[
                        styles.categoryChip,
                        newQuestion.question_category === cat.value && styles.selectedCategoryChip
                      ]}
                      textStyle={styles.categoryChipText}>
                      {cat.label}
                    </Chip>
                  ))}
                </ScrollView>

                <Text variant="labelLarge" style={styles.label}>
                  Data Source
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {questionBankChoices.data_sources && questionBankChoices.data_sources.map((source: any) => (
                    <Chip
                      key={source.value}
                      selected={newQuestion.data_source === source.value}
                      onPress={() => setNewQuestion({ ...newQuestion, data_source: source.value })}
                      style={[
                        styles.categoryChip,
                        newQuestion.data_source === source.value && styles.selectedCategoryChip
                      ]}
                      textStyle={styles.categoryChipText}>
                      {source.label}
                    </Chip>
                  ))}
                </ScrollView>

                {newQuestion.data_source !== 'internal' && (
                  <View style={styles.partnerSelectionSection}>
                    <TextInput
                      label="Research Partner Name"
                      value={newQuestion.research_partner_name}
                      onChangeText={(text) => setNewQuestion({ ...newQuestion, research_partner_name: text })}
                      mode="outlined"
                      style={styles.input}
                      textColor="#ffffff"
                      theme={{
                        colors: {
                          primary: '#64c8ff',
                          onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                          outline: 'rgba(100, 200, 255, 0.5)',
                        },
                      }}
                    />
                    <TextInput
                      label="Partner Contact Email"
                      value={newQuestion.research_partner_contact}
                      onChangeText={(text) => setNewQuestion({ ...newQuestion, research_partner_contact: text })}
                      mode="outlined"
                      keyboardType="email-address"
                      style={styles.input}
                      textColor="#ffffff"
                      theme={{
                        colors: {
                          primary: '#64c8ff',
                          onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                          outline: 'rgba(100, 200, 255, 0.5)',
                        },
                      }}
                    />
                  </View>
                )}

                <TextInput
                  label="Work Package (Optional)"
                  value={newQuestion.work_package}
                  onChangeText={(text) => setNewQuestion({ ...newQuestion, work_package: text })}
                  mode="outlined"
                  placeholder="e.g., WP1, WP2"
                  style={styles.input}
                  textColor="#ffffff"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />

                <Text variant="labelLarge" style={styles.label}>
                  Response Type
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {RESPONSE_TYPE_CATEGORIES.map((category) => (
                    <Chip
                      key={category.label}
                      selected={selectedCategory === category.label}
                      onPress={() => setSelectedCategory(category.label)}
                      style={[
                        styles.categoryChip,
                        selectedCategory === category.label && styles.selectedCategoryChip
                      ]}
                      icon={category.icon}
                      textStyle={styles.categoryChipText}>
                      {category.label}
                    </Chip>
                  ))}
                </ScrollView>

                {currentCategory && (
                  <View style={styles.typeButtons}>
                    {currentCategory.types.map((type) => (
                      <Button
                        key={type}
                        mode={newQuestion.response_type === type ? 'contained' : 'outlined'}
                        onPress={() =>
                          setNewQuestion({ ...newQuestion, response_type: type as ResponseType })
                        }
                        style={[
                          styles.typeButton,
                          newQuestion.response_type === type && styles.selectedTypeButton
                        ]}
                        labelStyle={styles.typeButtonLabel}>
                        {getResponseTypeDisplay(type as ResponseType)}
                      </Button>
                    ))}
                  </View>
                )}

                {requiresOptions && (
                  <View style={styles.optionsSection}>
                    <Text variant="labelLarge" style={styles.label}>
                      Options *
                    </Text>
                    <View style={styles.optionInputRow}>
                      <TextInput
                        value={optionInput}
                        onChangeText={setOptionInput}
                        placeholder="Enter option"
                        mode="outlined"
                        style={styles.optionInput}
                        onSubmitEditing={addOption}
                        textColor="#ffffff"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        theme={{
                          colors: {
                            primary: '#64c8ff',
                            onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                            outline: 'rgba(100, 200, 255, 0.5)',
                          },
                        }}
                      />
                      <Button mode="contained" onPress={addOption} style={styles.addOptionButton}>
                        Add
                      </Button>
                    </View>
                    <View style={styles.optionsList}>
                      {newQuestion.options?.map((option: string, index: number) => (
                        <Chip
                          key={index}
                          onClose={() => removeOption(index)}
                          style={styles.optionChip}
                          textStyle={styles.optionChipText}>
                          {option}
                        </Chip>
                      ))}
                    </View>
                  </View>
                )}

                <Divider style={styles.dividerInDialog} />

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Targeted Respondents *
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Select respondent types this question targets
                  </Text>
                  <ScrollView style={{ maxHeight: 150 }}>
                    <View style={styles.respondentChipsContainer}>
                      {questionBankChoices.respondent_types && questionBankChoices.respondent_types.map((respondent: any) => (
                        <Chip
                          key={respondent.value}
                          selected={selectedTargetedRespondents.includes(respondent.value)}
                          onPress={() => {
                            setSelectedTargetedRespondents(prev =>
                              prev.includes(respondent.value)
                                ? prev.filter(r => r !== respondent.value)
                                : [...prev, respondent.value]
                            );
                          }}
                          style={[
                            styles.respondentChip,
                            selectedTargetedRespondents.includes(respondent.value) && styles.selectedRespondentChip
                          ]}
                          textStyle={styles.respondentChipText}>
                          {respondent.label}
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Targeted Commodities *
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Select commodities this question applies to
                  </Text>
                  <View style={styles.respondentChipsContainer}>
                    {questionBankChoices.commodities && questionBankChoices.commodities.map((commodity: any) => (
                      <Chip
                        key={commodity.value}
                        selected={selectedCommodities.includes(commodity.value)}
                        onPress={() => {
                          setSelectedCommodities(prev =>
                            prev.includes(commodity.value)
                              ? prev.filter(c => c !== commodity.value)
                              : [...prev, commodity.value]
                          );
                        }}
                        style={[
                          styles.respondentChip,
                          selectedCommodities.includes(commodity.value) && styles.selectedRespondentChip
                        ]}
                        textStyle={styles.respondentChipText}>
                        {commodity.label}
                      </Chip>
                    ))}
                  </View>
                </View>

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Targeted Countries *
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Select countries this question applies to
                  </Text>
                  <ScrollView style={{ maxHeight: 120 }}>
                    <View style={styles.respondentChipsContainer}>
                      {COUNTRY_OPTIONS.map((country) => (
                        <Chip
                          key={country}
                          selected={selectedCountries.includes(country)}
                          onPress={() => {
                            setSelectedCountries(prev =>
                              prev.includes(country)
                                ? prev.filter(c => c !== country)
                                : [...prev, country]
                            );
                          }}
                          style={[
                            styles.respondentChip,
                            selectedCountries.includes(country) && styles.selectedRespondentChip
                          ]}
                          textStyle={styles.respondentChipText}>
                          {country}
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Priority Score (1-10)
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Higher priority questions are selected first (10 = highest)
                  </Text>
                  <View style={styles.respondentChipsContainer}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                      <Chip
                        key={score}
                        selected={newQuestion.priority_score === score}
                        onPress={() => setNewQuestion({ ...newQuestion, priority_score: score })}
                        style={[
                          styles.respondentChip,
                          newQuestion.priority_score === score && styles.selectedRespondentChip
                        ]}
                        textStyle={styles.respondentChipText}>
                        {score}
                      </Chip>
                    ))}
                  </View>
                </View>

                <Divider style={styles.dividerInDialog} />

                {/* Conditional Logic Section */}
                <View style={styles.respondentsSection}>
                  <View style={styles.switchRow}>
                    <Text variant="labelLarge" style={styles.label}>Make this a follow-up question</Text>
                    <Switch
                      value={isFollowUp}
                      onValueChange={(value) => {
                        setIsFollowUp(value);
                        if (!value) {
                          setParentQuestionId('');
                          setConditionOperator('equals');
                          setConditionValue('');
                        }
                      }}
                      thumbColor={isFollowUp ? '#64c8ff' : '#ccc'}
                      trackColor={{ false: '#767577', true: 'rgba(100, 200, 255, 0.5)' }}
                    />
                  </View>
                  {isFollowUp && (
                    <View style={styles.conditionalLogicContainer}>
                      <Text variant="bodySmall" style={styles.labelHint}>
                        This question will only appear if the parent question meets the condition
                      </Text>

                      <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>
                        Parent Question *
                      </Text>
                      <ScrollView style={{ maxHeight: 120, marginTop: 8 }}>
                        <View style={styles.respondentChipsContainer}>
                          {questions
                            .filter(q => q.id !== editingQuestion?.id) // Don't show current question
                            .map((question) => (
                              <Chip
                                key={question.id}
                                selected={parentQuestionId === question.id}
                                onPress={() => setParentQuestionId(question.id)}
                                style={[
                                  styles.parentQuestionChip,
                                  parentQuestionId === question.id && styles.selectedRespondentChip
                                ]}
                                textStyle={styles.respondentChipText}>
                                {question.question_text.substring(0, 50)}
                                {question.question_text.length > 50 ? '...' : ''}
                              </Chip>
                            ))}
                        </View>
                      </ScrollView>

                      <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>
                        Condition Operator *
                      </Text>
                      <View style={styles.respondentChipsContainer}>
                        {[
                          { value: 'equals', label: 'Equals' },
                          { value: 'not_equals', label: 'Not Equals' },
                          { value: 'contains', label: 'Contains' },
                          { value: 'not_contains', label: 'Not Contains' },
                          { value: 'greater_than', label: '>' },
                          { value: 'less_than', label: '<' },
                          { value: 'greater_or_equal', label: '>=' },
                          { value: 'less_or_equal', label: '<=' },
                          { value: 'in', label: 'In List' },
                          { value: 'not_in', label: 'Not In List' },
                          { value: 'is_empty', label: 'Is Empty' },
                          { value: 'is_not_empty', label: 'Is Not Empty' },
                        ].map((op) => (
                          <Chip
                            key={op.value}
                            selected={conditionOperator === op.value}
                            onPress={() => setConditionOperator(op.value)}
                            style={[
                              styles.respondentChip,
                              conditionOperator === op.value && styles.selectedRespondentChip
                            ]}
                            textStyle={styles.respondentChipText}>
                            {op.label}
                          </Chip>
                        ))}
                      </View>

                      <TextInput
                        label="Condition Value *"
                        value={conditionValue}
                        onChangeText={setConditionValue}
                        mode="outlined"
                        placeholder="Enter the value to match"
                        style={[styles.input, { marginTop: 12 }]}
                      />
                    </View>
                  )}
                </View>

                <Divider style={styles.dividerInDialog} />

                <View style={styles.switchRow}>
                  <Text variant="bodyMedium" style={styles.switchLabel}>Required Question</Text>
                  <Switch
                    value={newQuestion.is_required}
                    onValueChange={(value) => setNewQuestion({ ...newQuestion, is_required: value })}
                    thumbColor={newQuestion.is_required ? '#64c8ff' : '#ccc'}
                    trackColor={{ false: '#767577', true: 'rgba(100, 200, 255, 0.5)' }}
                  />
                </View>

                {requiresOptions && (
                  <View style={styles.switchRow}>
                    <Text variant="bodyMedium" style={styles.switchLabel}>Allow Multiple Answers</Text>
                    <Switch
                      value={newQuestion.allow_multiple}
                      onValueChange={(value) =>
                        setNewQuestion({ ...newQuestion, allow_multiple: value })
                      }
                      thumbColor={newQuestion.allow_multiple ? '#64c8ff' : '#ccc'}
                      trackColor={{ false: '#767577', true: 'rgba(100, 200, 255, 0.5)' }}
                    />
                  </View>
                )}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => setShowAddDialog(false)} 
              disabled={saving}
              style={styles.cancelButton}
              labelStyle={styles.cancelButtonLabel}>
              Cancel
            </Button>
            <Button 
              onPress={handleAddQuestion} 
              loading={saving} 
              disabled={saving}
              style={styles.addButton}
              labelStyle={styles.addButtonLabel}>
              Add Question
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading form...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text variant="headlineSmall" style={styles.title}>
              Question Bank
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Your reusable question templates
            </Text>
          </View>
          <View style={styles.questionCountContainer}>
            <Text variant="titleMedium" style={styles.questionCount}>
              {questions.length}
            </Text>
            <Text variant="bodySmall" style={styles.questionCountLabel}>
              question{questions.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerDecoration} />
      </View>

      {/* Collapsible Search and Filter Bar */}
      <View style={styles.searchFilterContainer}>
        {/* Filter Toggle Bar */}
        <TouchableOpacity 
          style={styles.filterToggle}
          onPress={() => setIsFilterExpanded(!isFilterExpanded)}
          activeOpacity={0.7}>
          <View style={styles.filterToggleLeft}>
            <IconButton
              icon={isFilterExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              iconColor="#64c8ff"
            />
            <Text style={styles.filterToggleText}>
              {isFilterExpanded ? 'Hide Filters' : 'Show Filters & Search'}
            </Text>
          </View>
          {hasActiveFilters && (
            <View style={styles.activeFilterBadge}>
              <Text style={styles.activeFilterBadgeText}>
                {(selectedCategoryFilters.length + selectedRespondentFilters.length + (searchQuery ? 1 : 0))}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Collapsible Filter Content */}
        {isFilterExpanded && (
          <View style={styles.filterContent}>
            <TextInput
              placeholder="Search questions..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              mode="outlined"
              left={<TextInput.Icon icon="magnify" />}
              right={searchQuery ? <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} /> : undefined}
              style={styles.searchBar}
              textColor="#ffffff"
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              theme={{
                colors: {
                  primary: '#64c8ff',
                  onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                  outline: 'rgba(100, 200, 255, 0.5)',
                },
              }}
            />

            {/* Category Filters - Multi-Select */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>
                Categories {selectedCategoryFilters.length > 0 && `(${selectedCategoryFilters.length})`}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsContainer}>
                {questionBankChoices.categories && questionBankChoices.categories.map((cat: any) => (
                  <Chip
                    key={cat.value}
                    selected={selectedCategoryFilters.includes(cat.value)}
                    onPress={() => toggleCategoryFilter(cat.value)}
                    style={[
                      styles.filterChip, 
                      selectedCategoryFilters.includes(cat.value) && styles.selectedFilterChip
                    ]}
                    textStyle={styles.filterChipText}>
                    {cat.label}
                  </Chip>
                ))}
              </ScrollView>
            </View>

            {/* Respondent Filters - Multi-Select */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>
                Respondent Types {selectedRespondentFilters.length > 0 && `(${selectedRespondentFilters.length})`}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsContainer}>
                {questionBankChoices.respondent_types && questionBankChoices.respondent_types.map((resp: any) => (
                  <Chip
                    key={resp.value}
                    selected={selectedRespondentFilters.includes(resp.value)}
                    onPress={() => toggleRespondentFilter(resp.value)}
                    style={[
                      styles.filterChip, 
                      selectedRespondentFilters.includes(resp.value) && styles.selectedFilterChip
                    ]}
                    textStyle={styles.filterChipText}>
                    {resp.label}
                  </Chip>
                ))}
              </ScrollView>
            </View>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <View style={styles.activeFiltersContainer}>
                <Text style={styles.activeFiltersText}>
                  Showing {filteredQuestions.length} of {questions.length} questions
                </Text>
                <TouchableOpacity onPress={clearAllFilters}>
                  <Text style={styles.clearFiltersText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Compact Active Filters Display when collapsed */}
        {!isFilterExpanded && hasActiveFilters && (
          <View style={styles.compactFiltersDisplay}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              {searchQuery && (
                <Chip
                  style={styles.compactFilterChip}
                  textStyle={styles.compactFilterText}
                  onClose={() => setSearchQuery('')}>
                  🔍 "{searchQuery.substring(0, 20)}{searchQuery.length > 20 ? '...' : ''}"
                </Chip>
              )}
              {selectedCategoryFilters.map(cat => (
                <Chip
                  key={cat}
                  style={styles.compactFilterChip}
                  textStyle={styles.compactFilterText}
                  onClose={() => toggleCategoryFilter(cat)}>
                  {questionBankChoices.categories?.find((c: any) => c.value === cat)?.label || cat}
                </Chip>
              ))}
              {selectedRespondentFilters.map(resp => (
                <Chip
                  key={resp}
                  style={styles.compactFilterChip}
                  textStyle={styles.compactFilterText}
                  onClose={() => toggleRespondentFilter(resp)}>
                  {questionBankChoices.respondent_types?.find((r: any) => r.value === resp)?.label || resp}
                </Chip>
              ))}
            </ScrollView>
            <Text style={styles.compactResultsText}>
              {filteredQuestions.length}/{questions.length}
            </Text>
          </View>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4b1e85"
            colors={["#4b1e85"]}
          />
        }>
        {filteredQuestions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>
                {questions.length === 0 ? '📝' : '🔍'}
              </Text>
            </View>
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              {questions.length === 0 
                ? 'No Questions in Your Bank'
                : 'No Questions Match Filters'}
            </Text>
            <Text variant="bodyLarge" style={styles.emptySubtitle}>
              {questions.length === 0
                ? 'Start building your question library by adding reusable templates'
                : 'Try adjusting your search or filter criteria'}
            </Text>
          </View>
        ) : (
          <View style={styles.questionsList}>
            {filteredQuestions.map((question, index) => renderQuestionItem(question, index))}
          </View>
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
        <FAB
          icon="delete-sweep"
          label="Delete All"
          style={[styles.fab, styles.fabDelete]}
          onPress={handleDeleteAllQuestionBank}
          theme={{
            colors: {
              onPrimary: '#ffffff',
            },
          }}
        />
        <FAB
          icon="upload"
          label="Import/Export"
          style={[styles.fab, styles.fabImport]}
          onPress={() => setShowImportExportDialog(true)}
          theme={{
            colors: {
              onPrimary: '#ffffff',
            },
          }}
        />
        <FAB
          icon="plus"
          label="Add Question"
          style={styles.fab}
          onPress={() => setShowAddDialog(true)}
          theme={{
            colors: {
              onPrimary: '#ffffff',
            },
          }}
        />
      </View>

      {renderAddDialog()}

      {/* Edit Question Dialog - Full QuestionBank Structure */}
      <Portal>
        <Dialog
          visible={showEditDialog}
          onDismiss={() => setShowEditDialog(false)}
          style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Edit Question</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogInner}>
                <TextInput
                  label="Question Text *"
                  value={newQuestion.question_text}
                  onChangeText={(text) => setNewQuestion({ ...newQuestion, question_text: text })}
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  style={styles.input}
                  textColor="#ffffff"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />

                <Text variant="labelLarge" style={styles.label}>
                  Question Category *
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {questionBankChoices.categories && questionBankChoices.categories.map((cat: any) => (
                    <Chip
                      key={cat.value}
                      selected={newQuestion.question_category === cat.value}
                      onPress={() => setNewQuestion({ ...newQuestion, question_category: cat.value })}
                      style={[
                        styles.categoryChip,
                        newQuestion.question_category === cat.value && styles.selectedCategoryChip
                      ]}
                      textStyle={styles.categoryChipText}>
                      {cat.label}
                    </Chip>
                  ))}
                </ScrollView>

                <Text variant="labelLarge" style={styles.label}>
                  Data Source
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {questionBankChoices.data_sources && questionBankChoices.data_sources.map((source: any) => (
                    <Chip
                      key={source.value}
                      selected={newQuestion.data_source === source.value}
                      onPress={() => setNewQuestion({ ...newQuestion, data_source: source.value })}
                      style={[
                        styles.categoryChip,
                        newQuestion.data_source === source.value && styles.selectedCategoryChip
                      ]}
                      textStyle={styles.categoryChipText}>
                      {source.label}
                    </Chip>
                  ))}
                </ScrollView>

                {newQuestion.data_source !== 'internal' && (
                  <View style={styles.partnerSelectionSection}>
                    <TextInput
                      label="Research Partner Name"
                      value={newQuestion.research_partner_name}
                      onChangeText={(text) => setNewQuestion({ ...newQuestion, research_partner_name: text })}
                      mode="outlined"
                      style={styles.input}
                      textColor="#ffffff"
                      theme={{
                        colors: {
                          primary: '#64c8ff',
                          onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                          outline: 'rgba(100, 200, 255, 0.5)',
                        },
                      }}
                    />
                    <TextInput
                      label="Partner Contact Email"
                      value={newQuestion.research_partner_contact}
                      onChangeText={(text) => setNewQuestion({ ...newQuestion, research_partner_contact: text })}
                      mode="outlined"
                      keyboardType="email-address"
                      style={styles.input}
                      textColor="#ffffff"
                      theme={{
                        colors: {
                          primary: '#64c8ff',
                          onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                          outline: 'rgba(100, 200, 255, 0.5)',
                        },
                      }}
                    />
                  </View>
                )}

                <TextInput
                  label="Work Package (Optional)"
                  value={newQuestion.work_package}
                  onChangeText={(text) => setNewQuestion({ ...newQuestion, work_package: text })}
                  mode="outlined"
                  placeholder="e.g., WP1, WP2"
                  style={styles.input}
                  textColor="#ffffff"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  theme={{
                    colors: {
                      primary: '#64c8ff',
                      onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                      outline: 'rgba(100, 200, 255, 0.5)',
                    },
                  }}
                />

                <Text variant="labelLarge" style={styles.label}>
                  Response Type
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {RESPONSE_TYPE_CATEGORIES.map((category) => (
                    <Chip
                      key={category.label}
                      selected={selectedCategory === category.label}
                      onPress={() => setSelectedCategory(category.label)}
                      style={[
                        styles.categoryChip,
                        selectedCategory === category.label && styles.selectedCategoryChip
                      ]}
                      icon={category.icon}
                      textStyle={styles.categoryChipText}>
                      {category.label}
                    </Chip>
                  ))}
                </ScrollView>

                {RESPONSE_TYPE_CATEGORIES.find((cat) => cat.label === selectedCategory) && (
                  <View style={styles.typeButtons}>
                    {RESPONSE_TYPE_CATEGORIES.find((cat) => cat.label === selectedCategory)!.types.map((type) => (
                      <Button
                        key={type}
                        mode={newQuestion.response_type === type ? 'contained' : 'outlined'}
                        onPress={() =>
                          setNewQuestion({ ...newQuestion, response_type: type as ResponseType })
                        }
                        style={[
                          styles.typeButton,
                          newQuestion.response_type === type && styles.selectedTypeButton
                        ]}
                        labelStyle={styles.typeButtonLabel}>
                        {getResponseTypeDisplay(type as ResponseType)}
                      </Button>
                    ))}
                  </View>
                )}

                {['choice_single', 'choice_multiple'].includes(newQuestion.response_type) && (
                  <View style={styles.optionsSection}>
                    <Text variant="labelLarge" style={styles.label}>
                      Options *
                    </Text>
                    <View style={styles.optionInputRow}>
                      <TextInput
                        value={optionInput}
                        onChangeText={setOptionInput}
                        placeholder="Enter option"
                        mode="outlined"
                        style={styles.optionInput}
                        onSubmitEditing={addOption}
                        textColor="#ffffff"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        theme={{
                          colors: {
                            primary: '#64c8ff',
                            onSurfaceVariant: 'rgba(255, 255, 255, 0.7)',
                            outline: 'rgba(100, 200, 255, 0.5)',
                          },
                        }}
                      />
                      <Button mode="contained" onPress={addOption} style={styles.addOptionButton}>
                        Add
                      </Button>
                    </View>
                    <View style={styles.optionsList}>
                      {newQuestion.options?.map((option: string, index: number) => (
                        <Chip
                          key={index}
                          onClose={() => removeOption(index)}
                          style={styles.optionChip}
                          textStyle={styles.optionChipText}>
                          {option}
                        </Chip>
                      ))}
                    </View>
                  </View>
                )}

                <Divider style={styles.dividerInDialog} />

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Targeted Respondents *
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Select respondent types this question targets
                  </Text>
                  <ScrollView style={{ maxHeight: 150 }}>
                    <View style={styles.respondentChipsContainer}>
                      {questionBankChoices.respondent_types && questionBankChoices.respondent_types.map((respondent: any) => (
                        <Chip
                          key={respondent.value}
                          selected={selectedTargetedRespondents.includes(respondent.value)}
                          onPress={() => {
                            setSelectedTargetedRespondents(prev =>
                              prev.includes(respondent.value)
                                ? prev.filter(r => r !== respondent.value)
                                : [...prev, respondent.value]
                            );
                          }}
                          style={[
                            styles.respondentChip,
                            selectedTargetedRespondents.includes(respondent.value) && styles.selectedRespondentChip
                          ]}
                          textStyle={styles.respondentChipText}>
                          {respondent.label}
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Targeted Commodities *
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Select commodities this question applies to
                  </Text>
                  <View style={styles.respondentChipsContainer}>
                    {questionBankChoices.commodities && questionBankChoices.commodities.map((commodity: any) => (
                      <Chip
                        key={commodity.value}
                        selected={selectedCommodities.includes(commodity.value)}
                        onPress={() => {
                          setSelectedCommodities(prev =>
                            prev.includes(commodity.value)
                              ? prev.filter(c => c !== commodity.value)
                              : [...prev, commodity.value]
                          );
                        }}
                        style={[
                          styles.respondentChip,
                          selectedCommodities.includes(commodity.value) && styles.selectedRespondentChip
                        ]}
                        textStyle={styles.respondentChipText}>
                        {commodity.label}
                      </Chip>
                    ))}
                  </View>
                </View>

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Targeted Countries *
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Select countries this question applies to
                  </Text>
                  <ScrollView style={{ maxHeight: 120 }}>
                    <View style={styles.respondentChipsContainer}>
                      {COUNTRY_OPTIONS.map((country) => (
                        <Chip
                          key={country}
                          selected={selectedCountries.includes(country)}
                          onPress={() => {
                            setSelectedCountries(prev =>
                              prev.includes(country)
                                ? prev.filter(c => c !== country)
                                : [...prev, country]
                            );
                          }}
                          style={[
                            styles.respondentChip,
                            selectedCountries.includes(country) && styles.selectedRespondentChip
                          ]}
                          textStyle={styles.respondentChipText}>
                          {country}
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Priority Score (1-10)
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Higher priority questions are selected first (10 = highest)
                  </Text>
                  <View style={styles.respondentChipsContainer}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                      <Chip
                        key={score}
                        selected={newQuestion.priority_score === score}
                        onPress={() => setNewQuestion({ ...newQuestion, priority_score: score })}
                        style={[
                          styles.respondentChip,
                          newQuestion.priority_score === score && styles.selectedRespondentChip
                        ]}
                        textStyle={styles.respondentChipText}>
                        {score}
                      </Chip>
                    ))}
                  </View>
                </View>

                <Divider style={styles.dividerInDialog} />

                {/* Conditional Logic Section */}
                <View style={styles.respondentsSection}>
                  <View style={styles.switchRow}>
                    <Text variant="labelLarge" style={styles.label}>Make this a follow-up question</Text>
                    <Switch
                      value={isFollowUp}
                      onValueChange={(value) => {
                        setIsFollowUp(value);
                        if (!value) {
                          setParentQuestionId('');
                          setConditionOperator('equals');
                          setConditionValue('');
                        }
                      }}
                      thumbColor={isFollowUp ? '#64c8ff' : '#ccc'}
                      trackColor={{ false: '#767577', true: 'rgba(100, 200, 255, 0.5)' }}
                    />
                  </View>
                  {isFollowUp && (
                    <View style={styles.conditionalLogicContainer}>
                      <Text variant="bodySmall" style={styles.labelHint}>
                        This question will only appear if the parent question meets the condition
                      </Text>

                      <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>
                        Parent Question *
                      </Text>
                      <ScrollView style={{ maxHeight: 120, marginTop: 8 }}>
                        <View style={styles.respondentChipsContainer}>
                          {questions
                            .filter(q => q.id !== editingQuestion?.id) // Don't show current question
                            .map((question) => (
                              <Chip
                                key={question.id}
                                selected={parentQuestionId === question.id}
                                onPress={() => setParentQuestionId(question.id)}
                                style={[
                                  styles.parentQuestionChip,
                                  parentQuestionId === question.id && styles.selectedRespondentChip
                                ]}
                                textStyle={styles.respondentChipText}>
                                {question.question_text.substring(0, 50)}
                                {question.question_text.length > 50 ? '...' : ''}
                              </Chip>
                            ))}
                        </View>
                      </ScrollView>

                      <Text variant="labelMedium" style={[styles.label, { marginTop: 12 }]}>
                        Condition Operator *
                      </Text>
                      <View style={styles.respondentChipsContainer}>
                        {[
                          { value: 'equals', label: 'Equals' },
                          { value: 'not_equals', label: 'Not Equals' },
                          { value: 'contains', label: 'Contains' },
                          { value: 'not_contains', label: 'Not Contains' },
                          { value: 'greater_than', label: '>' },
                          { value: 'less_than', label: '<' },
                          { value: 'greater_or_equal', label: '>=' },
                          { value: 'less_or_equal', label: '<=' },
                          { value: 'in', label: 'In List' },
                          { value: 'not_in', label: 'Not In List' },
                          { value: 'is_empty', label: 'Is Empty' },
                          { value: 'is_not_empty', label: 'Is Not Empty' },
                        ].map((op) => (
                          <Chip
                            key={op.value}
                            selected={conditionOperator === op.value}
                            onPress={() => setConditionOperator(op.value)}
                            style={[
                              styles.respondentChip,
                              conditionOperator === op.value && styles.selectedRespondentChip
                            ]}
                            textStyle={styles.respondentChipText}>
                            {op.label}
                          </Chip>
                        ))}
                      </View>

                      <TextInput
                        label="Condition Value *"
                        value={conditionValue}
                        onChangeText={setConditionValue}
                        mode="outlined"
                        placeholder="Enter the value to match"
                        style={[styles.input, { marginTop: 12 }]}
                      />
                    </View>
                  )}
                </View>

                <Divider style={styles.dividerInDialog} />

                <View style={styles.switchRow}>
                  <Text variant="bodyMedium" style={styles.switchLabel}>Required Question</Text>
                  <Switch
                    value={newQuestion.is_required}
                    onValueChange={(value) => setNewQuestion({ ...newQuestion, is_required: value })}
                    thumbColor={newQuestion.is_required ? '#64c8ff' : '#ccc'}
                    trackColor={{ false: '#767577', true: 'rgba(100, 200, 255, 0.5)' }}
                  />
                </View>

                {['choice_single', 'choice_multiple'].includes(newQuestion.response_type) && (
                  <View style={styles.switchRow}>
                    <Text variant="bodyMedium" style={styles.switchLabel}>Allow Multiple Answers</Text>
                    <Switch
                      value={newQuestion.allow_multiple}
                      onValueChange={(value) =>
                        setNewQuestion({ ...newQuestion, allow_multiple: value })
                      }
                      thumbColor={newQuestion.allow_multiple ? '#64c8ff' : '#ccc'}
                      trackColor={{ false: '#767577', true: 'rgba(100, 200, 255, 0.5)' }}
                    />
                  </View>
                )}
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={() => setShowEditDialog(false)}
              disabled={saving}
              style={styles.cancelButton}
              labelStyle={styles.cancelButtonLabel}>
              Cancel
            </Button>
            <Button
              onPress={handleUpdateQuestion}
              loading={saving}
              disabled={saving}
              style={styles.addButton}
              labelStyle={styles.addButtonLabel}>
              Update Question
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Import/Export Dialog with Glassmorphism */}
      <Modal
        visible={showImportExportDialog}
        transparent
        animationType="fade"
        onRequestClose={() => !importing && setShowImportExportDialog(false)}>
        <View style={styles.importModalOverlay}>
          <View style={styles.importModalContainer}>
            <View style={styles.importGlassCard}>
              {/* Header */}
              <View style={styles.importHeader}>
                <Text variant="headlineSmall" style={styles.importTitle}>
                  Import & Export Questions
                </Text>
                <IconButton
                  icon="close"
                  iconColor="#ffffff"
                  size={24}
                  disabled={importing}
                  onPress={() => setShowImportExportDialog(false)}
                />
              </View>

              <ScrollView style={styles.importContent} showsVerticalScrollIndicator={false}>
                {/* Download Templates Section */}
                <View style={styles.importSection}>
                  <View style={styles.sectionIconContainer}>
                    <Text style={styles.sectionIcon}>📥</Text>
                  </View>
                  <Text variant="titleMedium" style={styles.importSectionTitle}>
                    Download Template
                  </Text>
                  <Text variant="bodyMedium" style={styles.importSectionDescription}>
                    Download a template file to fill in your questions with all the required metadata.
                  </Text>

                  <View style={styles.templateButtonsContainer}>
                    <TouchableOpacity
                      style={styles.templateButton}
                      onPress={() => handleDownloadTemplate('csv')}
                      disabled={saving}>
                      <View style={styles.templateButtonIcon}>
                        <Text style={styles.templateButtonIconText}>📄</Text>
                      </View>
                      <Text variant="titleSmall" style={styles.templateButtonTitle}>
                        CSV Template
                      </Text>
                      <Text variant="bodySmall" style={styles.templateButtonDescription}>
                        Simple format, works everywhere
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.templateButton}
                      onPress={() => handleDownloadTemplate('excel')}
                      disabled={saving}>
                      <View style={styles.templateButtonIcon}>
                        <Text style={styles.templateButtonIconText}>📊</Text>
                      </View>
                      <Text variant="titleSmall" style={styles.templateButtonTitle}>
                        Excel Template
                      </Text>
                      <Text variant="bodySmall" style={styles.templateButtonDescription}>
                        Formatted with validation
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Divider style={styles.importDivider} />

                {/* Import Questions Section */}
                <View style={styles.importSection}>
                  <View style={styles.sectionIconContainer}>
                    <Text style={styles.sectionIcon}>📤</Text>
                  </View>
                  <Text variant="titleMedium" style={styles.importSectionTitle}>
                    Import Questions
                  </Text>
                  <Text variant="bodyMedium" style={styles.importSectionDescription}>
                    Upload your completed CSV or Excel file to add questions to your Question Bank.
                  </Text>

                  {importing ? (
                    <View style={styles.importProgressContainer}>
                      <ActivityIndicator size="large" color="#64c8ff" />
                      <Text variant="bodyMedium" style={styles.importProgressText}>
                        Importing questions...
                      </Text>
                      <ProgressBar
                        progress={importProgress}
                        color="#64c8ff"
                        style={styles.importProgressBar}
                      />
                    </View>
                  ) : importResult ? (
                    <View style={[
                      styles.importResultContainer,
                      importResult.error ? styles.importResultError : styles.importResultSuccess
                    ]}>
                      <Text style={styles.importResultIcon}>
                        {importResult.error ? '❌' : '✅'}
                      </Text>
                      <Text variant="titleMedium" style={styles.importResultTitle}>
                        {importResult.error ? 'Import Failed' : 'Import Successful!'}
                      </Text>
                      {!importResult.error && (
                        <>
                          <Text variant="bodyMedium" style={styles.importResultText}>
                            ✓ Created: {importResult.created} questions
                          </Text>
                          <Text variant="bodyMedium" style={styles.importResultText}>
                            ✓ Updated: {importResult.updated} questions
                          </Text>
                        </>
                      )}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <View style={styles.importErrorsContainer}>
                          <Text variant="bodySmall" style={styles.importErrorsTitle}>
                            ⚠️ Errors ({importResult.errors.length}):
                          </Text>
                          {importResult.errors.slice(0, 3).map((error: string, index: number) => (
                            <Text key={index} variant="bodySmall" style={styles.importErrorText}>
                              • {error}
                            </Text>
                          ))}
                          {importResult.errors.length > 3 && (
                            <Text variant="bodySmall" style={styles.importErrorText}>
                              ... and {importResult.errors.length - 3} more
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.importButton}
                    onPress={handleImportQuestions}
                    disabled={importing}>
                    <View style={styles.importButtonContent}>
                      <Text style={styles.importButtonIcon}>📂</Text>
                      <View style={styles.importButtonTextContainer}>
                        <Text variant="titleMedium" style={styles.importButtonTitle}>
                          Select File to Import
                        </Text>
                        <Text variant="bodySmall" style={styles.importButtonDescription}>
                          Supports CSV and Excel (.csv, .xlsx, .xls)
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Options Guide Section */}
                <View style={styles.optionsGuideSection}>
                  <Text variant="titleSmall" style={styles.optionsGuideTitle}>
                    📋 When to use the Options field:
                  </Text>
                  <View style={styles.optionsGuideTable}>
                    {/* Table Header */}
                    <View style={styles.optionsGuideRow}>
                      <Text style={[styles.optionsGuideCell, styles.optionsGuideHeaderCell, { flex: 2 }]}>
                        Response Type
                      </Text>
                      <Text style={[styles.optionsGuideCell, styles.optionsGuideHeaderCell, { flex: 1.5 }]}>
                        Options Required?
                      </Text>
                      <Text style={[styles.optionsGuideCell, styles.optionsGuideHeaderCell, { flex: 2 }]}>
                        Example
                      </Text>
                    </View>

                    {/* Table Rows */}
                    <View style={styles.optionsGuideRow}>
                      <Text style={[styles.optionsGuideCell, { flex: 2 }]}>choice_single</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 1.5, color: '#4ade80' }]}>✅ YES</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 2, fontSize: 10 }]}>Yes|No|Maybe</Text>
                    </View>

                    <View style={styles.optionsGuideRow}>
                      <Text style={[styles.optionsGuideCell, { flex: 2 }]}>choice_multiple</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 1.5, color: '#4ade80' }]}>✅ YES</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 2, fontSize: 10 }]}>Cocoa|Maize|Rice</Text>
                    </View>

                    <View style={styles.optionsGuideRow}>
                      <Text style={[styles.optionsGuideCell, { flex: 2 }]}>text_short</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 1.5, color: '#f87171' }]}>❌ NO</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 2, fontStyle: 'italic' }]}>Leave empty</Text>
                    </View>

                    <View style={styles.optionsGuideRow}>
                      <Text style={[styles.optionsGuideCell, { flex: 2 }]}>numeric_integer</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 1.5, color: '#f87171' }]}>❌ NO</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 2, fontStyle: 'italic' }]}>Leave empty</Text>
                    </View>

                    <View style={styles.optionsGuideRow}>
                      <Text style={[styles.optionsGuideCell, { flex: 2 }]}>date</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 1.5, color: '#f87171' }]}>❌ NO</Text>
                      <Text style={[styles.optionsGuideCell, { flex: 2, fontStyle: 'italic' }]}>Leave empty</Text>
                    </View>
                  </View>
                  <Text variant="bodySmall" style={styles.optionsGuideNote}>
                    💡 <Text style={styles.optionsGuideNoteBold}>Note:</Text> Use the pipe character (|) to separate multiple options.
                  </Text>
                </View>

                {/* Info Section */}
                <View style={styles.importInfoSection}>
                  <Text variant="bodySmall" style={styles.importInfoText}>
                    💡 <Text style={styles.importInfoTextBold}>Tip:</Text> Download a template first if you haven't created questions yet. The template includes all required fields and examples.
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f0f23',
  },
  loadingText: {
    marginTop: 16,
    color: '#ffffff',
  },
  // Header Styles
  header: {
    position: 'relative',
    backgroundColor: '#1a1a3a',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  headerDecoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#4b1e85',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontSize: 28,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    fontSize: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuContent: {
    backgroundColor: '#1a1a3a',
    borderRadius: 12,
    marginTop: 8,
  },
  questionCountContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.5)',
  },
  questionCount: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 24,
  },
  questionCountLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  questionsList: {
    padding: 16,
  },
  // Modern Question Card Styles
  questionCardWrapper: {
    marginBottom: 16,
  },
  questionCard: {
    position: 'relative',
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
  },
  questionContent: {
    padding: 20,
    zIndex: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernChip: {
    backgroundColor: 'rgba(75, 30, 133, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  modernChipText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  typeChipModern: {
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  typeChipText: {
    color: '#64c8ff',
    fontSize: 12,
    fontWeight: '600',
  },
  questionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: 'rgba(75, 30, 133, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(211, 47, 47, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    fontWeight: '500',
  },
  questionMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  metaChipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
  },
  optionsPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    fontSize: 14,
  },
  moreOptions: {
    color: '#64c8ff',
    fontStyle: 'italic',
    fontSize: 12,
  },
  // Empty State Styles
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    marginTop: 64,
  },
  emptyIconContainer: {
    backgroundColor: 'rgba(75, 30, 133, 0.2)',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(75, 30, 133, 0.4)',
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 24,
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  // FAB Styles
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 30,
  },
  fab: {
    backgroundColor: '#4b1e85',
    borderRadius: 28,
  },
  // Dialog Styles
  dialog: {
    maxHeight: '90%',
    backgroundColor: '#1a1a3a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  dialogTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  dialogContent: {
    paddingHorizontal: 0,
  },
  dialogInner: {
    padding: 20,
  },
  dialogActions: {
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 30, 133, 0.3)',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  label: {
    marginBottom: 8,
    marginTop: 8,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryScroll: {
    marginBottom: 16,
  },
  categoryChip: {
    marginRight: 8,
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.5)',
  },
  selectedCategoryChip: {
    backgroundColor: 'rgba(75, 30, 133, 0.8)',
  },
  categoryChipText: {
    color: '#ffffff',
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    minWidth: 120,
    backgroundColor: 'rgba(75, 30, 133, 0.2)',
    borderColor: 'rgba(75, 30, 133, 0.5)',
  },
  selectedTypeButton: {
    backgroundColor: '#4b1e85',
  },
  typeButtonLabel: {
    color: '#ffffff',
  },
  optionsSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  optionInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  optionInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  addOptionButton: {
    justifyContent: 'center',
    backgroundColor: '#4b1e85',
  },
  optionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    marginBottom: 4,
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  optionChipText: {
    color: '#64c8ff',
  },
  ownerChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.5)',
    marginLeft: 8,
  },
  partnerChip: {
    backgroundColor: 'rgba(255, 152, 0, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.5)',
    marginLeft: 8,
  },
  ownershipChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  partnerInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  partnerInfoText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontStyle: 'italic',
  },
  dividerInDialog: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  switchLabel: {
    color: '#ffffff',
  },
  switchLabelContainer: {
    flex: 1,
  },
  switchHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
  },
  labelHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 12,
  },
  partnerSelectionSection: {
    marginTop: 16,
  },
  partnerChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  partnerSelectChip: {
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.5)',
  },
  selectedPartnerChip: {
    backgroundColor: 'rgba(255, 152, 0, 0.5)',
    borderColor: 'rgba(255, 152, 0, 0.7)',
  },
  partnerSelectChipText: {
    color: '#ffffff',
  },
  respondentsSection: {
    marginTop: 16,
  },
  respondentChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  respondentChip: {
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.5)',
  },
  selectedRespondentChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.5)',
    borderColor: 'rgba(76, 175, 80, 0.7)',
  },
  respondentChipText: {
    color: '#ffffff',
  },
  conditionalLogicContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(26, 140, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26, 140, 255, 0.2)',
  },
  parentQuestionChip: {
    backgroundColor: 'rgba(26, 140, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(26, 140, 255, 0.4)',
    marginBottom: 8,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelButtonLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  addButton: {
    backgroundColor: '#4b1e85',
    marginLeft: 8,
  },
  addButtonLabel: {
    color: '#ffffff',
  },
  // FAB Button Styles
  fabDelete: {
    backgroundColor: '#ef4444',
    marginBottom: 12,
  },
  fabImport: {
    backgroundColor: '#1a8cff',
    marginBottom: 12,
  },
  // Import/Export Modal Styles - Glassmorphism Design
  importModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  importModalContainer: {
    width: '100%',
    maxWidth: 600,
    height: '85%',
    alignSelf: 'center',
  },
  importGlassCard: {
    backgroundColor: 'rgba(26, 26, 58, 0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  importHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 200, 255, 0.1)',
    flexShrink: 0,
  },
  importTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  importContent: {
    flex: 1,
    flexGrow: 1,
  },
  importSection: {
    padding: 24,
  },
  sectionIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.2)',
  },
  sectionIcon: {
    fontSize: 28,
  },
  importSectionTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  importSectionDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 20,
    lineHeight: 22,
  },
  templateButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  templateButton: {
    flex: 1,
    backgroundColor: 'rgba(26, 140, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26, 140, 255, 0.3)',
  },
  templateButtonIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(26, 140, 255, 0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  templateButtonIconText: {
    fontSize: 24,
  },
  templateButtonTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  templateButtonDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  importDivider: {
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    height: 1,
    marginVertical: 0,
  },
  importButton: {
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(75, 30, 133, 0.5)',
    borderStyle: 'dashed',
  },
  importButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  importButtonIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  importButtonTextContainer: {
    flex: 1,
  },
  importButtonTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  importButtonDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  importProgressContainer: {
    backgroundColor: 'rgba(100, 200, 255, 0.05)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.2)',
  },
  importProgressText: {
    color: '#ffffff',
    marginTop: 16,
    marginBottom: 12,
  },
  importProgressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
  },
  importResultContainer: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  importResultSuccess: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  importResultError: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderColor: 'rgba(244, 67, 54, 0.3)',
  },
  importResultIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  importResultTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  importResultText: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  importErrorsContainer: {
    marginTop: 16,
    width: '100%',
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.2)',
  },
  importErrorsTitle: {
    color: '#ff6b6b',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  importErrorText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    lineHeight: 18,
  },
  // Options Guide Styles
  optionsGuideSection: {
    backgroundColor: 'rgba(139, 92, 246, 0.05)',
    borderRadius: 16,
    padding: 20,
    margin: 24,
    marginTop: 0,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  optionsGuideTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 16,
  },
  optionsGuideTable: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  optionsGuideRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.1)',
  },
  optionsGuideHeaderCell: {
    fontWeight: 'bold',
    color: '#a78bfa',
    fontSize: 12,
  },
  optionsGuideCell: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    paddingHorizontal: 4,
  },
  optionsGuideNote: {
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 18,
    marginTop: 12,
  },
  optionsGuideNoteBold: {
    fontWeight: 'bold',
    color: '#a78bfa',
  },
  importInfoSection: {
    backgroundColor: 'rgba(255, 193, 7, 0.05)',
    borderRadius: 12,
    padding: 16,
    margin: 24,
    marginTop: 0,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.2)',
  },
  importInfoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  importInfoTextBold: {
    fontWeight: 'bold',
    color: '#ffc107',
  },
  // Collapsible Search and Filter Styles
  searchFilterContainer: {
    backgroundColor: '#1a1a3a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 30, 133, 0.3)',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
  },
  filterToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterToggleText: {
    color: '#64c8ff',
    fontSize: 14,
    fontWeight: '600',
  },
  activeFilterBadge: {
    backgroundColor: '#4b1e85',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterContent: {
    padding: 16,
    paddingTop: 12,
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterChipsContainer: {
    flexDirection: 'row',
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: 'rgba(75, 30, 133, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.5)',
  },
  selectedFilterChip: {
    backgroundColor: 'rgba(75, 30, 133, 0.9)',
    borderColor: '#4b1e85',
  },
  filterChipText: {
    color: '#ffffff',
    fontSize: 12,
  },
  activeFiltersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeFiltersText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  clearFiltersText: {
    color: '#64c8ff',
    fontSize: 13,
    fontWeight: '600',
  },
  compactFiltersDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(100, 200, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 200, 255, 0.1)',
    gap: 8,
  },
  compactFilterChip: {
    marginRight: 6,
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
    height: 28,
  },
  compactFilterText: {
    color: '#64c8ff',
    fontSize: 11,
  },
  compactResultsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  // Enhanced Question Card Styles
  categoryChipDisplay: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    marginLeft: 8,
  },
  categoryChipDisplayText: {
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: '600',
  },
  priorityChip: {
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.5)',
    marginLeft: 8,
  },
  priorityChipText: {
    color: '#ffc107',
    fontSize: 11,
    fontWeight: '600',
  },
  questionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dataSourceBadge: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.4)',
  },
  dataSourceBadgeText: {
    color: '#64b5f6',
    fontSize: 11,
    fontWeight: '500',
  },
  workPackageBadge: {
    backgroundColor: 'rgba(156, 39, 176, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(156, 39, 176, 0.4)',
  },
  workPackageBadgeText: {
    color: '#ba68c8',
    fontSize: 11,
    fontWeight: '500',
  },
  targetedInfoSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  targetedRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  targetedLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
    minWidth: 110,
  },
  targetedValue: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    flex: 1,
  },
});

export default FormBuilderScreen;