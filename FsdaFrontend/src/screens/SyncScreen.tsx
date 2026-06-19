import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  ActivityIndicator,
  Switch,
  Divider,
  Portal,
  Dialog,
  ProgressBar,
  Menu,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { syncManager } from '../services/syncManager';
import { networkMonitor } from '../services/networkMonitor';
import { offlineStorage, SyncQueueItem } from '../services/offlineStorage';
import { syncApi } from '../services/syncApi';
import apiService from '../services/api';
import { colors, spacing, borderRadius, typography } from '../constants/theme';
import { TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Project {
  id: string;
  name: string;
}

const SyncScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProjectName, setSelectedProjectName] = useState<string>('All Projects');
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [localStats, setLocalStats] = useState<any>(null);
  const [backendStats, setBackendStats] = useState<any>(null);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      const projectsData = await apiService.getProjects();
      const projectsList = Array.isArray(projectsData) ? projectsData : projectsData.results || [];
      setProjects(projectsList);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }, []);

  // Filter queue items by project
  const filterQueueByProject = useCallback((queue: SyncQueueItem[]) => {
    if (!selectedProjectId) {
      return queue; // Show all if "All Projects" selected
    }

    return queue.filter((item) => {
      // Check if the item's data contains projectId
      if (item.data && typeof item.data === 'object') {
        return item.data.projectId === selectedProjectId;
      }
      return false;
    });
  }, [selectedProjectId]);

  // Calculate stats for filtered queue
  const calculateLocalStats = useCallback((queue: SyncQueueItem[]) => {
    return {
      pending: queue.filter(item => item.status === 'pending').length,
      syncing: queue.filter(item => item.status === 'syncing').length,
      completed: queue.filter(item => item.status === 'completed').length,
      failed: queue.filter(item => item.status === 'failed').length,
    };
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Get all queue items
      const allQueue = await offlineStorage.getQueue();

      // Filter by selected project
      const filteredQueue = filterQueueByProject(allQueue);
      setQueueItems(filteredQueue);

      // Calculate stats from filtered queue
      const filteredStats = calculateLocalStats(filteredQueue);
      setLocalStats(filteredStats);

      // Get sync manager stats for other info
      const statsData = await syncManager.getStats();
      setLastSync(statsData.lastSync);
      setIsOnline(statsData.isOnline);
      setAutoSync(statsData.autoSyncEnabled);
      setSyncing(statsData.isSyncing);

      // Get backend stats if online
      if (statsData.isOnline) {
        try {
          const backendStatsResult = await syncApi.getStats();
          if (backendStatsResult.success) {
            // Note: Backend doesn't support project filtering yet
            // Showing all backend stats for now
            setBackendStats(backendStatsResult.data);
          }
        } catch (error) {
          console.warn('Could not fetch backend stats:', error);
        }
      }
    } catch (error) {
      console.error('Error loading sync data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId, filterQueueByProject, calculateLocalStats]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Reload data when project selection changes
  useEffect(() => {
    loadData();
  }, [selectedProjectId]);

  // Setup listeners
  useEffect(() => {
    // Listen for network changes
    const unsubscribe = networkMonitor.addListener((connected) => {
      setIsOnline(connected);
    });

    // Listen for sync events
    const syncUnsubscribe = syncManager.addEventListener((event, data) => {
      if (event === 'sync_started') {
        setSyncing(true);
      } else if (event === 'sync_completed') {
        setSyncing(false);
        loadData();
      }
    });

    return () => {
      unsubscribe();
      syncUnsubscribe();
    };
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await syncManager.forceSyncNow();
      console.log('Sync result:', result);
      await loadData();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryFailed = async () => {
    await syncManager.retryFailedItems();
    await loadData();
  };

  const handleRetryItem = async (itemId: string) => {
    await offlineStorage.retryItem(itemId);
    await loadData();
    // Trigger sync to process the retried item
    syncManager.syncPendingItems();
  };

  const handleDeleteItem = async (itemId: string) => {
    await offlineStorage.removeFromQueue(itemId);
    await loadData();
  };

  const handleClearCompleted = async () => {
    await syncManager.clearCompleted();
    setShowClearDialog(false);
    await loadData();
  };

  const handleToggleAutoSync = (value: boolean) => {
    setAutoSync(value);
    syncManager.setAutoSync(value);
  };

  const handleProjectSelect = (projectId: string | null, projectName: string) => {
    setSelectedProjectId(projectId);
    setSelectedProjectName(projectName);
    setShowProjectMenu(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return colors.status.warning;
      case 'syncing':
        return colors.visualization.blue;
      case 'completed':
        return colors.status.success;
      case 'failed':
        return colors.status.error;
      default:
        return colors.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return 'clock-outline';
      case 'syncing':
        return 'sync';
      case 'completed':
        return 'check-circle';
      case 'failed':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <ScreenWrapper style={styles.container} edges={{ top: false }}>
        <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.heroTitle}>Sync & Backup</Text>
          <Text style={styles.heroSubtitle}>Manage data synchronization</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading sync status...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.container} edges={{ top: false }}>
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <View style={[styles.hero, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.heroNav}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon source="chevron-left" size={24} color="#fff" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          {/* Online badge */}
          <View style={[styles.onlineBadge, { backgroundColor: isOnline ? colors.status.successSurface : colors.status.errorSurface }]}>
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? colors.status.success : colors.status.error }]} />
            <Text style={[styles.onlineBadgeText, { color: isOnline ? colors.status.success : colors.status.error }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>Sync & Backup</Text>
        {lastSync ? (
          <Text style={styles.heroSubtitle}>Last sync: {formatDate(lastSync)}</Text>
        ) : (
          <Text style={styles.heroSubtitle}>Manage data synchronization</Text>
        )}
      </View>

      {/* Project Selector */}
      <View style={styles.projectSelectorRow}>
        <Text style={styles.projectLabel}>Project:</Text>
        <Menu
          visible={showProjectMenu}
          onDismiss={() => setShowProjectMenu(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setShowProjectMenu(true)}
              style={styles.projectButton}
              contentStyle={styles.projectButtonContent}
              icon="chevron-down"
            >
              {selectedProjectName}
            </Button>
          }
          contentStyle={styles.menuContent}
        >
          <Menu.Item
            onPress={() => handleProjectSelect(null, 'All Projects')}
            title="All Projects"
            titleStyle={[styles.menuItemText, !selectedProjectId && styles.selectedMenuItemText]}
            leadingIcon={!selectedProjectId ? 'check' : undefined}
          />
          <Divider />
          {projects.map((project) => (
            <Menu.Item
              key={project.id}
              onPress={() => handleProjectSelect(project.id, project.name)}
              title={project.name}
              titleStyle={[styles.menuItemText, selectedProjectId === project.id && styles.selectedMenuItemText]}
              leadingIcon={selectedProjectId === project.id ? 'check' : undefined}
            />
          ))}
        </Menu>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Connection Status */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.statusRow}>
              <View style={styles.statusIndicator}>
                <View style={[styles.dot, { backgroundColor: isOnline ? colors.status.success : colors.status.error }]} />
                <Text variant="titleMedium">{isOnline ? 'Online' : 'Offline'}</Text>
              </View>
              {lastSync && (
                <Text variant="bodySmall" style={styles.lastSyncText}>
                  Last sync: {formatDate(lastSync)}
                </Text>
              )}
            </View>

            {!isOnline && (
              <View style={styles.offlineNotice}>
                <Text variant="bodyMedium" style={styles.offlineText}>
                  You're currently offline. Changes will sync automatically when connection is restored.
                </Text>
              </View>
            )}

            {isOnline && autoSync && (
              <View style={[styles.offlineNotice, { backgroundColor: colors.status.successSurface }]}>
                <Text style={{ fontFamily: 'DMSans-Regular', color: colors.status.success, fontSize: typography.fontSize.sm }}>
                  ✓ Auto-sync enabled. Offline data syncs and processes automatically when online.
                </Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Local Queue Statistics */}
        {localStats && (
          <Card style={styles.card}>
            <Card.Title
              title={`Local Queue (Device)${selectedProjectId ? ` - ${selectedProjectName}` : ''}`}
              titleVariant="titleMedium"
            />
            <Card.Content>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: colors.status.warning }}>
                    {localStats.pending}
                  </Text>
                  <Text variant="bodySmall">Pending</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: colors.visualization.blue }}>
                    {localStats.syncing}
                  </Text>
                  <Text variant="bodySmall">Syncing</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: colors.status.error }}>
                    {localStats.failed}
                  </Text>
                  <Text variant="bodySmall">Failed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: colors.status.success }}>
                    {localStats.completed}
                  </Text>
                  <Text variant="bodySmall">Local Done</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Backend Queue Statistics */}
        {isOnline && backendStats && (
          <Card style={styles.card}>
            <Card.Title title="Backend Queue (Server)" titleVariant="titleMedium" />
            <Card.Content>
              {selectedProjectId && (
                <Text variant="bodySmall" style={{ marginBottom: 12, color: colors.status.warning, fontStyle: 'italic' }}>
                  Note: Backend stats show all projects (project filtering not yet supported on server)
                </Text>
              )}
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: colors.status.warning }}>
                    {backendStats.pending || 0}
                  </Text>
                  <Text variant="bodySmall">Pending</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: colors.visualization.blue }}>
                    {backendStats.syncing || 0}
                  </Text>
                  <Text variant="bodySmall">Processing</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: colors.status.error }}>
                    {backendStats.failed || 0}
                  </Text>
                  <Text variant="bodySmall">Failed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: colors.status.success }}>
                    {backendStats.completed || 0}
                  </Text>
                  <Text variant="bodySmall">Completed</Text>
                </View>
              </View>
              <Text variant="bodySmall" style={{ marginTop: 12, color: colors.text.secondary, textAlign: 'center' }}>
                Total: {backendStats.total || 0} items processed on server
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Controls */}
        <Card style={styles.card}>
          <Card.Title title="Sync Controls" titleVariant="titleMedium" />
          <Card.Content>
            {/* Auto-sync toggle */}
            <View style={styles.controlRow}>
              <View>
                <Text variant="bodyLarge">Auto-Sync</Text>
                <Text variant="bodySmall" style={styles.controlDescription}>
                  Automatically sync when online
                </Text>
              </View>
              <Switch value={autoSync} onValueChange={handleToggleAutoSync} />
            </View>

            <Divider style={styles.divider} />

            {/* Sync now button */}
            <Button
              mode="contained"
              icon="sync"
              onPress={handleSyncNow}
              disabled={syncing || !isOnline || localStats?.pending === 0}
              loading={syncing}
              style={styles.actionButton}
            >
              {syncing ? 'Syncing...' : `Sync Now (${localStats?.pending || 0} items)`}
            </Button>

            {/* Retry failed button */}
            {localStats?.failed > 0 && (
              <Button
                mode="outlined"
                icon="refresh"
                onPress={handleRetryFailed}
                disabled={syncing}
                style={styles.actionButton}
              >
                Retry Failed ({localStats.failed})
              </Button>
            )}

            {/* Clear completed button */}
            {localStats?.completed > 0 && (
              <Button
                mode="text"
                icon="delete-outline"
                onPress={() => setShowClearDialog(true)}
                disabled={syncing}
                style={styles.actionButton}
              >
                Clear Completed ({localStats.completed})
              </Button>
            )}
          </Card.Content>
        </Card>

        {/* Sync Progress */}
        {syncing && (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.syncingText}>
                Syncing data...
              </Text>
              <ProgressBar indeterminate color={colors.visualization.blue} style={styles.progressBar} />
            </Card.Content>
          </Card>
        )}

        {/* Queue Items */}
        {queueItems.length > 0 && (
          <Card style={styles.card}>
            <Card.Title title={`Queue (${queueItems.length} items)`} titleVariant="titleMedium" />
            <Card.Content>
              {queueItems.slice(0, 10).map((item) => (
                <View key={item.id} style={styles.queueItem}>
                  <View style={styles.queueItemHeader}>
                    <Chip
                      icon={getStatusIcon(item.status)}
                      style={[styles.statusChip, { backgroundColor: getStatusColor(item.status) + '20' }]}
                      textStyle={{ color: getStatusColor(item.status), fontSize: 12 }}
                    >
                      {item.status}
                    </Chip>
                    <Text variant="bodySmall" style={styles.queueItemTime}>
                      {formatDate(item.created_at)}
                    </Text>
                  </View>

                  <Text variant="bodyMedium" style={styles.queueItemText}>
                    {item.operation.toUpperCase()} - {item.table_name}
                  </Text>
                  <Text variant="bodySmall" style={styles.queueItemId}>
                    ID: {item.record_id}
                  </Text>

                  {item.error_message && (
                    <Text variant="bodySmall" style={styles.errorText}>
                      Error: {item.error_message}
                    </Text>
                  )}

                  {item.attempts > 0 && (
                    <Text variant="bodySmall" style={styles.attemptsText}>
                      Attempts: {item.attempts}/{item.max_attempts}
                    </Text>
                  )}

                  {item.status === 'failed' && item.next_retry_at && (
                    <Text variant="bodySmall" style={styles.retryTimeText}>
                      Auto-retry: {formatDate(item.next_retry_at)}
                    </Text>
                  )}

                  {item.status === 'failed' && (
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={styles.itemRetryBtn}
                        onPress={() => handleRetryItem(item.id)}
                      >
                        <Icon source="refresh" size={14} color={colors.primary.main} />
                        <Text style={styles.itemRetryText}>Retry Now</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.itemDeleteBtn}
                        onPress={() => handleDeleteItem(item.id)}
                      >
                        <Icon source="delete-outline" size={14} color={colors.status.error} />
                        <Text style={styles.itemDeleteText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}

              {queueItems.length > 10 && (
                <Text variant="bodySmall" style={styles.moreItems}>
                  +{queueItems.length - 10} more items...
                </Text>
              )}
            </Card.Content>
          </Card>
        )}

        {/* Empty state */}
        {queueItems.length === 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.emptyState}>
                <Text variant="headlineSmall" style={styles.emptyIcon}>
                  ✓
                </Text>
                <Text variant="titleMedium" style={styles.emptyTitle}>
                  All synced up!
                </Text>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  No pending items in the sync queue
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Clear Dialog */}
      <Portal>
        <Dialog visible={showClearDialog} onDismiss={() => setShowClearDialog(false)}>
          <Dialog.Title>Clear Completed Items?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will remove {localStats?.completed || 0} completed items from the local queue. This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClearDialog(false)}>Cancel</Button>
            <Button onPress={handleClearCompleted}>Clear</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontFamily: 'DMSans-Regular',
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },

  // ── Hero
  hero: {
    backgroundColor: colors.primary.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  heroNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.md,
    color: '#fff',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  onlineBadgeText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
  },
  heroTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.xxl,
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.65)',
  },

  // ── Project selector
  projectSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  projectLabel: {
    fontFamily: 'DMSans-Medium',
    color: colors.text.secondary,
    fontSize: typography.fontSize.sm,
  },
  projectButton: {
    minWidth: 180,
    borderColor: colors.border.medium,
    borderRadius: borderRadius.md,
  },
  projectButtonContent: {
    flexDirection: 'row-reverse',
  },
  menuContent: {
    backgroundColor: colors.background.paper,
    maxHeight: 400,
    borderRadius: borderRadius.lg,
  },
  menuItemText: {
    fontFamily: 'DMSans-Regular',
    fontSize: typography.fontSize.sm,
  },
  selectedMenuItemText: {
    fontFamily: 'DMSans-Bold',
    color: colors.primary.main,
  },

  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  card: {
    marginBottom: spacing.md,
    backgroundColor: colors.background.paper,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border.light,
    elevation: 0,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  lastSyncText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
  },
  offlineNotice: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.status.warningSurface,
    borderRadius: borderRadius.md,
  },
  offlineText: {
    fontFamily: 'DMSans-Regular',
    color: colors.accent.darkOrange,
    fontSize: typography.fontSize.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  controlDescription: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    marginTop: 2,
    fontSize: typography.fontSize.xs,
  },
  divider: {
    marginVertical: spacing.md,
    backgroundColor: colors.border.light,
  },
  actionButton: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.lg,
  },
  syncingText: {
    fontFamily: 'DMSans-Medium',
    marginBottom: spacing.sm,
    textAlign: 'center',
    color: colors.text.primary,
    fontSize: typography.fontSize.md,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  queueItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  queueItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statusChip: {
    height: 24,
  },
  queueItemTime: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
  },
  queueItemText: {
    fontFamily: 'DMSans-Medium',
    marginBottom: 2,
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
  },
  queueItemId: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    fontSize: typography.fontSize.xs,
  },
  errorText: {
    fontFamily: 'DMSans-Regular',
    color: colors.status.error,
    marginTop: 2,
    fontSize: typography.fontSize.xs,
  },
  attemptsText: {
    fontFamily: 'DMSans-Regular',
    color: colors.status.warning,
    marginTop: 2,
    fontSize: typography.fontSize.xs,
  },
  retryTimeText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    marginTop: 2,
    fontSize: typography.fontSize.xs,
    fontStyle: 'italic',
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  itemRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.main + '12',
  },
  itemRetryText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.primary.main,
  },
  itemDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.error + '12',
  },
  itemDeleteText: {
    fontFamily: 'DMSans-Medium',
    fontSize: typography.fontSize.xs,
    color: colors.status.error,
  },
  moreItems: {
    fontFamily: 'DMSans-Regular',
    textAlign: 'center',
    color: colors.text.secondary,
    marginTop: spacing.sm,
    fontSize: typography.fontSize.xs,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontFamily: 'Fraunces-Bold',
    fontSize: 56,
    color: colors.status.success,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: 'Fraunces-Bold',
    fontSize: typography.fontSize.lg,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    letterSpacing: -0.2,
  },
  emptyText: {
    fontFamily: 'DMSans-Regular',
    color: colors.text.secondary,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
  },
});

export default React.memo(SyncScreen);
