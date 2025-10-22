/**
 * Sync API Service
 * Handles communication with Django sync backend
 */

import { API_BASE_URL } from '../config/env';
import { secureStorage } from '../utils/secureStorage';
import { SyncQueueItem } from './offlineStorage';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

class SyncApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/sync`;
  }

  private async getAuthHeaders() {
    const token = await secureStorage.getItem('userToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    };
  }

  /**
   * Send sync queue item to backend
   */
  async syncItem(item: SyncQueueItem): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/queue/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          table_name: item.table_name,
          record_id: item.record_id,
          operation: item.operation,
          data: item.data,
          priority: item.priority,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error syncing item:', error);
      return {
        success: false,
        error: error.message || 'Failed to sync item',
      };
    }
  }

  /**
   * Process pending items on backend
   */
  async processPending(): Promise<ApiResponse<{
    total_processed: number;
    failed_count: number;
    errors?: string[];
  }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/queue/process_pending/`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error processing pending items:', error);
      return {
        success: false,
        error: error.message || 'Failed to process pending items',
      };
    }
  }

  /**
   * Get sync statistics from backend
   */
  async getStats(): Promise<ApiResponse<{
    total: number;
    pending: number;
    syncing: number;
    completed: number;
    failed: number;
    recent_activity: any[];
  }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/queue/stats/`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Error getting sync stats:', error);
      return {
        success: false,
        error: error.message || 'Failed to get sync statistics',
      };
    }
  }

  /**
   * Retry a failed sync item
   */
  async retryItem(itemId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/queue/${itemId}/retry/`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error retrying item:', error);
      return {
        success: false,
        error: error.message || 'Failed to retry item',
      };
    }
  }

  /**
   * Retry all failed items
   */
  async retryAllFailed(): Promise<ApiResponse<{ retry_count: number }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/queue/retry_failed/`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error retrying failed items:', error);
      return {
        success: false,
        error: error.message || 'Failed to retry failed items',
      };
    }
  }

  /**
   * Clear completed sync items
   */
  async clearCompleted(): Promise<ApiResponse<{ cleared_count: number }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/queue/clear_completed/`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error clearing completed items:', error);
      return {
        success: false,
        error: error.message || 'Failed to clear completed items',
      };
    }
  }

  /**
   * Get sync queue from backend
   */
  async getQueue(status?: 'pending' | 'failed' | 'completed'): Promise<ApiResponse<SyncQueueItem[]>> {
    try {
      const headers = await this.getAuthHeaders();
      const url = status ? `${this.baseUrl}/queue/?status=${status}` : `${this.baseUrl}/queue/`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.results || data,
      };
    } catch (error: any) {
      console.error('Error getting queue:', error);
      return {
        success: false,
        error: error.message || 'Failed to get sync queue',
      };
    }
  }
}

export const syncApi = new SyncApi();
export default syncApi;
