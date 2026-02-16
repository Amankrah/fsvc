/**
 * ResponseCard Component
 * Displays a single response with question and value
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import { ResponseDetail } from '../../hooks/responses';
import { ResponseFormatter } from './ResponseFormatter';
import { colors } from '../../constants/theme';

interface ResponseCardProps {
  response: ResponseDetail;
}

export const ResponseCard: React.FC<ResponseCardProps> = ({ response }) => {
  const questionBankSummary = response.question_bank_summary;

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.header}>
          <Text variant="labelLarge" style={styles.questionLabel}>
            {response.question_text || response.question_details?.question_text || 'Question'}
          </Text>
          {response.is_validated && (
            <Chip
              style={styles.validatedChip}
              textStyle={styles.validatedChipText}
              icon="check-circle">
              Validated
            </Chip>
          )}
        </View>

        {questionBankSummary?.question_category && (
          <View style={styles.metadataContainer}>
            <Chip
              style={styles.categoryChip}
              textStyle={styles.categoryChipText}
              icon="folder-outline"
              compact>
              {questionBankSummary.question_category}
            </Chip>
          </View>
        )}

        <View style={styles.valueContainer}>
          <ResponseFormatter response={response} />
        </View>

        <Text variant="bodySmall" style={styles.timestamp}>
          {new Date(response.collected_at).toLocaleString()}
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.border.light,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionLabel: {
    color: colors.primary.main,
    flex: 1,
    marginRight: 8,
  },
  validatedChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    height: 28,
  },
  validatedChipText: {
    color: colors.status.success,
    fontSize: 11,
  },
  valueContainer: {
    marginBottom: 8,
  },
  timestamp: {
    color: colors.text.disabled,
    fontSize: 12,
  },
  metadataContainer: {
    marginBottom: 12,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignSelf: 'flex-start',
  },
  categoryChipText: {
    color: colors.status.warning,
    fontSize: 11,
    fontWeight: '600',
  },
});
