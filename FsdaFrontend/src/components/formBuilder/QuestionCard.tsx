/**
 * QuestionCard Component
 * Displays a single question with actions and metadata.
 * Savanna Intelligence design: white card, left accent bar, theme tokens.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { Question, ResponseType, ResponseTypeInfo } from '../../types';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface QuestionCardProps {
  question: Question;
  index: number;
  responseTypes: ResponseTypeInfo[];
  questionBankChoices: any;
  onEdit: (question: Question) => void;
  onDuplicate: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  responseCount?: number;
}

/** Maps response type → accent color + badge surface color */
const getTypeColors = (responseType: string) => {
  const amberTypes = ['multiple_choice', 'text', 'long_text', 'email', 'phone', 'url'];
  const infoTypes = ['matrix', 'ranking', 'slider', 'file_upload', 'signature'];
  if (amberTypes.includes(responseType)) {
    return { accent: colors.sync.pending, surface: colors.sync.pendingSurface };
  }
  if (infoTypes.includes(responseType)) {
    return { accent: colors.status.info, surface: colors.status.infoSurface };
  }
  // Default: green (single_choice, number, decimal, yes_no, date, photo, gps, etc.)
  return { accent: colors.sync.synced, surface: colors.sync.syncedSurface };
};

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  responseTypes,
  questionBankChoices,
  onEdit,
  onDuplicate,
  onDelete,
  responseCount,
}) => {
  const { accent, surface } = getTypeColors(question.response_type);

  const getResponseTypeDisplay = (type: ResponseType) => {
    const typeInfo = responseTypes.find((rt) => rt.value === type);
    return typeInfo?.display_name || type;
  };

  const getCategoryDisplay = (category: string) => {
    const cat = questionBankChoices.categories?.find((c: any) => c.value === category);
    return cat?.label || category;
  };

  const getDataSourceDisplay = (source: string) => {
    const src = questionBankChoices.data_sources?.find((s: any) => s.value === source);
    return src?.label || source;
  };

  // Compact meta line: "4 options · Required"
  const metaParts: string[] = [];
  if (question.options?.length) metaParts.push(`${question.options.length} options`);
  metaParts.push(question.is_required ? 'Required' : 'Optional');
  if (question.allow_multiple) metaParts.push('Multiple');

  return (
    <TouchableOpacity style={styles.cardWrapper} activeOpacity={0.92}>
      <View style={styles.card}>
        {/* Left accent bar — color indicates response type group */}
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        <View style={styles.content}>
          {/* ── Header: type badge + action buttons ── */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.typeBadge, { backgroundColor: surface }]}>
                <Text style={[styles.typeBadgeText, { color: accent }]}>
                  {getResponseTypeDisplay(question.response_type)}
                </Text>
              </View>

              {question.priority_score !== undefined && question.priority_score >= 7 && (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>⭐ {question.priority_score}</Text>
                </View>
              )}

              {responseCount !== undefined && responseCount > 0 && (
                <View style={styles.responseCountBadge}>
                  <Text style={styles.responseCountBadgeText}>✓ {responseCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onEdit(question)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Icon source="pencil-outline" size={17} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => onDuplicate(question.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Icon source="content-copy" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtnStyle]}
                onPress={() => onDelete(question.id)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Icon source="delete-outline" size={17} color={colors.status.error} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Question text ── */}
          <Text style={styles.questionText} numberOfLines={3}>
            {question.question_text}
          </Text>

          {/* ── Compact meta line ── */}
          <Text style={styles.metaLine}>{metaParts.join(' · ')}</Text>

          {/* ── Secondary badges: category / data source / work package ── */}
          {(question.question_category || question.data_source || question.work_package) && (
            <View style={styles.secondaryRow}>
              {question.question_category && (
                <View style={styles.secondaryBadge}>
                  <Text style={styles.secondaryBadgeText}>
                    {getCategoryDisplay(question.question_category)}
                  </Text>
                </View>
              )}
              {question.data_source && question.data_source !== 'internal' && (
                <View style={[styles.secondaryBadge, styles.dataSourceBadge]}>
                  <Text style={[styles.secondaryBadgeText, { color: colors.status.info }]}>
                    🤝 {getDataSourceDisplay(question.data_source)}
                  </Text>
                </View>
              )}
              {question.work_package && (
                <View style={[styles.secondaryBadge, styles.workPackageBadge]}>
                  <Text style={[styles.secondaryBadgeText, { color: colors.sync.pending }]}>
                    📦 {question.work_package}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Assigned fields (Generated Questions) ── */}
          {((question as any).assigned_respondent_type ||
            (question as any).assigned_commodity ||
            (question as any).assigned_country) && (
            <View style={styles.targetingBox}>
              {(question as any).assigned_respondent_type && (
                <View style={styles.targetRow}>
                  <Text style={styles.targetLabel}>👥 Respondent:</Text>
                  <Text style={styles.targetValue} numberOfLines={1}>
                    {(question as any).assigned_respondent_type}
                  </Text>
                </View>
              )}
              {(question as any).assigned_commodity && (
                <View style={styles.targetRow}>
                  <Text style={styles.targetLabel}>🌾 Commodity:</Text>
                  <Text style={styles.targetValue} numberOfLines={1}>
                    {(question as any).assigned_commodity}
                  </Text>
                </View>
              )}
              {(question as any).assigned_country && (
                <View style={styles.targetRow}>
                  <Text style={styles.targetLabel}>🌍 Country:</Text>
                  <Text style={styles.targetValue} numberOfLines={1}>
                    {(question as any).assigned_country}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Targeted fields (Question Bank) ── */}
          {!(question as any).assigned_respondent_type &&
            ((question.targeted_respondents?.length ?? 0) > 0 ||
              (question.targeted_commodities?.length ?? 0) > 0 ||
              (question.targeted_countries?.length ?? 0) > 0) && (
            <View style={styles.targetingBox}>
              {question.targeted_respondents && question.targeted_respondents.length > 0 && (
                <View style={styles.targetRow}>
                  <Text style={styles.targetLabel}>👥 Respondents:</Text>
                  <Text style={styles.targetValue} numberOfLines={1}>
                    {question.targeted_respondents.slice(0, 2).join(', ')}
                    {question.targeted_respondents.length > 2 &&
                      ` +${question.targeted_respondents.length - 2}`}
                  </Text>
                </View>
              )}
              {question.targeted_commodities && question.targeted_commodities.length > 0 && (
                <View style={styles.targetRow}>
                  <Text style={styles.targetLabel}>🌾 Commodities:</Text>
                  <Text style={styles.targetValue} numberOfLines={1}>
                    {question.targeted_commodities.slice(0, 3).join(', ')}
                    {question.targeted_commodities.length > 3 &&
                      ` +${question.targeted_commodities.length - 3}`}
                  </Text>
                </View>
              )}
              {question.targeted_countries && question.targeted_countries.length > 0 && (
                <View style={styles.targetRow}>
                  <Text style={styles.targetLabel}>🌍 Countries:</Text>
                  <Text style={styles.targetValue} numberOfLines={1}>
                    {question.targeted_countries.slice(0, 3).join(', ')}
                    {question.targeted_countries.length > 3 &&
                      ` +${question.targeted_countries.length - 3}`}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Options preview ── */}
          {question.options && question.options.length > 0 && (
            <View style={styles.optionsPreview}>
              {question.options.slice(0, 3).map((option, idx) => (
                <Text key={idx} style={styles.optionText}>
                  • {option}
                </Text>
              ))}
              {question.options.length > 3 && (
                <Text style={styles.moreOptions}>
                  +{question.options.length - 3} more
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: spacing.md,
  },

  // Card: row layout — accent bar sits flush on the left
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    marginRight: spacing.sm,
  },
  typeBadge: {
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
  },
  priorityBadge: {
    backgroundColor: colors.sync.pendingSurface,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  priorityBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.sync.pending,
  },
  responseCountBadge: {
    backgroundColor: colors.sync.syncedSurface,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  responseCountBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.sync.synced,
  },

  // ── Action buttons
  actions: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnStyle: {
    backgroundColor: colors.status.errorSurface,
  },

  // ── Question text + meta
  questionText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    lineHeight: 22,
    marginBottom: 5,
  },
  metaLine: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },

  // ── Secondary badges
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  secondaryBadge: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  dataSourceBadge: {
    backgroundColor: colors.status.infoSurface,
  },
  workPackageBadge: {
    backgroundColor: colors.sync.pendingSurface,
  },
  secondaryBadgeText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
  },

  // ── Targeting info box
  targetingBox: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  targetRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  targetLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    marginRight: 6,
  },
  targetValue: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    flex: 1,
  },

  // ── Options preview
  optionsPreview: {
    backgroundColor: colors.background.subtle,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  optionText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.primary,
    marginBottom: 3,
  },
  moreOptions: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: 2,
  },
});
