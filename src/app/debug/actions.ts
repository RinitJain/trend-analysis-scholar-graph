

// src/app/debug/actions.ts
'use server';

import { z } from 'zod';
import {
  AnalysisQuestion,
  AnalysisQuestionSchema,
  DatasetsOutputSchema,
  LeaderboardEntrySchema,
  LeaderboardOutputSchema,
  ModelSchema,
  PromptLeaderboardOutputSchema,
  PaperCacheEntry,
  GrobidOutput,
  PromptLeaderboardEntrySchema,
} from '@/lib/types';

import { getLeaderboardLinksFromGoogle, isLeaderboardCandidate } from '@/services/google-search';
import { fetchHtmlAuto, extractTruePaperTitle, fetchHtmlWithTimeout } from '@/services/scraper';
import { parseTable } from '@/services/parser';
import { resolvePdfUrlAndDateFromRow, scrapeArxivDate } from '@/services/pdf-resolver';
import { buildCitationGraph } from '@/ai/flows/build-citation-graph';
import { flattenLeaderboardModels, normalizeLeaderboardScores } from '@/services/graph-model-utils';
import { paperCache } from '@/services/in-memory-cache';
import { downloadPdf, extractDataFromPdf } from '@/services/grobid';
import { unlink } from 'fs/promises';
import * as cheerio from 'cheerio';
import { geminiKeyManager } from '@/lib/geminiKeyManager';


// --- AI Prompts (as defined in fetch-graph-data) ---

const datasetPrompt = geminiKeyManager.getClient().definePrompt({
    name: 'datasetPrompt_debug',
    input: { schema: z.object({ topic: z.string() }) },
    output: { schema: DatasetsOutputSchema },
    prompt: `You are a JSON-only expert researcher.

List all of the most relevant and popular benchmark datasets for the research topic: "{{topic}}".

Each dataset name should be:
- The canonical short name used in academic papers or leaderboard websites (e.g., "SQuAD", not "Stanford Question Answering Dataset").
- Avoid combined names, instead list them separately.
- Avoid including dataset descriptions inside the name field.
- Do not include version numbers unless essential (e.g., "SQuAD v2.0" is valid, but avoid "SQuAD 2.0 with Extra Questions").

Return JSON in the specified format.`,
});

const leaderboardPrompt = geminiKeyManager.getClient().definePrompt({
    name: 'leaderboardPrompt_debug',
    input: { schema: z.object({ rows: z.any(), url: z.string() }) },
    output: { schema: PromptLeaderboardOutputSchema },
    prompt: `You are a JSON-only agent responsible for cleaning and structuring academic leaderboard data.

You are given a list of rows extracted from an HTML table from the URL: {{url}}

Extracted rows:
{{{json rows}}}

Your task is to convert this data into a structured JSON format. Follow these rules precisely:
1.  **Extract Core Fields:** Identify and extract the 'rank', 'name', 'metrics', 'paper_title', 'code_url', 'result_url', and 'year'.
2.  **Clean the 'name' field:** The 'name' field should ONLY contain the name of the model or method. Remove any extra information like author names, affiliations, or dates (e.g., from "SuperBERT (Turing Corp, 2023)", extract only "SuperBERT").
3.  **Handle 'paper_title':** If a 'paper_title' field is not explicitly present in a row, look for a column named "Method" or "Model" that might contain the title. Sometimes, it's just a citation like "[Author et al. '24]". Extract this text as the 'paper_title'.
4.  **Do NOT create a separate 'extra_info' field.** All relevant information should be mapped to the core fields. Discard any columns that do not map to the defined schema (e.g., ignore 'Authors', 'Organization', 'Date' columns).
5.  **Populate 'final_leaderboard_used':** This object is mandatory. Populate it with the source URL and the platform name (e.g., "PapersWithCode", "Kaggle", "GitHub").
6.  **Handle Nulls:** If a field's value is not present or cannot be determined, set it to null. Do not invent data.

Return the cleaned data in the specified JSON format.`,
});

// Helper function to manage cache state for the debug pipeline
function initializeCache(initialState: PaperCacheEntry[] | null) {
    paperCache.clear();
    if (initialState) {
        paperCache.loadEntries(initialState);
    }
}


// --- Step-by-Step Server Actions ---

export async function runStep1_findDatasets(topic: string) {
  console.log(`[Debug Step 1] Asking AI for datasets for topic: "${topic}"`);
  const { output } = await datasetPrompt({ topic });
  const finalOutput = output as z.infer<typeof DatasetsOutputSchema> | null;
  if (!finalOutput || !finalOutput.datasets) {
    throw new Error('AI failed to return datasets.');
  }
  return { datasets: finalOutput.datasets.slice(0, 3) };
}

