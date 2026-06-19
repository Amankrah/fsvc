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
  TouchableOpacity,
} from 'react-native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  ActivityIndicator,
  Portal,
  Dialog,
  Button,
  ProgressBar,
  SegmentedButtons,
  IconButton,
  Menu,
  Chip,
  Icon,
} from 'react-native-paper';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';

// Custom Hooks
import {
  useQuestionBank,
  useQuestionFilters,
  useQuestionForm,
  useImportExport,
} from '../hooks/formBuilder';
import { useGeneratedQuestions } from '../hooks/formBuilder/useGeneratedQuestions';

// Services
import { networkMonitor, offlineQuestionCache } from '../services';

// Utils
import { showAlert } from '../utils/alert';

// Constants
import { getCategorySortIndex } from '../constants/formBuilder';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

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
  const navigation = useNavigation();
  const route = useRoute<FormBuilderRouteProp>();
  const { projectId } = route.params;
  const insets = useSafeAreaInsets();

  // Tab state
  const [activeTab, setActiveTab] = useState<'bank' | 'generated'>('bank');

  // Connection and Cache state
  const [isOnline, setIsOnline] = useState(true);
  const [cacheStats, setCacheStats] = useState<{
    questionBanksCount: number;
    generatedQuestionsCount: number;
    lastUpdate: string | null;
  }>({
    questionBanksCount: 0,
    generatedQuestionsCount: 0,
    lastUpdate: null,
  });

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
    loadingMore,
    hasMore,
    totalCount,
    responseTypes,
    questionBankChoices,
    loadProjectAndQuestions,
    loadResponseTypes,
    loadQuestionBankChoices,
    handleRefresh,
    loadMore,
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
    sectionMode,
    setSectionMode,
    persistedSectionHeader,
    setPersistedSectionHeader,
    persistedSectionPreamble,
    setPersistedSectionPreamble,
    resetForm,
    resetFormFull,
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
    handleExportQuestionBank,
  } = useImportExport(projectId, async () => {
    await loadProjectAndQuestions();
  });

  // Initialize data
  useEffect(() => {
    loadProjectAndQuestions();
    loadResponseTypes();
    loadQuestionBankChoices();
    generatedQuestionsHook.loadData();
    generatedQuestionsHook.loadResponseCounts(); // Load response counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Monitor network connection status
  useEffect(() => {
    // Check initial status
    networkMonitor.checkConnection().then(setIsOnline);

    // Listen for connection changes
    const unsubscribe = networkMonitor.addListener((connected) => {
      setIsOnline(connected);
    });

    return unsubscribe;
  }, []);

  // Load cache statistics
  useEffect(() => {
    const loadCacheStats = async () => {
      const stats = await offlineQuestionCache.getCacheStats();
      setCacheStats({
        questionBanksCount: stats.questionBanks[projectId] || 0,
        generatedQuestionsCount: stats.generatedQuestions[projectId] || 0,
        lastUpdate: stats.lastUpdate,
      });
    };

    loadCacheStats();

    // Refresh cache stats when questions load
    const interval = setInterval(loadCacheStats, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [projectId]);

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

  // Get unique filter options from Question Bank (actual data, not predefined)
  // Note: This extracts from currently loaded questions. To see ALL categories,
  // user needs to load more questions or we need a separate API endpoint.
  const getUniqueQuestionBankFilters = () => {
    const categories = new Set<string>();
    const respondentTypes = new Set<string>();

    questions.forEach((q) => {
      // Extract categories
      if (q.question_category) {
        categories.add(q.question_category);
      }

      // Extract respondent types from targeted_respondents array
      if (q.targeted_respondents && Array.isArray(q.targeted_respondents)) {
        q.targeted_respondents.forEach(type => respondentTypes.add(type));
      }
    });

    return {
      categories: Array.from(categories).sort().map(cat => ({ value: cat, label: cat })),
      respondentTypes: Array.from(respondentTypes).sort().map(type => ({ value: type, label: type })),
    };
  };

  const questionBankFilters = getUniqueQuestionBankFilters();

  // Filter Generated Questions by selected bundle
  const filteredGeneratedQuestions = generatedQuestionsHook.generatedQuestions
    .filter((q) => {
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
    })
    .sort((a, b) => {
      // Sort by category order first
      const categoryA = a.question_category || '';
      const categoryB = b.question_category || '';
      const categoryIndexA = getCategorySortIndex(categoryA);
      const categoryIndexB = getCategorySortIndex(categoryB);

      if (categoryIndexA !== categoryIndexB) {
        return categoryIndexA - categoryIndexB;
      }

      // Within same category, maintain original order (order_index)
      return (a.order_index || 0) - (b.order_index || 0);
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
            iconColor={colors.primary.light}
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
            iconColor={colors.primary.light}
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
          onEdit={activeTab === 'bank' ? handleOpenEditDialog : () => { }}
          onDuplicate={activeTab === 'bank' ? duplicateQuestion : () => { }}
          onDelete={
            activeTab === 'bank'
              ? deleteQuestion
              : generatedQuestionsHook.deleteGeneratedQuestion
          }
          responseCount={activeTab === 'generated' ? generatedQuestionsHook.responseCounts[question.id] : undefined}
        />
      </View>
    </View>
  ), [activeTab, generatedQuestionsHook.isReorderMode, generatedQuestionsHook.reorderedQuestions.length, generatedQuestionsHook.deleteGeneratedQuestion, generatedQuestionsHook.responseCounts, responseTypes, questionBankChoices, handleOpenEditDialog, duplicateQuestion, deleteQuestion, generatedQuestionsHook.moveQuestionUp, generatedQuestionsHook.moveQuestionDown]);

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
            textColor={colors.primary.main}
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
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.heroNav}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Icon source="chevron-left" size={24} color="#fff" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>Form Builder</Text>
          <Text style={styles.heroSubtitle}>{route.params.projectName}</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading form...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false, bottom: false }}>
      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.heroNav}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon source="chevron-left" size={24} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.heroRightRow}>
            <View style={[styles.onlinePill, { backgroundColor: isOnline ? 'rgba(5,150,105,0.25)' : 'rgba(217,119,6,0.25)' }]}>
              <Icon source={isOnline ? 'wifi' : 'wifi-off'} size={12} color={isOnline ? colors.status.success : colors.status.warning} />
              <Text style={[styles.onlinePillText, { color: isOnline ? colors.status.success : colors.status.warning }]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>
                {activeTab === 'bank' ? totalCount : filteredGeneratedQuestions.length} Qs
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.heroTitle}>Form Builder</Text>
        <Text style={styles.heroSubtitle}>{route.params.projectName}</Text>
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
              checkedColor: colors.primary.contrast,
              uncheckedColor: colors.text.secondary,
            },
            {
              value: 'generated',
              label: 'Generated Questions',
              icon: 'file-document-multiple',
              checkedColor: colors.primary.contrast,
              uncheckedColor: colors.text.secondary,
            },
          ]}
          style={styles.segmentedButtons}
          theme={{ colors: { secondaryContainer: colors.primary.dark, onSecondaryContainer: colors.primary.contrast } }}
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
          totalCount={activeTab === 'bank' ? totalCount : filteredGeneratedQuestions.length}
          categories={questionBankFilters.categories}
          respondentTypes={questionBankFilters.respondentTypes}
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
                    textColor={colors.primary.main}>
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
                    textColor={colors.primary.main}>
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
                    textColor={colors.primary.main}>
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
                  textColor={colors.text.primary}
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
        contentContainerStyle={[
          displayQuestions.length === 0 ? styles.emptyListContent : styles.listContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={activeRefreshing}
            onRefresh={activeHandleRefresh}
            tintColor={colors.primary.dark}
            colors={[colors.primary.dark]}
          />
        }
        // Pagination - Only for Question Bank tab
        onEndReached={() => {
          if (activeTab === 'bank' && hasMore && !loadingMore) {
            loadMore();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={() => {
          // Only show pagination for Question Bank tab
          if (activeTab === 'bank') {
            if (loadingMore) {
              return (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary.dark} />
                  <Text style={{ marginTop: 10, color: colors.text.secondary }}>Loading more questions...</Text>
                </View>
              );
            }

            if (hasMore && displayQuestions.length > 0) {
              return (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Button
                    mode="outlined"
                    onPress={loadMore}
                    icon="chevron-down"
                    style={{ borderColor: colors.primary.dark, borderWidth: 2 }}
                    labelStyle={{ color: colors.primary.dark, fontWeight: 'bold' }}
                  >
                    Load More Questions
                  </Button>
                  <Text style={{ marginTop: 10, color: colors.text.secondary, fontSize: 12 }}>
                    Showing {displayQuestions.length} of {totalCount}
                  </Text>
                </View>
              );
            }
          }

          return null;
        }}
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

      {/* FAB Actions — compact round buttons with label pills to the left */}
      <View style={[styles.fabContainer, { bottom: insets.bottom + 16 }]}>
        {activeTab === 'bank' ? (
          <>
            {/* Delete All */}
            <View style={styles.fabRow}>
              <View style={styles.fabLabelPill}>
                <Text style={styles.fabLabelText}>Delete All</Text>
              </View>
              <TouchableOpacity
                style={[styles.fabBtn, styles.fabBtnDelete]}
                onPress={deleteAllQuestionBank}
                activeOpacity={0.82}
              >
                <Icon source="delete-sweep" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Import / Export */}
            <View style={styles.fabRow}>
              <View style={styles.fabLabelPill}>
                <Text style={styles.fabLabelText}>Import/Export</Text>
              </View>
              <TouchableOpacity
                style={[styles.fabBtn, styles.fabBtnImport]}
                onPress={() => setShowImportExportDialog(true)}
                activeOpacity={0.82}
              >
                <Icon source="upload" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Add Question — primary, slightly larger */}
            <View style={styles.fabRow}>
              <View style={styles.fabLabelPill}>
                <Text style={styles.fabLabelText}>Add Question</Text>
              </View>
              <TouchableOpacity
                style={[styles.fabBtn, styles.fabBtnPrimary]}
                onPress={() => setShowAddDialog(true)}
                activeOpacity={0.82}
              >
                <Icon source="plus" size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Delete All (generated) */}
            <View style={styles.fabRow}>
              <View style={styles.fabLabelPill}>
                <Text style={styles.fabLabelText}>Delete All</Text>
              </View>
              <TouchableOpacity
                style={[styles.fabBtn, styles.fabBtnDelete]}
                onPress={generatedQuestionsHook.deleteAllGeneratedQuestions}
                activeOpacity={0.82}
              >
                <Icon source="delete-sweep" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Generate Offline */}
            <View style={styles.fabRow}>
              <View style={styles.fabLabelPill}>
                <Text style={styles.fabLabelText}>Generate Offline</Text>
              </View>
              <TouchableOpacity
                style={[styles.fabBtn, styles.fabBtnImport]}
                onPress={async () => {
                  if (!isOnline) {
                    if (!selectedGeneratedRespondentType || !selectedGeneratedCommodity || !selectedGeneratedCountry) {
                      showAlert(
                        'Filter Required',
                        'Please select Respondent Type, Commodity, and Country to generate questions offline.'
                      );
                      return;
                    }
                    await generatedQuestionsHook.generateQuestionsOffline(
                      selectedGeneratedRespondentType,
                      selectedGeneratedCommodity,
                      selectedGeneratedCountry
                    );
                  } else {
                    showAlert(
                      'Generate Offline',
                      'You are currently online. This feature is for generating questions from cached Question Bank when offline. Would you like to cache the Question Bank for offline use?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Cache Now',
                          onPress: async () => {
                            await loadProjectAndQuestions();
                            showAlert('Success', 'Question Bank cached for offline use!');
                          },
                        },
                      ]
                    );
                  }
                }}
                activeOpacity={0.82}
              >
                <Icon source="cloud-download-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Reorder / Done */}
            <View style={styles.fabRow}>
              <View style={styles.fabLabelPill}>
                <Text style={styles.fabLabelText}>
                  {generatedQuestionsHook.isReorderMode ? 'Done' : 'Reorder'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.fabBtn, styles.fabBtnPrimary]}
                onPress={
                  generatedQuestionsHook.isReorderMode
                    ? generatedQuestionsHook.saveQuestionOrder
                    : () => {
                      if (filteredGeneratedQuestions.length === 0) {
                        showAlert('No Questions', 'There are no questions to reorder.');
                        return;
                      }
                      const first = filteredGeneratedQuestions[0];
                      const allSameBundle = filteredGeneratedQuestions.every(
                        (q) =>
                          q.assigned_respondent_type === first.assigned_respondent_type &&
                          q.assigned_commodity === first.assigned_commodity &&
                          q.assigned_country === first.assigned_country
                      );
                      if (!allSameBundle) {
                        showAlert(
                          'Filter Required',
                          'Please filter to a specific generation bundle (Respondent Type + Commodity + Country) before reordering.'
                        );
                        return;
                      }
                      generatedQuestionsHook.startReorderMode(filteredGeneratedQuestions);
                    }
                }
                activeOpacity={0.82}
              >
                <Icon
                  source={generatedQuestionsHook.isReorderMode ? 'check' : 'swap-vertical'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          </>
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
                <ProgressBar progress={importProgress} color={colors.primary.light} style={styles.progressBar} />
              </View>
            ) : (
              <View style={styles.importExportButtons}>
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Templates
                </Text>
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

                <Text variant="labelLarge" style={[styles.sectionLabel, { marginTop: 16 }]}>
                  Import
                </Text>
                <Button
                  mode="contained"
                  icon="upload"
                  onPress={handleImportQuestions}
                  style={[styles.importExportButton, styles.importButton]}>
                  Import Questions to Question Bank
                </Button>

                <Text variant="labelLarge" style={[styles.sectionLabel, { marginTop: 16 }]}>
                  Export Question Bank
                </Text>
                <Button
                  mode="contained"
                  icon="download"
                  onPress={() => handleExportQuestionBank('csv')}
                  style={[styles.importExportButton, styles.exportButton]}>
                  Export Question Bank (CSV)
                </Button>
                <Button
                  mode="contained"
                  icon="download"
                  onPress={() => handleExportQuestionBank('json')}
                  style={[styles.importExportButton, styles.exportButton]}>
                  Export Question Bank (JSON)
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
          resetFormFull();
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
        sectionMode={sectionMode}
        setSectionMode={setSectionMode}
        persistedSectionHeader={persistedSectionHeader}
        setPersistedSectionHeader={setPersistedSectionHeader}
        persistedSectionPreamble={persistedSectionPreamble}
        setPersistedSectionPreamble={setPersistedSectionPreamble}
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
          resetFormFull();
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
        sectionMode={sectionMode}
        setSectionMode={setSectionMode}
        persistedSectionHeader={persistedSectionHeader}
        setPersistedSectionHeader={setPersistedSectionHeader}
        persistedSectionPreamble={persistedSectionPreamble}
        setPersistedSectionPreamble={setPersistedSectionPreamble}
        addOption={addOption}
        removeOption={removeOption}
        responseTypes={responseTypes}
        questionBankChoices={questionBankChoices}
        questions={questions}
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },

  // ── Hero
  hero: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  heroTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.65)',
  },
  heroRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  onlinePillText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  countBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: '#fff',
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
    backgroundColor: colors.primary.faint,
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.primary.muted,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 12,
  },
  // Compact FAB row: label pill (left) + round icon button (right)
  fabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fabLabelPill: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border.light,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  fabLabelText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
  },
  fabBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  fabBtnPrimary: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.dark,
  },
  fabBtnDelete: {
    backgroundColor: colors.status.error,
  },
  fabBtnImport: {
    backgroundColor: colors.status.info,
  },
  dialog: {
    backgroundColor: colors.background.paper,
    borderRadius: 20,
  },
  dialogTitle: {
    color: colors.text.primary,
  },
  importingContainer: {
    padding: 16,
  },
  importingText: {
    color: colors.text.primary,
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
    backgroundColor: colors.primary.dark,
  },
  importButton: {
    backgroundColor: colors.status.info,
  },
  exportButton: {
    backgroundColor: colors.status.success,
  },
  sectionLabel: {
    color: colors.text.primary,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  tabContainer: {
    backgroundColor: colors.background.paper,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  segmentedButtons: {
    backgroundColor: colors.background.subtle,
  },
  segmentedButtonText: {
    color: colors.text.primary,
  },
  reorderBanner: {
    backgroundColor: colors.primary.faint,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.light,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  reorderBannerText: {
    color: colors.text.primary,
    marginBottom: 12,
    fontWeight: '600',
  },
  reorderActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  reorderButton: {
    borderColor: colors.primary.light,
  },
  saveButton: {
    backgroundColor: colors.primary.dark,
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
    backgroundColor: colors.primary.faint,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.primary.muted,
  },
  reorderButtonDisabled: {
    opacity: 0.3,
  },
  orderIndex: {
    color: colors.text.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  questionCardContent: {
    flex: 1,
  },
  generatedFiltersContainer: {
    backgroundColor: colors.background.paper,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  filterLabel: {
    color: colors.text.primary,
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
    color: colors.text.secondary,
    marginBottom: 4,
  },
  filterButton: {
    borderColor: colors.border.medium,
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
  },
});

export default React.memo(FormBuilderScreen);
