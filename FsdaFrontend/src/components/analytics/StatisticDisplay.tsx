import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip, Divider } from 'react-native-paper';
import { colors } from '../../constants/theme';

interface StatisticDisplayProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'highlight' | 'chip';
  color?: string;
}

export const StatisticDisplay: React.FC<StatisticDisplayProps> = ({
  label,
  value,
  variant = 'default',
  color,
}) => {
  if (variant === 'chip') {
    return (
      <View style={styles.chipContainer}>
        <Text variant="bodyMedium">{label}:</Text>
        <Chip mode="flat" style={[styles.chip, color && { backgroundColor: color }]}>
          {value}
        </Chip>
      </View>
    );
  }

  if (variant === 'highlight') {
    return (
      <View style={styles.highlightContainer}>
        <Text variant="headlineMedium" style={[styles.highlightValue, color && { color }]}>
          {value}
        </Text>
        <Text variant="bodySmall" style={styles.highlightLabel}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.defaultContainer}>
      <Text variant="bodySmall" style={styles.label}>
        {label}
      </Text>
      <Text variant="bodyLarge" style={[styles.value, color && { color }]}>
        {value}
      </Text>
    </View>
  );
};

interface StatisticsGridProps {
  children: React.ReactNode;
}

export const StatisticsGrid: React.FC<StatisticsGridProps> = ({ children }) => {
  return <View style={styles.grid}>{children}</View>;
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  chip: {
    backgroundColor: colors.primary.faint,
  },
  highlightContainer: {
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
  },
  highlightValue: {
    fontWeight: 'bold',
    color: colors.primary.main,
  },
  highlightLabel: {
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  defaultContainer: {
    marginBottom: 12,
  },
  label: {
    color: colors.text.secondary,
    marginBottom: 4,
  },
  value: {
    fontWeight: '500',
  },
});
