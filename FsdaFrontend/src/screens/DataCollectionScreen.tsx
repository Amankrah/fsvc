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
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, Card, ActivityIndicator, IconButton, Portal, Dialog, TextInput as PaperTextInput, Button } from 'react-native-paper';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';

// Custom Hooks
import { useRespondent, useQuestions, useResponseState } from '../hooks/dataCollection';

// Components
import {
  RespondentForm,
  QuestionInput,
  NavigationControls,
} from '../components/dataCollection';

// Services
import apiService from '../services/api';

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
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkExpirationDays, setLinkExpirationDays] = useState('7');
  const [linkMaxResponses, setLinkMaxResponses] = useState('100');
  const [creatingLink, setCreatingLink] = useState(false);

  // Respondent Hook
  const respondent = useRespondent(projectId);

  // Questions Hook
  const questions = useQuestions({
    projectId,
    selectedRespondentType: respondent.selectedRespondentType,
    selectedCommodities: respondent.selectedCommodities,
    selectedCountry: respondent.selectedCountry,
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
    }
  );

  // Load available options on mount
  useEffect(() => {
    questions.loadAvailableOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-generate respondent ID on mount
  useEffect(() => {
    if (respondent.useAutoId && !respondent.respondentId) {
      respondent.generateNewRespondentId();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setShowRespondentForm(true);
  };

  // Handle Back to Form
  const handleBackToForm = () => {
    setShowRespondentForm(true);
  };

  // Handle Create Link
  const handleOpenLinkDialog = () => {
    if (questions.questions.length === 0) {
      Alert.alert('No Questions', 'Please generate questions first before creating a shareable link.');
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
        title: linkTitle || projectName,
        description: linkDescription,
        expiration_days: parseInt(linkExpirationDays) || 7,
        max_responses: parseInt(linkMaxResponses) || 0,
        auto_expire_after_use: false,
      };

      const response = await apiService.createResponseLink(linkData);

      // Get the shareable URL from backend response
      const shareableUrl = response.share_url || `http://localhost:8000/respond/${response.token}`;

      Alert.alert(
        'Link Created Successfully!',
        `Your shareable survey link:\n\n${shareableUrl}\n\nShare this link with respondents to complete the survey in their browser.`,
        [
          {
            text: 'Copy Link',
            onPress: () => {
              // Copy to clipboard (you'll need @react-native-clipboard/clipboard)
              Alert.alert('Success', 'Link copied to clipboard!');
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
      Alert.alert('Error', error?.message || 'Failed to create shareable link');
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
            <IconButton
              icon="share-variant"
              iconColor="#ffffff"
              size={24}
              onPress={handleOpenLinkDialog}
            />
          </View>

          {/* Respondent Form */}
          <RespondentForm
            {...respondent}
            availableRespondentTypes={questions.availableRespondentTypes}
            availableCommodities={questions.availableCommodities}
            availableCountries={questions.availableCountries}
            loadingOptions={questions.loadingOptions}
            generatingQuestions={questions.generatingQuestions}
            questionsGenerated={questions.questionsGenerated}
            onGenerateQuestions={handleGenerateQuestions}
            onStartSurvey={handleStartSurvey}
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

                {/* Question Number and Type */}
                <View style={styles.questionHeader}>
                  <View style={styles.questionBadge}>
                    <Text style={styles.questionBadgeText}>
                      Q{responses.currentQuestionIndex + 1}
                    </Text>
                  </View>
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

        {/* Navigation Controls */}
        {currentQuestion && (
          <NavigationControls
            currentIndex={responses.currentQuestionIndex}
            totalQuestions={responses.visibleQuestions.length}
            progress={responses.progress}
            onPrevious={responses.handlePrevious}
            onNext={responses.handleNext}
            onSubmit={() => responses.handleSubmit(handleSubmitSuccess)}
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
});

export default React.memo(DataCollectionScreen);
