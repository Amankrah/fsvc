/**
 * NavigationControls Component
 * Previous, Next, and Submit buttons with progress indicator
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, ProgressBar, Text } from 'react-native-paper';

interface NavigationControlsProps {
  currentIndex: number;
  totalQuestions: number;
  progress: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
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
  submitting,
  canGoBack,
  isLastQuestion,
}) => {
  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          Question {currentIndex + 1} of {totalQuestions}
        </Text>
        <ProgressBar progress={progress} color="#64c8ff" style={styles.progressBar} />
        <Text style={styles.progressPercentage}>{Math.round(progress * 100)}% Complete</Text>
      </View>

      {/* Navigation Buttons */}
      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          onPress={onPrevious}
          disabled={!canGoBack || submitting}
          icon="arrow-left"
          style={[styles.button, styles.previousButton]}
          textColor="#64c8ff">
          Previous
        </Button>

        {isLastQuestion ? (
          <Button
            mode="contained"
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
            icon="check-circle"
            style={[styles.button, styles.submitButton]}>
            Submit
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={onNext}
            disabled={submitting}
            icon="arrow-right"
            style={[styles.button, styles.nextButton]}
            contentStyle={styles.nextButtonContent}>
            Next
          </Button>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'rgba(75, 30, 133, 0.1)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 30, 133, 0.3)',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 8,
  },
  progressPercentage: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
  },
  previousButton: {
    borderColor: '#64c8ff',
  },
  nextButton: {
    backgroundColor: '#4b1e85',
  },
  nextButtonContent: {
    flexDirection: 'row-reverse',
  },
  submitButton: {
    backgroundColor: '#1976d2',
  },
});
