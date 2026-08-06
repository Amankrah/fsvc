/**
 * ResponseCard Component
 * Individual Q&A card in the respondent detail view.
 * Follows the Savanna Intelligence card language: left accent bar,
 * Fraunces question text, DMSans answer, category badge.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { ResponseDetail } from '../../hooks/responses';
import { ResponseFormatter } from './ResponseFormatter';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface ResponseCardProps {
  response: ResponseDetail;
}

export const ResponseCard: React.FC<ResponseCardProps> = ({ response }) => {
  const category =
    response.question_category ||
    response.question_bank_summary?.question_category;
  const questionText =
    response.question_text ||
    response.question_details?.question_text ||
    'Question';
  const timestamp = new Date(response.collected_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.card}>
      {/* Left accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.body}>
        {/* Badge row */}
        <View style={styles.badgeRow}>
          {category ? (
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{category}</Text>
            </View>
          ) : null}
          {response.is_validated && (
            <View style={styles.validatedBadge}>
              <Icon source="check-circle" size={11} color={colors.status.success} />
              <Text style={styles.validatedText}>Validated</Text>
            </View>
          )}
        </View>

        {/* Question */}
        <Text style={styles.questionText}>{questionText}</Text>

        {/* Answer */}
        <View style={styles.answerContainer}>
          <ResponseFormatter response={response} />
        </View>

        {/* Timestamp */}
        <Text style={styles.timestamp}>{timestamp}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    backgroundColor: colors.primary.main,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
  },
  catBadge: {
    backgroundColor: colors.status.warningSurface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  catBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.status.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  validatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.status.successSurface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.25)',
  },
  validatedText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.status.success,
  },
  questionText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    lineHeight: 22,
    letterSpacing: -0.1,
    marginBottom: spacing.sm,
  },
  answerContainer: {
    marginBottom: spacing.sm,
  },
  timestamp: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
  },
});
