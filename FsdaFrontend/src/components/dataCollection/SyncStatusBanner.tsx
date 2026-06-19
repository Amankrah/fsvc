/**
 * SyncStatusBanner
 * Compact, always-visible indicator of sync queue status.
 * Shows pending/failed counts, last sync time, and quick actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Icon, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { syncManager } from '../../services/syncManager';
import { offlineStorage } from '../../services/offlineStorage';
import { networkMonitor } from '../../services/networkMonitor';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';

interface SyncStats {
  pending: number;
  failed: number;
  syncing: number;
}

export const SyncStatusBanner: React.FC = () => {
  const navigation = useNavigation();
  const [stats, setStats] = useState<SyncStats>({ pending: 0, failed: 0, syncing: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [forcingSyncNow, setForcingSyncNow] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const queueStats = await offlineStorage.getStats();
      setStats({
        pending: queueStats.pending,
        failed: queueStats.failed,
        syncing: queueStats.syncing,
      });
      const last = await offlineStorage.getLastSync();
      setLastSync(last);
      setIsOnline(networkMonitor.getConnectionStatus());
    } catch (e) {
      console.warn('SyncStatusBanner: failed to load stats', e);
    }
  }, []);

  useEffect(() => {
    loadStats();

    const networkUnsub = networkMonitor.addListener((connected) => {
      setIsOnline(connected);
      loadStats();
    });

    const syncUnsub = syncManager.addEventListener((event) => {
      if (event === 'sync_started') setIsSyncing(true);
      if (event === 'sync_completed' || event === 'sync_failed') {
        setIsSyncing(false);
        loadStats();
      }
      if (event === 'item_synced' || event === 'item_failed') {
        loadStats();
      }
    });

    // Refresh stats every 30s while mounted
    const interval = setInterval(loadStats, 30_000);

    return () => {
      networkUnsub();
      syncUnsub();
      clearInterval(interval);
    };
  }, [loadStats]);

  const handleForceSyncNow = async () => {
    setForcingSyncNow(true);
    try {
      await syncManager.forceSyncNow();
    } finally {
      setForcingSyncNow(false);
      loadStats();
    }
  };

  const handleRetryFailed = async () => {
    await syncManager.retryFailedItems();
    loadStats();
  };

  const totalActionable = stats.pending + stats.failed + stats.syncing;

  // Nothing to show — all synced
  if (totalActionable === 0 && !isSyncing) return null;

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // Determine banner variant
  const hasFailed = stats.failed > 0;
  const isBusy = isSyncing || stats.syncing > 0;

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        hasFailed && styles.bannerFailed,
        isBusy && !hasFailed && styles.bannerSyncing,
      ]}
      onPress={() => (navigation as any).navigate('Sync')}
      activeOpacity={0.8}
    >
      {/* Left: icon + summary */}
      <View style={styles.leftSection}>
        {isBusy ? (
          <ActivityIndicator size={16} color={hasFailed ? colors.status.error : colors.status.info} />
        ) : hasFailed ? (
          <Icon source="alert-circle" size={16} color={colors.status.error} />
        ) : (
          <Icon source="cloud-sync" size={16} color={colors.status.warning} />
        )}

        <View style={styles.textBlock}>
          <Text style={[styles.summaryText, hasFailed && styles.summaryTextFailed]}>
            {isBusy
              ? 'Syncing...'
              : hasFailed
                ? `${stats.failed} failed`
                : `${stats.pending} pending`}
            {stats.pending > 0 && hasFailed ? ` · ${stats.pending} pending` : ''}
          </Text>
          <Text style={styles.lastSyncText}>
            Last sync: {formatLastSync(lastSync)}
          </Text>
        </View>
      </View>

      {/* Right: quick actions */}
      <View style={styles.rightSection}>
        {hasFailed && !isBusy && (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={(e) => { e.stopPropagation(); handleRetryFailed(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon source="refresh" size={14} color={colors.status.error} />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}

        {stats.pending > 0 && isOnline && !isBusy && (
          <TouchableOpacity
            style={styles.syncNowBtn}
            onPress={(e) => { e.stopPropagation(); handleForceSyncNow(); }}
            disabled={forcingSyncNow}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {forcingSyncNow ? (
              <ActivityIndicator size={12} color={colors.primary.main} />
            ) : (
              <>
                <Icon source="sync" size={14} color={colors.primary.main} />
                <Text style={styles.syncNowText}>Sync</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <Icon source="chevron-right" size={16} color={colors.text.tertiary} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.status.warningSurface,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.25)',
  },
  bannerFailed: {
    backgroundColor: colors.status.errorSurface,
    borderColor: 'rgba(220, 38, 38, 0.25)',
  },
  bannerSyncing: {
    backgroundColor: colors.status.infoSurface,
    borderColor: 'rgba(37, 99, 235, 0.25)',
  },

  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  textBlock: {
    flex: 1,
  },
  summaryText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.sm,
    color: colors.status.warning,
  },
  summaryTextFailed: {
    color: colors.status.error,
  },
  lastSyncText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 1,
  },

  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.status.error,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.primary.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  syncNowText: {
    fontFamily: 'DMSans-Bold',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
  },
});
