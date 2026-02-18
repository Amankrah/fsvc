/**
 * Sync Manager
 * Orchestrates offline/online synchronization with automatic retry and conflict resolution
 */

import { networkMonitor } from './networkMonitor';
import { offlineStorage, SyncQueueItem } from './offlineStorage';
import { syncApi } from './syncApi';

type SyncEventType = 'sync_started' | 'sync_completed' | 'sync_failed' | 'item_synced' | 'item_failed' | 'auth_error';
type SyncEventCallback = (event: SyncEventType, data?: any) => void;

class SyncManager {
  private isSyncing: boolean = false;
  private autoSyncEnabled: boolean = true;
  private syncInterval: NodeJS.Timeout | null = null;
  private eventListeners: Set<SyncEventCallback> = new Set();
  private networkUnsubscribe: (() => void) | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize sync manager with network monitoring
   */
  private async initialize() {
    // Migrate any malformed queue items from previous versions
    try {
      const migrationResult = await offlineStorage.migrateQueue();
      if (migrationResult.removed > 0) {
        console.log(`Cleaned up ${migrationResult.removed} malformed queue items`);
      }
    } catch (error) {
      console.error('Error during queue migration:', error);
    }

    // Listen for network changes
    this.networkUnsubscribe = networkMonitor.addListener((isConnected) => {
      console.log(`Sync Manager: Network ${isConnected ? 'ONLINE' : 'OFFLINE'}`);

      if (isConnected && this.autoSyncEnabled) {
        // Auto-sync when coming back online
        this.syncPendingItems();
      }
    });

    // Start periodic sync check (every 5 minutes)
    this.startPeriodicSync(5 * 60 * 1000);
  }

  /**
   * Queue an operation for synchronization
   */
  async queueOperation(
    table_name: string,
    record_id: string,
    operation: 'create' | 'update' | 'delete',
    data: any,
    priority: number = 5
  ): Promise<void> {
    try {
      // Add to offline queue
      await offlineStorage.addToQueue({
        table_name,
        record_id,
        operation,
        data,
        priority,
        max_attempts: 3,
      });

      console.log(`Queued ${operation} operation for ${table_name}:${record_id}`);

      // If online, try to sync immediately
      if (networkMonitor.getConnectionStatus()) {
        this.syncPendingItems();
      }
    } catch (error) {
      console.error('Error queuing operation:', error);
      throw error;
    }
  }

