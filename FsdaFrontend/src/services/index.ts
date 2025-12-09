/**
 * Services Barrel Export
 * Centralized export point for all services
 */

export { networkMonitor } from './networkMonitor';
export { offlineStorage } from './offlineStorage';
export { syncApi } from './syncApi';
export { syncManager } from './syncManager';
export { analyticsService } from './analyticsService';
export { offlineQuestionCache } from './offlineQuestionCache';
export { offlineProjectCache } from './offlineProjectCache';

export type { SyncQueueItem } from './offlineStorage';
export type {
  CachedQuestionBank,
  CachedGeneratedQuestion,
  ProjectCache,
} from './offlineQuestionCache';
export type { CachedProject } from './offlineProjectCache';
