'use server';

/**
 * @fileOverview An AI flow to generate dynamic, topic-specific analysis questions.
 */
import { config } from 'dotenv';
config();

import { z } from 'zod';
import { geminiKeyManager } from '@/lib/geminiKeyManager';
import { callWithRetry } from '@/lib/ai-utils';
import { AnalysisQuestionSchema, AnalysisQuestion } from '@/lib/types';

const AnalysisQuestionsOutputSchema = z.object({
  questions: z.array(AnalysisQuestionSchema).length(15),
});

export async function generateAnalysisQuestions(topic: string, abstracts: string[]): Promise<AnalysisQuestion[]> {
    console.log(`- 🧠 Generating topic-specific analysis questions for "${topic}"...`);
    
    const client = geminiKeyManager.getClient();
    const analysisQuestionGeneratorPrompt = client.definePrompt({
      name: 'analysisQuestionGeneratorPrompt',
      input: {
        schema: z.object({
          topic: z.string(),
          abstracts: z.array(z.string()),
        }),
      },
      output: { schema: AnalysisQuestionsOutputSchema },
      prompt: `You are an expert research analyst tasked with creating a set of insightful, topic-specific evaluation questions to assess academic papers in a research domain.

**Topic:** "{{topic}}"

**Task:**
Based on the provided abstracts, generate exactly 15 distinct and broadly applicable questions that a researcher could use to analyze or summarize any paper within this research area.  
The questions should be **topic-specific** (tailored to "{{topic}}") but **not paper-specific** — i.e., they should apply to multiple papers in this field, not reference details unique to a single one.

**Instructions:**
1. **Understand the Field:** Use the abstracts only to identify key themes, subtopics, and challenges of the field, not to ask about individual papers.
2. **Be Topic-Specific but Generalizable:**  
   For example, for "Text-to-SQL", ask questions like  
   - “What benchmark datasets are commonly used for evaluating Text-to-SQL models?”  
   - “How are input questions and database schemas encoded and decoded?”  
   rather than “How does Model X handle metadata in the BIRD benchmark?”
3. **Cover Core Dimensions:** Ensure your 15 questions include a mix of these aspects:
   * Core problem and proposed solution types.
   * Model architecture, components, or modules.
   * Encoding-decoding strategies or reasoning mechanisms (if relevant to the topic).
   * Datasets, benchmarks, and data preprocessing.
   * Data augmentation or synthesis techniques.
   * Evaluation metrics and error analysis.
   * Limitations, open problems, and future work.
   * Real-world applications or use cases.
4. **Format:** For each question, provide a short \`key\` in camelCase and the full \`question\`.

**Provided Abstracts:**
---
{{#each abstracts}}
- {{{this}}}
---
{{/each}}

Return a JSON object containing a "questions" array with exactly 15 items.`,
    });

    const runGeneration = async () => {
        const { output } = await analysisQuestionGeneratorPrompt({
            topic,
            abstracts,
        });
        return output as z.infer<typeof AnalysisQuestionsOutputSchema> | null;
    };

    const finalOutput = await callWithRetry(runGeneration);

    if (!finalOutput || finalOutput.questions.length !== 15) {
        throw new Error("AI failed to generate the required 15 analysis questions.");
    }
    
    console.log(`- ✅ Successfully generated ${finalOutput.questions.length} topic-specific questions.`);
    return finalOutput.questions;
}
