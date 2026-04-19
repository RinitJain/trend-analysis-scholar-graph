
'use server';

/**
 * @fileOverview A flow to fetch and process citation graph data based on a user-provided topic.
 *
 * - fetchGraphData - The main function that orchestrates the data fetching and processing pipeline.
 * - FetchGraphDataInput - The input type for the fetchGraphData function.
 * - FetchGraphDataOutput - The return type for the fetchGraphData function.
 */
import { config } from 'dotenv';
config();

import { z } from 'zod';
import { fetchHtmlAuto, extractTruePaperTitle, fetchHtmlWithTimeout } from '@/services/scraper';
import { parseTable } from '@/services/parser';
import { resolvePdfUrlAndDateFromRow } from '@/services/pdf-resolver';
import { flattenLeaderboardModels, normalizeLeaderboardScores } from '@/services/graph-model-utils';
import { getLeaderboardLinksFromGoogle, isLeaderboardCandidate } from '@/services/google-search';
import { 
    DatasetsOutputSchema, 
    FetchGraphDataInput, 
    FetchGraphDataInputSchema, 
    FetchGraphDataOutput, 
    FetchGraphDataOutputSchema, 
    LeaderboardEntrySchema,
    LeaderboardOutputSchema,
    PromptLeaderboardOutputSchema,
    PaperCacheEntry,
    PromptLeaderboardEntrySchema
} from '@/lib/types';
import { createLogger } from '@/services/logger';
import { paperCache } from '@/services/in-memory-cache';
import { geminiKeyManager } from '@/lib/geminiKeyManager';
import { callWithRetry } from '@/lib/ai-utils';


// --- Prompts ---

const getDatasetPrompt = () => geminiKeyManager.getClient().definePrompt({
    name: 'datasetPrompt',
    input: { schema: z.object({ topic: z.string() }) },
    output: { schema: DatasetsOutputSchema },
    // prompt: 'You are a JSON-only expert researcher. For the research topic: "{{topic}}", list only the name of the BIRD dataset.',
    prompt: `You are a JSON-only expert researcher.

List all of the most relevant and popular benchmark datasets for the research topic: "{{topic}}".

Each dataset name should be:
- The canonical short name used in academic papers or leaderboard websites (e.g., "SQuAD", not "Stanford Question Answering Dataset").
- Avoid combined names, instead list them separately.
- Avoid including dataset descriptions inside the name field.
- Do not include version numbers unless essential (e.g., "SQuAD v2.0" is valid, but avoid "SQuAD 2.0 with Extra Questions").
- For example, if the topic is 'NL to SQL', the datasets should be 'SPIDER', 'WIKISQL', 'BIRD', etc.
Return JSON in the specified format.`,

});

const getLeaderboardPrompt = () => geminiKeyManager.getClient().definePrompt({
  name: 'leaderboardPrompt',
  input: { schema: z.object({ rows: z.any(), url: z.string() }) },
  output: { schema: PromptLeaderboardOutputSchema },
  prompt: `You are a JSON-only agent responsible for cleaning and structuring academic leaderboard data.

You are given a list of rows extracted from an HTML table from the URL: {{url}}

Extracted rows:
{{{json rows}}}

Your task is to convert this data into a structured JSON format. Follow these rules precisely:

1.  **Extract Core Fields:** Identify 'rank', 'name', 'paper_title', 'code_url', 'result_url', and 'year'.
2.  **Identify Primary Metric:** Carefully examine the table columns. Determine which metric is the primary one used for ranking (e.g., "Execution Accuracy", "F1", "BLEU").
3.  **Populate Metric Fields:**
    -   \`primary_metric_name\`: The name of the main ranking metric.
    -   \`primary_metric_value\`: The numeric value of that metric. Extract only the number (e.g., from "85.2%", get 85.2).
    -   \`metrics\`: An object containing ALL other metric columns and their values.
4.  **Clean the 'name' field:** The 'name' field must ONLY contain the name of the model or method. Remove extra info like author names or dates.
5.  **Populate 'final_leaderboard_used':** This object is mandatory. Populate it with the source URL and the platform name (e.g., "PapersWithCode").
6. Return JSON matching the expected schema.`,
});


// --- Main Flow ---

export async function fetchGraphData(
  input: FetchGraphDataInput,
  debugLogger?: ReturnType<typeof createLogger>
): Promise<FetchGraphDataOutput> {
    const logger = debugLogger || createLogger(); // Use provided logger or create a new one
    return fetchGraphDataFlow({ input, logger });
}

