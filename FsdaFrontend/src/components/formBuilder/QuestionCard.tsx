/**
 * QuestionCard Component
 * Displays a single question with actions and metadata
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { Question, ResponseType, ResponseTypeInfo } from '../../types';

interface QuestionCardProps {
  question: Question;
  index: number;
  responseTypes: ResponseTypeInfo[];
  questionBankChoices: any;
  onEdit: (question: Question) => void;
  onDuplicate: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  responseCount?: number; // Number of respondents who answered this question
}

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

  return (
    <TouchableOpacity style={styles.cardWrapper} activeOpacity={0.95}>
      <View style={styles.card}>
        <View style={styles.cardOverlay} />
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.modernChip}>
                <Text style={styles.modernChipText}>{index + 1}</Text>
              </View>
              <View style={styles.typeChipModern}>
                <Text style={styles.typeChipText}>
                  {getResponseTypeDisplay(question.response_type)}
                </Text>
              </View>
              {question.question_category && (
                <View style={styles.categoryChipDisplay}>
                  <Text style={styles.categoryChipDisplayText}>
                    {getCategoryDisplay(question.question_category)}
                  </Text>
                </View>
              )}
              {question.priority_score && question.priority_score >= 7 && (
                <View style={styles.priorityChip}>
                  <Text style={styles.priorityChipText}>⭐ {question.priority_score}</Text>
                </View>
              )}
              {responseCount !== undefined && responseCount > 0 && (
                <View style={styles.responseCountChip}>
                  <Text style={styles.responseCountChipText}>✓ {responseCount} responses</Text>
                </View>
              )}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(question)}>
                <IconButton icon="pencil" size={18} iconColor="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => onDuplicate(question.id)}>
                <IconButton icon="content-copy" size={18} iconColor="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(question.id)}>
                <IconButton icon="delete" size={18} iconColor="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          <Text variant="bodyLarge" style={styles.questionText}>
            {question.question_text}
          </Text>

          {/* QuestionBank Metadata */}
          <View style={styles.metaRow}>
            {question.data_source && question.data_source !== 'internal' && (
              <View style={styles.dataSourceBadge}>
                <Text style={styles.dataSourceBadgeText}>
                  🤝 {getDataSourceDisplay(question.data_source)}
                </Text>
              </View>
            )}
            {question.work_package && (
              <View style={styles.workPackageBadge}>
                <Text style={styles.workPackageBadgeText}>📦 {question.work_package}</Text>
              </View>
            )}
          </View>

          <View style={styles.meta}>
            {question.is_required && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>Required</Text>
              </View>
            )}
            {question.allow_multiple && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>Multiple</Text>
              </View>
            )}
            {question.options && question.options.length > 0 && (
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>{question.options.length} options</Text>
              </View>
            )}
          </View>

          {/* Targeted/Assigned Information */}
          {/* Show assigned fields for generated questions, targeted fields for question bank */}
          {(question as any).assigned_respondent_type ||
          (question as any).assigned_commodity ||
          (question as any).assigned_country ? (
            /* Generated Question - Show Assigned Fields */
            <View style={styles.targetedInfoSection}>
              {(question as any).assigned_respondent_type && (
                <View style={styles.targetedRow}>
                  <Text style={styles.targetedLabel}>👥 Respondent:</Text>
                  <Text style={styles.targetedValue} numberOfLines={1}>
                    {(question as any).assigned_respondent_type}
                  </Text>
                </View>
              )}
              {(question as any).assigned_commodity && (
                <View style={styles.targetedRow}>
                  <Text style={styles.targetedLabel}>🌾 Commodity:</Text>
                  <Text style={styles.targetedValue} numberOfLines={1}>
                    {(question as any).assigned_commodity}
                  </Text>
                </View>
              )}
              {(question as any).assigned_country && (
                <View style={styles.targetedRow}>
                  <Text style={styles.targetedLabel}>🌍 Country:</Text>
                  <Text style={styles.targetedValue} numberOfLines={1}>
                    {(question as any).assigned_country}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            /* Question Bank - Show Targeted Fields */
            ((question.targeted_respondents?.length ?? 0) > 0 ||
              (question.targeted_commodities?.length ?? 0) > 0 ||
              (question.targeted_countries?.length ?? 0) > 0) && (
              <View style={styles.targetedInfoSection}>
                {question.targeted_respondents && question.targeted_respondents.length > 0 && (
                  <View style={styles.targetedRow}>
                    <Text style={styles.targetedLabel}>👥 Respondents:</Text>
                    <Text style={styles.targetedValue} numberOfLines={1}>
                      {question.targeted_respondents.slice(0, 2).join(', ')}
                      {question.targeted_respondents.length > 2 &&
                        ` +${question.targeted_respondents.length - 2}`}
                    </Text>
                  </View>
                )}
                {question.targeted_commodities && question.targeted_commodities.length > 0 && (
                  <View style={styles.targetedRow}>
                    <Text style={styles.targetedLabel}>🌾 Commodities:</Text>
                    <Text style={styles.targetedValue} numberOfLines={1}>
                      {question.targeted_commodities.slice(0, 3).join(', ')}
                      {question.targeted_commodities.length > 3 &&
                        ` +${question.targeted_commodities.length - 3}`}
                    </Text>
                  </View>
                )}
                {question.targeted_countries && question.targeted_countries.length > 0 && (
                  <View style={styles.targetedRow}>
                    <Text style={styles.targetedLabel}>🌍 Countries:</Text>
                    <Text style={styles.targetedValue} numberOfLines={1}>
                      {question.targeted_countries.slice(0, 3).join(', ')}
                      {question.targeted_countries.length > 3 &&
                        ` +${question.targeted_countries.length - 3}`}
                    </Text>
                  </View>
                )}
              </View>
            )
          )}

          {question.options && question.options.length > 0 && (
            <View style={styles.optionsPreview}>
              {question.options.slice(0, 3).map((option, idx) => (
                <Text key={idx} variant="bodySmall" style={styles.optionText}>
                  • {option}
                </Text>
              ))}
              {question.options.length > 3 && (
                <Text variant="bodySmall" style={styles.moreOptions}>
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
    marginBottom: 16,
  },
  card: {
    position: 'relative',
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  content: {
    padding: 16,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  modernChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.4)',
  },
  modernChipText: {
    color: '#64c8ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  typeChipModern: {
    backgroundColor: 'rgba(156, 39, 176, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(156, 39, 176, 0.4)',
  },
  typeChipText: {
    color: '#ce93d8',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryChipDisplay: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  categoryChipDisplayText: {
    color: '#81c784',
    fontSize: 11,
    fontWeight: '600',
  },
  priorityChip: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.4)',
  },
  priorityChipText: {
    color: '#ffd54f',
    fontSize: 11,
  },
  responseCountChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  responseCountChipText: {
    color: '#81c784',
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    backgroundColor: 'rgba(75, 30, 133, 0.4)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.4)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  dataSourceBadge: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.4)',
  },
  dataSourceBadgeText: {
    color: '#64b5f6',
    fontSize: 11,
    fontWeight: '600',
  },
  workPackageBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.4)',
  },
  workPackageBadgeText: {
    color: '#ffb74d',
    fontSize: 11,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  metaChipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
  targetedInfoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  targetedRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  targetedLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  targetedValue: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    flex: 1,
  },
  optionsPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginBottom: 4,
  },
  moreOptions: {
    color: '#64c8ff',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
