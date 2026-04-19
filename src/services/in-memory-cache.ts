
/**
 * @fileoverview A simple in-memory cache for storing paper metadata and aliases.
 * This is used to deduplicate papers and avoid redundant network requests during
 * a single pipeline execution. The cache is cleared at the start of each pipeline run.
 */

import { type PaperCacheEntry } from '@/lib/types';

class InMemoryCache {
  private cache: Map<string, PaperCacheEntry>; // Key is the 'true_title'
  private aliasMap: Map<string, string>; // Maps an alias to a true_title key

  constructor() {
    this.cache = new Map();
    this.aliasMap = new Map();
  }

  /**
   * Normalizes a title into a cache-safe key.
   * @param title The paper title.
   * @returns A lowercase, non-special-character string.
   */
  private normalizeKey(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Stores or updates paper information in the cache.
   * @param paperData The paper data to store.
   */
  public storeOrUpdatePaperInfo(paperData: PaperCacheEntry): void {
    const key = this.normalizeKey(paperData.true_title);
    const existingEntry = this.cache.get(key);

    if (existingEntry) {
      // Entry exists, merge new info into it
      const updatedEntry: PaperCacheEntry = {
        ...existingEntry,
        aliases: [...new Set([...existingEntry.aliases, ...paperData.aliases])],
        scraped_from: [...new Set([...existingEntry.scraped_from, ...paperData.scraped_from])],
        source_urls: [...new Set([...existingEntry.source_urls, ...paperData.source_urls])],
        metrics: [...existingEntry.metrics, ...paperData.metrics],
        // Prefer a more complete date if the new one is better
        publishedDate: existingEntry.publishedDate || paperData.publishedDate,
        year: existingEntry.year || paperData.year,
      };
      this.cache.set(key, updatedEntry);
    } else {
      // This is a new paper
      this.cache.set(key, paperData);
    }

    // Update the alias map for all aliases of this paper
    paperData.aliases.forEach(alias => {
        this.aliasMap.set(this.normalizeKey(alias), key);
    });
    // Also map the true title to itself
    this.aliasMap.set(key, key);
  }

  /**
   * Retrieves a paper by its alias (e.g., a leaderboard name or a variation of the title).
   * @param alias The alias to search for.
   * @returns The cached paper entry, or null if not found.
   */
  public getPaperByAlias(alias: string): PaperCacheEntry | null {
    const normalizedAlias = this.normalizeKey(alias);
    const trueTitleKey = this.aliasMap.get(normalizedAlias);
    if (trueTitleKey) {
        return this.cache.get(trueTitleKey) || null;
    }
    return null;
  }

  /**
   * Clears the entire cache.
   */
  public clear(): void {
    this.cache.clear();
    this.aliasMap.clear();
    console.log('✨ In-memory cache cleared.');
  }

  /**
   * Returns all entries in the cache. Useful for debugging.
   * @returns An array of all cached paper entries.
   */
  public getAllEntries(): PaperCacheEntry[] {
    return Array.from(this.cache.values());
  }

   /**
   * Loads a set of entries into the cache, useful for rehydrating state.
   * @param entries An array of PaperCacheEntry objects.
   */
  public loadEntries(entries: PaperCacheEntry[]): void {
      this.clear();
      for (const entry of entries) {
          this.storeOrUpdatePaperInfo(entry);
      }
      console.log(`Cache rehydrated with ${entries.length} entries.`);
  }
}

// Export a singleton instance to be used across the application
export const paperCache = new InMemoryCache();

    