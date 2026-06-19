import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Icon } from 'react-native-paper';
import { colors, typography, spacing, borderRadius, elevation } from '../constants/theme';

interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  /**
   * `featured` — full-width horizontal layout with a green-tinted background.
   * Regular — compact vertical layout for a 2-column grid.
   */
  featured?: boolean;
  /** Icon and accent color. Defaults to primary green. */
  tintColor?: string;
  disabled?: boolean;
}

/**
 * ToolCard
 *
 * Used in ProjectDetailsScreen's tools grid. The `featured` variant
 * spans full width as a hero entry point (e.g., "Collect Data").
 * Regular variants sit in a 2-column grid.
 */
const ToolCard: React.FC<ToolCardProps> = ({
  icon,
  title,
  description,
  onPress,
  featured = false,
  tintColor = colors.primary.main,
  disabled = false,
}) => {
  if (featured) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        style={[styles.featured, { borderLeftColor: tintColor }, disabled && styles.disabled]}
      >
        <View style={[styles.featuredIcon, { backgroundColor: `${tintColor}18` }]}>
          <Icon source={icon} size={28} color={tintColor} />
        </View>
        <View style={styles.featuredText}>
          <Text style={[styles.featuredTitle, { color: tintColor }]}>{title}</Text>
          <Text style={styles.featuredDesc} numberOfLines={2}>
            {description}
          </Text>
        </View>
        <Icon
          source="chevron-right"
          size={20}
          color={disabled ? colors.text.disabled : colors.text.tertiary}
        />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.regular, disabled && styles.disabled]}
    >
      <View style={[styles.regularIcon, { backgroundColor: `${tintColor}15` }]}>
        <Icon source={icon} size={24} color={disabled ? colors.text.disabled : tintColor} />
      </View>
      <Text style={[styles.regularTitle, disabled && styles.disabledText]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.regularDesc} numberOfLines={2}>
        {description}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Featured (full-width horizontal)
  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    ...elevation.sm,
  },
  featuredIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  featuredText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  featuredTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    marginBottom: 2,
  },
  featuredDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },

  // Regular (half-width grid cell)
  regular: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    flex: 1,
  },
  regularIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  regularTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    marginBottom: 4,
  },
  regularDesc: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },

  // States
  disabled: {
    opacity: 0.45,
  },
  disabledText: {
    color: colors.text.disabled,
  },
});

export default React.memo(ToolCard);
