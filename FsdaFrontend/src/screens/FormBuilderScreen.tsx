import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
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
import { Question, CreateQuestionData, ResponseType, ResponseTypeInfo, Project, RespondentType } from '../types';

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
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [responseTypes, setResponseTypes] = useState<ResponseTypeInfo[]>([]);

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
  });
  const [optionInput, setOptionInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Text');
  const [selectedTargetedRespondents, setSelectedTargetedRespondents] = useState<RespondentType[]>([]);
  const [selectedCommodities, setSelectedCommodities] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  
  // QuestionBank field choices
  const [questionBankChoices, setQuestionBankChoices] = useState<any>({
    categories: [],
    data_sources: [],
    commodities: [],
    respondents: [],
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
      const [projectData, questionBankData] = await Promise.all([
        apiService.getProject(projectId),
        apiService.getQuestionBank({ page_size: 1000 }),
      ]);
      setProject(projectData);
      // Extract questions from QuestionBank response
      const questionsList = Array.isArray(questionBankData) 
        ? questionBankData 
        : questionBankData.results || [];
      setQuestions(questionsList);
    } catch (error: any) {
      console.error('Error loading project and questions:', error);
      Alert.alert('Error', 'Failed to load project data');
    } finally {
      setLoading(false);
    }
  };

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

  const handleAddQuestion = async () => {
    if (!newQuestion.question_text.trim()) {
      Alert.alert('Validation Error', 'Please enter a question text');
      return;
    }

    const requiresOptions = ['choice_single', 'choice_multiple'].includes(newQuestion.response_type);
    if (requiresOptions && (!newQuestion.options || newQuestion.options.length < 2)) {
      Alert.alert('Validation Error', 'Please add at least 2 options for choice questions');
      return;
    }

    try {
      setSaving(true);
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
      });
      setOptionInput('');
      setSelectedTargetedRespondents([]);
      setSelectedCommodities([]);
      setSelectedCountries([]);
      setShowAddDialog(false);
      Alert.alert('Success', 'Question added to your Question Bank');
    } catch (error: any) {
      console.error('Error adding question:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add question');
    } finally {
      setSaving(false);
    }
  };

  const toggleTargetedRespondent = (respondent: RespondentType) => {
    setSelectedTargetedRespondents(prev =>
      prev.includes(respondent) ? prev.filter(r => r !== respondent) : [...prev, respondent]
    );
  };

  const COUNTRY_OPTIONS = ['Ghana', 'Nigeria', 'Kenya', 'Tanzania', 'Uganda', 'Ethiopia', 'South Africa', 'Senegal', 'Mali', 'Burkina Faso', 'Côte d\'Ivoire', 'Cameroon', 'Other'];

  const handleOpenEditDialog = (question: Question) => {
    setEditingQuestion(question);
    setNewQuestion({
      question_text: question.question_text,
      response_type: question.response_type,
      is_required: question.is_required,
      allow_multiple: question.allow_multiple || false,
      options: question.options || [],
      validation_rules: question.validation_rules || {},
      is_owner_question: question.is_owner_question !== undefined ? question.is_owner_question : true,
      targeted_respondents: question.targeted_respondents || [],
    });
    setSelectedTargetedRespondents(question.targeted_respondents || []);

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

    const requiresOptions = ['choice_single', 'choice_multiple'].includes(newQuestion.response_type);
    if (requiresOptions && (!newQuestion.options || newQuestion.options.length < 2)) {
      Alert.alert('Validation Error', 'Please add at least 2 options for choice questions');
      return;
    }

    try {
      setSaving(true);
      const questionBankData = {
        question_text: newQuestion.question_text,
        response_type: newQuestion.response_type,
        is_required: newQuestion.is_required,
        allow_multiple: newQuestion.allow_multiple,
        options: newQuestion.options,
        validation_rules: newQuestion.validation_rules,
        targeted_respondents: selectedTargetedRespondents.length > 0 ? selectedTargetedRespondents : undefined,
      };

      await apiService.updateQuestionBankItem(editingQuestion.id, questionBankData);
      await loadQuestions();

      // Reset form
      setNewQuestion({
        question_text: '',
        response_type: 'text_short',
        is_required: true,
        allow_multiple: false,
        options: [],
        validation_rules: {},
        is_owner_question: true,
        targeted_respondents: [],
      });
      setOptionInput('');
      setSelectedTargetedRespondents([]);
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

  const renderQuestionItem = (question: Question, index: number) => (
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
              {question.is_owner_question !== undefined && (
                <View style={question.is_owner_question ? styles.ownerChip : styles.partnerChip}>
                  <Text style={styles.ownershipChipText}>
                    {question.is_owner_question ? 'Owner' : 'Partner'}
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
            {question.targeted_respondents && question.targeted_respondents.length > 0 && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {question.targeted_respondents.join(', ')}
                </Text>
              </View>
            )}
          </View>

          {question.partner_organization && (
            <View style={styles.partnerInfo}>
              <Text variant="bodySmall" style={styles.partnerInfoText}>
                Partner: {question.partner_organization.name}
              </Text>
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

                {project?.targeted_respondents && project.targeted_respondents.length > 0 && (
                  <View style={styles.respondentsSection}>
                    <Text variant="labelLarge" style={styles.label}>
                      Targeted Respondents
                    </Text>
                    <Text variant="bodySmall" style={styles.labelHint}>
                      Select from project's respondent types
                    </Text>
                    <View style={styles.respondentChipsContainer}>
                      {project.targeted_respondents.map((respondent) => (
                        <Chip
                          key={respondent}
                          selected={selectedTargetedRespondents.includes(respondent)}
                          onPress={() => toggleTargetedRespondent(respondent)}
                          style={[
                            styles.respondentChip,
                            selectedTargetedRespondents.includes(respondent) && styles.selectedRespondentChip
                          ]}
                          textStyle={styles.respondentChipText}>
                          {respondent}
                        </Chip>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.respondentsSection}>
                  <Text variant="labelLarge" style={styles.label}>
                    Targeted Commodities
                  </Text>
                  <Text variant="bodySmall" style={styles.labelHint}>
                    Select commodities this question applies to (leave empty for all)
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

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {questions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
            </View>
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              No Questions in Your Bank
            </Text>
            <Text variant="bodyLarge" style={styles.emptySubtitle}>
              Start building your question library by adding reusable templates
            </Text>
          </View>
        ) : (
          <View style={styles.questionsList}>
            {questions.map((question, index) => renderQuestionItem(question, index))}
          </View>
        )}
      </ScrollView>

      <View style={styles.fabContainer}>
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

      {/* Edit Question Dialog - Reuse the same structure as Add Dialog */}
      <Portal>
        <Dialog
          visible={showEditDialog}
          onDismiss={() => setShowEditDialog(false)}
          style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Edit Question</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogInner}>
                {/* Reuse the same form structure from renderAddDialog */}
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
                  Question Type
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

                {project?.targeted_respondents && project.targeted_respondents.length > 0 && (
                  <View style={styles.respondentsSection}>
                    <Text variant="labelLarge" style={styles.label}>
                      Targeted Respondents
                    </Text>
                    <Text variant="bodySmall" style={styles.labelHint}>
                      Select from project's respondent types
                    </Text>
                    <View style={styles.respondentChipsContainer}>
                      {project.targeted_respondents.map((respondent) => (
                        <Chip
                          key={respondent}
                          selected={selectedTargetedRespondents.includes(respondent)}
                          onPress={() => toggleTargetedRespondent(respondent)}
                          style={[
                            styles.respondentChip,
                            selectedTargetedRespondents.includes(respondent) && styles.selectedRespondentChip
                          ]}
                          textStyle={styles.respondentChipText}>
                          {respondent}
                        </Chip>
                      ))}
                    </View>
                  </View>
                )}

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
  // Import Button Styles
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
});

export default FormBuilderScreen;