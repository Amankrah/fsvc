/**
 * StatsCards Component
 * Displays summary statistics
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { colors } from '../../constants/theme';

interface StatsCardsProps {
  totalRespondents: number;
  totalResponses: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ totalRespondents, totalResponses }) => {
  return (
    <View style={styles.container}>
      <Card style={styles.statCard}>
        <Card.Content style={styles.statContent}>
          <Text variant="headlineMedium" style={styles.statNumber}>
            {totalRespondents}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Total Respondents
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.statCard}>
        <Card.Content style={styles.statContent}>
          <Text variant="headlineMedium" style={styles.statNumber}>
            {totalResponses}
          </Text>
          <Text variant="bodyMedium" style={styles.statLabel}>
            Total Responses
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    color: colors.primary.main,
    fontWeight: 'bold',
    fontSize: 32,
  },
  statLabel: {
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
