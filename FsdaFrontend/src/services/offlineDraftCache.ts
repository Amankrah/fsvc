/**
 * Offline Draft Cache Service
 *
 * Manages local caching of draft responses for offline access.
 * When a user saves a draft, it is cached locally so they can
 * view and resume drafts even without internet connectivity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
    DRAFTS: '@fsda/drafts',
    LAST_DRAFT_UPDATE: '@fsda/last_draft_update',
};

export interface CachedDraft {
    id: string;
    respondent_id: string;
    draft_name: string;
    project: string;
    respondent_type: string | null;
    commodity: string | null;
    country: string | null;
    responses: Array<{
        question_id: string;
        response_value: string;
    }>;
    completion_status: string;
    created_at: string;
    last_response_at: string;
    is_offline?: boolean; // true if saved while offline and not yet synced
}

class OfflineDraftCacheService {
    /**
     * Cache a draft locally
     */
    async cacheDraft(draft: CachedDraft): Promise<void> {
        try {
            const drafts = await this.getAllDrafts();
            // Update existing or add new
            const index = drafts.findIndex(d => d.id === draft.id);
            if (index !== -1) {
                drafts[index] = draft;
            } else {
                drafts.push(draft);
            }
            await AsyncStorage.setItem(CACHE_KEYS.DRAFTS, JSON.stringify(drafts));
            await this.updateLastCacheTime();
            console.log(`✓ Cached draft "${draft.draft_name || draft.respondent_id}" locally`);
        } catch (error) {
            console.error('Failed to cache draft:', error);
            throw error;
        }
    }

    /**
     * Get cached drafts for a specific project and user
     * Since drafts are per-user on the backend, we store all and filter by project
     */
    async getCachedDrafts(projectId: string): Promise<CachedDraft[]> {
        try {
            const drafts = await this.getAllDrafts();
            return drafts.filter(d => d.project === projectId);
        } catch (error) {
            console.error('Failed to get cached drafts:', error);
            return [];
        }
    }

    /**
     * Get all cached drafts across all projects
     */
    async getAllDrafts(): Promise<CachedDraft[]> {
        try {
            const data = await AsyncStorage.getItem(CACHE_KEYS.DRAFTS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to get all cached drafts:', error);
            return [];
        }
    }

    /**
     * Remove a single draft from cache
     */
    async removeDraft(draftId: string): Promise<void> {
        try {
            const drafts = await this.getAllDrafts();
            const filtered = drafts.filter(d => d.id !== draftId);
            await AsyncStorage.setItem(CACHE_KEYS.DRAFTS, JSON.stringify(filtered));
            console.log(`✓ Removed draft ${draftId} from cache`);
        } catch (error) {
            console.error('Failed to remove cached draft:', error);
            throw error;
        }
    }

    /**
     * Sync cached drafts with server data
     * Replaces local cache for a project with server data
     */
    async syncDraftsFromServer(projectId: string, serverDrafts: CachedDraft[]): Promise<void> {
        try {
            const allDrafts = await this.getAllDrafts();
            // Remove old drafts for this project that aren't offline-only
            const otherDrafts = allDrafts.filter(
                d => d.project !== projectId || d.is_offline
            );
            // Add server drafts
            const merged = [...otherDrafts, ...serverDrafts];
            await AsyncStorage.setItem(CACHE_KEYS.DRAFTS, JSON.stringify(merged));
            await this.updateLastCacheTime();
            console.log(`✓ Synced ${serverDrafts.length} server drafts to local cache`);
        } catch (error) {
            console.error('Failed to sync drafts from server:', error);
            throw error;
        }
    }

    /**
     * Clear all cached drafts
     */
    async clearCache(): Promise<void> {
        try {
            await AsyncStorage.multiRemove([
                CACHE_KEYS.DRAFTS,
                CACHE_KEYS.LAST_DRAFT_UPDATE,
            ]);
            console.log('✓ Cleared all draft cache');
        } catch (error) {
            console.error('Failed to clear draft cache:', error);
            throw error;
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats(): Promise<{
        totalDrafts: number;
        offlineDrafts: number;
        lastUpdate: string | null;
    }> {
        try {
            const drafts = await this.getAllDrafts();
            const lastUpdate = await AsyncStorage.getItem(CACHE_KEYS.LAST_DRAFT_UPDATE);
            const offlineDrafts = drafts.filter(d => d.is_offline).length;

            return {
                totalDrafts: drafts.length,
                offlineDrafts,
                lastUpdate,
            };
        } catch (error) {
            console.error('Failed to get draft cache stats:', error);
            return {
                totalDrafts: 0,
                offlineDrafts: 0,
                lastUpdate: null,
            };
        }
    }

    /**
     * Check if cache has data and is reasonably recent
     */
    async isCacheValid(): Promise<boolean> {
        try {
            const lastUpdate = await AsyncStorage.getItem(CACHE_KEYS.LAST_DRAFT_UPDATE);
            if (!lastUpdate) return false;

            const lastUpdateTime = new Date(lastUpdate).getTime();
            const now = new Date().getTime();
            const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);

            // Cache is valid if less than 24 hours old
            return hoursSinceUpdate < 24;
        } catch (error) {
            console.error('Failed to check draft cache validity:', error);
            return false;
        }
    }

    private async updateLastCacheTime(): Promise<void> {
        await AsyncStorage.setItem(CACHE_KEYS.LAST_DRAFT_UPDATE, new Date().toISOString());
    }
}

// Export singleton instance
export const offlineDraftCache = new OfflineDraftCacheService();
