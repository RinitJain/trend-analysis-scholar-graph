// src/lib/geminiKeyManager.ts
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import dotenv from 'dotenv';

dotenv.config(); // ✅ Ensure .env is loaded

const GEMINI_KEYS = [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3,
  process.env.GEMINI_KEY_4,
  process.env.GEMINI_KEY_5,
  process.env.GEMINI_KEY_6,
].filter(Boolean) as string[]; // removes any undefined ones

if (GEMINI_KEYS.length === 0) {
  throw new Error("❌ No Gemini API keys found. Please set GEMINI_KEY_1...GEMINI_KEY_6 in your .env file");
}

class GeminiKeyManager {
  private keys: string[];
  private currentIndex = 0;
  private currentClient!: ReturnType<typeof genkit>;;

  constructor(keys: string[]) {
    this.keys = keys;
    this.rotateKey(true); // Initialize with the first key
  }

  private maskKey(key: string) {
    if (!key) return "INVALID_KEY";
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  }

  private initializeClient(key: string) {
    return genkit({
      plugins: [googleAI({ apiKey: key })],
      model: 'googleai/gemini-2.0-flash',
    });
  }

  /** Returns the active genkit client */
  getClient() {
    return this.currentClient;
  }

  /** Rotates to the next API key */
  rotateKey(initial = false) {
    if (!initial) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    }
    const newKey = this.keys[this.currentIndex];
    this.currentClient = this.initializeClient(newKey);

    const msg = `${initial ? "🔑 Initialized" : "🔁 Rotated"} Gemini key → ${this.maskKey(newKey)}`;
    console.log(msg);
  }

  /** Returns the current API key (for debugging/logging only) */
  getCurrentKey() {
    return this.keys[this.currentIndex];
  }
}

// ✅ Export singleton instance
export const geminiKeyManager = new GeminiKeyManager(GEMINI_KEYS);
