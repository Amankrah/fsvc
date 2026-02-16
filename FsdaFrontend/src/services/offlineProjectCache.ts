/**
 * Offline Project Cache Service
 *
 * Manages local caching of projects for offline access on the dashboard.
 * Allows users to view their projects even without internet.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS = {
  PROJECTS: '@fsda/projects',
  LAST_PROJECT_UPDATE: '@fsda/last_project_update',
};

import { Project } from '../types';

export type CachedProject = Project & {
  is_active?: boolean;
  status?: string;
};

class OfflineProjectCacheService {
  /**
   * Cache all projects
   */
  async cacheProjects(projects: CachedProject[]): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.PROJECTS, JSON.stringify(projects));
      await this.updateLastCacheTime();
      console.log(`✓ Cached ${projects.length} projects`);
    } catch (error) {
      console.error('Failed to cache projects:', error);
      throw error;
    }
  }

  /**
   * Get cached projects
   */
  async getProjects(): Promise<CachedProject[]> {
    try {
      const data = await AsyncStorage.getItem(CACHE_KEYS.PROJECTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get cached projects:', error);
      return [];
    }
  }

  /**
   * Get a specific cached project by ID
   */
  async getProject(projectId: string): Promise<CachedProject | null> {
    try {
      const projects = await this.getProjects();
      return projects.find(p => p.id === projectId) || null;
    } catch (error) {
      console.error('Failed to get cached project:', error);
      return null;
    }
  }

  /**
   * Update a single project in cache
   */
  async updateProject(project: CachedProject): Promise<void> {
    try {
      const projects = await this.getProjects();
      const index = projects.findIndex(p => p.id === project.id);

      if (index !== -1) {
        projects[index] = project;
      } else {
        projects.push(project);
      }

      await this.cacheProjects(projects);
    } catch (error) {
      console.error('Failed to update cached project:', error);
      throw error;
    }
  }

  /**
   * Remove a project from cache
   */
  async removeProject(projectId: string): Promise<void> {
    try {
      const projects = await this.getProjects();
      const filtered = projects.filter(p => p.id !== projectId);
      await this.cacheProjects(filtered);
    } catch (error) {
      console.error('Failed to remove cached project:', error);
      throw error;
    }
  }

  /**
   * Get last cache update time
   */
  async getLastCacheTime(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(CACHE_KEYS.LAST_PROJECT_UPDATE);
    } catch (error) {
      console.error('Failed to get last cache time:', error);
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalProjects: number;
    lastUpdate: string | null;
    activeProjects: number;
  }> {
    try {
      const projects = await this.getProjects();
      const lastUpdate = await this.getLastCacheTime();
      const activeProjects = projects.filter(p => p.is_active).length;

      return {
        totalProjects: projects.length,
        lastUpdate,
        activeProjects,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalProjects: 0,
        lastUpdate: null,
        activeProjects: 0,
      };
    }
  }

  /**
   * Clear all project cache
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        CACHE_KEYS.PROJECTS,
        CACHE_KEYS.LAST_PROJECT_UPDATE,
      ]);
      console.log('✓ Cleared all project cache');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Check if cache exists and is recent (within last 24 hours)
   */
  async isCacheValid(): Promise<boolean> {
    try {
      const lastUpdate = await this.getLastCacheTime();
      if (!lastUpdate) return false;

      const lastUpdateTime = new Date(lastUpdate).getTime();
      const now = new Date().getTime();
      const hoursSinceUpdate = (now - lastUpdateTime) / (1000 * 60 * 60);

      // Cache is valid if less than 24 hours old
      return hoursSinceUpdate < 24;
    } catch (error) {
      console.error('Failed to check cache validity:', error);
      return false;
    }
  }

  // Private helper methods

  private async updateLastCacheTime(): Promise<void> {
    await AsyncStorage.setItem(CACHE_KEYS.LAST_PROJECT_UPDATE, new Date().toISOString());
  }
}

// Export singleton instance
export const offlineProjectCache = new OfflineProjectCacheService();
