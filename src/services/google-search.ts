
/**
 * @fileoverview This file contains functions for querying the Google Custom
 * Search API to find dataset and leaderboard URLs.
 */
import 'server-only';
import { config } from 'dotenv';

config(); // Load environment variables from .env file

// Use the same pool of Gemini keys for Google Search as well.
const GEMINI_KEYS = [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3,
  process.env.GEMINI_KEY_4,
  process.env.GEMINI_KEY_5,
  process.env.GEMINI_KEY_6,
].filter(Boolean) as string[];

const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;

/**
 * Checks if a given URL responds with a 200 OK status.
 * @param url The URL to check.
 * @returns The URL if it's valid, otherwise null.
 */
async function isValidUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (response.ok) {
      return url;
    }
  } catch {
    // Ignore errors (e.g., network issues, invalid certs)
  }
  return null;
}

/**
 * Queries the Google Custom Search JSON API with key rotation on failure.
 * @param query The search query.
 * @param num_results The number of results to return.
 * @returns A list of result URLs.
 */
async function googleSearch(query: string, num_results = 5): Promise<string[]> {
  if (GEMINI_KEYS.length === 0 || !GOOGLE_CSE_ID) {
    console.error('  - ⚠️ At least one GEMINI_KEY_n and GOOGLE_CSE_ID must be set in environment.');
    return [];
  }

  let lastError: Error | null = null;

  // Try each key in the pool upon failure.
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const apiKey = GEMINI_KEYS[i];
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('cx', GOOGLE_CSE_ID);
    url.searchParams.append('q', query);
    url.searchParams.append('num', String(num_results));

    try {
      const response = await fetch(url.toString());
      
      if (response.status === 429) {
        // Rate limit error, log it and the loop will try the next key.
        console.warn(`  - ⚠️ Google Search rate limit for key #${i+1}. Trying next key...`);
        lastError = new Error(`Google Search API rate limit hit for key #${i+1}`);
        continue;
      }
      
      if (!response.ok) {
        lastError = new Error(`Google Search API error! status: ${response.status}`);
        // For other errors, don't retry immediately, as it's likely not a quota issue.
        throw lastError;
      }

      const data = await response.json();
      const resultUrls = data.items?.map((item: any) => item.link).filter(Boolean) || [];
      return resultUrls; // Success, return the results.

    } catch (error) {
      console.error(`  - ⚠️ Google Search failed with key #${i+1}:`, error);
      lastError = error as Error;
      // If it's a network error or other non-429 issue, we might not want to retry.
      // For simplicity, we'll let it try the next key, but this could be refined.
    }
  }

  // If the loop completes without a successful return, it means all keys failed.
  console.error('  - ❌ Google Search failed with all available API keys.');
  if (lastError) {
      // You can optionally throw the last error encountered.
      // throw lastError;
  }
  return []; // Return empty array after all retries fail.
}

/**
 * Finds a valid dataset URL using Google Custom Search.
 * @param query The name of the dataset.
 * @returns A promise that resolves to a valid URL string, or null.
 */
export async function getDatasetUrlFromGoogle(query: string): Promise<string | null> {
  const urls = await googleSearch(`${query} Dataset`, 3);
  for (const url of urls) {
    const valid = await isValidUrl(url);
    if (valid) {
      return valid;
    }
  }
  return null;
}

/**
 * Finds leaderboard links for a given dataset name.
 * @param dataset_name The name of the dataset.
 * @param num_results The number of results to fetch.
 * @returns A promise resolving to a list of URLs.
 */
export async function getLeaderboardLinksFromGoogle(
  dataset_name: string,
  num_results = 3
): Promise<string[]> {
  const query = `${dataset_name} dataset leaderboard`;
  const links = await googleSearch(query, num_results);
  return links;
}

/**
 * Checks if a URL is a suitable candidate for being a leaderboard.
 * @param url The URL to check.
 * @returns `false` if the URL is from a known blocked domain, otherwise `true`.
 */
export function isLeaderboardCandidate(url: string): boolean {
  const blocked_domains = ['github.com', 'bitbucket.org', 'huggingface.co'];
  const isBlocked = !blocked_domains.some(blocked => url.includes(blocked));
  if(!isBlocked) {
    console.log(`  - Filtering out non-leaderboard URL: ${url}`);
  }
  return isBlocked;
}
