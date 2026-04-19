import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// This file is now deprecated in favor of the dynamic key manager.
// It is kept for reference but should not be used directly in new flows.
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});
