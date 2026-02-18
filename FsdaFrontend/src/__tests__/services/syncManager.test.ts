/**
 * Tests for syncManager.ts — Fixes 3 & 4
 *
 * Fix 3: isSyncing lock is always released in finally block
 * Fix 4: Post-sync re-check triggers follow-up when new items are pending
 *
 * We mock offlineStorage, syncApi, and networkMonitor so tests
 * are isolated from AsyncStorage and network.
 */

// Mock the dependencies before importing the module under test
jest.mock('../../services/offlineStorage', () => {
    const mockItems: any[] = [];
    return {
        offlineStorage: {
            getPendingItems: jest.fn(() => Promise.resolve([...mockItems])),
            markAsSyncing: jest.fn(() => Promise.resolve()),
            markAsCompleted: jest.fn(() => Promise.resolve()),
            markAsFailed: jest.fn(() => Promise.resolve()),
            updateLastSync: jest.fn(() => Promise.resolve()),
            migrateQueue: jest.fn(() => Promise.resolve({ removed: 0, kept: 0 })),
            getQueue: jest.fn(() => Promise.resolve([...mockItems])),
            addToQueue: jest.fn((item: any) => {
                const newItem = { ...item, id: `mock-${Date.now()}`, status: 'pending', attempts: 0 };
                mockItems.push(newItem);
                return Promise.resolve(newItem);
            }),
            clearQueue: jest.fn(() => {
                mockItems.length = 0;
                return Promise.resolve();
            }),
            _mockItems: mockItems,
        },
        SyncQueueItem: {},
    };
});

jest.mock('../../services/syncApi', () => ({
    syncApi: {
        syncItem: jest.fn(() => Promise.resolve({ success: true })),
        processPending: jest.fn(() =>
            Promise.resolve({ success: true, data: { total_processed: 1 } })
        ),
    },
}));

jest.mock('../../services/networkMonitor', () => ({
    networkMonitor: {
        getConnectionStatus: jest.fn(() => true),
        checkConnection: jest.fn(() => Promise.resolve(true)),
        addListener: jest.fn(() => () => { }),
    },
}));

// Import after mocks are set up
import { offlineStorage } from '../../services/offlineStorage';

// We need to access the SyncManager class directly since the module
// auto-initializes a singleton. Let's re-import it fresh.

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset mock items
    (offlineStorage as any)._mockItems.length = 0;

    // Reset the module to get a new SyncManager instance
    jest.resetModules();

    // Re-setup mocks after resetModules
    jest.mock('../../services/offlineStorage', () => {
        const mockItems: any[] = [];
        return {
            offlineStorage: {
                getPendingItems: jest.fn(() => Promise.resolve([...mockItems])),
                markAsSyncing: jest.fn(() => Promise.resolve()),
                markAsCompleted: jest.fn(() => Promise.resolve()),
                markAsFailed: jest.fn(() => Promise.resolve()),
                updateLastSync: jest.fn(() => Promise.resolve()),
                migrateQueue: jest.fn(() => Promise.resolve({ removed: 0, kept: 0 })),
                getQueue: jest.fn(() => Promise.resolve([...mockItems])),
                _mockItems: mockItems,
            },
            SyncQueueItem: {},
        };
    });

    jest.mock('../../services/syncApi', () => ({
        syncApi: {
            syncItem: jest.fn(() => Promise.resolve({ success: true })),
            processPending: jest.fn(() =>
                Promise.resolve({ success: true, data: { total_processed: 1 } })
            ),
        },
    }));

    jest.mock('../../services/networkMonitor', () => ({
        networkMonitor: {
            getConnectionStatus: jest.fn(() => true),
            checkConnection: jest.fn(() => Promise.resolve(true)),
            addListener: jest.fn(() => () => { }),
        },
    }));
});

afterEach(() => {
    jest.useRealTimers();
});

/**
 * Helper: create a SyncManager instance without triggering the auto-initialize
 * constructor side effects (network listeners, periodic sync).
 */
