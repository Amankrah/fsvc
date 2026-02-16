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

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Card, ActivityIndicator, IconButton, Portal, Dialog, TextInput as PaperTextInput, Button, Switch, Snackbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ScreenWrapper } from '../components/layout/ScreenWrapper';

// Services
import apiService from '../services/api';

// Constants
import { getCategorySortIndex } from '../constants/formBuilder';
import { colors } from '../constants/theme';

// Types
type RootStackParamList = {
  DataCollection: { projectId: string; projectName: string };
};

type DataCollectionRouteProp = RouteProp<RootStackParamList, 'DataCollection'>;

const DataCollectionScreen: React.FC = () => {
  const route = useRoute<DataCollectionRouteProp>();
  const navigation = useNavigation();
  const { projectId, projectName } = route.params;
  const insets = useSafeAreaInsets();

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
  const [showDraftNameDialog, setShowDraftNameDialog] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftsLoadedOffline, setDraftsLoadedOffline] = useState(false);

  // Scroll & navigation feedback
  const scrollViewRef = useRef<ScrollView>(null);
  const [navSnackVisible, setNavSnackVisible] = useState(false);
  const [navSnackMessage, setNavSnackMessage] = useState('');
  const prevQuestionIndexRef = useRef<number | null>(null);

  // Respondent Hook
  const respondent = useRespondent(projectId);

  // Questions Hook
  const questions = useQuestions({
    projectId,
    selectedRespondentType: respondent.selectedRespondentType,
    selectedCommodities: respondent.selectedCommodities,
    selectedCountry: respondent.selectedCountry,
    useProjectBankOnly,
    isSurveyRunning: !showRespondentForm, // Pass survey state to control auto-reloading
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

  // Scroll to top and show navigation toast when question changes
  useEffect(() => {
    if (prevQuestionIndexRef.current !== null && prevQuestionIndexRef.current !== responses.currentQuestionIndex) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      setNavSnackMessage(`Question ${responses.currentQuestionIndex + 1} of ${responses.visibleQuestions.length}`);
      setNavSnackVisible(true);
    }
    prevQuestionIndexRef.current = responses.currentQuestionIndex;
  }, [responses.currentQuestionIndex, responses.visibleQuestions.length]);

  // Handle Load Drafts — with offline fallback
  const handleLoadDrafts = async () => {
    try {
      setLoadingDrafts(true);
      setDraftsLoadedOffline(false);
      console.log(`Loading drafts for project: ${projectId}`);

      try {
        const result = await apiService.getDraftResponses(projectId);
        console.log(`Received ${result.count || 0} drafts from backend:`, result);

        // Log each draft's status
        if (result.drafts && result.drafts.length > 0) {
          result.drafts.forEach((draft: any, index: number) => {
            console.log(`Draft ${index + 1}: ID=${draft.id}, Status=${draft.completion_status}, Name=${draft.draft_name || '(none)'}, Respondent=${draft.respondent_id}`);
          });
        }

        setDrafts(result.drafts || []);

        // Sync server drafts to local cache for offline access
        try {
          const { offlineDraftCache } = require('../services/offlineDraftCache');
          await offlineDraftCache.syncDraftsFromServer(projectId, (result.drafts || []).map((d: any) => ({
            id: d.id,
            respondent_id: d.respondent_id,
            draft_name: d.draft_name || '',
            project: projectId,
            respondent_type: d.respondent_type,
            commodity: d.commodity,
            country: d.country,
            responses: [],
            completion_status: d.completion_status,
            created_at: d.created_at,
            last_response_at: d.last_response_at,
          })));
        } catch (cacheErr) {
          console.warn('Failed to sync drafts to local cache:', cacheErr);
        }
      } catch (apiError: any) {
        console.warn('API call failed, trying offline cache:', apiError.message);
        // Fallback to offline cache
        try {
          const { offlineDraftCache } = require('../services/offlineDraftCache');
          const cachedDrafts = await offlineDraftCache.getCachedDrafts(projectId);
          setDrafts(cachedDrafts);
          setDraftsLoadedOffline(true);
          console.log(`Loaded ${cachedDrafts.length} drafts from offline cache`);
        } catch (cacheErr) {
          console.error('Offline cache also failed:', cacheErr);
          showAlert('Error', 'Failed to load draft responses. No cached drafts available.');
          setLoadingDrafts(false);
          return;
        }
      }

      setShowDraftsDialog(true);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      showAlert('Error', 'Failed to load draft responses');
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Handle Save Draft with Name — shows the name dialog first
  const handleSaveDraftWithName = () => {
    setDraftName('');
    setShowDraftNameDialog(true);
  };

  // Confirm draft save with the entered name
  const confirmSaveDraft = () => {
    setShowDraftNameDialog(false);
    responses.handleSaveDraft(() => navigation.goBack(), draftName.trim() || undefined);
  };

  // Handle Resume Draft - Optimized with cleaner flow
  const handleResumeDraft = async (draft: any) => {
    setIsResumingDraft(true);
    try {
      setShowDraftsDialog(false);

      // STRICT VALIDATION: Ensure all 3 filters are present in the draft
      if (!draft.respondent_type || !draft.commodity || !draft.country) {
        console.error('Cannot resume draft - missing required filters:', {
          respondent_type: draft.respondent_type,
          commodity: draft.commodity,
          country: draft.country
        });
        showAlert('Error', 'Cannot resume this draft - it is missing required information (respondent type, commodity, or country).');
        return;
      }

      console.log('📋 Resuming draft:', {
        database_id: draft.id,
        respondent_id: draft.respondent_id,
        respondent_type: draft.respondent_type,
        commodity: draft.commodity,
        country: draft.country,
        response_count: draft.response_count
      });

      // Store the draft's database ID for submission
      setResumedDraftDatabaseId(draft.id);

      // Set respondent information
      respondent.setRespondentId(draft.respondent_id);
      respondent.setSelectedRespondentType(draft.respondent_type);
      const commodities = draft.commodity.split(',').map((c: string) => c.trim());
      respondent.setSelectedCommodities(commodities);
      respondent.setSelectedCountry(draft.country);

      // Wait for state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load questions and responses in parallel for efficiency
      const [questionsResponse, responsesData] = await Promise.all([
        apiService.getQuestionsForRespondent(
          projectId,
          {
            assigned_respondent_type: draft.respondent_type,
            assigned_commodity: draft.commodity,
            assigned_country: draft.country,
          },
          { page: 1, page_size: 1000 }
        ),
        apiService.getRespondentResponses(draft.id)
      ]);

      const loadedQuestions = questionsResponse.questions || [];

      // Verify questions loaded
      if (loadedQuestions.length === 0) {
        console.error('❌ No questions loaded for draft criteria');
        showAlert('Error', 'No questions found for this respondent criteria. Please ensure questions are generated for this combination.');
        return;
      }

      console.log(`✅ Loaded ${loadedQuestions.length} questions for resume`);

      // Sort questions by category and order
      loadedQuestions.sort((a: any, b: any) => {
        const categoryA = a.question_category || '';
        const categoryB = b.question_category || '';
        const categoryIndexA = getCategorySortIndex(categoryA);
        const categoryIndexB = getCategorySortIndex(categoryB);

        if (categoryIndexA !== categoryIndexB) {
          return categoryIndexA - categoryIndexB;
        }
        return a.order_index - b.order_index;
      });

      // Build responses object and track existing question IDs
      const loadedResponses: any = {};
      const existingQuestionIds = new Set<string>();

      if (responsesData.responses && responsesData.responses.length > 0) {
        responsesData.responses.forEach((resp: any) => {
          existingQuestionIds.add(resp.question);

          // Parse JSON values if needed
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

        // Store pre-existing IDs before loading responses
        setPreExistingResponseQuestionIds(existingQuestionIds);

        // Load all responses at once
        responses.loadResponses(loadedResponses);
      }

      console.log(`✅ Loaded ${Object.keys(loadedResponses).length} existing responses`);

      // Get resume metadata from backend (includes calculated resume index)
      const resumeIndex = responsesData.resume_metadata?.resume_index ?? 0;
      const answeredCount = responsesData.resume_metadata?.answered_count ?? 0;
      const totalQuestions = responsesData.resume_metadata?.available_question_count ?? 0;

      console.log(`📊 Backend calculated resume index: ${resumeIndex} (question ${resumeIndex + 1} of ${totalQuestions})`);

      // Start the survey
      setShowRespondentForm(false);

      // Set the resume index provided by backend
      // Use setTimeout to ensure state updates have propagated
      setTimeout(() => {
        console.log(`🎯 Setting question index to ${resumeIndex}`);
        responses.setQuestionIndex(resumeIndex);
        setIsResumingDraft(false);

        // Show success alert
        setTimeout(() => {
          showAlert(
            'Draft Loaded',
            `Resuming survey for ${draft.respondent_id}\n\n` +
            `${answeredCount} of ${totalQuestions} questions answered.\n` +
            `Starting at question ${resumeIndex + 1}.`,
            [{ text: 'Continue' }]
          );
        }, 200);
      }, 500);

    } catch (error: any) {
      setIsResumingDraft(false);
      console.error('❌ Error resuming draft:', error);

      // Provide more helpful error message
      const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error';
      showAlert(
        'Error Loading Draft',
        `Failed to load draft: ${errorMsg}\n\nPlease try again or contact support if the problem persists.`
      );
    }
  };

  // Handle Generate Questions
  const handleGenerateQuestions = async () => {
    // CRITICAL SECURITY: Block if any filter is missing
    if (!respondent.selectedRespondentType || respondent.selectedCommodities.length === 0 || !respondent.selectedCountry) {
      const missing = [];
      if (!respondent.selectedRespondentType) missing.push('Respondent Type');
      if (respondent.selectedCommodities.length === 0) missing.push('Commodity');
      if (!respondent.selectedCountry) missing.push('Country');

      showAlert(
        'Cannot Generate Questions',
        `All 3 filters are required to generate questions:\n\n` +
        `Missing: ${missing.join(', ')}\n\n` +
        `This requirement prevents data leakage and ensures data integrity.`
      );
      return;
    }

    await questions.generateDynamicQuestions(false, false);
  };

  // Handle Start Survey
  const handleStartSurvey = () => {
    if (!respondent.respondentId) {
      showAlert('Missing Information', 'Please provide a respondent ID');
      return;
    }

    // CRITICAL SECURITY: Block if any filter is missing
    if (!respondent.selectedRespondentType || respondent.selectedCommodities.length === 0 || !respondent.selectedCountry) {
      const missing = [];
      if (!respondent.selectedRespondentType) missing.push('Respondent Type');
      if (respondent.selectedCommodities.length === 0) missing.push('Commodity');
      if (!respondent.selectedCountry) missing.push('Country');

      showAlert(
        'Cannot Start Survey',
        `All 3 filters are required:\n\n` +
        `Missing: ${missing.join(', ')}\n\n` +
        `Please complete all selections before starting the survey.`
      );
      return;
    }

    if (responses.visibleQuestions.length === 0) {
      showAlert('No Questions', 'Please generate questions before starting the survey');
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
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <IconButton
            icon="arrow-left"
            iconColor={colors.text.primary}
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
              iconColor={colors.status.info}
              size={24}
              onPress={() => (navigation as any).navigate('BundleCompletion', {
                projectId,
                projectName,
                mode: 'user'
              })}
            />
            <IconButton
              icon="file-document-edit-outline"
              iconColor={colors.accent.orange}
              size={24}
              onPress={handleLoadDrafts}
              disabled={loadingDrafts}
            />
            <IconButton
              icon="download"
              iconColor={colors.status.success}
              size={24}
              onPress={handleExportJSON}
            />
            <IconButton
              icon="share-variant"
              iconColor={colors.primary.main}
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
                color={colors.primary.main}
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
          loadingQuestions={questions.loadingQuestions}
          cachingForOffline={questions.cachingForOffline}
          cachedOfflineCount={questions.cachedOfflineCount}
          onGenerateQuestions={handleGenerateQuestions}
          onStartSurvey={handleStartSurvey}
          onCacheForOffline={questions.cacheForOffline}
        />

        {/* Create Link Dialog */}
        <Portal>
          <Dialog visible={showLinkDialog} onDismiss={() => setShowLinkDialog(false)}>
            <Dialog.Title>Create Shareable Link</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium" style={{ marginBottom: 16, color: colors.text.secondary }}>
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

              <Text variant="bodySmall" style={{ color: colors.text.disabled, marginTop: 8 }}>
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
                  <ActivityIndicator size="large" color={colors.primary.main} />
                  <Text style={{ marginTop: 12, color: colors.text.secondary }}>Loading drafts...</Text>
                </View>
              ) : drafts.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text variant="bodyMedium" style={{ color: colors.text.secondary, textAlign: 'center' }}>
                    No draft responses found for this project.
                  </Text>
                  <Text variant="bodySmall" style={{ color: colors.text.disabled, textAlign: 'center', marginTop: 8 }}>
                    Start a new survey and use "Save for Later" to create drafts.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 400 }}>
                  {draftsLoadedOffline && (
                    <View style={{ backgroundColor: colors.accent.orange + '20', padding: 8, borderRadius: 8, marginBottom: 12 }}>
                      <Text variant="bodySmall" style={{ color: colors.accent.orange, textAlign: 'center', fontWeight: '600' }}>
                        ⚡ Loaded from offline cache
                      </Text>
                    </View>
                  )}
                  {drafts.map((draft, index) => (
                    <Card
                      key={draft.id}
                      style={{
                        marginBottom: 12,
                        backgroundColor: colors.background.subtle,
                      }}
                      onPress={() => handleResumeDraft(draft)}
                    >
                      <Card.Content>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            {draft.draft_name ? (
                              <>
                                <Text variant="titleMedium" style={{ fontWeight: 'bold', color: colors.text.primary }}>
                                  {draft.draft_name}
                                </Text>
                                <Text variant="bodySmall" style={{ color: colors.text.disabled, marginTop: 2 }}>
                                  ID: {draft.respondent_id}
                                </Text>
                              </>
                            ) : (
                              <Text variant="titleMedium" style={{ fontWeight: 'bold', color: colors.text.primary }}>
                                {draft.respondent_id}
                              </Text>
                            )}
                            <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 4 }}>
                              {draft.respondent_type && `Type: ${draft.respondent_type}`}
                              {draft.commodity && ` • Commodity: ${draft.commodity}`}
                              {draft.country && ` • Country: ${draft.country}`}
                            </Text>
                            <Text variant="bodySmall" style={{ color: colors.text.disabled, marginTop: 4 }}>
                              Last updated: {new Date(draft.last_response_at || draft.created_at).toLocaleString()}
                            </Text>
                            {draft.response_count !== undefined && (
                              <Text variant="bodySmall" style={{ color: colors.primary.main, marginTop: 4, fontWeight: '600' }}>
                                {draft.response_count} response(s) saved
                              </Text>
                            )}
                            {draft.is_offline && (
                              <Text variant="bodySmall" style={{ color: colors.accent.orange, marginTop: 4, fontWeight: '600' }}>
                                📱 Saved offline — will sync when connected
                              </Text>
                            )}
                          </View>
                          <IconButton
                            icon="arrow-right"
                            iconColor={colors.primary.main}
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
                <ActivityIndicator size="large" color={colors.primary.main} style={{ marginRight: 20 }} />
                <View>
                  <Text variant="titleMedium">Resuming Draft</Text>
                  <Text variant="bodySmall" style={{ color: colors.text.secondary }}>Please wait...</Text>
                </View>
              </View>
            </Dialog.Content>
          </Dialog>

          {/* Draft Name Dialog */}
          <Dialog visible={showDraftNameDialog} onDismiss={() => setShowDraftNameDialog(false)}>
            <Dialog.Title>Name Your Draft</Dialog.Title>
            <Dialog.Content>
              <Text variant="bodyMedium" style={{ marginBottom: 16, color: colors.text.secondary }}>
                Give this draft a name so you can easily find it later. The respondent ID will not be affected.
              </Text>
              <PaperTextInput
                label="Draft Name (optional)"
                value={draftName}
                onChangeText={setDraftName}
                mode="outlined"
                placeholder="e.g. John's Farm Visit, Morning Session"
                autoFocus
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowDraftNameDialog(false)}>Cancel</Button>
              <Button onPress={confirmSaveDraft} mode="contained">
                Save Draft
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScreenWrapper>
    );
  }

  // Show Question Form
  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <IconButton
          icon="arrow-left"
          iconColor={colors.text.primary}
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
            ref={scrollViewRef}
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
                <ActivityIndicator size="large" color={colors.primary.light} />
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
            onSaveDraft={handleSaveDraftWithName}
            submitting={responses.submitting}
            canGoBack={responses.currentQuestionIndex > 0}
            isLastQuestion={
              responses.currentQuestionIndex === responses.visibleQuestions.length - 1
            }
          />
        )}
      </KeyboardAvoidingView>

      {/* Navigation Toast */}
      <Snackbar
        visible={navSnackVisible}
        onDismiss={() => setNavSnackVisible(false)}
        duration={1500}
        wrapperStyle={styles.snackbarWrapper}
        style={styles.snackbar}
      >
        {navSnackMessage}
      </Snackbar>

      {/* Draft Name Dialog (must be in this view too for question form) */}
      <Portal>
        <Dialog visible={showDraftNameDialog} onDismiss={() => setShowDraftNameDialog(false)}>
          <Dialog.Title>Name Your Draft</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={{ marginBottom: 16, color: colors.text.secondary }}>
              Give this draft a name so you can easily find it later. The respondent ID will not be affected.
            </Text>
            <PaperTextInput
              label="Draft Name (optional)"
              value={draftName}
              onChangeText={setDraftName}
              mode="outlined"
              placeholder="e.g. John's Farm Visit, Morning Session"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDraftNameDialog(false)}>Cancel</Button>
            <Button onPress={confirmSaveDraft} mode="contained">
              Save Draft
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    paddingBottom: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 3,
    borderBottomColor: colors.primary.main,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: colors.text.primary,
    fontWeight: 'bold',
  },
  subtitle: {
    color: colors.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  questionCard: {
    backgroundColor: colors.primary.faint,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  followUpIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 6,
  },
  followUpIcon: {
    color: colors.status.warning,
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 8,
  },
  followUpText: {
    color: colors.accent.orange,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followUpQuestionText: {
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.status.warning,
  },
  sectionHeaderContainer: {
    backgroundColor: 'rgba(67, 56, 202, 0.06)',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.light,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  sectionHeaderText: {
    color: colors.primary.main,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionPreambleContainer: {
    backgroundColor: colors.primary.faint,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  sectionPreambleText: {
    color: colors.text.secondary,
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
    backgroundColor: 'rgba(67, 56, 202, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(67, 56, 202, 0.2)',
  },
  questionBadgeText: {
    color: colors.primary.main,
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoryBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  categoryBadgeText: {
    color: colors.status.success,
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadge: {
    backgroundColor: 'rgba(67, 56, 202, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(67, 56, 202, 0.2)',
  },
  typeBadgeText: {
    color: colors.primary.light,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  requiredBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  requiredBadgeText: {
    color: colors.status.error,
    fontSize: 11,
    fontWeight: '600',
  },
  questionText: {
    color: colors.text.primary,
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
    color: colors.text.secondary,
    marginTop: 16,
  },
  configCard: {
    backgroundColor: colors.primary.faint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.light,
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
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  scopeDescription: {
    color: colors.text.secondary,
    lineHeight: 18,
  },
  scopeHelpText: {
    color: colors.text.disabled,
    fontStyle: 'italic',
    marginTop: 4,
  },
  snackbarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  snackbar: {
    backgroundColor: 'rgba(67, 56, 202, 0.85)',
  },
});

export default React.memo(DataCollectionScreen);
