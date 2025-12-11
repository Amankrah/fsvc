/**
 * Offline Storage Service
 * Manages offline queue for sync operations using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyncQueueItem {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'create' | 'update' | 'delete';
  data: any;
  priority: number;
  created_at: string;
  attempts: number;
  max_attempts: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error_message?: string;
}

const STORAGE_KEYS = {
  SYNC_QUEUE: '@fsda/sync_queue',
  OFFLINE_DATA: '@fsda/offline_data',
  LAST_SYNC: '@fsda/last_sync',
};

class OfflineStorage {
  /**
   * Add item to sync queue
   */
  async addToQueue(item: Omit<SyncQueueItem, 'id' | 'created_at' | 'attempts' | 'status'>): Promise<SyncQueueItem> {
    try {
      const queue = await this.getQueue();
      const newItem: SyncQueueItem = {
        ...item,
        id: this.generateId(),
        created_at: new Date().toISOString(),
        attempts: 0,
        status: 'pending',
      };

      queue.push(newItem);
      await this.saveQueue(queue);

      console.log(`Added item to sync queue: ${newItem.table_name}:${newItem.record_id}`);
      return newItem;
    } catch (error) {
      console.error('Error adding item to queue:', error);
      throw error;
    }
  }

  /**
   * Get all pending items from queue
   */
  async getQueue(): Promise<SyncQueueItem[]> {
    try {
      const queueJson = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      if (!queueJson) return [];

      const queue: SyncQueueItem[] = JSON.parse(queueJson);
      return queue.sort((a, b) => {
        // Sort by priority (desc) then by created_at (asc)
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    } catch (error) {
      console.error('Error getting queue:', error);
      return [];
    }
  }

  /**
   * Get pending items only
   */
  async getPendingItems(): Promise<SyncQueueItem[]> {
    const queue = await this.getQueue();
    return queue.filter((item) => item.status === 'pending');
  }

  /**
   * Get failed items
   */
  async getFailedItems(): Promise<SyncQueueItem[]> {
    const queue = await this.getQueue();
    return queue.filter((item) => item.status === 'failed');
  }

  /**
   * Update item in queue
   */
  async updateQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    try {
      const queue = await this.getQueue();
      const index = queue.findIndex((item) => item.id === id);

      if (index === -1) {
        throw new Error(`Queue item not found: ${id}`);
      }

      queue[index] = { ...queue[index], ...updates };
      await this.saveQueue(queue);
    } catch (error) {
      console.error('Error updating queue item:', error);
      throw error;
    }
  }

  /**
   * Mark item as syncing
   */
  async markAsSyncing(id: string): Promise<void> {
    await this.updateQueueItem(id, { status: 'syncing' });
  }

  /**
   * Mark item as completed and remove from queue
   */
  async markAsCompleted(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter((item) => item.id !== id);
      await this.saveQueue(filtered);
      console.log(`Removed completed item from queue: ${id}`);
    } catch (error) {
      console.error('Error marking item as completed:', error);
      throw error;
    }
  }

  /**
   * Mark item as failed
   */
  async markAsFailed(id: string, error_message: string): Promise<void> {
    const queue = await this.getQueue();
    const item = queue.find((i) => i.id === id);

    if (!item) return;

    await this.updateQueueItem(id, {
      status: 'failed',
      error_message,
      attempts: item.attempts + 1,
    });
  }

  /**
   * Retry failed item
   */
  async retryItem(id: string): Promise<void> {
    await this.updateQueueItem(id, {
      status: 'pending',
      error_message: undefined,
    });
  }

  /**
   * Remove item from queue
   */
  async removeFromQueue(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter((item) => item.id !== id);
      await this.saveQueue(filtered);
    } catch (error) {
      console.error('Error removing item from queue:', error);
      throw error;
    }
  }

  /**
   * Clear completed items from queue
   */
  async clearCompleted(): Promise<number> {
    try {
      const queue = await this.getQueue();
      const pending = queue.filter((item) => item.status !== 'completed');
      const clearedCount = queue.length - pending.length;
      await this.saveQueue(pending);
      return clearedCount;
    } catch (error) {
      console.error('Error clearing completed items:', error);
      throw error;
    }
  }

  /**
   * Clear all queue items
   */
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    syncing: number;
    failed: number;
    completed: number;
  }> {
    const queue = await this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter((i) => i.status === 'pending').length,
      syncing: queue.filter((i) => i.status === 'syncing').length,
      failed: queue.filter((i) => i.status === 'failed').length,
      completed: queue.filter((i) => i.status === 'completed').length,
    };
  }

  /**
   * Save offline data (for caching API responses)
   */
  async saveOfflineData(key: string, data: any): Promise<void> {
    try {
      const offlineData = await this.getOfflineData();
      offlineData[key] = {
        data,
        timestamp: new Date().toISOString(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_DATA, JSON.stringify(offlineData));
    } catch (error) {
      console.error('Error saving offline data:', error);
      throw error;
    }
  }

  /**
   * Get offline data
   */
  async getOfflineData(key?: string): Promise<any> {
    try {
      const offlineDataJson = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_DATA);
      if (!offlineDataJson) return key ? null : {};

      const offlineData = JSON.parse(offlineDataJson);
      return key ? offlineData[key]?.data : offlineData;
    } catch (error) {
      console.error('Error getting offline data:', error);
      return key ? null : {};
    }
  }

  /**
   * Clear offline data
   */
  async clearOfflineData(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_DATA);
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSync(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  }

  /**
   * Get last sync timestamp
   */
  async getLastSync(): Promise<string | null> {
    return await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }

  /**
   * Migrate and fix malformed queue items
   * Removes items with invalid structure (where table_name or record_id are objects)
   */
  async migrateQueue(): Promise<{ removed: number; kept: number }> {
    try {
      const queue = await this.getQueue();
      const validQueue: SyncQueueItem[] = [];
      let removedCount = 0;

      for (const item of queue) {
        // Check if item has valid structure
        const isValid =
          typeof item.table_name === 'string' &&
          typeof item.record_id === 'string' &&
          typeof item.operation === 'string' &&
          item.data !== undefined;

        if (isValid) {
          validQueue.push(item);
        } else {
          console.warn(`Removing malformed queue item:`, {
            id: item.id,
            table_name: typeof item.table_name,
            record_id: typeof item.record_id,
          });
          removedCount++;
        }
      }

      await this.saveQueue(validQueue);
      console.log(`Queue migration: removed ${removedCount}, kept ${validQueue.length}`);

      return { removed: removedCount, kept: validQueue.length };
    } catch (error) {
      console.error('Error migrating queue:', error);
      throw error;
    }
  }

  /**
   * Private: Save queue to storage
   */
  private async saveQueue(queue: SyncQueueItem[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  }

  /**
   * Private: Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const offlineStorage = new OfflineStorage();
export default offlineStorage;
