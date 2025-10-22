import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import {
  Text,
  Card,
  Button,
  List,
  Chip,
  ActivityIndicator,
  Switch,
  Divider,
  IconButton,
  Portal,
  Dialog,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { syncManager } from '../services/syncManager';
import { networkMonitor } from '../services/networkMonitor';
import { offlineStorage, SyncQueueItem } from '../services/offlineStorage';

const SyncScreen: React.FC = () => {
  const navigation = useNavigation();

  // State
  const [stats, setStats] = useState<any>(null);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Get stats
      const statsData = await syncManager.getStats();
      setStats(statsData.local);
      setLastSync(statsData.lastSync);
      setIsOnline(statsData.isOnline);
      setAutoSync(statsData.autoSyncEnabled);
      setSyncing(statsData.isSyncing);

      // Get queue items
      const queue = await offlineStorage.getQueue();
      setQueueItems(queue);
    } catch (error) {
      console.error('Error loading sync data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

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

  const handleClearCompleted = async () => {
    await syncManager.clearCompleted();
    setShowClearDialog(false);
    await loadData();
  };

  const handleToggleAutoSync = (value: boolean) => {
    setAutoSync(value);
    syncManager.setAutoSync(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#ff9800';
      case 'syncing':
        return '#2196f3';
      case 'completed':
        return '#4caf50';
      case 'failed':
        return '#f44336';
      default:
        return '#757575';
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
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text variant="bodyLarge" style={styles.loadingText}>
          Loading sync status...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text variant="headlineMedium" style={styles.title}>
            Sync & Offline
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Manage data synchronization
          </Text>
        </View>
        <IconButton icon="close" onPress={() => navigation.goBack()} />
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
                <View style={[styles.dot, { backgroundColor: isOnline ? '#4caf50' : '#f44336' }]} />
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
          </Card.Content>
        </Card>

        {/* Statistics */}
        {stats && (
          <Card style={styles.card}>
            <Card.Title title="Sync Queue Status" titleVariant="titleMedium" />
            <Card.Content>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: '#ff9800' }}>
                    {stats.pending}
                  </Text>
                  <Text variant="bodySmall">Pending</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: '#2196f3' }}>
                    {stats.syncing}
                  </Text>
                  <Text variant="bodySmall">Syncing</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: '#f44336' }}>
                    {stats.failed}
                  </Text>
                  <Text variant="bodySmall">Failed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text variant="headlineSmall" style={{ color: '#4caf50' }}>
                    {stats.completed}
                  </Text>
                  <Text variant="bodySmall">Completed</Text>
                </View>
              </View>
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
              disabled={syncing || !isOnline || stats?.pending === 0}
              loading={syncing}
              style={styles.actionButton}
            >
              {syncing ? 'Syncing...' : `Sync Now (${stats?.pending || 0} items)`}
            </Button>

            {/* Retry failed button */}
            {stats?.failed > 0 && (
              <Button
                mode="outlined"
                icon="refresh"
                onPress={handleRetryFailed}
                disabled={syncing}
                style={styles.actionButton}
              >
                Retry Failed ({stats.failed})
              </Button>
            )}

            {/* Clear completed button */}
            {stats?.completed > 0 && (
              <Button
                mode="text"
                icon="delete-outline"
                onPress={() => setShowClearDialog(true)}
                disabled={syncing}
                style={styles.actionButton}
              >
                Clear Completed ({stats.completed})
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
              <ProgressBar indeterminate color="#2196f3" style={styles.progressBar} />
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
              This will remove {stats?.completed || 0} completed items from the queue. This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowClearDialog(false)}>Cancel</Button>
            <Button onPress={handleClearCompleted}>Clear</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  lastSyncText: {
    color: '#666',
  },
  offlineNotice: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff3e0',
    borderRadius: 4,
  },
  offlineText: {
    color: '#e65100',
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
    marginBottom: 12,
  },
  controlDescription: {
    color: '#666',
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  actionButton: {
    marginTop: 8,
  },
  syncingText: {
    marginBottom: 12,
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
  },
  queueItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  queueItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusChip: {
    height: 24,
  },
  queueItemTime: {
    color: '#666',
  },
  queueItemText: {
    marginBottom: 4,
  },
  queueItemId: {
    color: '#666',
  },
  errorText: {
    color: '#f44336',
    marginTop: 4,
  },
  attemptsText: {
    color: '#ff9800',
    marginTop: 4,
  },
  moreItems: {
    textAlign: 'center',
    color: '#666',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    color: '#4caf50',
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
});

export default React.memo(SyncScreen);
