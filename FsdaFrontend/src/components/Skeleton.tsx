import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '../constants/theme';

// ─── Base shimmer ─────────────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = '100%',
  height = 16,
  borderRadius: br = 6,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: br, backgroundColor: colors.border.medium, opacity },
        style,
      ]}
    />
  );
};

// ─── Project card skeleton ────────────────────────────────────────────────────

export const SkeletonProjectCard: React.FC = () => (
  <View style={cardStyles.card}>
    <View style={cardStyles.accentBar} />
    <View style={cardStyles.body}>
      {/* Title area */}
      <SkeletonBox width="60%" height={18} style={{ marginBottom: 8 }} />
      <SkeletonBox width="90%" height={13} style={{ marginBottom: 4 }} />
      <SkeletonBox width="75%" height={13} style={{ marginBottom: 20 }} />
      {/* Stat block */}
      <View style={cardStyles.statRow}>
        <SkeletonBox width={52} height={36} borderRadius={8} />
        <SkeletonBox width={52} height={36} borderRadius={8} />
        <SkeletonBox width={52} height={36} borderRadius={8} />
      </View>
      {/* Footer */}
      <View style={cardStyles.footer}>
        <SkeletonBox width={60} height={20} borderRadius={10} />
        <SkeletonBox width={80} height={13} borderRadius={6} />
      </View>
    </View>
  </View>
);

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  accentBar: {
    height: 3,
    backgroundColor: colors.border.medium,
  },
  body: {
    padding: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

// ─── Stat pill skeleton ───────────────────────────────────────────────────────

export const SkeletonStatPill: React.FC = () => (
  <SkeletonBox
    width={80}
    height={64}
    borderRadius={borderRadius.xl}
    style={{ marginRight: spacing.sm }}
  />
);

// ─── Bundle card skeleton ─────────────────────────────────────────────────────

export const SkeletonBundleCard: React.FC = () => (
  <View style={bundleStyles.card}>
    <SkeletonBox width="55%" height={16} style={{ marginBottom: 8 }} />
    <SkeletonBox width="30%" height={13} style={{ marginBottom: 12 }} />
    <SkeletonBox width="100%" height={8} borderRadius={4} style={{ marginBottom: 6 }} />
    <SkeletonBox width="40%" height={13} />
  </View>
);

const bundleStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
});
