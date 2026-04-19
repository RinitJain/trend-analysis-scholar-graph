'use server';

/**
 * @fileOverview An AI flow to generate a synthesized analysis based on 15 dynamic questions.
 */
import { config } from 'dotenv';
config();

import { z } from 'zod';
import { 
    DetailedAnalysisInputSchema, 
    DetailedAnalysisOutputSchema, 
    DetailedAnalysisInput, 
    DetailedAnalysisOutput, 
    PaperReferenceListSchema, 
    PaperAnalysis, 
    PaperAnalysisSchema,
    AnalysisQuestion
} from '@/lib/types';
import { callWithRetry } from '@/lib/ai-utils';
import { geminiKeyManager } from '@/lib/geminiKeyManager';

export async function generateDetailedSummary(
  input: DetailedAnalysisInput
): Promise<DetailedAnalysisOutput> {
    const { graphData, topic, analysisQuestions } = input;
    const client = geminiKeyManager.getClient();

    const analyzablePapers = graphData.nodes
      .filter(node => !!node.analysis)
      .map(node => ({
        paperTitle: node.id,
        publishedDate: node.publishedDate,
        year: node.year,
        analysis: node.analysis!,
      }));
      
    if (analyzablePapers.length === 0) throw new Error("No analyzed papers found.");
    
    const paperReferenceList = analyzablePapers.map((paper, index) => ({
        number: index + 1,
        title: paper.paperTitle,
    }));

    // --- Dynamic Final Summary Prompt ---
    const synthesizedProperties: Record<string, z.ZodString> = {};
    let promptQuestionInstructions = "";
    analysisQuestions.forEach(q => {
        synthesizedProperties[q.key] = z.string().describe(`Summary for: "${q.question}"`);
        promptQuestionInstructions += `- **${q.key}**: Synthesize answers for: *"${q.question}"*\n`;
    });
    
    const DynamicFinalSummaryOutputSchema = z.object({
        synthesizedAnalyses: z.object(synthesizedProperties),
        overallSummary: z.string(),
    });

    const finalSummaryPrompt = client.definePrompt({
        name: 'finalSummaryPrompt_dynamic',
        input: { schema: z.object({ 
            topic: z.string(), 
            paperReferenceList: PaperReferenceListSchema,
            paperAnalyses: z.array(z.any()) 
        }) },
        output: { schema: DynamicFinalSummaryOutputSchema },
        prompt: `You are synthesizing findings for "{{topic}}". 
For each question below, write a cohesive, **chronological summary** highlighting field evolution. 
**Use inline citations like [1], [8].**

Reference List:
{{{json paperReferenceList}}}

Analyses:
{{{json paperAnalyses}}}

Sections to generate:
${promptQuestionInstructions}`,
    });

    const result = await callWithRetry(() => finalSummaryPrompt({ topic, paperAnalyses: analyzablePapers, paperReferenceList }));
    const output = result.output as any;

    return {
        topic,
        paperReferenceList,
        synthesizedAnalyses: output.synthesizedAnalyses,
        overallSummary: output.overallSummary,
        analysisQuestions,
    };
}
