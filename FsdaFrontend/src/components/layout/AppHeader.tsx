import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { colors, typography, spacing } from '../../constants/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Called when the back chevron is pressed. If omitted, no back button is shown. */
  onBack?: () => void;
  /** Extra actions rendered on the right side (buttons, icons, etc.) */
  rightActions?: React.ReactNode;
  /**
   * `default` — white surface with dark text and a bottom border.
   * `hero`    — forest-green gradient background with white text.
   *             Use for Login, Dashboard, ProjectDetails, AcceptInvitation.
   */
  variant?: 'default' | 'hero';
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightActions,
  variant = 'default',
}) => {
  const insets = useSafeAreaInsets();
  const isHero = variant === 'hero';

  return (
    <View
      style={[
        styles.container,
        isHero ? styles.heroContainer : styles.defaultContainer,
        { paddingTop: insets.top + spacing.sm },
      ]}
    >
      {/* Left — optional back button */}
      <View style={styles.side}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon
              source="chevron-left"
              size={28}
              color={isHero ? colors.text.inverse : colors.text.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Center — title + subtitle */}
      <View style={styles.center}>
        <Text
          style={[styles.title, isHero ? styles.heroTitle : styles.defaultTitle]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, isHero ? styles.heroSubtitle : styles.defaultSubtitle]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {/* Right — action slot */}
      <View style={[styles.side, styles.rightSide]}>{rightActions}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    minHeight: 56,
  },
  defaultContainer: {
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  heroContainer: {
    backgroundColor: colors.primary.dark,
  },
  side: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontFamily: 'Fraunces-Bold',
    letterSpacing: -0.3,
  },
  defaultTitle: {
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
  },
  heroTitle: {
    fontSize: typography.fontSize.xl,
    color: colors.text.inverse,
  },
  subtitle: {
    fontFamily: 'DMSans-Regular',
    marginTop: 2,
  },
  defaultSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  heroSubtitle: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
});

export default AppHeader;