export async function runStep2_findLeaderboardUrl(datasetName: string) {
  console.log(`[Debug Step 2] Finding leaderboard URL for: "${datasetName}"`);
  const urls = (await getLeaderboardLinksFromGoogle(datasetName)).filter(isLeaderboardCandidate);
  if (urls.length === 0) {
    throw new Error(`Could not find any potential leaderboard URLs for "${datasetName}" from Google search.`);
  }
  const leaderboardUrl = urls[0];
  console.log(`[Debug Step 2] Found URL: ${leaderboardUrl}`);
  return { leaderboardUrl };
}

export async function runStep3_scrapeLeaderboard(url: string) {
    console.log(`[Debug Step 3] Scraping leaderboard from: "${url}"`);
    const html = await fetchHtmlAuto(url);
    const rows = parseTable(html, url);
    if (!rows || rows.length === 0) {
        throw new Error('Failed to parse any data rows from the table.');
    }
    console.log(`[Debug Step 3] Scraped ${rows.length} rows.`);
    return { scrapedRows: rows };
}

export async function runStep4_extractModels(rows: any[], url: string) {
    console.log(`[Debug Step 4] Asking AI to extract models from ${rows.length} rows.`);
    
    const BATCH_SIZE = 35;
    const allModels: z.infer<typeof PromptLeaderboardEntrySchema>[] = [];
    let finalLeaderboardMetadata: any = null;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        console.log(`  - Processing batch ${Math.floor(i / BATCH_SIZE) + 1}... (${batch.length} rows)`);

        try {
            const { output } = await leaderboardPrompt({ rows: batch, url });
            const leaderboard_data = output as z.infer<typeof PromptLeaderboardOutputSchema> | null;
            if (leaderboard_data && leaderboard_data.top_models) {
                allModels.push(...leaderboard_data.top_models);
                if (!finalLeaderboardMetadata) {
                    finalLeaderboardMetadata = leaderboard_data.final_leaderboard_used;
                }
            } else {
                console.warn(`  - AI failed to parse batch. Skipping.`);
            }
        } catch (e) {
             console.error(`  - AI failed on batch due to error: ${(e as Error).message}. Skipping.`);
        }
    }

    if (allModels.length === 0) {
        throw new Error('AI failed to extract any structured model data from the table rows.');
    }

    const finalOutput = {
        top_models: allModels,
        final_leaderboard_used: finalLeaderboardMetadata
    };

    console.log(`[Debug Step 4] Extracted ${allModels.length} models.`);
    return { extractedModels: finalOutput };
}

