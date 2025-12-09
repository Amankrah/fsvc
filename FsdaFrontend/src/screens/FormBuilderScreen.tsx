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

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  FAB,
  ActivityIndicator,
  Portal,
  Dialog,
  Button,
  ProgressBar,
  SegmentedButtons,
  IconButton,
  Menu,
} from 'react-native-paper';
import { useRoute, RouteProp } from '@react-navigation/native';

// Custom Hooks
import {
  useQuestionBank,
  useQuestionFilters,
  useQuestionForm,
  useImportExport,
} from '../hooks/formBuilder';
import { useGeneratedQuestions } from '../hooks/formBuilder/useGeneratedQuestions';

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

  // Tab state
  const [activeTab, setActiveTab] = useState<'bank' | 'generated'>('bank');

  // Generated Questions Filter State
  const [selectedGeneratedRespondentType, setSelectedGeneratedRespondentType] = useState<string>('');
  const [selectedGeneratedCommodity, setSelectedGeneratedCommodity] = useState<string>('');
  const [selectedGeneratedCountry, setSelectedGeneratedCountry] = useState<string>('');

  // Menu visibility state
  const [showRespondentMenu, setShowRespondentMenu] = useState(false);
  const [showCommodityMenu, setShowCommodityMenu] = useState(false);
  const [showCountryMenu, setShowCountryMenu] = useState(false);

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

  // Generated Questions Hook
  const generatedQuestionsHook = useGeneratedQuestions(projectId);

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
  } = useImportExport(projectId, async () => {
    await loadProjectAndQuestions();
  });

  // Initialize data
  useEffect(() => {
    loadProjectAndQuestions();
    loadResponseTypes();
    loadQuestionBankChoices();
    generatedQuestionsHook.loadData();
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

  // Get unique filter options for Generated Questions
  const getUniqueGeneratedFilters = () => {
    const respondentTypes = new Set<string>();
    const commodities = new Set<string>();
    const countries = new Set<string>();

    generatedQuestionsHook.generatedQuestions.forEach((q) => {
      if (q.assigned_respondent_type) respondentTypes.add(q.assigned_respondent_type);
      if (q.assigned_commodity) commodities.add(q.assigned_commodity);
      if (q.assigned_country) countries.add(q.assigned_country);
    });

    return {
      respondentTypes: Array.from(respondentTypes).sort(),
      commodities: Array.from(commodities).sort(),
      countries: Array.from(countries).sort(),
    };
  };

  const generatedFilters = getUniqueGeneratedFilters();

  // Filter Generated Questions by selected bundle
  const filteredGeneratedQuestions = generatedQuestionsHook.generatedQuestions.filter((q) => {
    if (selectedGeneratedRespondentType && q.assigned_respondent_type !== selectedGeneratedRespondentType) {
      return false;
    }
    if (selectedGeneratedCommodity && q.assigned_commodity !== selectedGeneratedCommodity) {
      return false;
    }
    if (selectedGeneratedCountry && q.assigned_country !== selectedGeneratedCountry) {
      return false;
    }
    return true;
  });

  // Get active data based on tab
  const activeQuestions = activeTab === 'bank' ? questions : filteredGeneratedQuestions;
  const activeRefreshing = activeTab === 'bank' ? refreshing : generatedQuestionsHook.refreshing;
  const activeHandleRefresh = activeTab === 'bank' ? handleRefresh : generatedQuestionsHook.handleRefresh;

  // Get the questions to display (for reorder mode or normal mode)
  const displayQuestions = activeTab === 'generated' && generatedQuestionsHook.isReorderMode
    ? generatedQuestionsHook.reorderedQuestions
    : activeTab === 'generated'
    ? filteredGeneratedQuestions
    : filteredQuestions;

  // Render individual question item
  const renderQuestionItem = useCallback(({ item: question, index }: { item: Question; index: number }) => (
    <View style={styles.questionCardWrapper}>
      {/* Reorder Controls for Generated Questions */}
      {activeTab === 'generated' && generatedQuestionsHook.isReorderMode && (
        <View style={styles.reorderControls}>
          <IconButton
            icon="arrow-up"
            size={20}
            iconColor="#64c8ff"
            disabled={index === 0}
            onPress={() => generatedQuestionsHook.moveQuestionUp(index)}
            style={[
              styles.reorderButton,
              index === 0 && styles.reorderButtonDisabled,
            ]}
          />
          <Text style={styles.orderIndex}>{index + 1}</Text>
          <IconButton
            icon="arrow-down"
            size={20}
            iconColor="#64c8ff"
            disabled={index === generatedQuestionsHook.reorderedQuestions.length - 1}
            onPress={() => generatedQuestionsHook.moveQuestionDown(index)}
            style={[
              styles.reorderButton,
              index === generatedQuestionsHook.reorderedQuestions.length - 1 &&
                styles.reorderButtonDisabled,
            ]}
          />
        </View>
      )}

      <View style={styles.questionCardContent}>
        <QuestionCard
          question={question}
          index={index}
          responseTypes={responseTypes}
          questionBankChoices={questionBankChoices}
          onEdit={activeTab === 'bank' ? handleOpenEditDialog : () => {}}
          onDuplicate={activeTab === 'bank' ? duplicateQuestion : () => {}}
          onDelete={activeTab === 'bank' ? deleteQuestion : () => {}}
        />
      </View>
    </View>
  ), [activeTab, generatedQuestionsHook.isReorderMode, generatedQuestionsHook.reorderedQuestions.length, responseTypes, questionBankChoices, handleOpenEditDialog, duplicateQuestion, deleteQuestion, generatedQuestionsHook.moveQuestionUp, generatedQuestionsHook.moveQuestionDown]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: Question) => item.id, []);

  // List header component (reorder banner)
  const ListHeaderComponent = useCallback(() => (
    activeTab === 'generated' && generatedQuestionsHook.isReorderMode ? (
      <View style={styles.reorderBanner}>
        <Text variant="bodyMedium" style={styles.reorderBannerText}>
          Reorder Mode: Use up/down arrows to arrange questions
        </Text>
        <View style={styles.reorderActions}>
          <Button
            mode="outlined"
            onPress={generatedQuestionsHook.cancelReorderMode}
            textColor="#fff"
            style={styles.reorderButton}>
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={generatedQuestionsHook.saveQuestionOrder}
            style={[styles.reorderButton, styles.saveButton]}>
            Save Order
          </Button>
        </View>
      </View>
    ) : null
  ), [activeTab, generatedQuestionsHook.isReorderMode, generatedQuestionsHook.cancelReorderMode, generatedQuestionsHook.saveQuestionOrder]);

  // Empty list component
  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Text style={styles.emptyIcon}>
          {activeQuestions.length === 0 ? '📝' : '🔍'}
        </Text>
      </View>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        {activeQuestions.length === 0
          ? activeTab === 'bank'
            ? 'No Questions in Your Bank'
            : 'No Generated Questions'
          : 'No Questions Match Filters'}
      </Text>
      <Text variant="bodyLarge" style={styles.emptySubtitle}>
        {activeQuestions.length === 0
          ? activeTab === 'bank'
            ? 'Start building your question library by adding reusable templates'
            : 'Generate questions from your Question Bank to start collecting data'
          : 'Try adjusting your search or filter criteria'}
      </Text>
    </View>
  ), [activeQuestions.length, activeTab]);

  // Loading state - placed after all hooks to comply with Rules of Hooks
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
              Form Builder
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Manage question templates and generated questions
            </Text>
          </View>
          <View style={styles.questionCountContainer}>
            <Text variant="titleMedium" style={styles.questionCount}>
              {activeQuestions.length}
            </Text>
            <Text variant="bodySmall" style={styles.questionCountLabel}>
              question{activeQuestions.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View style={styles.headerDecoration} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'bank' | 'generated')}
          buttons={[
            {
              value: 'bank',
              label: 'Question Bank',
              icon: 'database',
              checkedColor: '#ffffff',
              uncheckedColor: 'rgba(255, 255, 255, 0.6)',
            },
            {
              value: 'generated',
              label: 'Generated Questions',
              icon: 'file-document-multiple',
              checkedColor: '#ffffff',
              uncheckedColor: 'rgba(255, 255, 255, 0.6)',
            },
          ]}
          style={styles.segmentedButtons}
          theme={{ colors: { secondaryContainer: '#4b1e85', onSecondaryContainer: '#ffffff' } }}
        />
      </View>

      {/* Conditional Filter Bars */}
      {activeTab === 'bank' ? (
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
      ) : (
        <View style={styles.generatedFiltersContainer}>
          <Text variant="labelMedium" style={styles.filterLabel}>
            Filter by Generation Bundle:
          </Text>
          <View style={styles.generatedFiltersRow}>
            {/* Respondent Type Filter */}
            <View style={styles.filterDropdown}>
              <Text variant="labelSmall" style={styles.filterDropdownLabel}>
                Respondent Type
              </Text>
              <Menu
                visible={showRespondentMenu}
                onDismiss={() => setShowRespondentMenu(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setShowRespondentMenu(true)}
                    style={styles.filterButton}
                    textColor="#fff">
                    {selectedGeneratedRespondentType || 'All'}
                  </Button>
                }>
                <Menu.Item
                  onPress={() => {
                    setSelectedGeneratedRespondentType('');
                    setShowRespondentMenu(false);
                  }}
                  title="All"
                />
                {generatedFilters.respondentTypes.map((type) => (
                  <Menu.Item
                    key={type}
                    onPress={() => {
                      setSelectedGeneratedRespondentType(type);
                      setShowRespondentMenu(false);
                    }}
                    title={type}
                  />
                ))}
              </Menu>
            </View>

            {/* Commodity Filter */}
            <View style={styles.filterDropdown}>
              <Text variant="labelSmall" style={styles.filterDropdownLabel}>
                Commodity
              </Text>
              <Menu
                visible={showCommodityMenu}
                onDismiss={() => setShowCommodityMenu(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setShowCommodityMenu(true)}
                    style={styles.filterButton}
                    textColor="#fff">
                    {selectedGeneratedCommodity || 'All'}
                  </Button>
                }>
                <Menu.Item
                  onPress={() => {
                    setSelectedGeneratedCommodity('');
                    setShowCommodityMenu(false);
                  }}
                  title="All"
                />
                {generatedFilters.commodities.map((commodity) => (
                  <Menu.Item
                    key={commodity}
                    onPress={() => {
                      setSelectedGeneratedCommodity(commodity);
                      setShowCommodityMenu(false);
                    }}
                    title={commodity}
                  />
                ))}
              </Menu>
            </View>

            {/* Country Filter */}
            <View style={styles.filterDropdown}>
              <Text variant="labelSmall" style={styles.filterDropdownLabel}>
                Country
              </Text>
              <Menu
                visible={showCountryMenu}
                onDismiss={() => setShowCountryMenu(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setShowCountryMenu(true)}
                    style={styles.filterButton}
                    textColor="#fff">
                    {selectedGeneratedCountry || 'All'}
                  </Button>
                }>
                <Menu.Item
                  onPress={() => {
                    setSelectedGeneratedCountry('');
                    setShowCountryMenu(false);
                  }}
                  title="All"
                />
                {generatedFilters.countries.map((country) => (
                  <Menu.Item
                    key={country}
                    onPress={() => {
                      setSelectedGeneratedCountry(country);
                      setShowCountryMenu(false);
                    }}
                    title={country}
                  />
                ))}
              </Menu>
            </View>

            {/* Clear Filters Button */}
            {(selectedGeneratedRespondentType ||
              selectedGeneratedCommodity ||
              selectedGeneratedCountry) && (
              <Button
                mode="text"
                onPress={() => {
                  setSelectedGeneratedRespondentType('');
                  setSelectedGeneratedCommodity('');
                  setSelectedGeneratedCountry('');
                }}
                textColor="#64c8ff"
                style={styles.clearFiltersButton}>
                Clear Filters
              </Button>
            )}
          </View>
        </View>
      )}

      {/* Questions List with Virtualization */}
      <FlatList
        data={displayQuestions}
        renderItem={renderQuestionItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={displayQuestions.length === 0 ? styles.emptyListContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={activeRefreshing}
            onRefresh={activeHandleRefresh}
            tintColor="#4b1e85"
            colors={['#4b1e85']}
          />
        }
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        windowSize={21}
        getItemLayout={(_, index) => ({
          length: 200, // Approximate height of each item
          offset: 200 * index,
          index,
        })}
      />

      {/* FAB Actions */}
      <View style={styles.fabContainer}>
        {activeTab === 'bank' ? (
          <>
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
          </>
        ) : (
          <FAB
            icon={generatedQuestionsHook.isReorderMode ? 'check' : 'swap-vertical'}
            label={generatedQuestionsHook.isReorderMode ? 'Done' : 'Reorder'}
            style={styles.fab}
            onPress={
              generatedQuestionsHook.isReorderMode
                ? generatedQuestionsHook.saveQuestionOrder
                : () => {
                    // Only allow reorder if questions are filtered to a specific bundle
                    if (filteredGeneratedQuestions.length === 0) {
                      Alert.alert('No Questions', 'There are no questions to reorder.');
                      return;
                    }

                    // Check if all filtered questions belong to the same bundle
                    const first = filteredGeneratedQuestions[0];
                    const allSameBundle = filteredGeneratedQuestions.every(
                      (q) =>
                        q.assigned_respondent_type === first.assigned_respondent_type &&
                        q.assigned_commodity === first.assigned_commodity &&
                        q.assigned_country === first.assigned_country
                    );

                    if (!allSameBundle) {
                      Alert.alert(
                        'Filter Required',
                        'Please filter to a specific generation bundle (Respondent Type + Commodity + Country) before reordering. Questions can only be reordered within their generation bundle.'
                      );
                      return;
                    }

                    generatedQuestionsHook.startReorderMode(filteredGeneratedQuestions);
                  }
            }
            theme={{ colors: { onPrimary: '#ffffff' } }}
          />
        )}
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
  tabContainer: {
    backgroundColor: '#1a1a3a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 30, 133, 0.3)',
  },
  segmentedButtons: {
    backgroundColor: '#0f0f23',
  },
  segmentedButtonText: {
    color: '#ffffff',
  },
  reorderBanner: {
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#64c8ff',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  reorderBannerText: {
    color: '#64c8ff',
    marginBottom: 12,
    fontWeight: '600',
  },
  reorderActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  reorderButton: {
    borderColor: '#64c8ff',
  },
  saveButton: {
    backgroundColor: '#4b1e85',
  },
  questionCardWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  reorderControls: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: 'rgba(100, 200, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.3)',
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  orderIndex: {
    color: '#64c8ff',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  questionCardContent: {
    flex: 1,
  },
  generatedFiltersContainer: {
    backgroundColor: '#1a1a3a',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 30, 133, 0.3)',
  },
  filterLabel: {
    color: '#64c8ff',
    marginBottom: 12,
    fontWeight: '600',
  },
  generatedFiltersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    flexWrap: 'wrap',
  },
  filterDropdown: {
    flex: 1,
    minWidth: 120,
  },
  filterDropdownLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  filterButton: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  clearFiltersButton: {
    alignSelf: 'flex-end',
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
  },
});

export default React.memo(FormBuilderScreen);
