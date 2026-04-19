
'use server';

/**
 * @fileOverview A citation graph insights summarization AI agent.
 *
 * - summarizeInsights - A function that summarizes insights from a citation graph.
 * - SummarizeInsightsInput - The input type for the summarizeInsights function.
 * - SummarizeInsightsOutput - The return type for the summarizeInsights function.
 */
import { config } from 'dotenv';
config();

import {z} from 'genkit';
import { CitationGraphSchema, SummarizeInsightsInputSchema, SummarizeInsightsOutputSchema, SummarizeInsightsInput, SummarizeInsightsOutput } from '@/lib/types';
import { geminiKeyManager } from '@/lib/geminiKeyManager';


export async function summarizeInsights(input: SummarizeInsightsInput): Promise<SummarizeInsightsOutput> {
  return summarizeInsightsFlow(input);
}

const getSummarizeInsightsPrompt = () => geminiKeyManager.getClient().definePrompt({
  name: 'summarizeInsightsPrompt',
  input: {schema: SummarizeInsightsInputSchema},
  output: {schema: SummarizeInsightsOutputSchema},
  prompt: `You are an expert in analyzing citation graphs to identify key insights and trends in research areas.

  Given the following citation graph data for the topic "{{topic}}", analyze the relationships between the papers and summarize the main takeaways.

  Citation Graph Data:
  Nodes: {{#each graphData.nodes}}{{{this.id}}} (Year: {{{this.year}}}, Accuracy: {{{this.accuracy}}}), {{/each}}
  Edges: {{#each graphData.edges}}{{{this.from}}} cites {{{this.to}}}, {{/each}}

  Consider the publication years, accuracy scores, and citation links to identify any significant patterns, breakthroughs, or unanswered challenges in the research area.

  Provide a concise summary of the key insights and trends that can be gleaned from this citation graph.
  Summary:`, // Ensure the LLM responds with "Summary: ..." to match the schema
});

const summarizeInsightsFlow = geminiKeyManager.getClient().defineFlow(
  {
    name: 'summarizeInsightsFlow',
    inputSchema: SummarizeInsightsInputSchema,
    outputSchema: SummarizeInsightsOutputSchema,
  },
  async (input: SummarizeInsightsInput) => {
    const summarizeInsightsPrompt = getSummarizeInsightsPrompt();
    const {output} = await summarizeInsightsPrompt(input);
    const finalOutput = output as SummarizeInsightsOutput | null;
    if (!finalOutput) {
        throw new Error("Failed to summarize insights.");
    }
    return finalOutput;
  }
);
