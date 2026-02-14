/**
 * NavigationControls Component
 * Previous, Next, and Submit buttons with progress indicator
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, ProgressBar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';

interface NavigationControlsProps {
  currentIndex: number;
  totalQuestions: number;
  progress: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  submitting: boolean;
  canGoBack: boolean;
  isLastQuestion: boolean;
}

export const NavigationControls: React.FC<NavigationControlsProps> = ({
  currentIndex,
  totalQuestions,
  progress,
  onPrevious,
  onNext,
  onSubmit,
  onSaveDraft,
  submitting,
  canGoBack,
  isLastQuestion,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Question {currentIndex + 1} of {totalQuestions}
        </Text>
        <ProgressBar progress={progress} color={colors.primary.main} style={styles.progressBar} />
        <Text style={styles.progressPercentage}>{Math.round(progress * 100)}% Complete</Text>
      </View>

      {/* Save for Later Button */}
      {onSaveDraft && (
        <Button
          mode="text"
          onPress={onSaveDraft}
          disabled={submitting}
          icon="content-save-outline"
          style={styles.saveDraftButton}
          textColor={colors.status.warning}
          labelStyle={styles.saveDraftLabel}>
          Save for Later
        </Button>
      )}

      {/* Navigation Buttons */}
      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          onPress={onPrevious}
          disabled={!canGoBack || submitting}
          icon="arrow-left"
          style={[styles.button, styles.previousButton]}
          textColor={colors.primary.main}>
          Previous
        </Button>

        {isLastQuestion ? (
          <Button
            mode="contained"
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
            icon="check-circle"
            style={[styles.button, styles.submitButton]}
            textColor="#FFFFFF">
            Submit
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={onNext}
            disabled={submitting}
            icon="arrow-right"
            style={[styles.button, styles.nextButton]}
            contentStyle={styles.nextButtonContent}
            textColor="#FFFFFF">
            Next
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 30, 133, 0.3)',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    color: colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background.paper,
    marginBottom: 8,
  },
  progressPercentage: {
    color: colors.text.secondary,
    fontSize: 12,
    textAlign: 'center',
  },
  saveDraftButton: {
    marginBottom: 12,
    alignSelf: 'center',
  },
  saveDraftLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
  previousButton: {
    borderColor: colors.primary.main,
  },
  nextButton: {
    backgroundColor: colors.primary.dark,
  },
  nextButtonContent: {
    flexDirection: 'row-reverse',
  },
  submitButton: {
    backgroundColor: colors.primary.main,
  },
});
