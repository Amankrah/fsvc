import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
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
} from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';
import apiService from '../services/api';
import { Question, CreateQuestionData, ResponseType, ResponseTypeInfo } from '../types';

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
  const { projectId, projectName } = route.params;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [responseTypes, setResponseTypes] = useState<ResponseTypeInfo[]>([]);

  // New question form state
  const [newQuestion, setNewQuestion] = useState<CreateQuestionData>({
    question_text: '',
    response_type: 'text_short',
    is_required: true,
    allow_multiple: false,
    options: [],
    validation_rules: {},
  });
  const [optionInput, setOptionInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Text');

  useEffect(() => {
    loadQuestions();
    loadResponseTypes();
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const data = await apiService.getQuestions(projectId);
      setQuestions(Array.isArray(data) ? data : data.results || []);
    } catch (error: any) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'Failed to load questions');
    } finally {
      setLoading(false);
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
      const questionData = {
        ...newQuestion,
        order_index: questions.length,
      };

      await apiService.createQuestion(projectId, questionData);
      await loadQuestions();

      // Reset form
      setNewQuestion({
        question_text: '',
        response_type: 'text_short',
        is_required: true,
        allow_multiple: false,
        options: [],
        validation_rules: {},
      });
      setOptionInput('');
      setShowAddDialog(false);
      Alert.alert('Success', 'Question added successfully');
    } catch (error: any) {
      console.error('Error adding question:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add question');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this question?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteQuestion(questionId);
            await loadQuestions();
            Alert.alert('Success', 'Question deleted successfully');
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
      await apiService.duplicateQuestion(questionId, projectId);
      await loadQuestions();
      Alert.alert('Success', 'Question duplicated successfully');
    } catch (error) {
      console.error('Error duplicating question:', error);
      Alert.alert('Error', 'Failed to duplicate question');
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
            </View>
            <View style={styles.questionActions}>
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
          </View>

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
                      {newQuestion.options?.map((option, index) => (
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
              Form Builder
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {projectName}
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
              No Questions Yet
            </Text>
            <Text variant="bodyLarge" style={styles.emptySubtitle}>
              Start building your form by adding questions
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
});

export default FormBuilderScreen;