/**
 * Auto-Save Service for In-Progress Surveys
 *
 * Persists survey responses to AsyncStorage automatically so that
 * if the app is killed, backgrounded, or crashes, the enumerator
 * can resume exactly where they left off.
 *
 * Storage key pattern: @fsda/autosave/{projectId}/{respondentId}
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTOSAVE_PREFIX = '@fsda/autosave';

export interface AutoSaveData {
    projectId: string;
    respondentId: string;
    respondentType: string;
    commodities: string[];
    country: string;
    responses: { [questionId: string]: string | string[] };
    currentQuestionIndex: number;
    totalQuestions: number;
    timestamp: string;
    /** Database ID if resuming from an existing draft */
    existingRespondentDatabaseId?: string | null;
    /** Question IDs that already have responses in the backend DB */
    preExistingResponseQuestionIds?: string[];
}

class AutoSaveService {
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly DEBOUNCE_MS = 2000;
    private readonly QUESTION_INTERVAL = 5;
    private lastSavedQuestionCount = 0;

    /**
     * Build the storage key for a specific survey session
     */
    private getKey(projectId: string, respondentId: string): string {
        return `${AUTOSAVE_PREFIX}/${projectId}/${respondentId}`;
    }

    /**
     * Save the current survey state to AsyncStorage immediately
     */
    async save(data: AutoSaveData): Promise<void> {
        try {
            const key = this.getKey(data.projectId, data.respondentId);
            await AsyncStorage.setItem(key, JSON.stringify(data));
            console.log(
                `[AutoSave] Saved progress: Q${data.currentQuestionIndex + 1}/${data.totalQuestions}, ` +
                `${Object.keys(data.responses).length} responses`
            );
        } catch (error) {
            console.error('[AutoSave] Failed to save:', error);
            // Don't throw — auto-save failures should never block the user
        }
    }

    /**
     * Schedule a debounced save — resets the timer if called again within DEBOUNCE_MS
     */
    debouncedSave(data: AutoSaveData): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this.save(data);
            this.saveTimer = null;
        }, this.DEBOUNCE_MS);
    }

    /**
     * Check if we should save based on question count interval (every N questions)
     */
    shouldSaveOnQuestionCount(answeredCount: number): boolean {
        if (answeredCount > 0 && answeredCount % this.QUESTION_INTERVAL === 0 && answeredCount !== this.lastSavedQuestionCount) {
            this.lastSavedQuestionCount = answeredCount;
            return true;
        }
        return false;
    }

    /**
     * Cancel any pending debounced save
     */
    cancelPending(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
    }

    /**
     * Flush: cancel debounce and save immediately (used for AppState → background)
     */
    async flush(data: AutoSaveData): Promise<void> {
        this.cancelPending();
        await this.save(data);
    }

    /**
     * Check if there's an auto-save for a given project
     * Returns all auto-saves for the project (could be multiple respondents)
     */
    async getAutoSaves(projectId: string): Promise<AutoSaveData[]> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const prefix = `${AUTOSAVE_PREFIX}/${projectId}/`;
            const matchingKeys = allKeys.filter(k => k.startsWith(prefix));

            if (matchingKeys.length === 0) return [];

            const items = await AsyncStorage.multiGet(matchingKeys);
            const results: AutoSaveData[] = [];

            for (const [, value] of items) {
                if (value) {
                    try {
                        results.push(JSON.parse(value));
                    } catch (e) {
                        // Skip corrupted entries
                    }
                }
            }

            // Sort by timestamp, most recent first
            results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return results;
        } catch (error) {
            console.error('[AutoSave] Failed to get auto-saves:', error);
            return [];
        }
    }

    /**
     * Get the most recent auto-save for a project (if any)
     */
    async getMostRecent(projectId: string): Promise<AutoSaveData | null> {
        const saves = await this.getAutoSaves(projectId);
        return saves.length > 0 ? saves[0] : null;
    }

    /**
     * Clear auto-save for a specific survey session (after successful submit)
     */
    async clear(projectId: string, respondentId: string): Promise<void> {
        try {
            const key = this.getKey(projectId, respondentId);
            await AsyncStorage.removeItem(key);
            this.lastSavedQuestionCount = 0;
            console.log(`[AutoSave] Cleared auto-save for ${respondentId}`);
        } catch (error) {
            console.error('[AutoSave] Failed to clear:', error);
        }
    }

    /**
     * Clear ALL auto-saves for a project
     */
    async clearAll(projectId: string): Promise<void> {
        try {
            const allKeys = await AsyncStorage.getAllKeys();
            const prefix = `${AUTOSAVE_PREFIX}/${projectId}/`;
            const matchingKeys = allKeys.filter(k => k.startsWith(prefix));
            if (matchingKeys.length > 0) {
                await AsyncStorage.multiRemove(matchingKeys);
            }
            this.lastSavedQuestionCount = 0;
            console.log(`[AutoSave] Cleared all auto-saves for project ${projectId}`);
        } catch (error) {
            console.error('[AutoSave] Failed to clear all:', error);
        }
    }
}

// Export singleton
export const autoSaveService = new AutoSaveService();
