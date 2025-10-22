/**
 * StatsCards Component
 * Displays summary statistics
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

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
    backgroundColor: 'rgba(75, 30, 133, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(75, 30, 133, 0.3)',
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    color: '#64c8ff',
    fontWeight: 'bold',
    fontSize: 32,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    textAlign: 'center',
  },
});
