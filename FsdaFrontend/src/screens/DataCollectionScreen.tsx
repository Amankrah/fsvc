/**
 * DataCollectionScreen - Refactored Version
 * Modular, production-ready implementation with clean separation of concerns
 *
 * Architecture:
 * - Custom hooks handle business logic
 * - Reusable components handle UI
 * - Constants centralize configuration
 * - Full Django backend compatibility
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Card, ActivityIndicator, IconButton, Portal, Dialog, TextInput as PaperTextInput, Button, Switch } from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { showAlert, showError, showInfo } from '../utils/alert';

// Custom Hooks
import { useRespondent, useQuestions, useResponseState } from '../hooks/dataCollection';

// Components
import {
  RespondentForm,
  QuestionInput,
  NavigationControls,
  SwipeableQuestionView,
} from '../components/dataCollection';

// Services
import apiService from '../services/api';

// Constants
import { getCategorySortIndex } from '../constants/formBuilder';

// Types
type RootStackParamList = {
  DataCollection: { projectId: string; projectName: string };
};

type DataCollectionRouteProp = RouteProp<RootStackParamList, 'DataCollection'>;

const DataCollectionScreen: React.FC = () => {
  const route = useRoute<DataCollectionRouteProp>();
  const navigation = useNavigation();
  const { projectId, projectName } = route.params;

  const [showRespondentForm, setShowRespondentForm] = useState(true);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showDraftsDialog, setShowDraftsDialog] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkExpirationDays, setLinkExpirationDays] = useState('7');
  const [linkMaxResponses, setLinkMaxResponses] = useState('100');
  const [creatingLink, setCreatingLink] = useState(false);
  const [useProjectBankOnly, setUseProjectBankOnly] = useState(true);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [resumedDraftDatabaseId, setResumedDraftDatabaseId] = useState<string | null>(null);
  const [preExistingResponseQuestionIds, setPreExistingResponseQuestionIds] = useState<Set<string>>(new Set());
  const [isResumingDraft, setIsResumingDraft] = useState(false);

  // Respondent Hook
  const respondent = useRespondent(projectId);

  // Questions Hook
  const questions = useQuestions({
    projectId,
    selectedRespondentType: respondent.selectedRespondentType,
    selectedCommodities: respondent.selectedCommodities,
    selectedCountry: respondent.selectedCountry,
    useProjectBankOnly,
  });

  // Response State Hook
  const responses = useResponseState(
    questions.questions,
    projectId,
    {
      respondentId: respondent.respondentId,
      respondentType: respondent.selectedRespondentType as string,
      commodities: respondent.selectedCommodities,
      country: respondent.selectedCountry,
    },
    resumedDraftDatabaseId,  // Pass the draft's database ID when resuming
    preExistingResponseQuestionIds  // Pass the set of question IDs that already have responses
  );

  // Load available options on mount and when projectId changes
  useEffect(() => {
    questions.loadAvailableOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-generate respondent ID on mount and when projectId changes
  useEffect(() => {
    if (respondent.useAutoId && !respondent.respondentId) {
      respondent.generateNewRespondentId();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Reset state when projectId changes
  useEffect(() => {
    setShowRespondentForm(true);
    respondent.resetForNextRespondent();
    responses.resetResponses();
    questions.resetQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Handle Load Drafts
  const handleLoadDrafts = async () => {
    try {
      setLoadingDrafts(true);
      console.log(`Loading drafts for project: ${projectId}`);
      const result = await apiService.getDraftResponses(projectId);
      console.log(`Received ${result.count || 0} drafts from backend:`, result);

      // Log each draft's status
      if (result.drafts && result.drafts.length > 0) {
        result.drafts.forEach((draft: any, index: number) => {
          console.log(`Draft ${index + 1}: ID=${draft.id}, Status=${draft.completion_status}, Respondent=${draft.respondent_id}`);
        });
      }

      setDrafts(result.drafts || []);
      setShowDraftsDialog(true);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      showAlert('Error', 'Failed to load draft responses');
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Handle Resume Draft
  const handleResumeDraft = async (draft: any) => {
    setIsResumingDraft(true);
    try {
      setShowDraftsDialog(false);

      // Store the draft's database ID for submission
      setResumedDraftDatabaseId(draft.id);

      // Set respondent information first (using the draft's database ID as respondent_id)
      respondent.setRespondentId(draft.respondent_id);
      respondent.setSelectedRespondentType(draft.respondent_type || '');

      const commodities = draft.commodity ? draft.commodity.split(',').map((c: string) => c.trim()) : [];
      respondent.setSelectedCommodities(commodities);
      respondent.setSelectedCountry(draft.country || '');

      console.log('Resume criteria:', {
        respondent_type: draft.respondent_type,
        commodities: commodities,
        commodity_string: draft.commodity,
        country: draft.country,
        database_id: draft.id
      });

      // Wait for state to update before generating questions
      await new Promise(resolve => setTimeout(resolve, 100));

      // STRICT VALIDATION: Ensure all 3 filters are present in the draft
      if (!draft.respondent_type || !draft.commodity || !draft.country) {
        console.error('Cannot resume draft - missing required filters:', {
          respondent_type: draft.respondent_type,
          commodity: draft.commodity,
          country: draft.country
        });
        alert('Cannot resume this draft - it is missing required information (respondent type, commodity, or country).');
        return;
      }

      // Load questions using the filtered API endpoint for this draft's criteria
      const filteredResponse = await apiService.getQuestionsForRespondent(
        projectId,
        {
          assigned_respondent_type: draft.respondent_type,
          assigned_commodity: draft.commodity,
          assigned_country: draft.country,
        },
        {
          page: 1,
          page_size: 1000,
        }
      );

      const matchingQuestions = filteredResponse.questions || [];

      // Sort by category order first, then by order_index within each category
      const loadedQuestions = matchingQuestions.sort((a: any, b: any) => {
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

      // Verify questions loaded
      if (!loadedQuestions || loadedQuestions.length === 0) {
        console.error('No questions loaded after generation');
        showAlert('Error', 'Failed to load questions for this respondent. Please check that questions were generated for this criteria.');
        return;
      }

      console.log(`Loaded ${loadedQuestions.length} questions for resume`);

      // Load the draft's responses
      const draftResponses = await apiService.getRespondentResponses(draft.id);

      // Build the responses object and track pre-existing response question IDs
      const loadedResponses: any = {};
      const existingQuestionIds = new Set<string>();

      if (draftResponses.responses && draftResponses.responses.length > 0) {
        draftResponses.responses.forEach((resp: any) => {
          // Track this question ID as having a pre-existing response
          existingQuestionIds.add(resp.question);

          // Parse JSON arrays if needed
          let value = resp.response_value;
          try {
            if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
              value = JSON.parse(value);
            }
          } catch (e) {
            // Keep original value if parsing fails
          }
          loadedResponses[resp.question] = value;
        });

        // Load all responses at once
        responses.loadResponses(loadedResponses);

        // Store the pre-existing response question IDs
        setPreExistingResponseQuestionIds(existingQuestionIds);
        console.log(`Captured ${existingQuestionIds.size} pre-existing response question IDs`);
      }

      console.log(`Loaded ${Object.keys(loadedResponses).length} existing responses`);

      // Calculate resume position using the loaded questions
      const answeredQuestionIds = new Set(Object.keys(loadedResponses));

      console.log('Total questions captured:', loadedQuestions.length);
      console.log('Answered questions:', answeredQuestionIds.size);

      // Find the last answered question index
      let lastAnsweredIndex = -1;
      for (let i = loadedQuestions.length - 1; i >= 0; i--) {
        if (answeredQuestionIds.has(loadedQuestions[i].id)) {
          lastAnsweredIndex = i;
          break;
        }
      }

      console.log('Last answered index:', lastAnsweredIndex);

      // Move to the next unanswered question (or stay at last if all answered)
      const resumeIndex = Math.min(
        lastAnsweredIndex + 1,
        loadedQuestions.length - 1
      );

      console.log('Resume index:', resumeIndex);

      const totalQuestions = loadedQuestions.length;
      const answeredCount = answeredQuestionIds.size;

      // Start the survey
      setShowRespondentForm(false);

      // Wait for UI to render, then set question index and show alert
      setTimeout(() => {
        // Set the question index to resume from
        if (resumeIndex > 0) {
          responses.setQuestionIndex(resumeIndex);
        }

        setIsResumingDraft(false);

        showAlert(
          'Draft Loaded',
          `Resuming survey for ${draft.respondent_id}\n\n` +
          `${answeredCount} of ${totalQuestions} questions already answered.\n` +
          `Starting at question ${resumeIndex + 1}.`,
          [{ text: 'Continue' }]
        );
      }, 200);

    } catch (error: any) {
      setIsResumingDraft(false);
      console.error('Error resuming draft:', error);
      showAlert('Error', 'Failed to load draft. Please try again.');
    }
  };

  // Handle Generate Questions
  const handleGenerateQuestions = async () => {
    await questions.generateDynamicQuestions(false, false);
  };

  // Handle Start Survey
  const handleStartSurvey = () => {
    if (!respondent.respondentId) {
      return;
    }

    if (responses.visibleQuestions.length === 0) {
      return;
    }

    setShowRespondentForm(false);
  };

  // Handle Submit Success
  const handleSubmitSuccess = () => {
    // Reset for next respondent
    respondent.resetForNextRespondent();
    responses.resetResponses();
    questions.resetQuestions();
    setResumedDraftDatabaseId(null);  // Clear draft ID
    setPreExistingResponseQuestionIds(new Set());  // Clear pre-existing response IDs
    setShowRespondentForm(true);
  };

  // Handle Finish and Go Back
  const handleFinishAndGoBack = () => {
    // Navigate to Dashboard after finishing data collection session
    (navigation as any).navigate('Dashboard');
  };

  // Handle Back to Form
  const handleBackToForm = () => {
    setShowRespondentForm(true);
  };

  // Handle Export JSON
  const handleExportJSON = async () => {
    if (questions.questions.length === 0) {
      showAlert('No Questions', 'Please generate questions first before exporting.');
      return;
    }

    try {
      const filters = {
        assigned_respondent_type: respondent.selectedRespondentType || undefined,
        assigned_commodity: respondent.selectedCommodities.join(',') || undefined,
        assigned_country: respondent.selectedCountry || undefined,
      };

      const blob = await apiService.exportGeneratedQuestionsJSON(projectId, filters);
      const fileName = `generated_questions_${new Date().toISOString().split('T')[0]}.json`;

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
        showAlert('Success', 'JSON export downloaded successfully');
      } else {
        // Mobile download using FileSystem and Sharing
        const FileSystem = require('expo-file-system');
        const Sharing = require('expo-sharing');

        // Convert blob to text
        const jsonText = await blob.text();

        // Save to file system
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, jsonText, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Export Generated Questions',
          });
          showAlert('Success', 'JSON export file shared successfully');
        } else {
          showAlert('Success', `File saved to: ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Error exporting JSON:', error);
      showError('Failed to export questions as JSON');
    }
  };

  // Handle Create Link
  const handleOpenLinkDialog = () => {
    if (questions.questions.length === 0) {
      showAlert('No Questions', 'Please generate questions first before creating a shareable link.');
      return;
    }
    setLinkTitle(projectName || 'Survey');
    setLinkDescription(`Please complete this survey for ${projectName}`);
    setShowLinkDialog(true);
  };

  const handleCreateLink = async () => {
    try {
      setCreatingLink(true);

      // Get all question IDs
      const questionIds = questions.questions.map((q: any) => q.id);

      const linkData = {
        project: projectId,
        question_set: questionIds,
        respondent_type: respondent.selectedRespondentType || '',
        commodity: respondent.selectedCommodities.join(',') || '',
        country: respondent.selectedCountry || '',
        title: linkTitle || projectName,
        description: linkDescription,
        expiration_days: parseInt(linkExpirationDays) || 7,
        max_responses: parseInt(linkMaxResponses) || 0,
        auto_expire_after_use: false,
      };

      const response = await apiService.createResponseLink(linkData);

      // Get the shareable URL from backend response
      const shareableUrl = response.share_url;

      if (!shareableUrl) {
        showAlert('Error', 'Failed to generate shareable URL. Please try again.');
        return;
      }

      showAlert(
        'Link Created Successfully!',
        `Your shareable survey link:\n\n${shareableUrl}\n\nShare this link with respondents to complete the survey in their browser.`,
        [
          {
            text: 'Copy Link',
            onPress: async () => {
              try {
                // Copy to clipboard using Expo Clipboard
                await Clipboard.setStringAsync(shareableUrl);
                showAlert('Success', 'Link copied to clipboard!');
              } catch (error) {
                console.error('Failed to copy to clipboard:', error);
                showAlert('Error', 'Failed to copy link. Please copy it manually.');
              }
              setShowLinkDialog(false);
            }
          },
          {
            text: 'View All Links',
            onPress: () => {
              setShowLinkDialog(false);
              (navigation as any).navigate('ResponseLinks', {
                projectId,
                projectName
              });
            }
          },
        ]
      );

      // Reset form
      setLinkTitle('');
      setLinkDescription('');
      setLinkExpirationDays('7');
      setLinkMaxResponses('100');

    } catch (error: any) {
      console.error('Error creating link:', error);
      showAlert('Error', error?.message || 'Failed to create shareable link');
    } finally {
      setCreatingLink(false);
    }
  };

  // Get current question
  const currentQuestion = responses.visibleQuestions[responses.currentQuestionIndex];

  // Show Respondent Form
  if (showRespondentForm) {
    return (
      <>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              iconColor="#ffffff"
              size={24}
              onPress={() => navigation.goBack()}
            />
            <View style={styles.headerContent}>
              <Text variant="headlineSmall" style={styles.title}>
                Data Collection
              </Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                {projectName}
              </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <IconButton
                icon="chart-bar"
                iconColor="#2196F3"
                size={24}
                onPress={() => (navigation as any).navigate('BundleCompletion', {
                  projectId,
                  projectName,
                  mode: 'user'
                })}
              />
              <IconButton
                icon="file-document-edit-outline"
                iconColor="#FFA500"
                size={24}
                onPress={handleLoadDrafts}
                disabled={loadingDrafts}
              />
              <IconButton
                icon="download"
                iconColor="#4CAF50"
                size={24}
                onPress={handleExportJSON}
              />
              <IconButton
                icon="share-variant"
                iconColor="#ffffff"
                size={24}
                onPress={handleOpenLinkDialog}
              />
            </View>
          </View>

          {/* Question Bank Scope Configuration */}
          <Card style={styles.configCard}>
            <Card.Content>
              <View style={styles.scopeControl}>
                <View style={styles.scopeTextContainer}>
                  <Text variant="titleMedium" style={styles.scopeTitle}>
                    Question Bank Scope
                  </Text>
                  <Text variant="bodySmall" style={styles.scopeDescription}>
                    {useProjectBankOnly
                      ? 'Using only questions from this project\'s question bank'
                      : 'Using questions from all accessible question banks'}
                  </Text>
                </View>
                <Switch
                  value={useProjectBankOnly}
                  onValueChange={setUseProjectBankOnly}
                  color="#6200ee"
                />
              </View>
              <Text variant="bodySmall" style={styles.scopeHelpText}>
                Toggle to choose between project-specific questions or all accessible questions
              </Text>
            </Card.Content>
          </Card>

          {/* Respondent Form */}
          <RespondentForm
            {...respondent}
            availableRespondentTypes={questions.availableRespondentTypes}
            availableCommodities={questions.availableCommodities}
            availableCountries={questions.availableCountries}
            loadingOptions={questions.loadingOptions}
            generatingQuestions={questions.generatingQuestions}
            questionsGenerated={questions.questionsGenerated}
            cachingForOffline={questions.cachingForOffline}
            cachedOfflineCount={questions.cachedOfflineCount}
            onGenerateQuestions={handleGenerateQuestions}
            onStartSurvey={handleStartSurvey}
            onCacheForOffline={questions.cacheForOffline}
          />
        </View>

        {/* Create Link Dialog */}
        <Portal>
          <Dialog visible={showLinkDialog} onDismiss={() => setShowLinkDialog(false)}>
            <Dialog.Title>Create Shareable Link</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium" style={{ marginBottom: 16, color: '#666' }}>
                Create a link to share this survey. Respondents can complete it in their browser without the app.
              </Text>

              <PaperTextInput
                label="Link Title"
                value={linkTitle}
                onChangeText={setLinkTitle}
                mode="outlined"
                style={{ marginBottom: 12 }}
              />

              <PaperTextInput
                label="Description (Optional)"
                value={linkDescription}
                onChangeText={setLinkDescription}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={{ marginBottom: 12 }}
              />

              <PaperTextInput
                label="Expiration (Days)"
                value={linkExpirationDays}
                onChangeText={setLinkExpirationDays}
                mode="outlined"
                keyboardType="numeric"
                style={{ marginBottom: 12 }}
              />

              <PaperTextInput
                label="Max Responses (0 = unlimited)"
                value={linkMaxResponses}
                onChangeText={setLinkMaxResponses}
                mode="outlined"
                keyboardType="numeric"
                style={{ marginBottom: 12 }}
              />

              <Text variant="bodySmall" style={{ color: '#999', marginTop: 8 }}>
                {questions.questions.length} questions will be included in this survey
              </Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowLinkDialog(false)}>Cancel</Button>
              <Button
                onPress={handleCreateLink}
                loading={creatingLink}
                disabled={creatingLink || !linkTitle}
              >
                Create Link
              </Button>
            </Dialog.Actions>
          </Dialog>

          {/* Drafts Dialog */}
          <Dialog
            visible={showDraftsDialog}
            onDismiss={() => setShowDraftsDialog(false)}
            style={{ maxHeight: '80%' }}
          >
            <Dialog.Title>Continue Draft Response</Dialog.Title>
            <Dialog.Content>
              {loadingDrafts ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#4b1e85" />
                  <Text style={{ marginTop: 12, color: '#666' }}>Loading drafts...</Text>
                </View>
              ) : drafts.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text variant="bodyMedium" style={{ color: '#666', textAlign: 'center' }}>
                    No draft responses found for this project.
                  </Text>
                  <Text variant="bodySmall" style={{ color: '#999', textAlign: 'center', marginTop: 8 }}>
                    Start a new survey and use "Save for Later" to create drafts.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 400 }}>
                  {drafts.map((draft, index) => (
                    <Card
                      key={draft.id}
                      style={{
                        marginBottom: 12,
                        backgroundColor: '#f5f5f5',
                      }}
                      onPress={() => handleResumeDraft(draft)}
                    >
                      <Card.Content>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text variant="titleMedium" style={{ fontWeight: 'bold', color: '#333' }}>
                              {draft.respondent_id}
                            </Text>
                            <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                              {draft.respondent_type && `Type: ${draft.respondent_type}`}
                              {draft.commodity && ` • Commodity: ${draft.commodity}`}
                              {draft.country && ` • Country: ${draft.country}`}
                            </Text>
                            <Text variant="bodySmall" style={{ color: '#999', marginTop: 4 }}>
                              Last updated: {new Date(draft.last_response_at || draft.created_at).toLocaleString()}
                            </Text>
                            {draft.response_count !== undefined && (
                              <Text variant="bodySmall" style={{ color: '#4b1e85', marginTop: 4, fontWeight: '600' }}>
                                {draft.response_count} response(s) saved
                              </Text>
                            )}
                          </View>
                          <IconButton
                            icon="arrow-right"
                            iconColor="#4b1e85"
                            size={24}
                            onPress={() => handleResumeDraft(draft)}
                          />
                        </View>
                      </Card.Content>
                    </Card>
                  ))}
                </ScrollView>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDraftsDialog(false)}>Close</Button>
            </Dialog.Actions>
          </Dialog>

          {/* Loading Draft Dialog */}
          <Dialog visible={isResumingDraft} dismissable={false}>
            <Dialog.Content>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
                <ActivityIndicator size="large" color="#4b1e85" style={{ marginRight: 20 }} />
                <View>
                  <Text variant="titleMedium">Resuming Draft</Text>
                  <Text variant="bodySmall" style={{ color: '#666' }}>Please wait...</Text>
                </View>
              </View>
            </Dialog.Content>
          </Dialog>
        </Portal>
      </>
    );
  }

  // Show Question Form
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          iconColor="#ffffff"
          size={24}
          onPress={handleBackToForm}
        />
        <View style={styles.headerContent}>
          <Text variant="titleMedium" style={styles.title}>
            {projectName}
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            Respondent: {respondent.respondentId}
          </Text>
        </View>
        <View style={{ width: 48 }} />
      </View>

      {/* Question Card */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <SwipeableQuestionView
          onSwipeLeft={responses.handleNext}
          onSwipeRight={responses.handlePrevious}
          canSwipeLeft={responses.currentQuestionIndex < responses.visibleQuestions.length - 1}
          canSwipeRight={responses.currentQuestionIndex > 0}
          enabled={!responses.submitting}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {currentQuestion ? (
              <Card style={styles.questionCard}>
                <Card.Content>
                  {/* Follow-up Question Indicator */}
                  {currentQuestion.is_follow_up && (
                    <View style={styles.followUpIndicator}>
                      <Text style={styles.followUpIcon}>↳</Text>
                      <Text style={styles.followUpText}>Follow-up question</Text>
                    </View>
                  )}

                  {/* Section Header and Preamble */}
                  {currentQuestion.section_header && (
                    <>
                      {/* Show section header */}
                      <View style={styles.sectionHeaderContainer}>
                        <Text style={styles.sectionHeaderText}>
                          {currentQuestion.section_header}
                        </Text>
                      </View>

                      {/* Show preamble only for first question in section */}
                      {currentQuestion.section_preamble && (
                        (() => {
                          const prevQuestion = questions.questions[responses.currentQuestionIndex - 1];
                          const isFirstInSection = !prevQuestion || prevQuestion.section_header !== currentQuestion.section_header;
                          return isFirstInSection ? (
                            <View style={styles.sectionPreambleContainer}>
                              <Text style={styles.sectionPreambleText}>
                                {currentQuestion.section_preamble}
                              </Text>
                            </View>
                          ) : null;
                        })()
                      )}
                    </>
                  )}

                  {/* Question Number and Type */}
                  <View style={styles.questionHeader}>
                    <View style={styles.questionBadge}>
                      <Text style={styles.questionBadgeText}>
                        Q{responses.currentQuestionIndex + 1}
                      </Text>
                    </View>
                    {currentQuestion.question_category && (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>
                          {currentQuestion.question_category}
                        </Text>
                      </View>
                    )}
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {currentQuestion.response_type.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    {currentQuestion.is_required && (
                      <View style={styles.requiredBadge}>
                        <Text style={styles.requiredBadgeText}>Required</Text>
                      </View>
                    )}
                  </View>

                  {/* Question Text */}
                  <Text variant="headlineSmall" style={[
                    styles.questionText,
                    currentQuestion.is_follow_up && styles.followUpQuestionText
                  ]}>
                    {currentQuestion.question_text}
                  </Text>

                  {/* Question Input */}
                  <View style={styles.inputContainer}>
                    <QuestionInput
                      question={currentQuestion}
                      value={responses.responses[currentQuestion.id]}
                      onChange={responses.handleResponseChange}
                    />
                  </View>
                </Card.Content>
              </Card>
            ) : (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#64c8ff" />
                <Text style={styles.loadingText}>Loading question...</Text>
              </View>
            )}
          </ScrollView>
        </SwipeableQuestionView>

        {/* Navigation Controls */}
        {currentQuestion && (
          <NavigationControls
            currentIndex={responses.currentQuestionIndex}
            totalQuestions={responses.visibleQuestions.length}
            progress={responses.progress}
            onPrevious={responses.handlePrevious}
            onNext={responses.handleNext}
            onSubmit={() => responses.handleSubmit(handleSubmitSuccess, handleFinishAndGoBack)}
            onSaveDraft={() => responses.handleSaveDraft(() => navigation.goBack())}
            submitting={responses.submitting}
            canGoBack={responses.currentQuestionIndex > 0}
            isLastQuestion={
              responses.currentQuestionIndex === responses.visibleQuestions.length - 1
            }
          />
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a3a',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#4b1e85',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  questionCard: {
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  followUpIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 6,
  },
  followUpIcon: {
    color: '#ff9800',
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8,
  },
  followUpText: {
    color: '#ffb74d',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followUpQuestionText: {
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 152, 0, 0.3)',
  },
  sectionHeaderContainer: {
    backgroundColor: 'rgba(100, 200, 255, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#64c8ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  sectionHeaderText: {
    color: '#64c8ff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionPreambleContainer: {
    backgroundColor: 'rgba(100, 200, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  sectionPreambleText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  questionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  questionBadge: {
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.4)',
  },
  questionBadgeText: {
    color: '#64c8ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  categoryBadgeText: {
    color: '#81c784',
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadge: {
    backgroundColor: 'rgba(156, 39, 176, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(156, 39, 176, 0.4)',
  },
  typeBadgeText: {
    color: '#ce93d8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  requiredBadge: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.4)',
  },
  requiredBadgeText: {
    color: '#ef5350',
    fontSize: 11,
    fontWeight: '600',
  },
  questionText: {
    color: '#ffffff',
    marginBottom: 24,
    lineHeight: 32,
  },
  inputContainer: {
    marginTop: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  configCard: {
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
    marginBottom: 16,
  },
  scopeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scopeTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  scopeTitle: {
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 4,
  },
  scopeDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
  },
  scopeHelpText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
    marginTop: 4,
  },
});

export default React.memo(DataCollectionScreen);
