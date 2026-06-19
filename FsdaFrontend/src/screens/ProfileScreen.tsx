import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Divider, Icon, ActivityIndicator, Switch, Portal, Dialog } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { offlineStorage } from '../services/offlineStorage';
import { offlineDraftCache } from '../services/offlineDraftCache';
import { offlineQuestionCache } from '../services/offlineQuestionCache';
import { networkMonitor } from '../services/networkMonitor';

// Simple deterministic color from a string (for avatar)
const getAvatarColor = (str: string): string => {
  const palette = [
    colors.primary.main,
    colors.status.info,
    colors.visualization?.teal ?? '#0D9488',
    colors.visualization?.indigo ?? '#4F46E5',
    colors.accent.main,
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, clearAuth } = useAuthStore();

  // Sign-out check state
  const [signOutChecking, setSignOutChecking] = useState(false);
  const [signOutDialogVisible, setSignOutDialogVisible] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [offlineDraftCount, setOfflineDraftCount] = useState(0);

  // Force-offline toggle state
  const [isForceOffline, setIsForceOffline] = useState(networkMonitor.forceOffline);

  // Cache stats state
  const [cacheStats, setCacheStats] = useState<{
    questionBanks: { [key: string]: number };
    generatedQuestions: { [key: string]: number };
  } | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  const loadCacheStats = useCallback(async () => {
    const stats = await offlineQuestionCache.getCacheStats();
    setCacheStats({
      questionBanks: stats.questionBanks,
      generatedQuestions: stats.generatedQuestions,
    });
  }, []);

  useEffect(() => {
    loadCacheStats();
  }, [loadCacheStats]);

  const handleToggleOffline = (value: boolean) => {
    setIsForceOffline(value);
    networkMonitor.setForceOffline(value);
  };

  const handleClearQuestionCache = () => {
    const totalQB = cacheStats
      ? Object.values(cacheStats.questionBanks).reduce((a, b) => a + b, 0)
      : 0;
    const totalGQ = cacheStats
      ? Object.values(cacheStats.generatedQuestions).reduce((a, b) => a + b, 0)
      : 0;

    Alert.alert(
      'Clear Question Cache',
      `This will remove all cached questions from this device:\n\n` +
      `  Question Banks: ${totalQB} items\n` +
      `  Generated Questions: ${totalGQ} items\n\n` +
      `Draft responses and collected data will NOT be affected.\n\n` +
      `You will need to re-download questions when online.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearingCache(true);
              await offlineQuestionCache.clearCache();
              await loadCacheStats();
              Alert.alert('Done', 'Question cache cleared successfully.');
            } catch (err) {
              console.error('Failed to clear cache:', err);
              Alert.alert('Error', 'Failed to clear question cache.');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const displayName = user?.first_name && user?.last_name
    ? `${user.first_name} ${user.last_name}`
    : user?.username ?? 'User';

  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const avatarColor = getAvatarColor(displayName);

  // ── Sign-out logic ────────────────────────────────────────────────────────

  const handleSignOutPress = async () => {
    setSignOutChecking(true);
    try {
      const [syncStats, draftStats] = await Promise.all([
        offlineStorage.getStats(),
        offlineDraftCache.getCacheStats(),
      ]);

      setPendingCount(syncStats.pending);
      setFailedCount(syncStats.failed);
      setOfflineDraftCount(draftStats.offlineDrafts);

      const hasIssues =
        syncStats.pending > 0 ||
        syncStats.failed > 0 ||
        draftStats.offlineDrafts > 0;

      if (hasIssues) {
        setSignOutDialogVisible(true);
      } else {
        // Nothing at risk — simple confirmation
        Alert.alert(
          'Sign Out',
          'Are you sure you want to sign out?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: () => clearAuth() },
          ]
        );
      }
    } catch (_err) {
      // If the checks themselves fail, still let the user sign out
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: () => clearAuth() },
        ]
      );
    } finally {
      setSignOutChecking(false);
    }
  };

  const handleForceSignOut = () => {
    setSignOutDialogVisible(false);
    clearAuth();
  };

  // ── Sub-components ────────────────────────────────────────────────────────

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );

  const RowItem: React.FC<{
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
    chevron?: boolean;
    loading?: boolean;
  }> = ({ icon, label, value, onPress, danger, chevron = true, loading = false }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress || loading}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        {loading ? (
          <ActivityIndicator size={16} color={colors.status.error} />
        ) : (
          <Icon source={icon} size={18} color={danger ? colors.status.error : colors.primary.main} />
        )}
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress && chevron && !loading && (
        <Icon source="chevron-right" size={18} color={colors.text.tertiary} />
      )}
    </TouchableOpacity>
  );

  // ── Warning row inside dialog ─────────────────────────────────────────────

  const WarningRow: React.FC<{
    icon: string;
    iconColor: string;
    iconBg: string;
    label: string;
  }> = ({ icon, iconColor, iconBg, label }) => (
    <View style={styles.warnRow}>
      <View style={[styles.warnIcon, { backgroundColor: iconBg }]}>
        <Icon source={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.warnRowText}>{label}</Text>
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
      >
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.heroName}>{displayName}</Text>
          {user?.email ? (
            <Text style={styles.heroEmail}>{user.email}</Text>
          ) : null}
          {user?.institution ? (
            <View style={styles.institutionPill}>
              <Icon source="domain" size={12} color="rgba(255,255,255,0.6)" />
              <Text style={styles.institutionText}>{user.institution}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Account ───────────────────────────────────────────────────── */}
        <Section title="Account">
          <RowItem
            icon="account-outline"
            label="Username"
            value={user?.username ?? '—'}
            chevron={false}
          />
          <Divider style={styles.rowDivider} />
          <RowItem
            icon="email-outline"
            label="Email"
            value={user?.email ?? '—'}
            chevron={false}
          />
        </Section>

        {/* ── App ───────────────────────────────────────────────────────── */}
        <Section title="App">
          <RowItem
            icon="cloud-sync-outline"
            label="Sync & Backup"
            onPress={() => {
              // SyncScreen is accessible from ProjectDetails
            }}
          />
          <Divider style={styles.rowDivider} />
          <RowItem
            icon="information-outline"
            label="App Version"
            value="1.0.0"
            chevron={false}
          />
        </Section>

        {/* ── Storage ───────────────────────────────────────────────────── */}
        <Section title="Storage">
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Icon source="database-outline" size={18} color={colors.primary.main} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Cached Questions</Text>
              <Text style={styles.rowHint}>
                {cacheStats
                  ? `${Object.values(cacheStats.questionBanks).reduce((a, b) => a + b, 0)} bank · ${Object.values(cacheStats.generatedQuestions).reduce((a, b) => a + b, 0)} generated`
                  : 'Loading...'}
              </Text>
            </View>
          </View>
          <Divider style={styles.rowDivider} />
          <RowItem
            icon="delete-outline"
            label={clearingCache ? 'Clearing...' : 'Clear Question Cache'}
            onPress={handleClearQuestionCache}
            danger
            chevron={false}
            loading={clearingCache}
          />
        </Section>

        {/* ── Developer ────────────────────────────────────────────────── */}
        <Section title="Developer">
          <View style={styles.row}>
            <View style={[styles.rowIcon, isForceOffline && styles.rowIconWarn]}>
              <Icon
                source={isForceOffline ? 'wifi-off' : 'wifi'}
                size={18}
                color={isForceOffline ? colors.status.warning : colors.primary.main}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Force Offline Mode</Text>
              <Text style={styles.rowHint}>
                {isForceOffline
                  ? 'App behaves as if there is no network'
                  : 'Uses real network status'}
              </Text>
            </View>
            <Switch
              value={isForceOffline}
              onValueChange={handleToggleOffline}
              color={colors.status.warning}
            />
          </View>
        </Section>

        {/* ── Danger zone ───────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <RowItem
              icon="logout"
              label={signOutChecking ? 'Checking...' : 'Sign Out'}
              onPress={handleSignOutPress}
              danger
              chevron={false}
              loading={signOutChecking}
            />
          </View>
        </View>
      </ScrollView>

      {/* ── Sign-out warning dialog ────────────────────────────────────── */}
      <Portal>
        <Dialog
          visible={signOutDialogVisible}
          onDismiss={() => setSignOutDialogVisible(false)}
          style={styles.dialogPaper}
        >
          {/* Title with amber accent */}
          <View style={styles.dialogTitleRow}>
            <View style={[styles.dialogTitleAccent, { backgroundColor: colors.status.warning }]} />
            <Text style={styles.dialogTitleText}>Unsaved Data Detected</Text>
          </View>

          <Dialog.Content style={styles.dialogBody}>
            <Text style={styles.dialogBodyText}>
              Signing out now may affect the following data on this device:
            </Text>

            {/* Warning items */}
            <View style={styles.warnList}>
              {pendingCount > 0 && (
                <WarningRow
                  icon="cloud-upload-outline"
                  iconColor={colors.status.warning}
                  iconBg={colors.status.warningSurface}
                  label={`${pendingCount} response${pendingCount !== 1 ? 's' : ''} waiting to sync to the server`}
                />
              )}
              {failedCount > 0 && (
                <WarningRow
                  icon="alert-circle-outline"
                  iconColor={colors.status.error}
                  iconBg={colors.status.errorSurface}
                  label={`${failedCount} item${failedCount !== 1 ? 's' : ''} failed to sync and need${failedCount === 1 ? 's' : ''} retrying`}
                />
              )}
              {offlineDraftCount > 0 && (
                <WarningRow
                  icon="file-document-outline"
                  iconColor={colors.status.warning}
                  iconBg={colors.status.warningSurface}
                  label={`${offlineDraftCount} draft${offlineDraftCount !== 1 ? 's' : ''} saved offline and not yet uploaded`}
                />
              )}
            </View>

            <View style={styles.noteRow}>
              <Icon source="information-outline" size={14} color={colors.text.disabled} />
              <Text style={styles.noteText}>
                Your data stays on this device but syncing will pause until you sign back in. Open a project's Sync screen to upload first.
              </Text>
            </View>
          </Dialog.Content>

          {/* Actions */}
          <View style={styles.dialogActionRow}>
            <TouchableOpacity
              style={styles.dialogCancelBtn}
              onPress={() => setSignOutDialogVisible(false)}
            >
              <Text style={styles.dialogCancelText}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dialogDangerBtn}
              onPress={handleForceSignOut}
            >
              <Icon source="logout" size={16} color="#fff" />
              <Text style={styles.dialogDangerText}>Sign Out Anyway</Text>
            </TouchableOpacity>
          </View>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.default,
  },

  // ── Hero
  hero: {
    backgroundColor: colors.primary.dark,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 28,
    color: '#fff',
    lineHeight: 32,
  },
  heroName: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  heroEmail: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  institutionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  institutionText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.65)',
  },

  // ── Sections
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    overflow: 'hidden',
  },

  // ── Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primary.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: {
    backgroundColor: colors.status.errorSurface,
  },
  rowLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.md,
    color: colors.text.primary,
    flex: 1,
  },
  rowLabelDanger: {
    fontFamily: 'DMSans-Medium',
    color: colors.status.error,
  },
  rowValue: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  rowHint: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  rowIconWarn: {
    backgroundColor: colors.status.warningSurface,
  },
  rowDivider: {
    backgroundColor: colors.border.light,
    marginLeft: 56,
  },

  // ══════════════════════════════════════════
  // SIGN-OUT WARNING DIALOG
  // ══════════════════════════════════════════

  dialogPaper: {
    borderRadius: borderRadius.xl,
    backgroundColor: colors.background.paper,
  },
  dialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  dialogTitleAccent: {
    width: 4,
    height: 26,
    borderRadius: 2,
  },
  dialogTitleText: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 20,
    color: colors.text.primary,
    letterSpacing: -0.2,
    flex: 1,
    paddingLeft: spacing.md,
  },
  dialogBody: {
    paddingTop: spacing.xs,
  },
  dialogBodyText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },

  // Warning item list
  warnList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.background.subtle ?? colors.background.default,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
  },
  warnIcon: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  warnRowText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: colors.text.primary,
    flex: 1,
    lineHeight: 20,
  },

  // Info note
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  noteText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.disabled,
    flex: 1,
    lineHeight: 17,
  },

  // Action buttons
  dialogActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: colors.text.secondary,
  },
  dialogDangerBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 13,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.status.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogDangerText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
});

export default React.memo(ProfileScreen);