const fetchGraphDataFlow = geminiKeyManager.getClient().defineFlow(
  {
    name: 'fetchGraphDataFlow',
    inputSchema: z.object({
        input: FetchGraphDataInputSchema,
        logger: z.any().optional(),
    }),
    outputSchema: FetchGraphDataOutputSchema,
  },
  async (flowInput: { input: FetchGraphDataInput; logger?: ReturnType<typeof createLogger> }): Promise<FetchGraphDataOutput> => {
    const { input, logger: providedLogger } = flowInput;
    const logger = providedLogger || createLogger();
    logger.log("START_PIPELINE", `Starting pipeline for topic: "${input.topic}"`);
    console.log(`🧠 Using Gemini Key: ${geminiKeyManager.getCurrentKey()}`);

    // Initialize the in-memory cache for this run
    paperCache.clear();

    logger.log("GET_DATASETS_FROM_AI", `📝 Asking AI for relevant datasets...`);
    
    const getDatasets = async () => {
        const datasetPrompt = getDatasetPrompt();
        const { output } = await datasetPrompt({ topic: input.topic });
        return output;
    };
    
    const datasetResult = await callWithRetry(getDatasets) as z.infer<typeof DatasetsOutputSchema> | null;
    
    if (!datasetResult) {
        logger.log("GET_DATASETS_FROM_AI", `AI failed to return datasets`, "FAILURE");
        throw new Error("Failed to get datasets from AI");
    }

    const raw_datasets = datasetResult.datasets || [];
    logger.log("GET_DATASETS_FROM_AI", `✅ AI returned ${raw_datasets.length} datasets.`, "SUCCESS");
    
    for (const [idx, d] of raw_datasets.entries()) {
      const datasetName = d.name;
      if (!datasetName) continue;
      logger.log("PROCESS_DATASET", `\n➡️  Processing Dataset ${idx + 1}/${raw_datasets.length}: ${datasetName}`);

      logger.log("FIND_LEADERBOARD_LINKS", `🔎 Finding leaderboard links...`);
      const urls = (await getLeaderboardLinksFromGoogle(datasetName, 3)).filter(isLeaderboardCandidate);
      logger.log("FIND_LEADERBOARD_LINKS", `✅ Found ${urls.length} potential leaderboard links.`, "SUCCESS");

      for (const url of urls) {
        logger.log("PROCESS_LEADERBOARD_URL", `  - Trying leaderboard URL: ${url}`);
        try {
          const html = await fetchHtmlAuto(url);
          const tableRows = parseTable(html, url);
          if (!tableRows || tableRows.length === 0) {
            logger.log("PARSE_TABLE", `  - ⚠️ No data rows found. Trying next link.`, "FAILURE");
            continue;
          }
          const allRows = tableRows;
          logger.log("PARSE_TABLE", `  - ✅ Parsed ${tableRows.length} rows from table, processing all of them.`, "SUCCESS");

          logger.log("EXTRACT_MODELS_WITH_AI", `  - 📝 Asking AI to structure leaderboard data (in batches if needed)...`);
          
          const BATCH_SIZE = 35;
          const allModels: z.infer<typeof PromptLeaderboardEntrySchema>[] = [];
          let finalLeaderboardMetadata: any = null;
          
          for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
              const batch = allRows.slice(i, i + BATCH_SIZE);
              logger.log("PROCESS_BATCH", `    - Processing batch ${Math.floor(i / BATCH_SIZE) + 1}... (${batch.length} rows)`);

              try {
                  const getLeaderboardData = async () => {
                      const leaderboardPrompt = getLeaderboardPrompt();
                      const { output } = await leaderboardPrompt({ rows: batch, url });
                      return output;
                  };

                  const leaderboard_data = await callWithRetry(getLeaderboardData) as z.infer<typeof PromptLeaderboardOutputSchema> | null;
                  
                  if (leaderboard_data) {
                      allModels.push(...leaderboard_data.top_models);
                      if (!finalLeaderboardMetadata) {
                          finalLeaderboardMetadata = leaderboard_data.final_leaderboard_used;
                      }
                  } else {
                      logger.log("EXTRACT_MODELS_WITH_AI_BATCH_FAIL", `    - ⚠️ AI failed to parse batch. Skipping.`, "FAILURE");
                  }
              } catch (e) {
                   logger.log("EXTRACT_MODELS_WITH_AI_BATCH_ERROR", `    - ⚠️ AI failed on batch due to error: ${(e as Error).message}. Skipping.`, "FAILURE");
              }
          }

          if (allModels.length > 0) {
            logger.log("EXTRACT_MODELS_WITH_AI", `  - ✅ AI successfully parsed ${allModels.length} models from leaderboard.`, "SUCCESS");
            
            logger.log("PDF_RESOLUTION_START", `  - 🔎 Resolving PDFs & consolidating data into cache for ${allModels.length} models...`);
              
            for(const model of allModels) {
                logger.log("PDF_RESOLUTION_MODEL", `    - Consolidating: "${model.name}"`);
                const alias = model.name;
                const existingPaper = paperCache.getPaperByAlias(alias);

                const newMetrics = {
                    source: datasetName,
                    primary_metric_name: model.primary_metric_name || null,
                    primary_metric_value: model.primary_metric_value || null,
                    values: model.metrics,
                };

                if (existingPaper) {
                    logger.log("CACHE_HIT", `      - ✅ Cache HIT for alias "${alias}". Updating entry.`);
                    paperCache.storeOrUpdatePaperInfo({
                        ...existingPaper,
                        aliases: [...new Set([...existingPaper.aliases, alias])],
                        scraped_from: [...new Set([...existingPaper.scraped_from, datasetName])],
                        metrics: [...existingPaper.metrics, newMetrics],
                    });
                } else {
                    logger.log("CACHE_MISS", `      - 🟡 Cache MISS for "${alias}". Resolving...`);
                    const resolved = await resolvePdfUrlAndDateFromRow(model);
                    if (!resolved) {
                        logger.log("PDF_RESOLVE_FAIL", `      - ⚠️ Could not resolve PDF for "${model.name}". Skipping.`);
                        continue;
                    }
                    const { pdfUrl, sourceUrl, publishedDate } = resolved;
                
                    if (pdfUrl && sourceUrl) {
                        logger.log("PDF_RESOLUTION_MODEL_SUCCESS", `      - Found PDF for "${model.name}"`);
                        
                        let titleExtractionUrl: string | null = sourceUrl;
                        if (sourceUrl.toLowerCase().endsWith('.pdf')) {
                            if (sourceUrl.includes('arxiv.org/pdf/')) {
                                titleExtractionUrl = sourceUrl.replace('/pdf/', '/abs/').replace(/\.pdf$/i, '');
                            } else {
                                titleExtractionUrl = null;
                            }
                        }

                        let trueTitle = model.paper_title || model.name;
                        try {
                            if (titleExtractionUrl) {
                                const trueTitleHtml = await fetchHtmlWithTimeout(titleExtractionUrl);
                                trueTitle = extractTruePaperTitle(trueTitleHtml, trueTitle);
                            }
                        } catch (e) {
                            logger.log("TITLE_EXTRACTION_FAIL", `      - ⚠️ Could not extract true title for "${model.name}". Using fallback.`, "FAILURE");
                        }
                        
                        const newPaperEntry: PaperCacheEntry = {
                            id: trueTitle,
                            true_title: trueTitle,
                            aliases: [alias],
                            pdf_url: pdfUrl,
                            source_urls: [sourceUrl],
                            scraped_from: [datasetName],
                            publishedDate: publishedDate,
                            year: model.year ?? null,
                            metrics: [newMetrics]
                        };
                        paperCache.storeOrUpdatePaperInfo(newPaperEntry);
                    } else {
                        logger.log("PDF_RESOLVE_FAIL", `      - ⚠️ Could not resolve PDF for "${model.name}". Skipping.`);
                    }
                }
            }
            
            logger.log("PROCESS_LEADERBOARD_URL", `✅ Processed and cached data from ${url}.`, "SUCCESS");
            break; 
          } else {
             logger.log("EXTRACT_MODELS_WITH_AI", `  - ⚠️ AI failed to parse any models from ${url}.`, "FAILURE");
          }
        } catch (e) {
          logger.log("PROCESS_LEADERBOARD_URL", `  - ⚠️ Skipping URL ${url} due to error: ${(e as Error).message}`, "FAILURE");
          continue;
        }
      }
    }
    
    const uniquePapers = paperCache.getAllEntries();
    logger.log("DE-DUPLICATION_COMPLETE", `\n✨ Found ${uniquePapers.length} unique papers across all leaderboards.`);

    const flattened_models = flattenLeaderboardModels(uniquePapers);
    const normalized_models = normalizeLeaderboardScores(flattened_models);

    logger.log("NORMALIZE_SCORES", `\n📊 Normalized scores for ${normalized_models.length} models.`);
    logger.log("END_PIPELINE", `\n✅ Finished fetching data. Returning ${normalized_models.length} processed models.`);
    
    const result: FetchGraphDataOutput = {
        datasets: [],
        flattened_models: normalized_models,
    };

    return result;
  }
);
