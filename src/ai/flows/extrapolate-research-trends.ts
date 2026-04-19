'use server';

/**
 * @fileOverview An AI flow to extrapolate future research trends from a collection of paper analyses.
 * This file includes logic to detect research plateaus for a more focused analysis.
 */
import { config } from 'dotenv';
config();

import { z } from 'zod';
import { TrendExtrapolationInputSchema, TrendExtrapolationOutputSchema, TrendExtrapolationInput, TrendExtrapolationOutput, PaperAnalysisSchema, GraphNode, PaperAnalysis } from '@/lib/types';
import { callWithRetry } from '@/lib/ai-utils';
import { geminiKeyManager } from '@/lib/geminiKeyManager';

type PaperAnalysisWithMetadata = {
    paperTitle: string;
    publishedDate: string | null | undefined;
    year: number | null;
    analysis: PaperAnalysis;
    normalizedAccuracy: number | null | undefined;
};

/**
 * Detects a research plateau from a list of papers.
 */
function findResearchPlateau(papers: PaperAnalysisWithMetadata[]): PaperAnalysisWithMetadata[] | null {
    const PLATEAU_WINDOW = 4; 
    const PLATEAU_THRESHOLD = 0.08; 

    if (papers.length < PLATEAU_WINDOW) return null;

    for (let i = 0; i <= papers.length - PLATEAU_WINDOW; i++) {
        const window = papers.slice(i, i + PLATEAU_WINDOW);
        const accuracies = window.map(p => p.normalizedAccuracy).filter(a => a !== null && a !== undefined) as number[];

        if (accuracies.length < PLATEAU_WINDOW) continue;

        const maxAccuracy = Math.max(...accuracies);
        const minAccuracy = Math.min(...accuracies);

        if (maxAccuracy - minAccuracy < PLATEAU_THRESHOLD) {
            let plateauEndIndex = i + PLATEAU_WINDOW - 1;
            for (let j = i + PLATEAU_WINDOW; j < papers.length; j++) {
                const nextAcc = papers[j].normalizedAccuracy;
                if (nextAcc !== null && nextAcc !== undefined && Math.abs(nextAcc - minAccuracy) < PLATEAU_THRESHOLD) {
                    plateauEndIndex = j;
                } else {
                    break;
                }
            }
            console.log(`- ✅ Found a research plateau of ${plateauEndIndex - i + 1} papers.`);
            return papers.slice(i, plateauEndIndex + 1);
        }
    }
    return null;
}

export async function extrapolateResearchTrends(
  input: TrendExtrapolationInput
): Promise<TrendExtrapolationOutput> {
  const { graphData, topic } = input;
  console.log(`- Starting research trend extrapolation for topic: "${topic}"`);

  const allAnalyzedPapers: PaperAnalysisWithMetadata[] = graphData.nodes
    .filter((node): node is GraphNode & { analysis: PaperAnalysis } => !!node.analysis)
    .map(node => ({
      paperTitle: node.id,
      publishedDate: node.publishedDate,
      year: node.year,
      analysis: node.analysis,
      normalizedAccuracy: node.normalizedAccuracy,
    }))
    .sort((a, b) => {
        const dateA = a.publishedDate ? new Date(a.publishedDate) : new Date(a.year || 0, 0, 1);
        const dateB = b.publishedDate ? new Date(b.publishedDate) : new Date(b.year || 0, 0, 1);
        return dateA.getTime() - dateB.getTime();
    });

  if (allAnalyzedPapers.length < 2) {
    throw new Error("Cannot extrapolate trends with fewer than 2 analyzed papers.");
  }
  
  let papersForAnalysis = findResearchPlateau(allAnalyzedPapers);
  let analysisContext = "You have been provided with analyses of key papers in this domain.";

  if (papersForAnalysis) {
      analysisContext = "STUBBORN CHALLENGES IDENTIFIED: The following papers represent a 'research plateau' where performance progress slowed down. These papers are crucial for identifying the underlying technical bottlenecks of the field.";
  } else {
      papersForAnalysis = allAnalyzedPapers;
  }

  const client = geminiKeyManager.getClient();
  const researchExtrapolatorPrompt = client.definePrompt({
      name: 'researchExtrapolatorPrompt',
      input: { schema: z.object({
          topic: z.string(),
          analysisContext: z.string(),
          paperAnalyses: z.array(z.object({
              paperTitle: z.string(),
              year: z.number().nullable(),
              analysis: PaperAnalysisSchema
          }))
      })},
      output: { schema: TrendExtrapolationOutputSchema },
      prompt: `You are an expert research strategist and futurist. You are tasked with extrapolating future research directions for the topic of "{{topic}}".

{{{analysisContext}}}

You have been provided with detailed analyses from key papers. Each analysis includes answers to 15 topic-specific questions covering contributions, methods, and limitations.

**Your Task:**
1. **Synthesize Holistically:** Identify macro-level trends. Are multiple papers hitting the same wall? Do newer papers solve old problems but introduce more complex ones?
2. **Formulate 7-10 Predicted Research Gaps:** Each must be:
    * **Technically Actionable:** State a clear technical challenge (e.g., “schema-aware pretraining” vs “improve robustness”).
    * **Evidence-Based:** Link directly to issues mentioned in the papers.
    * **Dimension-Focused:** Mention Modeling, Benchmarks, Evaluation, or Efficiency.
3. **Provide Overall Summary:** A brief summary of the field's current state.

**Analyses:**
{{{json paperAnalyses}}}

Return a JSON object containing \`topic\`, \`overall_summary\`, and \`predicted_gaps\`.`,
  });

  const runExtrapolation = async () => {
      const { output } = await researchExtrapolatorPrompt({ topic, analysisContext, paperAnalyses: papersForAnalysis! });
      return output as TrendExtrapolationOutput | null;
  };
  
  const result = await callWithRetry(runExtrapolation);
  if (!result) throw new Error("Failed to generate research trends.");
  return result;
}