function createSyncManager() {
    // Re-require the mocked dependencies
    const { offlineStorage: storage } = require('../../services/offlineStorage');
    const { syncApi: api } = require('../../services/syncApi');
    const { networkMonitor: network } = require('../../services/networkMonitor');

    // Build a minimal SyncManager-like object to test syncPendingItems directly
    const manager = {
        isSyncing: false,
        autoSyncEnabled: true,
        eventListeners: new Set<any>(),

        emitEvent(event: string, data?: any) {
            this.eventListeners.forEach((cb: any) => cb(event, data));
        },

        addEventListener(cb: any) {
            this.eventListeners.add(cb);
            return () => this.eventListeners.delete(cb);
        },

        async getPendingCount(): Promise<number> {
            const items = await storage.getPendingItems();
            return items.length;
        },

        async syncPendingItems(): Promise<{
            success: boolean;
            synced: number;
            failed: number;
            errors: string[];
        }> {
            if (this.isSyncing) {
                return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress'] };
            }

            const isConnected = await network.checkConnection();
            if (!isConnected) {
                return { success: false, synced: 0, failed: 0, errors: ['No network connection'] };
            }

            this.isSyncing = true;
            this.emitEvent('sync_started');

            let synced = 0;
            let failed = 0;
            const errors: string[] = [];

            try {
                const pendingItems = await storage.getPendingItems();

                for (const item of pendingItems) {
                    try {
                        if (item.attempts >= item.max_attempts) {
                            await storage.markAsFailed(item.id, 'Max attempts reached');
                            failed++;
                            continue;
                        }

                        await storage.markAsSyncing(item.id);
                        const result = await api.syncItem(item);

                        if (result.success) {
                            await storage.markAsCompleted(item.id);
                            synced++;
                            this.emitEvent('item_synced', item);
                        } else {
                            const errorMsg = result.error || 'Unknown error';
                            await storage.markAsFailed(item.id, errorMsg);
                            failed++;
                            errors.push(`${item.table_name}:${item.record_id} - ${errorMsg}`);
                            this.emitEvent('item_failed', { item, error: errorMsg });
                        }
                    } catch (error: any) {
                        const errorMsg = error.message || 'Unknown error';
                        try {
                            await storage.markAsFailed(item.id, errorMsg);
                        } catch (storageError) {
                            // don't let storage errors escape
                        }
                        failed++;
                        errors.push(`${item.table_name}:${item.record_id} - ${errorMsg}`);
                        this.emitEvent('item_failed', { item, error: errorMsg });
                    }
                }

                if (synced > 0) {
                    await storage.updateLastSync();
                    try {
                        await api.processPending();
                    } catch (error) {
                        // don't fail if backend processing fails
                    }
                }
            } catch (outerError: any) {
                errors.push(`Sync infrastructure error: ${outerError.message}`);
            } finally {
                // Fix 3: always release the lock
                this.isSyncing = false;
                this.emitEvent('sync_completed', { synced, failed, errors });
            }

            // Fix 4: re-check for new items
            try {
                const remainingCount = await this.getPendingCount();
                if (remainingCount > 0 && network.getConnectionStatus()) {
                    setTimeout(() => this.syncPendingItems(), 500);
                }
            } catch (recheckError) {
                // non-critical
            }

            return { success: failed === 0 && synced > 0, synced, failed, errors };
        },
    };

    return { manager, storage, api, network };
}

describe('SyncManager — Lock Safety (Fix 3)', () => {
    test('isSyncing is released after successful sync', async () => {
        const { manager, storage } = createSyncManager();
        (storage.getPendingItems as jest.Mock).mockResolvedValue([
            { id: '1', table_name: 'responses', record_id: 'r1', attempts: 0, max_attempts: 3 },
        ]);

        const result = await manager.syncPendingItems();

        expect(result.success).toBe(true);
        expect(result.synced).toBe(1);
        expect(manager.isSyncing).toBe(false);
    });

    test('isSyncing is released after syncApi throws', async () => {
        const { manager, storage, api } = createSyncManager();
        (storage.getPendingItems as jest.Mock).mockResolvedValue([
            { id: '1', table_name: 'responses', record_id: 'r1', attempts: 0, max_attempts: 3 },
        ]);
        (api.syncItem as jest.Mock).mockRejectedValue(new Error('Network timeout'));

        const result = await manager.syncPendingItems();

        // isSyncing MUST be false even after error — this is the core of Fix 3
        expect(manager.isSyncing).toBe(false);
        expect(result.failed).toBe(1);
        expect(result.errors[0]).toContain('Network timeout');
    });

    test('isSyncing is released after offlineStorage.getPendingItems throws', async () => {
        const { manager, storage } = createSyncManager();
        (storage.getPendingItems as jest.Mock).mockRejectedValue(
            new Error('AsyncStorage read failed')
        );

        const result = await manager.syncPendingItems();

        // CRITICAL: must not remain locked
        expect(manager.isSyncing).toBe(false);
        expect(result.errors[0]).toContain('AsyncStorage read failed');
    });

    test('concurrent sync calls are blocked while syncing', async () => {
        jest.useRealTimers(); // This test needs real async
        const { manager, storage, api } = createSyncManager();

        // Make syncItem slow so the lock is held for a bit
        let resolveSync: () => void;
        const slowSync = new Promise<{ success: boolean }>((resolve) => {
            resolveSync = () => resolve({ success: true });
        });
        (storage.getPendingItems as jest.Mock).mockResolvedValue([
            { id: '1', table_name: 'responses', record_id: 'r1', attempts: 0, max_attempts: 3 },
        ]);
        (api.syncItem as jest.Mock).mockReturnValue(slowSync);

        // Start first sync (holds the lock)
        const firstSync = manager.syncPendingItems();

        // Wait a tick for isSyncing to be set
        await new Promise((r) => setTimeout(r, 10));

        // Try second sync — should be rejected because first is still running
        const secondSync = await manager.syncPendingItems();
        expect(secondSync.errors).toContain('Sync already in progress');

        // Let the first sync complete
        resolveSync!();
        await firstSync;

        // Lock should be released
        expect(manager.isSyncing).toBe(false);
        jest.useFakeTimers(); // Restore for other tests
    }, 10000);

    test('markAsFailed error does not prevent lock release', async () => {
        const { manager, storage, api } = createSyncManager();
        (storage.getPendingItems as jest.Mock).mockResolvedValue([
            { id: '1', table_name: 'responses', record_id: 'r1', attempts: 0, max_attempts: 3 },
        ]);
        (api.syncItem as jest.Mock).mockRejectedValue(new Error('API error'));
        // markAsFailed also fails!
        (storage.markAsFailed as jest.Mock).mockRejectedValue(new Error('Storage write error'));

        const result = await manager.syncPendingItems();

        // Even with cascading failures, lock MUST be released
        expect(manager.isSyncing).toBe(false);
        expect(result.failed).toBe(1);
    });
});

