/**
 * StatsCards Component
 * Summary stat pills in the responses screen header band.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface StatsCardsProps {
  totalRespondents: number;
  totalResponses: number;
  totalCount?: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  totalRespondents,
  totalResponses,
  totalCount,
}) => {
  const displayCount = totalCount ?? totalRespondents;

  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <Text style={styles.pillValue}>{displayCount}</Text>
        <Text style={styles.pillLabel}>Respondents</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.pill}>
        <Text style={styles.pillValue}>{totalResponses}</Text>
        <Text style={styles.pillLabel}>Responses</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border.light,
  },
  pillValue: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 28,
    color: colors.text.primary,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  pillLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
});
