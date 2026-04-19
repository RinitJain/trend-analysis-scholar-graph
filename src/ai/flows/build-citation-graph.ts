'use server';

/**
 * @fileOverview A flow to build a citation graph using a dynamic 15-question analysis set.
 */
import { config } from 'dotenv';
config();

import { z } from 'zod';
import { extractDataFromPdf, downloadPdf, GrobidOutput, GrobidContext } from '@/services/grobid';
import { unlink } from 'fs/promises';
import { ModelSchema, BuildCitationGraphOutputSchema, GraphNode, GraphEdge, PaperAnalysis, AnalysisQuestionSchema, AnalysisQuestion } from '@/lib/types';
import { callWithRetry } from '@/lib/ai-utils';
import { analyzeCitationIntent } from '@/services/citation-intent-analyzer';
import stringSimilarity from 'string-similarity';
import { geminiKeyManager } from '@/lib/geminiKeyManager';

function isPotentialMatch(ctx: GrobidContext, citedPaperTitle: string): boolean {
    if (!ctx.linkedReference || !ctx.linkedReference.title) return false;
    const citedTitleNorm = citedPaperTitle.toLowerCase().trim();
    const ctxTitleNorm = ctx.linkedReference.title.toLowerCase().trim();
    if (ctxTitleNorm === citedTitleNorm) return true;
    return stringSimilarity.compareTwoStrings(ctxTitleNorm, citedTitleNorm) > 0.8;
}

export async function buildCitationGraph(
  models: z.infer<typeof ModelSchema>[],
  questions: AnalysisQuestion[]
): Promise<z.infer<typeof BuildCitationGraphOutputSchema>> {
  console.log(`📄 Building citation graph from ${models.length} models...`);
  
  const client = geminiKeyManager.getClient();
  const grobidDataStore = new Map<string, GrobidOutput>();
  const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // --- Individual Paper Analyzer Prompt (Dynamic) ---
  const properties: Record<string, z.ZodString> = {};
  let promptQuestions = "";
  questions.forEach((q, index) => {
      properties[q.key] = z.string().describe(q.question);
      promptQuestions += `${index + 1}. **${q.key}**: ${q.question}\n`;
  });
  const DynamicPaperAnalysisSchema = z.object(properties);

  const paperAnalyzerPrompt = client.definePrompt({
      name: 'paperAnalyzerPrompt_dynamic',
      input: { schema: z.object({
          fullText: z.string(),
          paperTitle: z.string(),
          accuracy: z.number().nullable(),
      })},
      output: { schema: DynamicPaperAnalysisSchema },
      prompt: `You are an expert research analyst. Analyze paper "{{paperTitle}}" (Accuracy: {{#if accuracy}}{{accuracy}}%{{else}}N/A{{/if}}).
Answer the following questions based SOLELY on the provided text.

**Full Text:**
---
{{{fullText}}}
---

**Questions:**
${promptQuestions}

Return a single JSON object. If information is missing, return an empty string for that key.`,
  });

  // --- Context Finder Prompt ---
  const contextFinderPrompt = client.definePrompt({
      name: 'contextFinderPrompt',
      input: { schema: z.object({
          fullText: z.string(),
          cited_paper_title: z.string(),
          cited_paper_year: z.number().optional(),
      })},
      output: { schema: z.object({
          contexts: z.array(z.object({
              context: z.string(),
              section: z.string(),
              type: z.string()
          }))
      })},
      prompt: `Find all citation contexts for "{{cited_paper_title}}" in the following text.
Text:
{{{fullText}}}`,
  });

  // --- Pass 1: Nodes & Analysis ---
  const nodes: GraphNode[] = [];
  const titleToTrueTitleMap = new Map<string, string>();

  for (const model of models) {
      if (!model.title || !model.pdf_url) continue;
      let pdfPath: string | null = null;
      try {
          pdfPath = await downloadPdf(model.pdf_url);
          if (!pdfPath) continue;
          
          const grobidData = await extractDataFromPdf(pdfPath, model.title, grobidDataStore);
          const trueTitle = grobidData.paperTitle || model.title;
          titleToTrueTitleMap.set(model.title, trueTitle);
          if (!grobidDataStore.has(trueTitle)) grobidDataStore.set(trueTitle, grobidData);

          const analysis = await callWithRetry(() => paperAnalyzerPrompt({
              fullText: grobidData.structuredText,
              paperTitle: trueTitle,
              accuracy: model.accuracy
          }));

          nodes.push({
              id: trueTitle,
              year: model.year,
              accuracy: model.accuracy,
              pdf_url: model.pdf_url,
              publishedDate: model.publishedDate || grobidData.publishedDate,
              normalizedAccuracy: model.normalizedAccuracy,
              primary_metric: model.primary_metric,
              scraped_from: model.source ? [model.source] : [],
              analysis: analysis.output as PaperAnalysis,
          });
      } catch (error) {
          console.error(`- ❌ Pass 1 failed for ${model.title}:`, error);
      } finally {
          if (pdfPath) await unlink(pdfPath).catch(() => {});
      }
  }

  // --- Pass 2 & 3: Edges & Intent ---
  const enrichedEdges: GraphEdge[] = [];
  const datasetPaperTitles = new Map(nodes.map(n => [normalizeTitle(n.id), n.id]));

  for (const citingNode of nodes) {
      const grobidData = grobidDataStore.get(citingNode.id);
      if (!grobidData) continue;

      for (const ref of grobidData.references) {
          if (!ref.title) continue;
          const normalizedRefTitle = normalizeTitle(ref.title);
          if (datasetPaperTitles.has(normalizedRefTitle)) {
              const citedId = datasetPaperTitles.get(normalizedRefTitle)!;
              if (citedId === citingNode.id) continue;

              const relevantContexts = grobidData.contexts.filter(ctx => isPotentialMatch(ctx, citedId));
              let combinedContext = relevantContexts.map(ctx => ctx.raw_context).join('\n\n---\n\n');

              if (!combinedContext) {
                  const aiFound = await callWithRetry(() => contextFinderPrompt({ fullText: grobidData.structuredText, cited_paper_title: citedId }));
                  combinedContext = (aiFound.output as any).contexts?.map((c: any) => c.context).join('\n\n') || "";
              }

              if (combinedContext) {
                  const intent = await analyzeCitationIntent(combinedContext, citedId, citingNode.id);
                  if (intent) {
                      enrichedEdges.push({
                          from: citedId,
                          to: citingNode.id,
                          citation_intent: intent.intent,
                          citation_confidence: intent.confidence,
                          citation_context: intent.context_snippet,
                          citation_reasoning: intent.reasoning,
                          research_gap_summary: intent.research_gap_summary,
                      });
                  }
              }
          }
      }
  }

  return { nodes, edges: enrichedEdges };
}
