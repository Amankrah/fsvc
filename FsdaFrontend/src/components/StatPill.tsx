import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Icon } from 'react-native-paper';
import { colors, typography, spacing, borderRadius } from '../constants/theme';

interface StatPillProps {
  icon: string;
  value: number | string;
  label: string;
  /** When true, renders on a dark (hero) background. Default: false. */
  onDark?: boolean;
  /** When true, pill expands to fill available width (flex: 1). */
  fill?: boolean;
}

/**
 * StatPill
 *
 * A compact pill-shaped stat tile used in the Dashboard hero section.
 * Render multiple in a horizontal ScrollView for the stats row.
 */
const StatPill: React.FC<StatPillProps> = ({ icon, value, label, onDark = false, fill = false }) => {
  return (
    <View style={[styles.pill, onDark ? styles.pillDark : styles.pillLight, fill && { flex: 1, marginRight: 0 }]}>
      <Icon
        source={icon}
        size={18}
        color={onDark ? 'rgba(255,255,255,0.8)' : colors.primary.main}
      />
      <Text style={[styles.value, onDark ? styles.valueDark : styles.valueLight]}>
        {value}
      </Text>
      <Text style={[styles.label, onDark ? styles.labelDark : styles.labelLight]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.xl,
    marginRight: spacing.sm,
    minWidth: 80,
    gap: 2,
  },
  pillLight: {
    backgroundColor: colors.background.subtle,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  pillDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  value: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xl,
    lineHeight: typography.fontSize.xl + 4,
  },
  valueLight: {
    color: colors.text.primary,
  },
  valueDark: {
    color: colors.text.inverse,
  },
  label: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelLight: {
    color: colors.text.secondary,
  },
  labelDark: {
    color: 'rgba(255,255,255,0.65)',
  },
});

export default React.memo(StatPill);
