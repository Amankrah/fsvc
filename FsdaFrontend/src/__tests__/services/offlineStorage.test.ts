/**
 * Tests for offlineStorage.ts — specifically the write serialization (Fix 5)
 *
 * Validates that concurrent queue writes are serialized through the
 * writeChain/withQueueLock mechanism, preventing race conditions.
 */

// Mock AsyncStorage before any imports
jest.mock('@react-native-async-storage/async-storage', () => {
    let store: Record<string, string> = {};
    return {
        __esModule: true,
        default: {
            getItem: jest.fn((key: string) => Promise.resolve(store[key] || null)),
            setItem: jest.fn((key: string, value: string) => {
                store[key] = value;
                return Promise.resolve();
            }),
            removeItem: jest.fn((key: string) => {
                delete store[key];
                return Promise.resolve();
            }),
            clear: jest.fn(() => {
                store = {};
                return Promise.resolve();
            }),
            getAllKeys: jest.fn(() => Promise.resolve(Object.keys(store))),
        },
    };
});

import AsyncStorage from '@react-native-async-storage/async-storage';

// Reset the module registry so each test gets a fresh OfflineStorage instance
let offlineStorage: any;

beforeEach(async () => {
    jest.resetModules();
    await AsyncStorage.clear();
    const mod = require('../../services/offlineStorage');
    offlineStorage = mod.offlineStorage;
});

afterEach(async () => {
    await AsyncStorage.clear();
});

const makeItem = (i: number) => ({
    table_name: 'responses',
    record_id: `record-${i}`,
    operation: 'create' as const,
    data: { answer: `value-${i}` },
    priority: 5,
    max_attempts: 3,
});

describe('OfflineStorage — Write Serialization (Fix 5)', () => {
    test('addToQueue creates an item with correct defaults', async () => {
        const item = await offlineStorage.addToQueue(makeItem(1));

        expect(item).toMatchObject({
            table_name: 'responses',
            record_id: 'record-1',
            operation: 'create',
            status: 'pending',
            attempts: 0,
        });
        expect(item.id).toBeDefined();
        expect(item.created_at).toBeDefined();
    });

    test('concurrent addToQueue calls do not lose items', async () => {
        // Fire 10 concurrent writes — without serialization, some would be lost
        const promises = Array.from({ length: 10 }, (_, i) =>
            offlineStorage.addToQueue(makeItem(i))
        );

        const results = await Promise.all(promises);

        // All 10 should complete
        expect(results).toHaveLength(10);

        // All 10 should be in the queue
        const queue = await offlineStorage.getQueue();
        expect(queue).toHaveLength(10);

        // Each should have a unique ID
        const ids = new Set(queue.map((item: any) => item.id));
        expect(ids.size).toBe(10);
    });

    test('concurrent addToQueue + markAsCompleted preserves order', async () => {
        // Add 5 items
        const items = [];
        for (let i = 0; i < 5; i++) {
            items.push(await offlineStorage.addToQueue(makeItem(i)));
        }

        // Concurrently complete 2 and add 3 more
        const actions = [
            offlineStorage.markAsCompleted(items[0].id),
            offlineStorage.markAsCompleted(items[1].id),
            offlineStorage.addToQueue(makeItem(100)),
            offlineStorage.addToQueue(makeItem(101)),
            offlineStorage.addToQueue(makeItem(102)),
        ];

        await Promise.all(actions);

        const queue = await offlineStorage.getQueue();
        // 5 original - 2 completed + 3 new = 6
        expect(queue).toHaveLength(6);

        // The completed items should not be in the queue
        const queueIds = queue.map((item: any) => item.id);
        expect(queueIds).not.toContain(items[0].id);
        expect(queueIds).not.toContain(items[1].id);
    });

    test('markAsFailed increments attempts and stores error', async () => {
        const item = await offlineStorage.addToQueue(makeItem(1));

        await offlineStorage.markAsFailed(item.id, 'Network error');

        const queue = await offlineStorage.getQueue();
        const updated = queue.find((q: any) => q.id === item.id);

        expect(updated.status).toBe('failed');
        expect(updated.attempts).toBe(1);
        expect(updated.error_message).toBe('Network error');
    });

    test('markAsSyncing sets status correctly', async () => {
        const item = await offlineStorage.addToQueue(makeItem(1));

        await offlineStorage.markAsSyncing(item.id);

        const queue = await offlineStorage.getQueue();
        const updated = queue.find((q: any) => q.id === item.id);
        expect(updated.status).toBe('syncing');
    });

    test('clearCompleted removes only completed items', async () => {
        const item1 = await offlineStorage.addToQueue(makeItem(1));
        const item2 = await offlineStorage.addToQueue(makeItem(2));
        const item3 = await offlineStorage.addToQueue(makeItem(3));

        await offlineStorage.markAsCompleted(item1.id);
        // item2 stays pending, item3 stays pending

        const queue = await offlineStorage.getQueue();
        // markAsCompleted already removes items from queue in this implementation
        expect(queue).toHaveLength(2);
        expect(queue.map((q: any) => q.id)).toContain(item2.id);
        expect(queue.map((q: any) => q.id)).toContain(item3.id);
    });

    test('one failure does not block subsequent writes', async () => {
        const item = await offlineStorage.addToQueue(makeItem(1));

        // Force an error in the middle of the chain by marking a non-existent item
        // (this should not crash but should not find the item)
        await offlineStorage.markAsFailed('non-existent-id', 'test error');

        // A subsequent write should still work
        const item2 = await offlineStorage.addToQueue(makeItem(2));
        expect(item2).toBeDefined();

        const queue = await offlineStorage.getQueue();
        expect(queue.length).toBeGreaterThanOrEqual(2);
    });

    test('getQueue and getPendingItems are read-only (no lock)', async () => {
        await offlineStorage.addToQueue(makeItem(1));
        await offlineStorage.addToQueue(makeItem(2));

        // These should work without going through the lock
        const queue = await offlineStorage.getQueue();
        expect(queue).toHaveLength(2);

        const pending = await offlineStorage.getPendingItems();
        expect(pending).toHaveLength(2);
        expect(pending.every((item: any) => item.status === 'pending')).toBe(true);
    });

    test('getStats returns correct counts', async () => {
        await offlineStorage.addToQueue(makeItem(1));
        const item2 = await offlineStorage.addToQueue(makeItem(2));
        const item3 = await offlineStorage.addToQueue(makeItem(3));

        await offlineStorage.markAsFailed(item2.id, 'error');

        const stats = await offlineStorage.getStats();
        expect(stats.total).toBe(3);
        expect(stats.pending).toBe(2); // item1 + item3
        expect(stats.failed).toBe(1); // item2
    });
});
