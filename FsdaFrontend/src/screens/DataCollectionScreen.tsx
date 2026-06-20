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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, FlatList, KeyboardAvoidingView, Platform, AppState, TouchableOpacity, Alert, useWindowDimensions, InteractionManager } from 'react-native';
import { Text, Card, ActivityIndicator, Portal, Dialog, TextInput as PaperTextInput, Switch, Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { showAlert, showConfirm, showError, showInfo } from '../utils/alert';

// Custom Hooks
import { useRespondent, useQuestions, useResponseState } from '../hooks/dataCollection';

// Components
import {
  RespondentForm,
  QuestionInput,
  NavigationControls,
  SwipeableQuestionView,
  SyncStatusBanner,
} from '../components/dataCollection';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';

// Services
import apiService from '../services/api';
import type { CachedDraft } from '../services/offlineDraftCache';

// Constants
import { getCategorySortIndex } from '../constants/formBuilder';
import { computeQuestionSetHash } from '../services/offlineDraftCache';
import { colors, spacing, borderRadius, typography } from '../constants/theme';

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
  const [enterDirection, setEnterDirection] = useState<'left' | 'right' | null>(null);

  // ── Survey view mode: 'linear' = all questions (default), 'single' = one at a time
  const [surveyMode, setSurveyMode] = useState<'linear' | 'single'>('linear');

  // Tablet landscape: focused question in sidebar
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const linearFlatListRef = useRef<FlatList>(null);

  // Detect tablet landscape mode
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isTabletLandscape = winWidth >= 768 && winWidth > winHeight;

  // Scroll & navigation feedback
  const scrollViewRef = useRef<ScrollView>(null);
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

  // Count of questions that have a non-empty response (for linear progress display)
  const answeredCount = useMemo(() => {
    return responses.visibleQuestions.filter(q => {
      const val = responses.responses[q.id];
      if (Array.isArray(val)) return val.length > 0;
      return val !== undefined && val !== null && val !== '';
    }).length;
  }, [responses.visibleQuestions, responses.responses]);

  // Questions grouped by category, preserving insertion order for section dividers
  const questionsBySection = useMemo(() => {
    const sections = new Map<string, typeof responses.visibleQuestions>();
    responses.visibleQuestions.forEach(q => {
      const key = q.question_category || 'General';
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key)!.push(q);
    });
    return sections;
  }, [responses.visibleQuestions]);

  // Flat data for FlatList used in tablet landscape right panel
  type FlatLinearItem =
    | { type: 'section'; key: string; section: string }
    | { type: 'question'; key: string; q: (typeof responses.visibleQuestions)[0]; orderIdx: number };

  const flatLinearData = useMemo<FlatLinearItem[]>(() => {
    const items: FlatLinearItem[] = [];
    let orderIdx = 0;
    Array.from(questionsBySection.entries()).forEach(([section, qs]) => {
      items.push({ type: 'section', key: `s-${section}`, section });
      qs.forEach(q => {
        items.push({ type: 'question', key: q.id, q, orderIdx: orderIdx++ });
      });
    });
    return items;
  }, [questionsBySection]);

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

  // --- Auto-Save Recovery & Background Save ---

  // Check for auto-save on mount
  useEffect(() => {
    const checkAutoSave = async () => {
      // Only check if we're starting fresh (not resuming a draft explicitly)
      if (!resumedDraftDatabaseId) {
        const savedData = await responses.hasAutoSave();
        if (savedData) {
          // Found unsaved progress — ask user with a simple yes/no confirm
          const wantsResume = await showConfirm(
            'Unsaved Progress Found',
            `We found an unfinished survey for this project from ${new Date(savedData.timestamp).toLocaleString()}.\n\n` +
            `Progress: ${Object.keys(savedData.responses).length} responses.\n\n` +
            `Would you like to resume where you left off?`,
            'Resume',
            'Discard'
          );

          if (wantsResume) {
            setLoadingDrafts(true);

            // Restore respondent state
            respondent.setRespondentId(savedData.respondentId);
            respondent.setSelectedRespondentType(savedData.respondentType as any);
            respondent.setSelectedCommodities(savedData.commodities as any);
            respondent.setSelectedCountry(savedData.country);

            // Load responses
            responses.loadAutoSave(savedData);

            // Restore pre-existing question IDs if any
            if (savedData.preExistingResponseQuestionIds) {
              setPreExistingResponseQuestionIds(new Set(savedData.preExistingResponseQuestionIds));
            }

            setLoadingDrafts(false);
            setShowRespondentForm(false);

            // Show confirmation after UI renders
            setTimeout(() => {
              showAlert(
                'Resumed',
                `Restored ${Object.keys(savedData.responses).length} responses. Jumping to question ${savedData.currentQuestionIndex + 1}.`
              );
            }, 500);
          } else {
            // User chose Discard
            await responses.clearAutoSave();
            showInfo('Progress discarded', 'Starting a fresh survey.');
          }
        }
      }
    };

    checkAutoSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // Run when project changes/loads

  // Listen to AppState to flush save on background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        // App going to background -> flush immediate save
        responses.flushAutoSave();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [responses]);

  // Scroll to top when question changes
  useEffect(() => {
    if (prevQuestionIndexRef.current !== null && prevQuestionIndexRef.current !== responses.currentQuestionIndex) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
    prevQuestionIndexRef.current = responses.currentQuestionIndex;
  }, [responses.currentQuestionIndex]);

  // Handle Load Drafts — server first, then merge in local-only drafts so user always sees their saved drafts
  const handleLoadDrafts = async () => {
    try {
      setLoadingDrafts(true);
      setDraftsLoadedOffline(false);
      console.log(`Loading drafts for project: ${projectId}`);

      let serverDrafts: any[] = [];

      try {
        const result = await apiService.getDraftResponses(projectId);
        console.log(`Received ${result.count || 0} drafts from backend:`, result);
        serverDrafts = result.drafts || [];

        if (serverDrafts.length > 0) {
          serverDrafts.forEach((draft: any, index: number) => {
            console.log(`Draft ${index + 1}: ID=${draft.id}, Status=${draft.completion_status}, Name=${draft.draft_name || '(none)'}, Respondent=${draft.respondent_id}`);
          });
        }

        // Sync server drafts to local cache for offline access
        try {
          const { offlineDraftCache } = require('../services/offlineDraftCache');
          await offlineDraftCache.syncDraftsFromServer(projectId, serverDrafts.map((d: any) => ({
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
        // When offline or API fails, use only local cache
        try {
          const { offlineDraftCache } = require('../services/offlineDraftCache');
          const cachedDrafts = await offlineDraftCache.getCachedDrafts(projectId);
          const merged = cachedDrafts.map((d: CachedDraft) => ({
            id: d.id,
            respondent_id: d.respondent_id,
            draft_name: d.draft_name || '',
            respondent_type: d.respondent_type,
            commodity: d.commodity,
            country: d.country,
            completion_status: d.completion_status,
            created_at: d.created_at,
            last_response_at: d.last_response_at,
            response_count: d.responses?.length ?? 0,
            is_offline: d.is_offline ?? true,
            responses: d.responses,
          }));
          setDrafts(merged);
          setDraftsLoadedOffline(true);
          console.log(`Loaded ${merged.length} drafts from offline cache`);
          setShowDraftsDialog(true);
        } catch (cacheErr) {
          console.error('Offline cache also failed:', cacheErr);
          showAlert('Error', 'Failed to load draft responses. No cached drafts available.');
        } finally {
          setLoadingDrafts(false);
        }
        return;
      }

      // Merge: show server drafts + any local-only drafts (saved on device but not yet on server)
      try {
        const { offlineDraftCache } = require('../services/offlineDraftCache');
        const cachedDrafts = await offlineDraftCache.getCachedDrafts(projectId);
        const serverIds = new Set(serverDrafts.map((d: any) => d.id));
        const localOnly = cachedDrafts.filter((d: CachedDraft) => !serverIds.has(d.id) || d.is_offline);
        const localOnlyForList = localOnly.map((d: CachedDraft) => ({
          id: d.id,
          respondent_id: d.respondent_id,
          draft_name: d.draft_name || '',
          respondent_type: d.respondent_type,
          commodity: d.commodity,
          country: d.country,
          completion_status: d.completion_status,
          created_at: d.created_at,
          last_response_at: d.last_response_at,
          response_count: d.responses?.length ?? 0,
          is_offline: true,
          responses: d.responses,
        }));
        const merged = [...serverDrafts, ...localOnlyForList];
        if (localOnlyForList.length > 0) {
          setDraftsLoadedOffline(true);
          console.log(`Merged ${serverDrafts.length} server + ${localOnlyForList.length} local-only drafts`);
        }
        setDrafts(merged);
      } catch (cacheErr) {
        console.warn('Could not merge local drafts:', cacheErr);
        setDrafts(serverDrafts);
      }

      setShowDraftsDialog(true);
    } catch (error: any) {
      console.error('Error loading drafts:', error);
      showAlert('Error', 'Failed to load draft responses');
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Handle Delete Draft
  const handleDeleteDraft = async (draft: any) => {
    const draftLabel = draft.draft_name || draft.respondent_id;
    const confirmed = await showConfirm(
      'Delete Draft',
      `Are you sure you want to delete "${draftLabel}"? This action cannot be undone.`,
      'Delete',
      'Cancel'
    );
    if (!confirmed) return;
    try {
      await apiService.deleteRespondent(draft.id);
      await handleLoadDrafts();
    } catch (error: any) {
      console.error('Error deleting draft:', error);
      showError('Failed to delete draft. Please try again.');
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

      setResumedDraftDatabaseId(draft.id);
      respondent.setRespondentId(draft.respondent_id);
      respondent.setSelectedRespondentType(draft.respondent_type);
      const commodities = draft.commodity.split(',').map((c: string) => c.trim());
      respondent.setSelectedCommodities(commodities);
      respondent.setSelectedCountry(draft.country);
      await new Promise(resolve => setTimeout(resolve, 100));

      // ----- Load questions (online → API, offline → local cache) -----
      let loadedQuestions: any[] = [];
      const { networkMonitor } = require('../services');
      const { offlineQuestionCache } = require('../services');
      const isOnline = await networkMonitor.checkConnection();
      const isOfflineDraft = !!draft.is_offline;

      if (isOnline && !isOfflineDraft) {
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
        loadedQuestions = filteredResponse.questions || filteredResponse.results || [];
      } else {
        console.log('Offline draft resume — loading questions from local cache');
        const cachedQuestions = await offlineQuestionCache.getGeneratedQuestions(projectId);
        const commodityStr = draft.commodity;
        loadedQuestions = cachedQuestions.filter((q: any) =>
          q.assigned_respondent_type === draft.respondent_type &&
          q.assigned_commodity === commodityStr &&
          q.assigned_country === draft.country
        );
        console.log(`Loaded ${loadedQuestions.length} questions from offline cache`);
      }

      loadedQuestions = loadedQuestions.sort((a: any, b: any) => {
        const catA = getCategorySortIndex(a.question_category || '');
        const catB = getCategorySortIndex(b.question_category || '');
        return catA !== catB ? catA - catB : a.order_index - b.order_index;
      });

      if (!loadedQuestions || loadedQuestions.length === 0) {
        console.error('No questions loaded after generation');
        showAlert(
          'Error',
          isOnline
            ? 'Failed to load questions for this respondent. Check that questions were generated for this criteria.'
            : 'No questions cached for this respondent type. Please go online and generate questions before collecting offline.'
        );
        return;
      }

      console.log(`Loaded ${loadedQuestions.length} questions for resume`);

      // Check if the question set has changed since the draft was saved
      if (draft.question_set_hash) {
        const currentHash = computeQuestionSetHash(loadedQuestions.map((q: any) => q.id));
        if (currentHash !== draft.question_set_hash) {
          console.warn(`Question set changed since draft was saved (saved: ${draft.question_set_hash}, current: ${currentHash})`);
          const proceed = await showConfirm(
            'Questions Changed',
            'The question set has been updated since this draft was saved. ' +
            'Some of your saved answers may no longer match the current questions.\n\n' +
            'Continue resuming?',
            'Continue',
            'Cancel'
          );
          if (!proceed) {
            setIsResumingDraft(false);
            return;
          }
        }
      }

      // CRITICAL: Inject the fetched questions directly into the hook's state so that
      // visibleQuestions is already populated when the survey view mounts.
      // Without this, setQuestionIndex fires on an empty/stale questions array.
      questions.setQuestionsDirectly(loadedQuestions);

      // ----- Load responses (online → backend, offline → cached draft.responses) -----
      const loadedResponses: any = {};
      const existingQuestionIds = new Set<string>();

      if (isOfflineDraft && draft.responses && draft.responses.length > 0) {
        console.log(`Reading ${draft.responses.length} responses from offline draft cache`);
        draft.responses.forEach((resp: any) => {
          const qId = resp.question_id ?? resp.question;
          if (!qId) return;
          existingQuestionIds.add(qId);
          let value = resp.response_value;
          try {
            if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
              value = JSON.parse(value);
            }
          } catch (e) { /* keep raw value */ }
          loadedResponses[qId] = value;
        });
      } else {
        const draftResponses = await apiService.getRespondentResponses(draft.id);
        if (draftResponses.responses && draftResponses.responses.length > 0) {
          draftResponses.responses.forEach((resp: any) => {
            existingQuestionIds.add(resp.question);
            let value = resp.response_value;
            try {
              if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
                value = JSON.parse(value);
              }
            } catch (e) { /* keep raw value */ }
            loadedResponses[resp.question] = value;
          });
        }
      }

      if (Object.keys(loadedResponses).length > 0) {
        responses.loadResponses(loadedResponses);
        setPreExistingResponseQuestionIds(existingQuestionIds);
        console.log(`Loaded ${Object.keys(loadedResponses).length} responses (${existingQuestionIds.size} pre-existing)`);
      }

      const answeredQuestionIds = new Set(Object.keys(loadedResponses));
      let lastAnsweredIndex = -1;
      for (let i = loadedQuestions.length - 1; i >= 0; i--) {
        if (answeredQuestionIds.has(loadedQuestions[i].id)) {
          lastAnsweredIndex = i;
          break;
        }
      }

      const resumeIndex = Math.min(lastAnsweredIndex + 1, loadedQuestions.length - 1);
      const totalQuestions = loadedQuestions.length;
      const answeredCount = answeredQuestionIds.size;

      console.log(`Resume: lastAnsweredIndex=${lastAnsweredIndex}, resumeIndex=${resumeIndex}`);

      setShowRespondentForm(false);

      setTimeout(() => {
        if (resumeIndex > 0) {
          responses.setQuestionIndex(resumeIndex);
        }
        setIsResumingDraft(false);

        showAlert(
          isOfflineDraft ? 'Offline Draft Loaded' : 'Draft Loaded',
          `Resuming survey for ${draft.respondent_id}\n\n` +
          `${answeredCount} of ${totalQuestions} questions already answered.\n` +
          `Starting at question ${resumeIndex + 1}.` +
          (isOfflineDraft ? '\n\n(Offline draft — changes will sync when you reconnect)' : ''),
          [{ text: 'Continue' }]
        );
      }, 100);

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

  // Handle Start Survey — defer the view switch until after any ongoing
  // animations/transitions finish so the UI doesn't jank on budget devices.
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

    InteractionManager.runAfterInteractions(() => {
      setShowRespondentForm(false);
    });
  };

  // Handle Submit Success — different profile (full reset back to setup screen)
  const handleSubmitSuccess = () => {
    respondent.resetForNextRespondent();
    responses.resetResponses();
    questions.resetQuestions();
    setResumedDraftDatabaseId(null);
    setPreExistingResponseQuestionIds(new Set());
    setShowRespondentForm(true);
  };

  // Handle Submit Success — same profile, new respondent
  // Keeps respondent type, commodities, country, and questions intact.
  // Only resets the respondent ID and responses so you can start a fresh survey immediately.
  const handleSameProfileSuccess = () => {
    respondent.resetForNextRespondent();  // generates new respondent ID, keeps profile filters
    responses.resetResponses();
    setResumedDraftDatabaseId(null);
    setPreExistingResponseQuestionIds(new Set());
    // NOTE: no questions.resetQuestions() and no setShowRespondentForm(true)
    // — stays in survey view with same questions ready to go
  };

  // Handle Finish and Go Back
  const handleFinishAndGoBack = () => {
    // Navigate to Dashboard after finishing data collection session
    (navigation as any).navigate('Dashboard');
  };

  // Stable submit handler for NavigationControls.
  // Using a ref so the callback identity never changes (preventing NavigationControls
  // re-renders on every answer) while always calling the latest closures.
  const _navSubmitRef = useRef<() => void>();
  _navSubmitRef.current = () => {
    responses.handleSubmit(handleSubmitSuccess, handleFinishAndGoBack, handleSameProfileSuccess);
  };
  const handleNavSubmit = useCallback(() => { _navSubmitRef.current?.(); }, []);

  // Handle Discard — confirm then reset to setup form
  const handleDiscard = useCallback(() => {
    Alert.alert(
      'Discard Survey',
      'Are you sure you want to discard this survey? All responses will be lost.',
      [
        { text: 'Keep Answering', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            respondent.resetForNextRespondent();
            responses.resetResponses();
            questions.resetQuestions();
            setResumedDraftDatabaseId(null);
            setPreExistingResponseQuestionIds(new Set());
            setShowRespondentForm(true);
          },
        },
      ]
    );
  }, [respondent, responses, questions]);

  const handleSidebarTap = useCallback((questionId: string) => {
    setFocusedQuestionId(questionId);
    const itemIndex = flatLinearData.findIndex(item => item.key === questionId);
    if (itemIndex >= 0) {
      linearFlatListRef.current?.scrollToIndex({
        index: itemIndex,
        animated: true,
        viewOffset: 8,
      });
    }
  }, [flatLinearData]);

  // Accent color for linear question cards based on response type
  const getAccentColor = useCallback((responseType: string): string => {
    const amberTypes = ['text', 'long_text', 'email', 'phone', 'url', 'multiple_choice'];
    const blueTypes = ['matrix', 'ranking', 'slider', 'file_upload', 'signature'];
    if (amberTypes.includes(responseType)) return colors.sync.pending;
    if (blueTypes.includes(responseType)) return colors.status.info;
    return colors.sync.synced;
  }, []);

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
        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon source="chevron-left" size={24} color="#fff" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => (navigation as any).navigate('BundleCompletion', { projectId, projectName, mode: 'user' })}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Icon source="chart-bar" size={20} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={handleLoadDrafts}
                disabled={loadingDrafts}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Icon source="file-document-edit-outline" size={20} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={handleExportJSON}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Icon source="download" size={20} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={handleOpenLinkDialog}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Icon source="share-variant" size={20} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.title}>Data Collection</Text>
            <Text style={styles.subtitle}>{projectName}</Text>
          </View>
        </View>

        {/* Question Bank Scope Configuration */}
        <View style={styles.configCard}>
          <View style={styles.scopeControl}>
            <View style={styles.scopeTextContainer}>
              <Text style={styles.scopeTitle}>Question Bank Scope</Text>
              <Text style={styles.scopeDescription}>
                {useProjectBankOnly
                  ? "Using only questions from this project's question bank"
                  : 'Using questions from all accessible question banks'}
              </Text>
            </View>
            <Switch
              value={useProjectBankOnly}
              onValueChange={setUseProjectBankOnly}
              color={colors.primary.main}
            />
          </View>
          <Text style={styles.scopeHelpText}>
            Toggle to choose between project-specific questions or all accessible questions
          </Text>
        </View>

        {/* Sync Status Banner — visible when items are pending/failed */}
        <SyncStatusBanner />

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
          preparingAll={questions.preparingAll}
          prepareAllProgress={questions.prepareAllProgress}
          onPrepareAllForOffline={questions.prepareAllForOffline}
          onGenerateQuestions={handleGenerateQuestions}
          onStartSurvey={handleStartSurvey}
          onCacheForOffline={questions.cacheForOffline}
        />

        {/* Create Link Dialog */}
        <Portal>
          <Dialog visible={showLinkDialog} onDismiss={() => setShowLinkDialog(false)} style={styles.dialogPaper}>
            <View style={styles.dialogTitleRow}>
              <View style={styles.dialogTitleAccent} />
              <Text style={styles.dialogTitleText}>Create Shareable Link</Text>
            </View>
            <Dialog.Content style={styles.dialogBodyPad}>
              <Text style={styles.dialogBodyText}>
                Create a link to share this survey. Respondents can complete it in their browser without the app.
              </Text>
              <PaperTextInput
                label="Link Title"
                value={linkTitle}
                onChangeText={setLinkTitle}
                mode="outlined"
                style={styles.dialogInput}
                theme={{ colors: { primary: colors.primary.main, onSurfaceVariant: colors.text.secondary, outline: colors.border.light } }}
              />
              <PaperTextInput
                label="Description (Optional)"
                value={linkDescription}
                onChangeText={setLinkDescription}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.dialogInput}
                theme={{ colors: { primary: colors.primary.main, onSurfaceVariant: colors.text.secondary, outline: colors.border.light } }}
              />
              <PaperTextInput
                label="Expiration (Days)"
                value={linkExpirationDays}
                onChangeText={setLinkExpirationDays}
                mode="outlined"
                keyboardType="numeric"
                style={styles.dialogInput}
                theme={{ colors: { primary: colors.primary.main, onSurfaceVariant: colors.text.secondary, outline: colors.border.light } }}
              />
              <PaperTextInput
                label="Max Responses (0 = unlimited)"
                value={linkMaxResponses}
                onChangeText={setLinkMaxResponses}
                mode="outlined"
                keyboardType="numeric"
                style={styles.dialogInput}
                theme={{ colors: { primary: colors.primary.main, onSurfaceVariant: colors.text.secondary, outline: colors.border.light } }}
              />
              <Text style={styles.dialogHintText}>
                {questions.questions.length} questions will be included in this survey
              </Text>
            </Dialog.Content>
            <View style={styles.dialogActionRow}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowLinkDialog(false)}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogPrimaryBtn, (creatingLink || !linkTitle) && styles.dialogBtnDisabled]}
                onPress={handleCreateLink}
                disabled={creatingLink || !linkTitle}
              >
                {creatingLink
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.dialogPrimaryText}>Create Link</Text>}
              </TouchableOpacity>
            </View>
          </Dialog>

          {/* Drafts Dialog */}
          <Dialog
            visible={showDraftsDialog}
            onDismiss={() => setShowDraftsDialog(false)}
            style={[styles.dialogPaper, { maxHeight: '85%' }]}
          >
            <View style={styles.dialogTitleRow}>
              <View style={styles.dialogTitleAccent} />
              <Text style={styles.dialogTitleText}>Continue Draft</Text>
            </View>
            <Dialog.Content style={[styles.dialogBodyPad, { paddingBottom: 0 }]}>
              {loadingDrafts ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary.main} />
                  <Text style={[styles.dialogBodyText, { marginTop: 12, marginBottom: 0, textAlign: 'center' }]}>Loading drafts…</Text>
                </View>
              ) : drafts.length === 0 ? (
                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                  <Text style={[styles.dialogBodyText, { textAlign: 'center', marginBottom: spacing.xs }]}>
                    No draft responses found for this project.
                  </Text>
                  <Text style={[styles.dialogHintText, { textAlign: 'center' }]}>
                    Start a new survey and use "Save for Later" to create drafts.
                  </Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                  {draftsLoadedOffline && (
                    <View style={styles.draftsOfflineBanner}>
                      <Text style={styles.draftsOfflineBannerText}>⚡ Loaded from offline cache</Text>
                    </View>
                  )}
                  {drafts.map((draft) => (
                    <TouchableOpacity
                      key={draft.id}
                      style={styles.draftCard}
                      onPress={() => handleResumeDraft(draft)}
                      activeOpacity={0.82}
                    >
                      <View style={styles.draftCardLeft}>
                        <View style={styles.draftIconTile}>
                          <Icon source="file-edit-outline" size={18} color={colors.primary.main} />
                        </View>
                      </View>
                      <View style={styles.draftCardBody}>
                        {draft.draft_name ? (
                          <>
                            <Text style={styles.draftName}>{draft.draft_name}</Text>
                            <Text style={styles.draftSubId}>ID: {draft.respondent_id}</Text>
                          </>
                        ) : (
                          <Text style={styles.draftName}>{draft.respondent_id}</Text>
                        )}
                        {(draft.respondent_type || draft.commodity || draft.country) && (
                          <Text style={styles.draftMeta}>
                            {[draft.respondent_type && `Type: ${draft.respondent_type}`, draft.commodity && `Commodity: ${draft.commodity}`, draft.country].filter(Boolean).join(' · ')}
                          </Text>
                        )}
                        <Text style={styles.draftTimestamp}>
                          {new Date(draft.last_response_at || draft.created_at).toLocaleString()}
                        </Text>
                        {draft.response_count !== undefined && (
                          <Text style={styles.draftResponseCount}>{draft.response_count} response{draft.response_count !== 1 ? 's' : ''} saved</Text>
                        )}
                        {draft.is_offline && (
                          <Text style={styles.draftOfflineLabel}>📱 Saved offline</Text>
                        )}
                      </View>
                      <View style={styles.draftCardActions}>
                        <TouchableOpacity
                          onPress={() => handleDeleteDraft(draft)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.draftDeleteBtn}
                        >
                          <Icon source="trash-can-outline" size={18} color={colors.status.error} />
                        </TouchableOpacity>
                        <Icon source="chevron-right" size={18} color={colors.text.tertiary} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </Dialog.Content>
            <View style={[styles.dialogActionRow, { paddingTop: spacing.md }]}>
              <TouchableOpacity style={[styles.dialogCancelBtn, { flex: 0, paddingHorizontal: spacing.xl }]} onPress={() => setShowDraftsDialog(false)}>
                <Text style={styles.dialogCancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Dialog>

          {/* Loading Draft Dialog */}
          <Dialog visible={isResumingDraft} dismissable={false} style={styles.dialogPaper}>
            <Dialog.Content style={[styles.dialogBodyPad, { paddingVertical: spacing.xl }]}>
              <View style={{ alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary.main} />
                <Text style={[styles.dialogTitleText, { marginTop: spacing.md, textAlign: 'center' }]}>Resuming Draft</Text>
                <Text style={[styles.dialogBodyText, { textAlign: 'center', marginBottom: 0, marginTop: 4 }]}>Please wait…</Text>
              </View>
            </Dialog.Content>
          </Dialog>

          {/* Draft Name Dialog */}
          <Dialog visible={showDraftNameDialog} onDismiss={() => setShowDraftNameDialog(false)} style={styles.dialogPaper}>
            <View style={styles.dialogTitleRow}>
              <View style={styles.dialogTitleAccent} />
              <Text style={styles.dialogTitleText}>Name Your Draft</Text>
            </View>
            <Dialog.Content style={styles.dialogBodyPad}>
              <Text style={styles.dialogBodyText}>
                Give this draft a name so you can easily find it later. The respondent ID will not be affected.
              </Text>
              <PaperTextInput
                label="Draft Name (optional)"
                value={draftName}
                onChangeText={setDraftName}
                mode="outlined"
                placeholder="e.g. John's Farm Visit, Morning Session"
                autoFocus
                theme={{ colors: { primary: colors.primary.main, onSurfaceVariant: colors.text.secondary, outline: colors.border.light } }}
              />
            </Dialog.Content>
            <View style={styles.dialogActionRow}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowDraftNameDialog(false)}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogPrimaryBtn} onPress={confirmSaveDraft}>
                <Icon source="content-save-outline" size={16} color="#fff" />
                <Text style={styles.dialogPrimaryText}>Save Draft</Text>
              </TouchableOpacity>
            </View>
          </Dialog>
        </Portal>
      </ScreenWrapper>
    );
  }

  // Show Question Form
  const linearProgress = responses.visibleQuestions.length > 0
    ? answeredCount / responses.visibleQuestions.length
    : 0;
  const singleProgress = responses.visibleQuestions.length > 0
    ? (responses.currentQuestionIndex + 1) / responses.visibleQuestions.length
    : 0;
  const progress = surveyMode === 'linear' ? linearProgress : singleProgress;

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>

      {/* ── Shared survey hero header ─────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          {/* ← Setup */}
          <TouchableOpacity
            onPress={handleBackToForm}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon source="chevron-left" size={24} color="#fff" />
            <Text style={styles.backText}>Setup</Text>
          </TouchableOpacity>

          {/* Right side: view toggle + (single mode) save draft pill */}
          <View style={styles.headerRight}>
            {/* View mode toggle */}
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleBtn, surveyMode === 'linear' && styles.viewToggleBtnActive]}
                onPress={() => setSurveyMode('linear')}
                activeOpacity={0.8}
              >
                <Icon source="view-list" size={13} color={surveyMode === 'linear' ? '#fff' : 'rgba(255,255,255,0.55)'} />
                <Text style={[styles.viewToggleBtnText, surveyMode === 'linear' && styles.viewToggleBtnTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleBtn, surveyMode === 'single' && styles.viewToggleBtnActive]}
                onPress={() => setSurveyMode('single')}
                activeOpacity={0.8}
              >
                <Icon source="card-text-outline" size={13} color={surveyMode === 'single' ? '#fff' : 'rgba(255,255,255,0.55)'} />
                <Text style={[styles.viewToggleBtnText, surveyMode === 'single' && styles.viewToggleBtnTextActive]}>
                  Single
                </Text>
              </TouchableOpacity>
            </View>

            {/* Save Draft pill — single mode only */}
            {surveyMode === 'single' && (
              <TouchableOpacity
                style={styles.saveDraftPill}
                onPress={handleSaveDraftWithName}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Icon source="content-save-outline" size={13} color={colors.primary.main} />
                <Text style={styles.saveDraftText}>Save Draft</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Title + mode-dependent subtitle */}
        <View style={styles.headerContent}>
          <Text style={styles.title} numberOfLines={1}>{projectName}</Text>
          {surveyMode === 'linear' ? (
            <Text style={styles.subtitle}>
              {respondent.respondentId} · {answeredCount} of {responses.visibleQuestions.length} answered
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              {respondent.respondentId} · Q{responses.currentQuestionIndex + 1} of {responses.visibleQuestions.length}
            </Text>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
        <Text style={styles.progressLabel}>{Math.round(progress * 100)}% complete</Text>
      </View>

      {/* ── LINEAR VIEW: all questions scrollable ─────────────────────────── */}
      {surveyMode === 'linear' ? (
        <>
          {isTabletLandscape ? (
            /* ── TABLET LANDSCAPE: master-detail two-column layout ── */
            <View style={styles.tabletContainer}>

              {/* LEFT: Question navigator sidebar */}
              <View style={styles.tabletSidebar}>
                <View style={styles.tabletSidebarHeader}>
                  <Text style={styles.tabletSidebarTitle}>Questions</Text>
                  <Text style={styles.tabletSidebarProgress}>
                    {answeredCount} of {responses.visibleQuestions.length} answered
                  </Text>
                </View>

                <ScrollView style={styles.tabletSidebarScroll} showsVerticalScrollIndicator={false}>
                  {Array.from(questionsBySection.entries()).map(([section, qs]) => (
                    <View key={section}>
                      <View style={styles.tabletSidebarSection}>
                        <Text style={styles.tabletSidebarSectionText}>{section}</Text>
                      </View>
                      {qs.map((q, idx) => {
                        const val = responses.responses[q.id];
                        const answered = Array.isArray(val) ? val.length > 0 : (val !== undefined && val !== null && val !== '');
                        const isFocused = focusedQuestionId === q.id;
                        return (
                          <TouchableOpacity
                            key={q.id}
                            style={[styles.tabletSidebarItem, isFocused && styles.tabletSidebarItemActive]}
                            onPress={() => handleSidebarTap(q.id)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.tabletSidebarBadge, answered && styles.tabletSidebarBadgeAnswered]}>
                              <Text style={[styles.tabletSidebarBadgeText, answered && styles.tabletSidebarBadgeTextAnswered]}>
                                Q{q.order_index ?? (idx + 1)}
                              </Text>
                            </View>
                            <Text style={styles.tabletSidebarItemText} numberOfLines={2}>{q.question_text}</Text>
                            {answered ? (
                              <Icon source="check-circle" size={14} color={colors.sync.synced} />
                            ) : q.is_required ? (
                              <Icon source="circle-medium" size={14} color={colors.sync.pending} />
                            ) : (
                              <Icon source="circle-outline" size={14} color={colors.text.disabled} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>

                {/* Sidebar footer: Save Draft + Discard */}
                <View style={styles.tabletSidebarFooter}>
                  <TouchableOpacity style={styles.tabletSidebarSaveBtn} onPress={handleSaveDraftWithName} activeOpacity={0.8}>
                    <Icon source="content-save-outline" size={14} color={colors.primary.main} />
                    <Text style={styles.tabletSidebarSaveBtnText}>Save Draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tabletSidebarDiscardBtn} onPress={handleDiscard} activeOpacity={0.8}>
                    <Icon source="close-circle-outline" size={14} color={colors.status.error} />
                    <Text style={styles.tabletSidebarDiscardBtnText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* RIGHT: Question detail panel using FlatList for scroll-to-index */}
              <View style={styles.tabletDetailPanel}>
                <FlatList
                  ref={linearFlatListRef}
                  data={flatLinearData}
                  keyExtractor={(item) => item.key}
                  contentContainerStyle={styles.tabletDetailContent}
                  showsVerticalScrollIndicator={false}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={5}
                  updateCellsBatchingPeriod={50}
                  windowSize={7}
                  initialNumToRender={8}
                  onScrollToIndexFailed={(info) => {
                    linearFlatListRef.current?.scrollToOffset({
                      offset: info.averageItemLength * info.index,
                      animated: true,
                    });
                  }}
                  renderItem={({ item }) => {
                    if (item.type === 'section') {
                      return (
                        <View style={styles.sectionDivider}>
                          <View style={styles.sectionDividerLine} />
                          <Text style={styles.sectionDividerLabel}>{item.section}</Text>
                          <View style={styles.sectionDividerLine} />
                        </View>
                      );
                    }
                    const q = item.q;
                    const isFocused = focusedQuestionId === q.id;
                    return (
                      <View style={[styles.linearCard, isFocused && styles.linearCardFocused]}>
                        <View style={[styles.linearAccent, { backgroundColor: getAccentColor(q.response_type) }]} />
                        <View style={styles.linearCardBody}>
                          <View style={styles.linearBadgeRow}>
                            <View style={styles.badgeQ}>
                              <Text style={styles.badgeQText}>Q{q.order_index ?? (item.orderIdx + 1)}</Text>
                            </View>
                            {q.question_category ? (
                              <View style={styles.badgeCat}>
                                <Text style={styles.badgeCatText}>{q.question_category}</Text>
                              </View>
                            ) : null}
                            <View style={styles.badgeType}>
                              <Text style={styles.badgeTypeText}>{q.response_type.replace(/_/g, ' ')}</Text>
                            </View>
                            {q.is_required && (
                              <View style={styles.badgeReq}>
                                <Text style={styles.badgeReqText}>Required</Text>
                              </View>
                            )}
                          </View>
                          {q.is_follow_up && (
                            <View style={styles.followUpIndicator}>
                              <Text style={styles.followUpIcon}>↳</Text>
                              <Text style={styles.followUpText}>Follow-up question</Text>
                            </View>
                          )}
                          <Text style={styles.linearQText}>{q.question_text}</Text>
                          <QuestionInput
                            question={q}
                            value={responses.responses[q.id]}
                            onChange={responses.handleResponseChange}
                          />
                        </View>
                      </View>
                    );
                  }}
                />

                {/* Tablet detail footer: Submit */}
                <View style={styles.tabletDetailFooter}>
                  <TouchableOpacity
                    style={[styles.linearSubmitBtn, responses.submitting && styles.linearBtnDisabled]}
                    onPress={handleNavSubmit}
                    disabled={responses.submitting}
                    activeOpacity={0.82}
                  >
                    {responses.submitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.linearSubmitBtnText}>Submit Survey →</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            /* ── MOBILE: existing scrollable layout ── */
            <>
              <ScrollView
                style={styles.flex}
                contentContainerStyle={styles.linearScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {Array.from(questionsBySection.entries()).map(([section, qs]) => (
                  <View key={section}>
                    <View style={styles.sectionDivider}>
                      <View style={styles.sectionDividerLine} />
                      <Text style={styles.sectionDividerLabel}>{section}</Text>
                      <View style={styles.sectionDividerLine} />
                    </View>
                    {qs.map((q, idx) => (
                      <View key={q.id} style={styles.linearCard}>
                        <View style={[styles.linearAccent, { backgroundColor: getAccentColor(q.response_type) }]} />
                        <View style={styles.linearCardBody}>
                          <View style={styles.linearBadgeRow}>
                            <View style={styles.badgeQ}>
                              <Text style={styles.badgeQText}>Q{q.order_index ?? (idx + 1)}</Text>
                            </View>
                            {q.question_category ? (
                              <View style={styles.badgeCat}>
                                <Text style={styles.badgeCatText}>{q.question_category}</Text>
                              </View>
                            ) : null}
                            <View style={styles.badgeType}>
                              <Text style={styles.badgeTypeText}>{q.response_type.replace(/_/g, ' ')}</Text>
                            </View>
                            {q.is_required && (
                              <View style={styles.badgeReq}>
                                <Text style={styles.badgeReqText}>Required</Text>
                              </View>
                            )}
                          </View>
                          {q.is_follow_up && (
                            <View style={styles.followUpIndicator}>
                              <Text style={styles.followUpIcon}>↳</Text>
                              <Text style={styles.followUpText}>Follow-up question</Text>
                            </View>
                          )}
                          <Text style={styles.linearQText}>{q.question_text}</Text>
                          <QuestionInput
                            question={q}
                            value={responses.responses[q.id]}
                            onChange={responses.handleResponseChange}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
                {responses.visibleQuestions.length === 0 && (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary.light} />
                    <Text style={styles.loadingText}>Loading questions…</Text>
                  </View>
                )}
              </ScrollView>

              {/* Mobile linear footer: Submit / Save for Later / Discard */}
              <View style={styles.linearFooter}>
                <TouchableOpacity
                  style={[styles.linearSubmitBtn, responses.submitting && styles.linearBtnDisabled]}
                  onPress={handleNavSubmit}
                  disabled={responses.submitting}
                  activeOpacity={0.82}
                >
                  {responses.submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.linearSubmitBtnText}>Submit Survey →</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.linearFooterRow}>
                  <TouchableOpacity style={styles.linearSaveBtn} onPress={handleSaveDraftWithName} activeOpacity={0.8}>
                    <Icon source="content-save-outline" size={16} color={colors.primary.main} />
                    <Text style={styles.linearSaveBtnText}>Save for Later</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.linearDiscardBtn} onPress={handleDiscard} activeOpacity={0.8}>
                    <Icon source="close-circle-outline" size={16} color={colors.status.error} />
                    <Text style={styles.linearDiscardBtnText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </>
      ) : (
        /* ── SINGLE VIEW: one question at a time ─────────────────────────── */
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <SwipeableQuestionView
            key={currentQuestion?.id || 'loading'}
            onSwipeLeft={() => {
              setEnterDirection('right');
              responses.handleNext();
            }}
            onSwipeRight={() => {
              setEnterDirection('left');
              responses.handlePrevious();
            }}
            canSwipeLeft={responses.currentQuestionIndex < responses.visibleQuestions.length - 1}
            canSwipeRight={responses.currentQuestionIndex > 0}
            enabled={!responses.submitting}
            onCheckSwipeLeft={responses.validateCurrentQuestion}
            enterDirection={enterDirection}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {currentQuestion ? (
                <Card style={styles.questionCard} mode="outlined">
                  <Card.Content>
                    {currentQuestion.is_follow_up && (
                      <View style={styles.followUpIndicator}>
                        <Text style={styles.followUpIcon}>↳</Text>
                        <Text style={styles.followUpText}>Follow-up question</Text>
                      </View>
                    )}

                    {currentQuestion.section_header && (
                      <>
                        <View style={styles.sectionHeaderContainer}>
                          <Text style={styles.sectionHeaderText}>
                            {currentQuestion.section_header}
                          </Text>
                        </View>
                        {currentQuestion.section_preamble && (() => {
                          const prevQ = questions.questions[responses.currentQuestionIndex - 1];
                          const isFirst = !prevQ || prevQ.section_header !== currentQuestion.section_header;
                          return isFirst ? (
                            <View style={styles.sectionPreambleContainer}>
                              <Text style={styles.sectionPreambleText}>
                                {currentQuestion.section_preamble}
                              </Text>
                            </View>
                          ) : null;
                        })()}
                      </>
                    )}

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

                    <Text style={[
                      styles.questionText,
                      currentQuestion.is_follow_up && styles.followUpQuestionText,
                    ]}>
                      {currentQuestion.question_text}
                    </Text>

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
                  <Text style={styles.loadingText}>Loading question…</Text>
                </View>
              )}
            </ScrollView>
          </SwipeableQuestionView>

          {currentQuestion && (
            <NavigationControls
              currentIndex={responses.currentQuestionIndex}
              totalQuestions={responses.visibleQuestions.length}
              onPrevious={responses.handlePrevious}
              onNext={responses.handleNext}
              onSubmit={handleNavSubmit}
              submitting={responses.submitting}
              canGoBack={responses.currentQuestionIndex > 0}
              isLastQuestion={
                responses.currentQuestionIndex === responses.visibleQuestions.length - 1
              }
            />
          )}
        </KeyboardAvoidingView>
      )}

      {/* Draft Name Dialog (survey view) */}
      <Portal>
        <Dialog visible={showDraftNameDialog} onDismiss={() => setShowDraftNameDialog(false)} style={styles.dialogPaper}>
          <View style={styles.dialogTitleRow}>
            <View style={styles.dialogTitleAccent} />
            <Text style={styles.dialogTitleText}>Name Your Draft</Text>
          </View>
          <Dialog.Content style={styles.dialogBodyPad}>
            <Text style={styles.dialogBodyText}>
              Give this draft a name so you can easily find it later. The respondent ID will not be affected.
            </Text>
            <PaperTextInput
              label="Draft Name (optional)"
              value={draftName}
              onChangeText={setDraftName}
              mode="outlined"
              placeholder="e.g. John's Farm Visit, Morning Session"
              autoFocus
              theme={{ colors: { primary: colors.primary.main, onSurfaceVariant: colors.text.secondary, outline: colors.border.light } }}
            />
          </Dialog.Content>
          <View style={styles.dialogActionRow}>
            <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowDraftNameDialog(false)}>
              <Text style={styles.dialogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dialogPrimaryBtn} onPress={confirmSaveDraft}>
              <Icon source="content-save-outline" size={16} color="#fff" />
              <Text style={styles.dialogPrimaryText}>Save Draft</Text>
            </TouchableOpacity>
          </View>
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

  // ── Header (both views)
  header: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 15,
    color: '#fff',
  },
  headerIconBtn: {
    padding: 6,
    marginLeft: 4,
  },
  headerContent: {
    marginBottom: 4,
  },
  title: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 20,
    color: '#fff',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },

  // Save draft pill (survey header)
  saveDraftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveDraftText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 12,
    color: colors.primary.main,
  },

  // Progress bar (survey header)
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.primary.light,
    borderRadius: 2,
  },
  progressLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    textAlign: 'right',
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  questionCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  followUpIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.warningSurface,
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
    fontFamily: 'DMSans-Bold',
    marginRight: 8,
  },
  followUpText: {
    fontFamily: 'DMSans-Medium',
    color: colors.accent.orange,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  followUpQuestionText: {
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.status.warning,
  },
  sectionHeaderContainer: {
    backgroundColor: colors.primary.faint,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  sectionHeaderText: {
    fontFamily: 'DMSans-Bold',
    color: colors.primary.main,
    fontSize: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionPreambleContainer: {
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  sectionPreambleText: {
    fontFamily: 'DMSans-Regular',
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
    backgroundColor: colors.primary.faint,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.primary.muted,
  },
  questionBadgeText: {
    fontFamily: 'DMSans-Bold',
    color: colors.primary.main,
    fontSize: 12,
  },
  categoryBadge: {
    backgroundColor: colors.status.successSurface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.3)',
  },
  categoryBadgeText: {
    fontFamily: 'DMSans-Medium',
    color: colors.status.success,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  typeBadge: {
    backgroundColor: colors.background.subtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  typeBadgeText: {
    fontFamily: 'DMSans-Medium',
    color: colors.text.secondary,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  requiredBadge: {
    backgroundColor: colors.status.errorSurface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  requiredBadgeText: {
    fontFamily: 'DMSans-Medium',
    color: colors.status.error,
    fontSize: 11,
  },
  questionText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 20,
    color: colors.text.primary,
    marginBottom: 24,
    lineHeight: 28,
    letterSpacing: -0.3,
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
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    marginTop: 16,
  },
  configCard: {
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scopeControl: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  scopeTextContainer: {
    flex: 1,
  },
  scopeTitle: {
    fontFamily: 'DMSans-Bold',
    color: colors.text.primary,
    marginBottom: 4,
    fontSize: 14,
  },
  scopeDescription: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    lineHeight: 18,
    fontSize: 12,
    marginBottom: 4,
  },
  scopeHelpText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.tertiary,
    fontSize: 11,
    marginTop: 2,
  },
  snackbarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  snackbar: {
    backgroundColor: colors.primary.dark,
  },

  // ── Survey header: right side
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  // ── View mode toggle
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.round,
    padding: 3,
    gap: 2,
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.round,
  },
  viewToggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  viewToggleBtnText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.55)',
  },
  viewToggleBtnTextActive: {
    color: '#fff',
  },

  // ── Linear view scroll area
  linearScrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 20,
  },

  // ── Section divider
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  sectionDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border.light,
  },
  sectionDividerLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // ── Linear question card
  linearCard: {
    flexDirection: 'row',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  linearAccent: {
    width: 4,
    flexShrink: 0,
  },
  linearCardBody: {
    flex: 1,
    padding: spacing.md,
  },
  linearBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: spacing.sm,
  },
  badgeQ: {
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeQText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
  },
  badgeCat: {
    backgroundColor: colors.status.successSurface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeCatText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.status.success,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  badgeType: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeTypeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  badgeReq: {
    backgroundColor: colors.status.errorSurface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeReqText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.status.error,
  },
  linearQText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    lineHeight: 22,
    letterSpacing: -0.1,
    marginBottom: spacing.md,
  },

  // ── Linear footer
  linearFooter: {
    backgroundColor: colors.background.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  linearSubmitBtn: {
    backgroundColor: colors.primary.dark,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  linearSubmitBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  linearBtnDisabled: {
    opacity: 0.45,
  },
  linearFooterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  linearSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    backgroundColor: colors.background.paper,
  },
  linearSaveBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.primary.main,
  },
  linearDiscardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.status.error,
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    backgroundColor: colors.background.paper,
  },
  linearDiscardBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.status.error,
  },

  // ── Tablet landscape two-column layout
  tabletContainer: {
    flex: 1,
    flexDirection: 'row',
  },

  // LEFT sidebar
  tabletSidebar: {
    width: '36%',
    backgroundColor: colors.background.paper,
    borderRightWidth: 1,
    borderRightColor: colors.border.light,
    flexDirection: 'column',
  },
  tabletSidebarHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    backgroundColor: colors.background.subtle,
  },
  tabletSidebarTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    letterSpacing: -0.1,
  },
  tabletSidebarProgress: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  tabletSidebarScroll: {
    flex: 1,
  },
  tabletSidebarSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 4,
  },
  tabletSidebarSectionText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    color: colors.primary.main,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  tabletSidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  tabletSidebarItemActive: {
    backgroundColor: colors.primary.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  tabletSidebarBadge: {
    minWidth: 30,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.background.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  tabletSidebarBadgeAnswered: {
    backgroundColor: colors.primary.surface,
  },
  tabletSidebarBadgeText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 9,
    color: colors.text.tertiary,
  },
  tabletSidebarBadgeTextAnswered: {
    color: colors.primary.main,
  },
  tabletSidebarItemText: {
    flex: 1,
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  tabletSidebarFooter: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    backgroundColor: colors.background.subtle,
  },
  tabletSidebarSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: 9,
  },
  tabletSidebarSaveBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 11,
    color: colors.primary.main,
  },
  tabletSidebarDiscardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.status.error,
    borderRadius: borderRadius.md,
    paddingVertical: 9,
  },
  tabletSidebarDiscardBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: 11,
    color: colors.status.error,
  },

  // RIGHT detail panel
  tabletDetailPanel: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.background.default,
  },
  tabletDetailContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 16,
  },
  tabletDetailFooter: {
    backgroundColor: colors.background.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  // Focused card highlight (tablet)
  linearCardFocused: {
    borderColor: colors.primary.main,
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // ── Dialog styles
  dialogPaper: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.paper,
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
    gap: 0,
  },
  dialogTitleAccent: {
    width: 4,
    height: 26,
    backgroundColor: colors.primary.main,
    borderRadius: 2,
    marginRight: 0,
  },
  dialogTitleText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 20,
    color: colors.text.primary,
    letterSpacing: -0.2,
    flex: 1,
    paddingLeft: spacing.md,
  },
  dialogBodyPad: {
    paddingTop: spacing.xs,
  },
  dialogBodyText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  dialogHintText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    marginTop: spacing.xs,
  },
  dialogInput: {
    marginBottom: spacing.sm,
    backgroundColor: colors.background.paper,
  },
  dialogActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  dialogPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogPrimaryText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  dialogBtnDisabled: {
    opacity: 0.45,
  },

  // ── Draft cards (inside Continue Draft dialog)
  draftsOfflineBanner: {
    backgroundColor: colors.accent.orange + '20',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  draftsOfflineBannerText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.accent.orange,
  },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  draftCardLeft: {
    flexShrink: 0,
  },
  draftIconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftCardBody: {
    flex: 1,
  },
  draftName: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    marginBottom: 2,
  },
  draftSubId: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    marginBottom: 2,
  },
  draftMeta: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  draftTimestamp: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    marginTop: 2,
  },
  draftResponseCount: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
    marginTop: 2,
  },
  draftOfflineLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.accent.orange,
    marginTop: 2,
  },
  draftCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  draftDeleteBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
  },
});

export default React.memo(DataCollectionScreen);