  /**
   * Sync all pending items
   */
  async syncPendingItems(): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    errors: string[];
  }> {
    // Check if already syncing
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress'] };
    }

    // Check network connectivity
    const isConnected = await networkMonitor.checkConnection();
    if (!isConnected) {
      console.log('No network connection, sync postponed');
      return { success: false, synced: 0, failed: 0, errors: ['No network connection'] };
    }

    this.isSyncing = true;
    this.emitEvent('sync_started');

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      const pendingItems = await offlineStorage.getPendingItems();
      console.log(`Starting sync of ${pendingItems.length} pending items...`);

      for (const item of pendingItems) {
        try {
          // Check if max attempts reached
          if (item.attempts >= item.max_attempts) {
            console.log(`Item ${item.id} exceeded max attempts, skipping`);
            await offlineStorage.markAsFailed(item.id, 'Max attempts reached');
            failed++;
            continue;
          }

          // Mark as syncing
          await offlineStorage.markAsSyncing(item.id);

          // Send to backend
          const result = await syncApi.syncItem(item);

          if (result.success) {
            // Mark as completed and remove from queue
            await offlineStorage.markAsCompleted(item.id);
            synced++;
            this.emitEvent('item_synced', item);
            console.log(`✓ Synced: ${item.table_name}:${item.record_id}`);
          } else {
            // Mark as failed
            const errorMsg = result.error || 'Unknown error';
            await offlineStorage.markAsFailed(item.id, errorMsg);
            failed++;
            errors.push(`${item.table_name}:${item.record_id} - ${errorMsg}`);
            this.emitEvent('item_failed', { item, error: errorMsg });
            console.error(`✗ Failed: ${item.table_name}:${item.record_id} - ${errorMsg}`);

            // If authentication error, emit special event to notify user
            if (errorMsg.includes('Authentication') || errorMsg.includes('Session expired') || errorMsg.includes('Not logged in')) {
              this.emitEvent('auth_error', { message: errorMsg });
            }
          }
        } catch (error: any) {
          const errorMsg = error.message || 'Unknown error';
          try {
            await offlineStorage.markAsFailed(item.id, errorMsg);
          } catch (storageError) {
            console.error('[SyncManager] Failed to mark item as failed in storage:', storageError);
          }
          failed++;
          errors.push(`${item.table_name}:${item.record_id} - ${errorMsg}`);
          this.emitEvent('item_failed', { item, error: errorMsg });
          console.error(`✗ Error syncing item:`, error);
        }
      }

      // Update last sync timestamp
      if (synced > 0) {
        await offlineStorage.updateLastSync();

        // Trigger backend processing of the synced items
        try {
          console.log(`[SyncManager] Successfully synced ${synced} items to backend queue`);
          console.log('[SyncManager] Now triggering backend processing...');
          const processResult = await syncApi.processPending();
          console.log('[SyncManager] processPending returned:', processResult);

          if (processResult.success) {
            const processed = processResult.data?.total_processed || processResult.total_processed || 0;
            console.log(`✓ Backend processed ${processed} items`);
          } else {
            console.warn('[SyncManager] Backend processing had issues:', processResult.error);
          }
        } catch (error) {
          console.error('[SyncManager] Error triggering backend processing:', error);
          // Don't fail the sync if backend processing fails
        }
      } else {
        console.log('[SyncManager] No items were synced, skipping backend processing');
      }
    } catch (outerError: any) {
      console.error('[SyncManager] Critical sync error:', outerError);
      errors.push(`Sync infrastructure error: ${outerError.message}`);
    } finally {
      this.isSyncing = false;
      this.emitEvent('sync_completed', { synced, failed, errors });
      console.log(`Sync completed: ${synced} synced, ${failed} failed`);
    }

    // Fix 4: Re-check for items queued during sync
    try {
      const remainingCount = await this.getPendingCount();
      if (remainingCount > 0 && networkMonitor.getConnectionStatus()) {
        console.log(`[SyncManager] ${remainingCount} items pending after sync, triggering follow-up in 500ms`);
        setTimeout(() => this.syncPendingItems(), 500);
      }
    } catch (recheckError) {
      console.error('[SyncManager] Error during post-sync recheck:', recheckError);
    }

    return { success: failed === 0 && synced > 0, synced, failed, errors };
  }

  /**
   * Retry all failed items
   */
  async retryFailedItems(): Promise<void> {
    const failedItems = await offlineStorage.getFailedItems();
    console.log(`Retrying ${failedItems.length} failed items...`);

    for (const item of failedItems) {
      await offlineStorage.retryItem(item.id);
    }

    // Trigger sync
    await this.syncPendingItems();
  }

  /**
   * Get sync statistics
   */
  async getStats() {
    const localStats = await offlineStorage.getStats();
    const lastSync = await offlineStorage.getLastSync();
    const isConnected = networkMonitor.getConnectionStatus();

    return {
      local: localStats,
      lastSync,
      isOnline: isConnected,
      isSyncing: this.isSyncing,
      autoSyncEnabled: this.autoSyncEnabled,
    };
  }

  /**
   * Enable/disable auto-sync
   */
  setAutoSync(enabled: boolean): void {
    this.autoSyncEnabled = enabled;
    console.log(`Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Start periodic sync
   */
  private startPeriodicSync(intervalMs: number): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      if (this.autoSyncEnabled && networkMonitor.getConnectionStatus()) {
        this.syncPendingItems();
      }
    }, intervalMs);
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Add event listener
   */
  addEventListener(callback: SyncEventCallback): () => void {
    this.eventListeners.add(callback);
    return () => {
      this.eventListeners.delete(callback);
    };
  }

  /**
   * Emit sync event
   */
  private emitEvent(event: SyncEventType, data?: any): void {
    this.eventListeners.forEach((callback) => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }

  /**
   * Clear completed items
   */
  async clearCompleted(): Promise<number> {
    return await offlineStorage.clearCompleted();
  }

  /**
   * Force sync now (manual trigger)
   */
  async forceSyncNow(): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    errors: string[];
  }> {
    console.log('Force sync triggered...');
    return await this.syncPendingItems();
  }

  /**
   * Get pending items count
   */
  async getPendingCount(): Promise<number> {
    const stats = await offlineStorage.getStats();
    return stats.pending;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopPeriodicSync();
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
    this.eventListeners.clear();
  }
}

export const syncManager = new SyncManager();
export default syncManager;