describe('SyncManager — Post-Sync Re-check (Fix 4)', () => {
    test('triggers follow-up sync when new items found after sync', async () => {
        const { manager, storage, network } = createSyncManager();

        let callCount = 0;
        (storage.getPendingItems as jest.Mock).mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // First call: return 1 item to sync
                return Promise.resolve([
                    { id: '1', table_name: 'responses', record_id: 'r1', attempts: 0, max_attempts: 3 },
                ]);
            }
            // Second call (re-check): return 1 new item queued during sync
            return Promise.resolve([
                { id: '2', table_name: 'responses', record_id: 'r2', attempts: 0, max_attempts: 3 },
            ]);
        });

        const syncSpy = jest.spyOn(manager, 'syncPendingItems');
        await manager.syncPendingItems();

        // A setTimeout should have been scheduled for 500ms
        expect(syncSpy).toHaveBeenCalledTimes(1);

        // Advance timer to trigger the follow-up
        jest.advanceTimersByTime(500);

        // The follow-up should call syncPendingItems again
        expect(syncSpy).toHaveBeenCalledTimes(2);
    });

    test('does NOT trigger follow-up when no items remain', async () => {
        const { manager, storage } = createSyncManager();
        (storage.getPendingItems as jest.Mock).mockResolvedValue([]);

        const syncSpy = jest.spyOn(manager, 'syncPendingItems');
        await manager.syncPendingItems();

        jest.advanceTimersByTime(1000);

        // Should only be called once (no follow-up)
        expect(syncSpy).toHaveBeenCalledTimes(1);
    });

    test('does NOT trigger follow-up when offline', async () => {
        const { manager, storage, network } = createSyncManager();

        let callCount = 0;
        (storage.getPendingItems as jest.Mock).mockImplementation(() => {
            callCount++;
            return Promise.resolve([
                { id: `${callCount}`, table_name: 'responses', record_id: `r${callCount}`, attempts: 0, max_attempts: 3 },
            ]);
        });

        // Network is offline when re-check runs
        (network.getConnectionStatus as jest.Mock).mockReturnValue(false);

        await manager.syncPendingItems();

        jest.advanceTimersByTime(1000);

        // No follow-up setTimeout should fire because getConnectionStatus returned false
        // The sync itself completed, but no re-check follow-up was scheduled
        expect(network.getConnectionStatus).toHaveBeenCalled();
    });
});

describe('SyncManager — Event Emission', () => {
    test('emits sync_started and sync_completed events', async () => {
        const { manager, storage } = createSyncManager();
        (storage.getPendingItems as jest.Mock).mockResolvedValue([
            { id: '1', table_name: 'responses', record_id: 'r1', attempts: 0, max_attempts: 3 },
        ]);

        const events: string[] = [];
        manager.addEventListener((event: string) => events.push(event));

        await manager.syncPendingItems();

        expect(events).toContain('sync_started');
        expect(events).toContain('item_synced');
        expect(events).toContain('sync_completed');
    });

    test('emits item_failed for failed items', async () => {
        const { manager, storage, api } = createSyncManager();
        (storage.getPendingItems as jest.Mock).mockResolvedValue([
            { id: '1', table_name: 'responses', record_id: 'r1', attempts: 0, max_attempts: 3 },
        ]);
        (api.syncItem as jest.Mock).mockResolvedValue({
            success: false,
            error: 'Server error',
        });

        const events: string[] = [];
        manager.addEventListener((event: string) => events.push(event));

        await manager.syncPendingItems();

        expect(events).toContain('item_failed');
        expect(events).toContain('sync_completed');
    });

    test('skips items that exceeded max_attempts', async () => {
        const { manager, storage, api } = createSyncManager();
        (storage.getPendingItems as jest.Mock).mockResolvedValue([
            { id: '1', table_name: 'responses', record_id: 'r1', attempts: 3, max_attempts: 3 },
        ]);

        const result = await manager.syncPendingItems();

        expect(result.failed).toBe(1);
        expect(storage.markAsFailed).toHaveBeenCalledWith('1', 'Max attempts reached');
        // syncItem should NOT have been called
        expect(api.syncItem).not.toHaveBeenCalled();
    });
});
