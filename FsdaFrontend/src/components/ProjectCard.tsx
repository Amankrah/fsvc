import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { Icon } from 'react-native-paper';
import { Project } from '../types';
import { colors, typography, spacing, borderRadius, elevation } from '../constants/theme';

interface ProjectCardProps {
  project: Project;
  onPress: (project: Project) => void;
  onEditPress?: (project: Project) => void;
}

const getSyncConfig = (status: string) => {
  switch (status) {
    case 'synced':
      return { color: colors.sync.synced, surface: colors.sync.syncedSurface, label: 'SYNCED' };
    case 'pending':
      return { color: colors.sync.pending, surface: colors.sync.pendingSurface, label: 'PENDING' };
    case 'error':
      return { color: colors.sync.error, surface: colors.sync.errorSurface, label: 'ERROR' };
    default:
      return { color: colors.sync.offline, surface: colors.sync.offlineSurface, label: 'OFFLINE' };
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onPress, onEditPress }) => {
  const syncConfig = getSyncConfig(project.sync_status);
  const scale = useRef(new Animated.Value(1)).current;
  const isPending = project.membership_status === 'pending';

  const handlePressIn = () => {
    if (isPending) return;
    Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, speed: 30 }).start();
  };

  const handlePressOut = () => {
    if (isPending) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={() => onPress(project)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={isPending ? 0.9 : 1}
        style={[styles.card, isPending && styles.cardPending]}
      >
        {/* Accent bar — amber for pending, otherwise sync-status colour */}
        <View style={[styles.accentBar, { backgroundColor: isPending ? colors.status.warning : syncConfig.color }]} />

        {/* Pending invitation banner */}
        {isPending && (
          <View style={styles.pendingBanner}>
            <Icon source="clock-outline" size={13} color={colors.status.warning} />
            <Text style={styles.pendingBannerText}>Invitation pending — tap to respond</Text>
          </View>
        )}

        <View style={[styles.body, isPending && styles.bodyPending]}>
          {/* Header: title + status dot + edit */}
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, isPending && styles.titlePending]} numberOfLines={1}>
                {project.name}
              </Text>
              {project.description ? (
                <Text style={styles.description} numberOfLines={2}>
                  {project.description}
                </Text>
              ) : null}
            </View>
            <View style={styles.headerRight}>
              {isPending ? (
                <Icon source="lock-outline" size={16} color={colors.status.warning} />
              ) : (
                <>
                  <View style={[styles.statusDot, { backgroundColor: syncConfig.color }]} />
                  {onEditPress && (
                    <TouchableOpacity
                      onPress={() => onEditPress(project)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.editBtn}
                    >
                      <Icon source="pencil-outline" size={16} color={colors.text.tertiary} />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>

          {/* Stat block — 3 equal columns with dividers */}
          <View style={[styles.statBlock, isPending && styles.statBlockPending]}>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, isPending && styles.statValuePending]}>{project.question_count ?? 0}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
            <View style={[styles.statCell, styles.statCellBordered]}>
              <Text style={[styles.statValue, isPending && styles.statValuePending]}>{project.response_count ?? 0}</Text>
              <Text style={styles.statLabel}>Respondents</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, isPending && styles.statValuePending]}>{project.team_members_count ?? 1}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {isPending ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingLabel}>AWAITING ACCEPTANCE</Text>
              </View>
            ) : (
              <View style={[styles.syncBadge, { backgroundColor: syncConfig.surface }]}>
                <Text style={[styles.syncLabel, { color: syncConfig.color }]}>
                  {syncConfig.label}
                </Text>
              </View>
            )}
            <View style={styles.footerRight}>
              <Text style={styles.dateText}>{formatDate(project.updated_at)}</Text>
              <Icon
                source={isPending ? 'bell-ring-outline' : 'chevron-right'}
                size={18}
                color={isPending ? colors.status.warning : colors.text.tertiary}
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrap: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    ...elevation.sm,
  },
  card: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  accentBar: {
    height: 3,
  },
  body: {
    padding: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleBlock: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  description: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  editBtn: {
    padding: 2,
  },
  statBlock: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    marginBottom: spacing.sm,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statCellBordered: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border.light,
  },
  statValue: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: colors.text.primary,
    lineHeight: typography.fontSize.xxl + 4,
  },
  statLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  syncBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  syncLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  // ── Pending invitation state
  cardPending: {
    borderColor: colors.status.warning + '60',
    opacity: 0.9,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.status.warningSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.status.warning + '30',
  },
  pendingBannerText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.status.warning,
  },
  bodyPending: {
    opacity: 0.75,
  },
  titlePending: {
    color: colors.text.secondary,
  },
  statBlockPending: {
    opacity: 0.6,
  },
  statValuePending: {
    color: colors.text.tertiary,
  },
  pendingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.status.warningSurface,
  },
  pendingLabel: {
    fontFamily: 'DMSans-Bold',
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.status.warning,
  },
  footerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  dateText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
  },
});

export default React.memo(ProjectCard);
