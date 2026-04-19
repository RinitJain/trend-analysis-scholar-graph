import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-insights.ts';
import '@/ai/flows/fetch-graph-data.ts';
import '@/ai/flows/build-citation-graph.ts';
import '@/ai/flows/generate-detailed-summary.ts';
import '@/ai/flows/extrapolate-research-trends.ts';
import '@/ai/flows/generate-analysis-questions.ts';
