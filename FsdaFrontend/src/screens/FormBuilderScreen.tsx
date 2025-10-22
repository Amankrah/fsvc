/**
 * FormBuilderScreen - Refactored Version
 * Modular, production-ready implementation with clean separation of concerns
 *
 * Architecture:
 * - Custom hooks handle business logic
 * - Reusable components handle UI
 * - Constants centralize configuration
 * - Full Django backend compatibility
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  FAB,
  ActivityIndicator,
  Portal,
  Dialog,
  Button,
  ProgressBar,
} from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';

// Custom Hooks
import {
  useQuestionBank,
  useQuestionFilters,
  useQuestionForm,
  useImportExport,
} from '../hooks/formBuilder';

// Components
import { QuestionCard, SearchFilterBar, QuestionFormDialog } from '../components/formBuilder';

// Constants
import {
  RESPONSE_TYPE_CATEGORIES,
} from '../constants/formBuilder';

// Types
import { Question } from '../types';

type RootStackParamList = {
  FormBuilder: { projectId: string; projectName: string };
};

type FormBuilderRouteProp = RouteProp<RootStackParamList, 'FormBuilder'>;

const FormBuilderScreen: React.FC = () => {
  const route = useRoute<FormBuilderRouteProp>();
  const { projectId } = route.params;

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Question Bank Hook
  const {
    questions,
    loading,
    refreshing,
    saving,
    responseTypes,
    questionBankChoices,
    loadProjectAndQuestions,
    loadResponseTypes,
    loadQuestionBankChoices,
    handleRefresh,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    duplicateQuestion,
    deleteAllQuestionBank,
  } = useQuestionBank(projectId);

  // Filters Hook
  const {
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
  } = useQuestionFilters(questions);

  // Question Form Hook
  const {
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
    isFollowUp,
    setIsFollowUp,
    parentQuestionId,
    setParentQuestionId,
    conditionOperator,
    setConditionOperator,
    conditionValue,
    setConditionValue,
    resetForm,
    loadQuestionForEdit,
    validateQuestion,
    buildQuestionData,
    addOption,
    removeOption,
  } = useQuestionForm();

  // Import/Export Hook
  const {
    showImportExportDialog,
    setShowImportExportDialog,
    importing,
    importProgress,
    handleDownloadTemplate,
    handleImportQuestions,
  } = useImportExport(async () => {
    await loadProjectAndQuestions();
  });

  // Initialize data
  useEffect(() => {
    loadProjectAndQuestions();
    loadResponseTypes();
    loadQuestionBankChoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Add Question
  const handleAddQuestion = async () => {
    if (!validateQuestion()) return;

    const questionData = buildQuestionData();
    const success = await createQuestion(questionData);

    if (success) {
      resetForm();
      setShowAddDialog(false);
    }
  };

  // Handle Update Question
  const handleUpdateQuestion = async () => {
    if (!editingQuestion || !validateQuestion()) return;

    const questionData = buildQuestionData();
    const success = await updateQuestion(editingQuestion.id, questionData);

    if (success) {
      resetForm();
      setEditingQuestion(null);
      setShowEditDialog(false);
    }
  };

  // Handle Open Edit Dialog
  const handleOpenEditDialog = (question: Question) => {
    setEditingQuestion(question);
    loadQuestionForEdit(question);

    // Set category based on response type
    const category = RESPONSE_TYPE_CATEGORIES.find((cat) =>
      cat.types.includes(question.response_type)
    );
    if (category) {
      setSelectedCategory(category.label);
    }

    setShowEditDialog(true);
  };

  // Loading state
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
      {/* Header */}
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

      {/* Search and Filter Bar */}
      <SearchFilterBar
        isExpanded={isFilterExpanded}
        onToggleExpanded={() => setIsFilterExpanded(!isFilterExpanded)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategoryFilters={selectedCategoryFilters}
        selectedRespondentFilters={selectedRespondentFilters}
        onToggleCategoryFilter={toggleCategoryFilter}
        onToggleRespondentFilter={toggleRespondentFilter}
        onClearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        activeFiltersCount={activeFiltersCount}
        filteredCount={filteredQuestions.length}
        totalCount={questions.length}
        categories={questionBankChoices.categories || []}
        respondentTypes={questionBankChoices.respondent_types || []}
      />

      {/* Questions List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4b1e85"
            colors={['#4b1e85']}
          />
        }>
        {filteredQuestions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>{questions.length === 0 ? '📝' : '🔍'}</Text>
            </View>
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              {questions.length === 0 ? 'No Questions in Your Bank' : 'No Questions Match Filters'}
            </Text>
            <Text variant="bodyLarge" style={styles.emptySubtitle}>
              {questions.length === 0
                ? 'Start building your question library by adding reusable templates'
                : 'Try adjusting your search or filter criteria'}
            </Text>
          </View>
        ) : (
          <View style={styles.questionsList}>
            {filteredQuestions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                responseTypes={responseTypes}
                questionBankChoices={questionBankChoices}
                onEdit={handleOpenEditDialog}
                onDuplicate={duplicateQuestion}
                onDelete={deleteQuestion}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB Actions */}
      <View style={styles.fabContainer}>
        <FAB
          icon="delete-sweep"
          label="Delete All"
          style={[styles.fab, styles.fabDelete]}
          onPress={deleteAllQuestionBank}
          theme={{ colors: { onPrimary: '#ffffff' } }}
        />
        <FAB
          icon="upload"
          label="Import/Export"
          style={[styles.fab, styles.fabImport]}
          onPress={() => setShowImportExportDialog(true)}
          theme={{ colors: { onPrimary: '#ffffff' } }}
        />
        <FAB
          icon="plus"
          label="Add Question"
          style={styles.fab}
          onPress={() => setShowAddDialog(true)}
          theme={{ colors: { onPrimary: '#ffffff' } }}
        />
      </View>

      {/* Import/Export Dialog */}
      <Portal>
        <Dialog
          visible={showImportExportDialog}
          onDismiss={() => !importing && setShowImportExportDialog(false)}
          style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Import / Export Questions</Dialog.Title>
          <Dialog.Content>
            {importing ? (
              <View style={styles.importingContainer}>
                <Text style={styles.importingText}>Importing questions...</Text>
                <ProgressBar progress={importProgress} color="#64c8ff" style={styles.progressBar} />
              </View>
            ) : (
              <View style={styles.importExportButtons}>
                <Button
                  mode="contained"
                  icon="download"
                  onPress={() => handleDownloadTemplate('csv')}
                  style={styles.importExportButton}>
                  Download CSV Template
                </Button>
                <Button
                  mode="contained"
                  icon="download"
                  onPress={() => handleDownloadTemplate('excel')}
                  style={styles.importExportButton}>
                  Download Excel Template
                </Button>
                <Button
                  mode="contained"
                  icon="upload"
                  onPress={handleImportQuestions}
                  style={[styles.importExportButton, styles.importButton]}>
                  Import Questions
                </Button>
              </View>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowImportExportDialog(false)} disabled={importing}>
              Close
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Add Question Dialog */}
      <QuestionFormDialog
        visible={showAddDialog}
        onDismiss={() => {
          setShowAddDialog(false);
          resetForm();
        }}
        onSubmit={handleAddQuestion}
        isEditing={false}
        saving={saving}
        newQuestion={newQuestion}
        setNewQuestion={setNewQuestion}
        optionInput={optionInput}
        setOptionInput={setOptionInput}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedTargetedRespondents={selectedTargetedRespondents}
        setSelectedTargetedRespondents={setSelectedTargetedRespondents}
        selectedCommodities={selectedCommodities}
        setSelectedCommodities={setSelectedCommodities}
        selectedCountries={selectedCountries}
        setSelectedCountries={setSelectedCountries}
        isFollowUp={isFollowUp}
        setIsFollowUp={setIsFollowUp}
        parentQuestionId={parentQuestionId}
        setParentQuestionId={setParentQuestionId}
        conditionOperator={conditionOperator}
        setConditionOperator={setConditionOperator}
        conditionValue={conditionValue}
        setConditionValue={setConditionValue}
        addOption={addOption}
        removeOption={removeOption}
        responseTypes={responseTypes}
        questionBankChoices={questionBankChoices}
        questions={questions}
      />

      {/* Edit Question Dialog */}
      <QuestionFormDialog
        visible={showEditDialog}
        onDismiss={() => {
          setShowEditDialog(false);
          setEditingQuestion(null);
          resetForm();
        }}
        onSubmit={handleUpdateQuestion}
        isEditing={true}
        saving={saving}
        newQuestion={newQuestion}
        setNewQuestion={setNewQuestion}
        optionInput={optionInput}
        setOptionInput={setOptionInput}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        selectedTargetedRespondents={selectedTargetedRespondents}
        setSelectedTargetedRespondents={setSelectedTargetedRespondents}
        selectedCommodities={selectedCommodities}
        setSelectedCommodities={setSelectedCommodities}
        selectedCountries={selectedCountries}
        setSelectedCountries={setSelectedCountries}
        isFollowUp={isFollowUp}
        setIsFollowUp={setIsFollowUp}
        parentQuestionId={parentQuestionId}
        setParentQuestionId={setParentQuestionId}
        conditionOperator={conditionOperator}
        setConditionOperator={setConditionOperator}
        conditionValue={conditionValue}
        setConditionValue={setConditionValue}
        addOption={addOption}
        removeOption={removeOption}
        responseTypes={responseTypes}
        questionBankChoices={questionBankChoices}
        questions={questions}
      />
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
    alignItems: 'flex-start',
    zIndex: 2,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerDecoration: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#4b1e85',
  },
  title: {
    fontWeight: 'bold',
    color: '#ffffff',
    fontSize: 24,
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  questionCountContainer: {
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.4)',
    alignItems: 'center',
  },
  questionCount: {
    color: '#64c8ff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  questionCountLabel: {
    color: '#64c8ff',
    fontSize: 11,
  },
  scrollView: {
    flex: 1,
  },
  questionsList: {
    padding: 16,
  },
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
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    gap: 12,
  },
  fab: {
    backgroundColor: '#4b1e85',
  },
  fabDelete: {
    backgroundColor: '#d32f2f',
  },
  fabImport: {
    backgroundColor: '#1976d2',
  },
  dialog: {
    backgroundColor: '#1a1a3a',
    borderRadius: 20,
  },
  dialogTitle: {
    color: '#ffffff',
  },
  importingContainer: {
    padding: 16,
  },
  importingText: {
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  importExportButtons: {
    gap: 12,
  },
  importExportButton: {
    backgroundColor: '#4b1e85',
  },
  importButton: {
    backgroundColor: '#1976d2',
  },
});

export default React.memo(FormBuilderScreen);
