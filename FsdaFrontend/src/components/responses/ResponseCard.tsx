/**
 * ResponseCard Component
 * Displays a single response with question and value
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip } from 'react-native-paper';
import { ResponseDetail } from '../../hooks/responses';
import { ResponseFormatter } from './ResponseFormatter';

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
            {response.question_details?.question_text || 'Question'}
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

        {questionBankSummary && (
          <View style={styles.metadataContainer}>
            {questionBankSummary.question_category && (
              <Chip
                style={styles.categoryChip}
                textStyle={styles.categoryChipText}
                icon="folder-outline"
                compact>
                {questionBankSummary.question_category}
              </Chip>
            )}

            <View style={styles.filtersRow}>
              {questionBankSummary.assigned_respondent_type && (
                <Chip
                  style={styles.filterChip}
                  textStyle={styles.filterChipText}
                  compact>
                  {questionBankSummary.assigned_respondent_type}
                </Chip>
              )}
              {questionBankSummary.assigned_commodity && (
                <Chip
                  style={styles.filterChip}
                  textStyle={styles.filterChipText}
                  compact>
                  {questionBankSummary.assigned_commodity}
                </Chip>
              )}
              {questionBankSummary.assigned_country && (
                <Chip
                  style={styles.filterChip}
                  textStyle={styles.filterChipText}
                  compact>
                  {questionBankSummary.assigned_country}
                </Chip>
              )}
            </View>
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
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionLabel: {
    color: '#64c8ff',
    flex: 1,
    marginRight: 8,
  },
  validatedChip: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
    height: 28,
  },
  validatedChipText: {
    color: '#4caf50',
    fontSize: 11,
  },
  valueContainer: {
    marginBottom: 8,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  metadataContainer: {
    marginBottom: 12,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: 'rgba(255, 152, 0, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
    alignSelf: 'flex-start',
  },
  categoryChipText: {
    color: '#ff9800',
    fontSize: 11,
    fontWeight: '600',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    backgroundColor: 'rgba(100, 200, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(100, 200, 255, 0.25)',
  },
  filterChipText: {
    color: '#64c8ff',
    fontSize: 10,
  },
});
