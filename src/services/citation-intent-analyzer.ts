
import { z } from 'zod';
import { callWithRetry } from '@/lib/ai-utils';
import { geminiKeyManager } from '@/lib/geminiKeyManager';

// Schema for citation intent analysis, now including research_gap_summary
export const CitationIntentSchema = z.object({
  intent: z.enum(['background', 'motivation', 'extension', 'comparison', 'methodology', 'limitation', 'uncertain']),
  confidence: z.number().min(0).max(1),
  context_snippet: z.string().describe("A brief excerpt of the citation context (2-3 sentences) that best supports the intent."),
  reasoning: z.string().optional().describe("Brief explanation for why this intent was classified, based on the provided context."),
  research_gap_summary: z.string().optional().describe("A 1-2 sentence, crisp and actionable summary of the research gap. Only present if intent is 'motivation' and confidence is high."),
  section_name: z.string().optional().describe("The section of the paper where the citation was found.")
});

export type CitationIntent = z.infer<typeof CitationIntentSchema>;

// This function creates the prompt object. It's called inside the main analysis function.
const getCitationIntentPrompt = () => geminiKeyManager.getClient().definePrompt({
  name: 'citationIntentPrompt',
  input: { 
    schema: z.object({ 
      citing_paper_title: z.string(),
      cited_paper_title: z.string(),
      raw_context: z.string(),
      section_name: z.string().optional(),
    }) 
  },
  output: { schema: CitationIntentSchema },
  prompt: `You are an expert academic-citation analyst performing a semantic classification. You will determine the primary reason a paper cites another, based *only* on the provided text context.

**Citing Paper (the one being written):** "{{citing_paper_title}}"
**Cited Paper (the one being referenced):** "{{cited_paper_title}}"
**Section of Citing Paper:** "{{section_name}}"
**Full Context of the Citation:** 
"""
{{{raw_context}}}
"""

---
**Your Task:**

1.  **Analyze the Full Context** to understand the relationship between the papers.
2.  **Classify the INTENT** into ONE of the following categories:
    *   \`motivation\`: The cited work is presented as having a limitation, problem, or a research gap that the citing paper aims to address. **This is the highest priority.** Look for phrases like "however, they do not consider," "a limitation is," "fails to address," or where a problem is described followed by the citation.
    *   \`limitation\`: The citing paper explicitly discusses a weakness or drawback of the cited work. (Similar to motivation, but may not be the primary driver for the new work).
    *   \`comparison\`: The citing paper compares its own results, methodology, or approach directly against the cited work (e.g., "outperforms [ref]", "in contrast to [ref]").
    *   \`methodology\`: The citing paper uses or directly adapts a method, algorithm, dataset, or tool from the cited work.
    *   \`extension\`: The citing paper builds upon, refines, or extends the work of the cited paper.
    *   \`background\`: The cited paper provides general context, definitions, or foundational knowledge (e.g., "Several studies have explored [ref]..."). This is the default if no other stronger intent is present.

3.  **Provide a Confidence Score** from 0.0 to 1.0 for your classification.

4.  **Extract a Context Snippet:** Select the best 1-3 sentences from the full context that most clearly support your chosen intent.

5.  **Provide Reasoning:** In 1-2 sentences, explain *why* you chose that intent, referencing the text.

6.  **Summarize Research Gap (Motivation Intent ONLY):** If and only if the intent is \`motivation\` and your confidence is high (> 0.75), provide a 1-2 sentence, crisp, and actionable summary of the research gap identified.

**Return your analysis in the specified JSON format.** If the context is ambiguous or a clear intent cannot be determined, classify the intent as 'uncertain' with a low confidence score.`,
});

/**
 * Analyzes the intent behind a citation by examining the context.
 * Implements quality guardrails from the 10-step plan.
 */
export async function analyzeCitationIntent(
  raw_context: string,
  cited_paper_title: string,
  citing_paper_title: string,
  section_name?: string
): Promise<CitationIntent | null> {
    
    // Guardrail: check for minimal context length
    if (raw_context.length < 50) {
        console.log("  - ⚠️ Skipping intent analysis: context is too short.");
        return null;
    }

    try {
        // Get a fresh prompt instance bound to the current client
        const citationIntentPrompt = getCitationIntentPrompt();
        
        const { output } = await callWithRetry(() => 
            citationIntentPrompt({
                raw_context,
                cited_paper_title,
                citing_paper_title,
                section_name,
            })
        );
        
        const finalOutput = output as CitationIntent | null;

        if (!finalOutput) {
            throw new Error('AI failed to analyze citation intent');
        }
        
        // Guardrail: Apply confidence threshold
        if (finalOutput.confidence < 0.6) {
            console.log(`  - ⚠️ Low confidence (${finalOutput.confidence}) for intent. Marking as 'uncertain'.`);
            return {
                ...finalOutput,
                intent: 'uncertain',
                research_gap_summary: undefined, // Ensure no gap summary for low-confidence results
                section_name: section_name,
            };
        }
        
        // Guardrail: Ensure research gap summary only exists for 'motivation' intent
        if (finalOutput.intent !== 'motivation' && finalOutput.research_gap_summary) {
            finalOutput.research_gap_summary = undefined;
        }

        return { ...finalOutput, section_name: section_name };

    } catch (error) {
        console.error('  - ❌ Citation intent analysis failed:', error);
        return null; // Return null on failure to be handled by the calling flow
    }
}

    