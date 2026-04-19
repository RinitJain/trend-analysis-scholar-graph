
'use server';

import { geminiKeyManager } from "./geminiKeyManager";

/**
 * @fileoverview Utility functions for interacting with AI models, including retry logic.
 */

/**
 * Calls an async function with a retry mechanism that includes exponential backoff and API key rotation.
 * This is useful for handling intermittent network issues or model availability problems.
 * @param fn The async function to call.
 * @param retries The maximum number of retries.
 * @param delay The initial delay in milliseconds.
 * @returns The result of the function call.
 * @throws An error if all retries are exhausted.
 */
export async function callWithRetry<T>(
    fn: () => Promise<T>,
    retries = 5, // Increased retries to allow for key rotation
    delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit = err.status === 429 || err.message?.includes("Too Many Requests");
      const isQuotaError = err.message?.includes("quota") || err.message?.includes("exceeded");
      const isServiceDisabled = err.status === 403 && (err.message?.includes("SERVICE_DISABLED") || err.message?.includes("API has not been used"));
      const isOverloaded = err.status === 503 || err.message?.includes('Service Unavailable') || err.message?.includes('model is overloaded');

      if (isRateLimit || isQuotaError || isServiceDisabled) {
        const reason = isServiceDisabled ? "API disabled" : "quota reached";
        console.warn(`⚠️ Gemini ${reason} — rotating key...`);
        geminiKeyManager.rotateKey();
        await new Promise((r) => setTimeout(r, 1000)); // short cooldown after rotation
        continue; // Retry with the new key immediately
      }
      
      if (isOverloaded) {
         const waitTime = delay * Math.pow(2, i); // Exponential backoff
         console.warn(`Retrying after ${waitTime}ms due to model overload...`);
         await new Promise(res => setTimeout(res, waitTime));
         continue; // Retry after delay
      }

      if (i === retries - 1) {
        console.error("Final attempt failed. Error is not a retryable one.", err);
        throw err;
      }
    }
  }

  // This line should theoretically be unreachable if the loop is correct,
  // but it's here for type safety and as a fallback.
  throw new Error("Retries exhausted");
}
