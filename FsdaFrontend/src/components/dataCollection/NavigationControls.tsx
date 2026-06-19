/**
 * NavigationControls Component
 * Previous / Next / Submit buttons for single-question survey mode.
 * Progress display and Save Draft are handled by the parent screen header.
 */

import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface NavigationControlsProps {
  currentIndex: number;
  totalQuestions: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  submitting: boolean;
  canGoBack: boolean;
  isLastQuestion: boolean;
}

const NavigationControlsInner: React.FC<NavigationControlsProps> = ({
  currentIndex,
  totalQuestions,
  onPrevious,
  onNext,
  onSubmit,
  submitting,
  canGoBack,
  isLastQuestion,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      {/* Question counter */}
      <Text style={styles.counter}>
        Question {currentIndex + 1} of {totalQuestions}
      </Text>

      {/* Previous / Next (or Submit) */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.prevBtn, !canGoBack && styles.btnDisabled]}
          onPress={onPrevious}
          disabled={!canGoBack || submitting}
          activeOpacity={0.8}
        >
          <Icon source="arrow-left" size={18} color={canGoBack ? colors.primary.main : colors.text.tertiary} />
          <Text style={[styles.prevBtnText, !canGoBack && styles.disabledText]}>Previous</Text>
        </TouchableOpacity>

        {isLastQuestion ? (
          <TouchableOpacity
            style={[styles.nextBtn, styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={onSubmit}
            disabled={submitting}
            activeOpacity={0.82}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon source="check-circle" size={18} color="#fff" />
                <Text style={styles.nextBtnText}>Submit</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, submitting && styles.btnDisabled]}
            onPress={onNext}
            disabled={submitting}
            activeOpacity={0.82}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <Icon source="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const NavigationControls = memo(NavigationControlsInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },

  counter: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  prevBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    backgroundColor: colors.background.paper,
  },
  prevBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.primary.main,
  },

  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary.dark,
  },
  nextBtnText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },

  submitBtn: {
    backgroundColor: colors.primary.main,
  },

  btnDisabled: {
    opacity: 0.4,
  },
  disabledText: {
    color: colors.text.tertiary,
  },
});
