/**
 * Offline Question Cache Service
 *
 * Manages local caching of Question Banks and Generated Questions for offline data collection.
 * Allows devices to access questions and generate new questions even without internet.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getObjectSize,
  formatBytes,
  exceedsStorageLimit,
  compressQuestionData,
  chunkArray,
  estimateChunkSize,
  deduplicateGeneratedQuestions,
} from '../utils/storageUtils';

const CACHE_KEYS = {
  QUESTION_BANKS: '@fsda/question_banks',
  GENERATED_QUESTIONS: '@fsda/generated_questions',
  PROJECT_DATA: '@fsda/project_data',
  LAST_CACHE_UPDATE: '@fsda/last_cache_update',
};

export interface CachedQuestionBank {
  id: string;
  project_id: string;
  question_text: string;
  question_category: string;
  response_type: string;
  is_required: boolean;
  options: string[] | null;
  targeted_respondents: string[];
  targeted_commodities: string[];
  targeted_countries: string[];
  is_follow_up: boolean;
  conditional_logic: any;
  section_header: string;
  section_preamble: string;
  created_at: string;
  updated_at: string;
}

export interface CachedGeneratedQuestion {
  id: string;
  project_id: string;
  question_text: string;
  response_type: string;
  is_required: boolean;
  options: string[] | null;
  assigned_respondent_type: string;
  assigned_commodity: string;
  assigned_country: string;
  order_index: number;
  is_follow_up: boolean;
  conditional_logic: any;
  section_header: string;
  section_preamble: string;
  source_question_bank_id: string;
}

export interface ProjectCache {
  id: string;
  name: string;
  commodities: string[];
  countries: string[];
  respondent_types: string[];
}

class OfflineQuestionCacheService {
  /**
   * Cache Question Banks for a project
   */
  async cacheQuestionBanks(projectId: string, questionBanks: CachedQuestionBank[]): Promise<void> {
    try {
      const cacheData = await this.getAllQuestionBanksCache();

      // Compress question data to reduce size
      const compressedQuestions = compressQuestionData(questionBanks);
      cacheData[projectId] = compressedQuestions as any;

      // Check size before saving
      const dataSize = getObjectSize(cacheData);
      console.log(`📊 Question banks cache size: ${formatBytes(dataSize)} (${questionBanks.length} questions)`);

      // If data is too large, implement chunking strategy
      if (exceedsStorageLimit(cacheData, 4)) {
        console.warn(`⚠️ Cache size exceeds 4MB, using chunked storage for project ${projectId}`);
        await this.cacheQuestionBanksChunked(projectId, compressedQuestions as any);
      } else {
        try {
          await AsyncStorage.setItem(CACHE_KEYS.QUESTION_BANKS, JSON.stringify(cacheData));
          await this.updateLastCacheTime();
          console.log(`✓ Cached ${questionBanks.length} question banks for project ${projectId}`);
        } catch (error: any) {
          // Handle QuotaExceededError
          if (error.name === 'QuotaExceededError' || error.message?.includes('quota')) {
            console.warn(`⚠️ Storage quota exceeded, switching to chunked storage`);
            await this.cacheQuestionBanksChunked(projectId, compressedQuestions as any);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Failed to cache question banks:', error);
      throw error;
    }
  }

  /**
   * Cache question banks using chunked storage (for large datasets)
   */
  private async cacheQuestionBanksChunked(projectId: string, questionBanks: CachedQuestionBank[]): Promise<void> {
    try {
      // Estimate chunk size based on sample item
      const sampleItem = questionBanks[0] || {};
      const chunkSize = estimateChunkSize(sampleItem, 2); // 2MB per chunk

      const chunks = chunkArray(questionBanks, chunkSize);
      console.log(`📦 Splitting ${questionBanks.length} question banks into ${chunks.length} chunks`);

      // Save each chunk separately
      for (let i = 0; i < chunks.length; i++) {
        const chunkKey = `${CACHE_KEYS.QUESTION_BANKS}_${projectId}_chunk_${i}`;
        await AsyncStorage.setItem(chunkKey, JSON.stringify(chunks[i]));
      }

      // Save chunk metadata
      const metadata = {
        projectId,
        totalChunks: chunks.length,
        totalItems: questionBanks.length,
        chunkSize,
      };
      await AsyncStorage.setItem(`${CACHE_KEYS.QUESTION_BANKS}_${projectId}_meta`, JSON.stringify(metadata));

      await this.updateLastCacheTime();
      console.log(`✓ Cached ${questionBanks.length} question banks in ${chunks.length} chunks for project ${projectId}`);
    } catch (error) {
      console.error('Failed to cache question banks in chunks:', error);
      throw error;
    }
  }

  /**
   * Get cached Question Banks for a project
   */
  async getQuestionBanks(projectId: string): Promise<CachedQuestionBank[]> {
    try {
      // First check if chunked storage exists
      const metadataKey = `${CACHE_KEYS.QUESTION_BANKS}_${projectId}_meta`;
      const metadataStr = await AsyncStorage.getItem(metadataKey);

      if (metadataStr) {
        // Load from chunked storage
        const metadata = JSON.parse(metadataStr);
        const allQuestions: CachedQuestionBank[] = [];

        for (let i = 0; i < metadata.totalChunks; i++) {
          const chunkKey = `${CACHE_KEYS.QUESTION_BANKS}_${projectId}_chunk_${i}`;
          const chunkStr = await AsyncStorage.getItem(chunkKey);
          if (chunkStr) {
            const chunk = JSON.parse(chunkStr);
            allQuestions.push(...chunk);
          }
        }

        console.log(`📦 Loaded ${allQuestions.length} question banks from ${metadata.totalChunks} chunks`);
        return allQuestions;
      }

      // Fall back to regular cache
      const cacheData = await this.getAllQuestionBanksCache();
      return cacheData[projectId] || [];
    } catch (error) {
      console.error('Failed to get cached question banks:', error);
      return [];
    }
  }

  /**
   * Cache Generated Questions for a project.
   *
   * Always uses per-project chunked storage to avoid Android's SQLite
   * CursorWindow 2 MB limit. The old monolithic key is only read as a
   * migration fallback in getGeneratedQuestions().
   */
  async cacheGeneratedQuestions(projectId: string, questions: CachedGeneratedQuestion[]): Promise<void> {
    try {
      // Deduplicate questions before caching to prevent duplicates
      const deduplicated = deduplicateGeneratedQuestions(questions);

      // Compress question data to reduce size
      const compressedQuestions = compressQuestionData(deduplicated);

      const dataSize = getObjectSize(compressedQuestions);
      console.log(`📊 Generated questions cache size: ${formatBytes(dataSize)} (${deduplicated.length} questions after deduplication)`);

      // Always write per-project chunks (1 MB limit per chunk keeps
      // every AsyncStorage row well under the 2 MB CursorWindow cap)
      await this.cacheGeneratedQuestionsChunked(projectId, compressedQuestions as any);
    } catch (error) {
      console.error('Failed to cache generated questions:', error);
      throw error;
    }
  }

  /**
   * Cache generated questions using per-project chunked storage.
   * Each chunk stays under 1 MB to avoid Android CursorWindow errors.
   */
  private async cacheGeneratedQuestionsChunked(projectId: string, questions: CachedGeneratedQuestion[]): Promise<void> {
    try {
      // Clean up old chunks first (the count may differ between writes)
      await this.clearGeneratedQuestionChunks(projectId);

      // 1 MB per chunk — safely under 2 MB CursorWindow limit
      const sampleItem = questions[0] || {};
      const chunkSize = estimateChunkSize(sampleItem, 1);

      const chunks = chunkArray(questions, chunkSize);
      console.log(`📦 Splitting ${questions.length} generated questions into ${chunks.length} chunks (≤1 MB each)`);

      // Save each chunk separately
      for (let i = 0; i < chunks.length; i++) {
        const chunkKey = `${CACHE_KEYS.GENERATED_QUESTIONS}_${projectId}_chunk_${i}`;
        await AsyncStorage.setItem(chunkKey, JSON.stringify(chunks[i]));
      }

      // Save chunk metadata
      const metadata = {
        projectId,
        totalChunks: chunks.length,
        totalItems: questions.length,
        chunkSize,
      };
      await AsyncStorage.setItem(`${CACHE_KEYS.GENERATED_QUESTIONS}_${projectId}_meta`, JSON.stringify(metadata));

      await this.updateLastCacheTime();
      console.log(`✓ Cached ${questions.length} generated questions in ${chunks.length} chunks for project ${projectId}`);
    } catch (error) {
      console.error('Failed to cache generated questions in chunks:', error);
      throw error;
    }
  }

  /**
   * Remove existing chunk keys for a project so stale chunks don't linger
   * when the new write produces fewer chunks than the previous one.
   */
  private async clearGeneratedQuestionChunks(projectId: string): Promise<void> {
    try {
      const metaKey = `${CACHE_KEYS.GENERATED_QUESTIONS}_${projectId}_meta`;
      const metaStr = await AsyncStorage.getItem(metaKey);
      if (!metaStr) return;

      const meta = JSON.parse(metaStr);
      const keysToRemove = [metaKey];
      for (let i = 0; i < meta.totalChunks; i++) {
        keysToRemove.push(`${CACHE_KEYS.GENERATED_QUESTIONS}_${projectId}_chunk_${i}`);
      }
      await AsyncStorage.multiRemove(keysToRemove);
    } catch (e) {
      // Non-fatal — worst case we overwrite keys
      console.warn('clearGeneratedQuestionChunks cleanup warning:', e);
    }
  }

  /**
   * Get cached Generated Questions for a project
   */
  async getGeneratedQuestions(projectId: string): Promise<CachedGeneratedQuestion[]> {
    try {
      // Prefer per-project chunked storage (the only write path now)
      const metadataKey = `${CACHE_KEYS.GENERATED_QUESTIONS}_${projectId}_meta`;
      const metadataStr = await AsyncStorage.getItem(metadataKey);

      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        const allQuestions: CachedGeneratedQuestion[] = [];

        for (let i = 0; i < metadata.totalChunks; i++) {
          const chunkKey = `${CACHE_KEYS.GENERATED_QUESTIONS}_${projectId}_chunk_${i}`;
          const chunkStr = await AsyncStorage.getItem(chunkKey);
          if (chunkStr) {
            const chunk = JSON.parse(chunkStr);
            allQuestions.push(...chunk);
          }
        }

        console.log(`📦 Loaded ${allQuestions.length} generated questions from ${metadata.totalChunks} chunks`);

        // Opportunistically delete the stale monolithic key so the
        // CursorWindow warning never fires again on future reads.
        this.purgeMonolithicKey();

        return allQuestions;
      }

      // Migration fallback: try the old monolithic key (may fail on
      // Android if the row has grown past 2 MB — handle gracefully)
      try {
        const cacheData = await this.getAllGeneratedQuestionsCache();
        const projectQuestions = cacheData[projectId] || [];

        // If found, migrate to chunked storage and clear from monolithic key
        if (projectQuestions.length > 0) {
          console.log(`🔄 Migrating ${projectQuestions.length} questions from monolithic cache to chunked storage`);
          await this.cacheGeneratedQuestionsChunked(projectId, projectQuestions);

          // Remove this project from the monolithic key
          delete cacheData[projectId];
          try {
            await AsyncStorage.setItem(CACHE_KEYS.GENERATED_QUESTIONS, JSON.stringify(cacheData));
          } catch (_) {
            // If the monolithic key is already too big to write back, just delete it entirely
            await AsyncStorage.removeItem(CACHE_KEYS.GENERATED_QUESTIONS).catch(() => {});
          }

          return projectQuestions;
        }
      } catch (legacyErr) {
        // Monolithic key is unreadable (CursorWindow overflow) — delete it
        // so it doesn't keep producing warnings on every future read.
        console.warn('Legacy monolithic cache unreadable, removing it.');
        await AsyncStorage.removeItem(CACHE_KEYS.GENERATED_QUESTIONS).catch(() => {});
      }

      return [];
    } catch (error) {
      console.error('Failed to get cached generated questions:', error);
      return [];
    }
  }

  /**
   * Delete the old monolithic generated-questions key (fire-and-forget).
   * Called once after a successful chunked read so the stale blob doesn't
   * linger and produce CursorWindow warnings on future fallback attempts.
   */
  private purgeMonolithicKey(): void {
    AsyncStorage.removeItem(CACHE_KEYS.GENERATED_QUESTIONS).catch(() => {});
  }

  /**
   * Generate questions offline using cached Question Bank
   * Mimics server-side logic for question generation
   */
  async generateQuestionsOffline(
    projectId: string,
    respondentType: string,
    commodity: string,
    country: string
  ): Promise<CachedGeneratedQuestion[]> {
    try {
      console.log(`Generating questions offline for: ${respondentType}, ${commodity}, ${country}`);

      // Get cached question banks
      const questionBanks = await this.getQuestionBanks(projectId);

      if (questionBanks.length === 0) {
        console.warn('No cached question banks found. Need to sync first.');
        return [];
      }

      // Parse commodities (support comma-separated list)
      const commodities = commodity ? commodity.split(',').map(c => c.trim()) : [];

      // Filter questions matching the generation criteria
      const matchingQuestions = questionBanks.filter((qb) => {
        const respondentMatch = qb.targeted_respondents.includes(respondentType);

        // Check if any of the requested commodities match the question's targeted commodities
        const commodityMatch = commodities.length === 0 ||
          qb.targeted_commodities.length === 0 ||
          commodities.some(c => qb.targeted_commodities.includes(c));

        const countryMatch = qb.targeted_countries.includes(country);

        return respondentMatch && commodityMatch && countryMatch;
      });

      console.log(`Found ${matchingQuestions.length} matching questions`);

      // Check if questions already exist in cache
      const existingQuestions = await this.getGeneratedQuestions(projectId);
      const existingIds = new Set(
        existingQuestions
          .filter(
            (q) =>
              q.assigned_respondent_type === respondentType &&
              q.assigned_commodity === commodity &&
              q.assigned_country === country
          )
          .map((q) => q.source_question_bank_id)
      );

      // Generate new questions (skip duplicates)
      const generatedQuestions: CachedGeneratedQuestion[] = [];
      let maxOrderIndex = Math.max(0, ...existingQuestions.map((q) => q.order_index));

      for (const qb of matchingQuestions) {
        // Skip if already generated
        if (existingIds.has(qb.id)) {
          console.log(`Skipping duplicate: ${qb.question_text}`);
          continue;
        }

        maxOrderIndex++;

        const generatedQuestion: CachedGeneratedQuestion = {
          id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Temporary offline ID
          project_id: projectId,
          question_text: qb.question_text,
          response_type: qb.response_type,
          is_required: qb.is_required,
          options: qb.options,
          assigned_respondent_type: respondentType,
          assigned_commodity: commodity,
          assigned_country: country,
          order_index: maxOrderIndex,
          is_follow_up: qb.is_follow_up,
          conditional_logic: qb.conditional_logic,
          section_header: qb.section_header,
          section_preamble: qb.section_preamble,
          source_question_bank_id: qb.id,
        };

        generatedQuestions.push(generatedQuestion);
      }

      console.log(`Generated ${generatedQuestions.length} new questions offline`);

      // Add to cache
      if (generatedQuestions.length > 0) {
        const allGenerated = [...existingQuestions, ...generatedQuestions];
        await this.cacheGeneratedQuestions(projectId, allGenerated);
      }

      return generatedQuestions;
    } catch (error) {
      console.error('Failed to generate questions offline:', error);
      throw error;
    }
  }

  /**
   * Cache project metadata
   */
  async cacheProjectData(project: ProjectCache): Promise<void> {
    try {
      const cacheData = await this.getAllProjectsCache();
      cacheData[project.id] = project;

      await AsyncStorage.setItem(CACHE_KEYS.PROJECT_DATA, JSON.stringify(cacheData));
      console.log(`✓ Cached project data for ${project.name}`);
    } catch (error) {
      console.error('Failed to cache project data:', error);
      throw error;
    }
  }

  /**
   * Get cached project data
   */
  async getProjectData(projectId: string): Promise<ProjectCache | null> {
    try {
      const cacheData = await this.getAllProjectsCache();
      return cacheData[projectId] || null;
    } catch (error) {
      console.error('Failed to get cached project data:', error);
      return null;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    questionBanks: { [projectId: string]: number };
    generatedQuestions: { [projectId: string]: number };
    projects: number;
    lastUpdate: string | null;
  }> {
    try {
      const questionBanks = await this.getAllQuestionBanksCache();
      const projects = await this.getAllProjectsCache();
      const lastUpdate = await this.getLastCacheTime();

      // For generated questions, read per-project chunk metadata instead
      // of the monolithic key (which may exceed CursorWindow on Android)
      const generatedQuestionsCounts: { [key: string]: number } = {};
      const allKeys = await AsyncStorage.getAllKeys();
      const metaKeys = allKeys.filter(k => k.startsWith(CACHE_KEYS.GENERATED_QUESTIONS) && k.endsWith('_meta'));
      for (const metaKey of metaKeys) {
        try {
          const metaStr = await AsyncStorage.getItem(metaKey);
          if (metaStr) {
            const meta = JSON.parse(metaStr);
            generatedQuestionsCounts[meta.projectId] = meta.totalItems;
          }
        } catch (_) { /* skip unreadable meta */ }
      }

      return {
        questionBanks: Object.keys(questionBanks).reduce((acc, key) => {
          acc[key] = questionBanks[key].length;
          return acc;
        }, {} as { [key: string]: number }),
        generatedQuestions: generatedQuestionsCounts,
        projects: Object.keys(projects).length,
        lastUpdate,
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        questionBanks: {},
        generatedQuestions: {},
        projects: 0,
        lastUpdate: null,
      };
    }
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        CACHE_KEYS.QUESTION_BANKS,
        CACHE_KEYS.GENERATED_QUESTIONS,
        CACHE_KEYS.PROJECT_DATA,
        CACHE_KEYS.LAST_CACHE_UPDATE,
      ]);
      console.log('✓ Cleared all question cache');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Clear cache for specific project
   */
  async clearProjectCache(projectId: string): Promise<void> {
    try {
      // Clear question banks (regular cache)
      const qbCache = await this.getAllQuestionBanksCache();
      delete qbCache[projectId];
      await AsyncStorage.setItem(CACHE_KEYS.QUESTION_BANKS, JSON.stringify(qbCache));

      // Clear question banks (chunked cache)
      const qbMetaKey = `${CACHE_KEYS.QUESTION_BANKS}_${projectId}_meta`;
      const qbMetaStr = await AsyncStorage.getItem(qbMetaKey);
      if (qbMetaStr) {
        const qbMeta = JSON.parse(qbMetaStr);
        const keysToRemove = [qbMetaKey];
        for (let i = 0; i < qbMeta.totalChunks; i++) {
          keysToRemove.push(`${CACHE_KEYS.QUESTION_BANKS}_${projectId}_chunk_${i}`);
        }
        await AsyncStorage.multiRemove(keysToRemove);
      }

      // Clear generated questions (chunked per-project storage)
      await this.clearGeneratedQuestionChunks(projectId);

      // Clear generated questions (legacy monolithic cache — best effort)
      try {
        const gqCache = await this.getAllGeneratedQuestionsCache();
        if (gqCache[projectId]) {
          delete gqCache[projectId];
          await AsyncStorage.setItem(CACHE_KEYS.GENERATED_QUESTIONS, JSON.stringify(gqCache));
        }
      } catch (_) {
        // Monolithic key may be too large to read — that's fine, chunked is authoritative
      }

      // Clear project data
      const projectCache = await this.getAllProjectsCache();
      delete projectCache[projectId];
      await AsyncStorage.setItem(CACHE_KEYS.PROJECT_DATA, JSON.stringify(projectCache));

      console.log(`✓ Cleared cache for project ${projectId}`);
    } catch (error) {
      console.error('Failed to clear project cache:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getAllQuestionBanksCache(): Promise<{ [projectId: string]: CachedQuestionBank[] }> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.QUESTION_BANKS);
    return data ? JSON.parse(data) : {};
  }

  private async getAllGeneratedQuestionsCache(): Promise<{ [projectId: string]: CachedGeneratedQuestion[] }> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.GENERATED_QUESTIONS);
    return data ? JSON.parse(data) : {};
  }

  private async getAllProjectsCache(): Promise<{ [projectId: string]: ProjectCache }> {
    const data = await AsyncStorage.getItem(CACHE_KEYS.PROJECT_DATA);
    return data ? JSON.parse(data) : {};
  }

  private async updateLastCacheTime(): Promise<void> {
    await AsyncStorage.setItem(CACHE_KEYS.LAST_CACHE_UPDATE, new Date().toISOString());
  }

  private async getLastCacheTime(): Promise<string | null> {
    return await AsyncStorage.getItem(CACHE_KEYS.LAST_CACHE_UPDATE);
  }
}

// Export singleton instance
export const offlineQuestionCache = new OfflineQuestionCacheService();