export async function runStep5_resolveAndCache(
    models: z.infer<typeof PromptLeaderboardEntrySchema>[], 
    datasetName: string, 
    initialCacheState: PaperCacheEntry[] | null
) {
    console.log(`[Debug Step 5] Resolving PDFs & Caching for ${models.length} models.`);
    initializeCache(initialCacheState);
    
    for (const model of models) {
        const alias = model.name;
        const existingPaper = paperCache.getPaperByAlias(alias);

        const newMetrics = {
            source: datasetName,
            primary_metric_name: model.primary_metric_name || null,
            primary_metric_value: model.primary_metric_value || null,
            values: model.metrics,
        };

        if (existingPaper) {
            console.log(`  - ✅ Cache HIT for alias "${alias}". Updating entry.`);
            paperCache.storeOrUpdatePaperInfo({
                ...existingPaper,
                aliases: [...new Set([...existingPaper.aliases, alias])],
                scraped_from: [...new Set([...existingPaper.scraped_from, datasetName])],
                metrics: [...existingPaper.metrics, newMetrics],
            });
        } else {
            console.log(`  - 🟡 Cache MISS for "${alias}". Resolving...`);
            const { pdfUrl, sourceUrl, publishedDate } = await resolvePdfUrlAndDateFromRow(model);
            if (pdfUrl && sourceUrl) {
                let trueTitle = model.paper_title || model.name;
                let titleExtractionUrl: string | null = sourceUrl;
                if (sourceUrl.toLowerCase().endsWith('.pdf')) {
                    if (sourceUrl.includes('arxiv.org/pdf/')) {
                        titleExtractionUrl = sourceUrl.replace('/pdf/', '/abs/').replace(/\.pdf$/i, '');
                    } else {
                        titleExtractionUrl = null;
                    }
                }
                
                try {
                    if (titleExtractionUrl) {
                        const trueTitleHtml = await fetchHtmlWithTimeout(titleExtractionUrl);
                        trueTitle = extractTruePaperTitle(trueTitleHtml, trueTitle);
                    }
                } catch (e) {
                     console.warn(`  - Could not extract true title for "${model.name}". Using fallback.`);
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
                console.log(`  - ❌ Could not resolve PDF/Source for "${alias}". Skipping.`);
            }
        }
    }

    const uniquePapers = paperCache.getAllEntries();
    const flattenedModels = flattenLeaderboardModels(uniquePapers);
    const normalizedModels = normalizeLeaderboardScores(flattenedModels);

    return {
        processedModels: normalizedModels,
        updatedCache: paperCache.getAllEntries(),
    };
}


export async function runStep6_buildGraph(models: z.infer<typeof ModelSchema>[], questions: AnalysisQuestion[]) {
    console.log(`[Debug Step 6] Building citation graph from ${models.length} models.`);
    // The debug step needs to provide questions, even if they are empty
    const graph = await buildCitationGraph(models, questions);
    console.log(`[Debug Step 6] Finished building graph with ${graph.nodes.length} nodes and ${graph.edges.length} edges.`);
    return { finalGraph: graph };
}


export async function runMiniGraphPipeline(urls: string[]) {
  if (!urls || urls.length === 0) {
    throw new Error('At least one PDF URL is required.');
  }
  
  const tempGrobidCache = new Map<string, GrobidOutput>();

  // Step 1: Pre-fetch titles to create a realistic model list
  const models: z.infer<typeof ModelSchema>[] = [];
  for (const [index, url] of urls.entries()) {
    let pdfPath: string | null = null;
    try {
      pdfPath = await downloadPdf(url);
      if (!pdfPath) {
        console.log(`  - ⚠️ PDF download failed for ${url}. Skipping.`);
        continue;
      }
      
      const placeholderTitle = `temp_title_for_${url}`;
      const grobidData = await extractDataFromPdf(pdfPath, placeholderTitle, tempGrobidCache);
      
      const title = grobidData.paperTitle || `Unknown Title for paper ${index + 1}`;
      
      models.push({
        title: title,
        pdf_url: url,
        accuracy: null,
        primary_metric: null,
        year: grobidData.publishedDate ? new Date(grobidData.publishedDate).getFullYear() : new Date().getFullYear(),
        model_name: title,
        source: url,
        publishedDate: grobidData.publishedDate,
        normalizedAccuracy: null,
      });

    } catch (error) {
      console.error(`  - ❌ Failed to pre-process PDF from "${url}":`, error);
    } finally {
      if (pdfPath) {
        await unlink(pdfPath).catch(err => console.error(`Failed to delete temp PDF ${pdfPath}:`, err));
      }
    }
  }

  if (models.length === 0) {
    throw new Error("Could not process any of the provided PDF URLs.");
  }
  
  // For the mini-pipeline, we'll use a fixed set of questions since we don't have a topic context.
  const fallbackQuestions: AnalysisQuestion[] = [
    { key: "researchProblem", question: "What is the core research problem this paper is trying to solve?" },
    { key: "technique", question: "What is the main technique, model architecture, or methodology proposed?" },
    { key: "evaluationResult", question: "Summarize the key quantitative and qualitative evaluation results." },
    { key: "researchGap", question: "What specific research gap from previous work does this paper explicitly state it is trying to fill?" },
    { key: "limitationScope", question: "What are the limitations of the proposed approach or suggestions for future work mentioned in the paper?" },
    { key: "benchmarks", question: "What benchmark datasets were used for evaluation?" },
    { key: "dataSynthesis", question: "What data augmentation or synthesis techniques were used, if any?" },
    { key: "evaluationMetrics", question: "What evaluation metrics (e.g., Accuracy, F1, BLEU) were used?" },
    { key: "modulesComponents", question: "What are the distinct modules, components, or stages of the proposed system?" },
    { key: "errorAnalysis", question: "Did the authors perform any error analysis? If so, what were the key findings?" },
    { key: "challenges", question: "What challenges in the field does this paper address?" },
    { key: "solutionCategories", question: "How does this paper categorize existing solutions or its own contribution?" },
    { key: "preprocessing", question: "What data preprocessing steps were performed?" },
    { key: "postprocessing", question: "What postprocessing steps were applied to the model's output?" },
    { key: "applicationsUseCases", question: "What are the specific applications and use cases mentioned for this research?" },
  ];

  const graph = await buildCitationGraph(models, fallbackQuestions);

  return { finalGraph: graph };
}


export async function runLeaderboardTester(leaderboardUrl: string) {
    // 1. Scrape raw rows
    const html = await fetchHtmlAuto(leaderboardUrl);
    const rawRows = parseTable(html, leaderboardUrl);
    if (!rawRows || rawRows.length === 0) {
        throw new Error('Failed to parse any data rows from the table.');
    }

    // 2. Get structured output from AI, using batching
    const BATCH_SIZE = 35;
    const allModels: z.infer<typeof PromptLeaderboardEntrySchema>[] = [];
    let finalLeaderboardMetadata: any = null;

    for (let i = 0; i < rawRows.length; i += BATCH_SIZE) {
        const batch = rawRows.slice(i, i + BATCH_SIZE);
        try {
            const { output } = await leaderboardPrompt({ rows: batch, url: leaderboardUrl });
            const leaderboard_data = output as z.infer<typeof PromptLeaderboardOutputSchema> | null;
            if (leaderboard_data && leaderboard_data.top_models) {
                allModels.push(...leaderboard_data.top_models);
                if (!finalLeaderboardMetadata) {
                    finalLeaderboardMetadata = leaderboard_data.final_leaderboard_used;
                }
            }
        } catch (e) {
            console.warn(`AI batch failed, skipping. Error: ${(e as Error).message}`);
        }
    }

    if (allModels.length === 0) {
        throw new Error('AI failed to extract structured model data from any batch.');
    }

    const validatedAiOutput = {
        top_models: allModels,
        final_leaderboard_used: finalLeaderboardMetadata
    };

    // 3. Resolve PDFs for each model
    const modelsWithPdfInfo = [];
    for (const model of validatedAiOutput.top_models) {
        const { pdfUrl, sourceUrl, publishedDate } = await resolvePdfUrlAndDateFromRow(model);
        modelsWithPdfInfo.push({
            ...model,
            pdf_url: pdfUrl,
            publishedDate: publishedDate,
        });
    }

    // 4. Flatten and normalize - THIS PART IS A SIMPLIFICATION for testing.
    // The real pipeline uses the cache.
    const uniquePapers = new Map<string, any>();
    for (const model of modelsWithPdfInfo) {
      const key = model.paper_title || model.name;
      if (!uniquePapers.has(key)) {
        uniquePapers.set(key, {
          true_title: key,
          aliases: [model.name],
          pdf_url: model.pdf_url,
          source_urls: [validatedAiOutput.final_leaderboard_used.source_url],
          scraped_from: [validatedAiOutput.final_leaderboard_used.source_platform],
          publishedDate: model.publishedDate,
          year: model.year,
          metrics: [{source: validatedAiOutput.final_leaderboard_used.source_platform, primary_metric_name: model.primary_metric_name, primary_metric_value: model.primary_metric_value, values: model.metrics}],
        });
      } else {
        const entry = uniquePapers.get(key);
        entry.metrics.push({source: validatedAiOutput.final_leaderboard_used.source_platform, primary_metric_name: model.primary_metric_name, primary_metric_value: model.primary_metric_value, values: model.metrics});
      }
    }
    
    const flattened = flattenLeaderboardModels(Array.from(uniquePapers.values()));
    const finalModels = normalizeLeaderboardScores(flattened);
    
    return {
        rawRows,
        aiOutput: validatedAiOutput,
        finalModels,
    };
}

export async function runScrapingTest(url: string) {
  console.log(`[Debug Scraping Test] Scraping URL: "${url}"`);
  if (!url) {
    throw new Error('URL is required.');
  }
  const html = await fetchHtmlAuto(url);
  const rows = parseTable(html, url);
  return { scrapedRows: rows };
}

export async function runGrobidAndDateTest(url: string) {
    if (!url) {
        throw new Error('Source URL is required.');
    }

    let resolvedPdfUrl = null;
    let resolvedDate = null;

    // Step 1: Scrape date from source page if possible (e.g., arXiv abstract page)
    const pageHtml = await fetchHtmlAuto(url);
    const dateFromPage = scrapeArxivDate(pageHtml);

    // Step 2: Resolve the PDF URL
    if (isPdfUrl(url)) {
        resolvedPdfUrl = url;
    } else {
        const convertedUrl = convertKnownPdfPatterns(url);
        if (convertedUrl) {
             resolvedPdfUrl = convertedUrl;
        } else {
            const bestLink = getBestPdfLink(extractLinksFromHtml(pageHtml, url), url);
            if (bestLink) {
                resolvedPdfUrl = convertKnownPdfPatterns(bestLink) || bestLink;
            }
        }
    }

    if (!resolvedPdfUrl) {
        return {
            sourceUrl: url,
            dateFromPage: dateFromPage || 'Not found',
            pdfUrl: 'Could not resolve PDF URL',
            grobidResult: 'Skipped, no PDF URL.',
        };
    }

    // Step 3: Run GROBID on the resolved PDF
    let grobidResult: any = 'GROBID processing failed.';
    let pdfPath: string | null = null;
    try {
        pdfPath = await downloadPdf(resolvedPdfUrl);
        const tempGrobidCache = new Map<string, GrobidOutput>();

        if (pdfPath) {
            try {
                grobidResult = await extractDataFromPdf(pdfPath, 'grobid_test', tempGrobidCache);
            } catch (e) {
                grobidResult = { error: (e as Error).message };
            }
        } else {
            grobidResult = 'PDF download failed.';
        }
    } finally {
        if (pdfPath) await unlink(pdfPath).catch(() => {});
    }


    // Step 4: Determine final date
    if (grobidResult.publishedDate) {
        resolvedDate = grobidResult.publishedDate;
    } else {
        resolvedDate = dateFromPage;
    }

    return {
        sourceUrl: url,
        dateFromPage: dateFromPage || 'Not found on page',
        resolvedPdfUrl,
        finalDate: resolvedDate || 'Not found',
        grobidResult,
    };
}
function isPdfUrl(url: string): boolean {
    try {
        const path = new URL(url).pathname;
        return path.toLowerCase().endsWith('.pdf');
    } catch {
        return false;
    }
}
function convertKnownPdfPatterns(url:string): string | null {
    if (url.includes('arxiv.org/abs/')) {
        const arxivId = url.split('arxiv.org/abs/').pop()?.replace(/\.pdf$/i, ''); // More robustly remove .pdf
        return arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : null;
    }

    if (url.includes('openreview.net/forum?id=')) {
        const paperId = new URL(url).searchParams.get('id');
        return paperId ? `https://openreview.net/pdf?id=${paperId}` : null;
    }

    // Handle ACL Anthology links (e.g., .../2020.findings-emnlp.438/)
    if (url.includes('aclanthology.org') && !url.endsWith('.pdf')) {
        // Avoid adding .pdf if it's already there
        const path = new URL(url).pathname;
        if (path.endsWith('/')) {
             return `${url.slice(0, -1)}.pdf`;
        }
        return `${url}.pdf`;
    }

    return null;
}
function getBestPdfLink(links: { url: string; text: string }[], baseUrl: string): string | null {
    if (!links.length) return null;

    const priorityDomains = [
        "arxiv.org", "aclweb.org", "openaccess.thecvf.com", "papers.nips.cc",
        "openreview.net", "ieeexplore.ieee.org", "aclanthology.org", "springer.com",
        "jmlr.org", "semanticscholar.org", "nature.com"
    ];

    const scoredLinks: { url: string; score: number }[] = [];

    for (const link of links) {
        let score = 0;
        const linkText = link.text.toLowerCase();
        const linkUrl = link.url.toLowerCase();

        if (linkUrl.endsWith(".pdf")) score += 100;
        if (linkText.includes("pdf") || linkText.includes("download")) score += 50;
        if (linkText.includes("paper") || linkText.includes("full text")) score += 25;
        if (linkUrl.includes("/pdf/") || linkUrl.includes("download")) score += 20;
        if (linkUrl.includes("supplementary") || linkText.includes("supp")) score -= 20;

        for (const domain of priorityDomains) {
            if (linkUrl.includes(domain)) score += 30;
        }

        if (score > 0) {
            try {
                const absoluteUrl = new URL(link.url, baseUrl).toString();
                scoredLinks.push({ url: absoluteUrl, score });
            } catch (e) {
                // Ignore invalid URL
            }
        }
    }

    if (!scoredLinks.length) {
         return null;
    }

    scoredLinks.sort((a, b) => b.score - a.score);
    return scoredLinks[0].url;
}
function extractLinksFromHtml(html: string, base_url: string): {url: string, text: string}[] {
    const $ = cheerio.load(html);
    const links: {url: string, text: string}[] = [];
    const seenUrls = new Set<string>();

    $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const linkText = $(el).text().trim();
        try {
            const absoluteUrl = new URL(href, base_url).toString();
            if (!seenUrls.has(absoluteUrl)) {
                links.push({ url: absoluteUrl, text: linkText });
                seenUrls.add(absoluteUrl);
            }
        } catch (e) {
            // Ignore invalid URLs
        }
    });
    return links;
}

    
