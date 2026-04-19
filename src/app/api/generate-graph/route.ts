// src/app/api/generate-graph/route.ts
import { fetchGraphData } from '@/ai/flows/fetch-graph-data';
import { buildCitationGraph } from '@/ai/flows/build-citation-graph';
import { generateDetailedSummary } from '@/ai/flows/generate-detailed-summary';
import { extrapolateResearchTrends } from '@/ai/flows/extrapolate-research-trends';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { createLogger } from '@/services/logger';
import { geminiKeyManager } from '@/lib/geminiKeyManager';
import { generateAnalysisQuestions } from '@/ai/flows/generate-analysis-questions';
import { extractDataFromPdf, downloadPdf } from '@/services/grobid';
import type { GrobidOutput } from '@/services/grobid';
import { unlink } from 'fs/promises';

export const dynamic = 'force-dynamic';
export const maxDuration = 900; 

async function runFullPipeline(topic: string) {
    const logger = createLogger();
    logger.log("START_PIPELINE", `🚀 Starting FULL PIPELINE: "${topic}"`);
    const graphFilePath = path.join(process.cwd(), 'citation_graph.json');
    const summaryFilePath = path.join(process.cwd(), 'detailed_summary.json');
    const trendsFilePath = path.join(process.cwd(), 'extrapolated_trends.json');
    const statusFilePath = path.join(process.cwd(), 'pipeline_status.json');
    const questionsFilePath = path.join(process.cwd(), 'analysis_questions.json');

    try {
        // 1. Fetch leaderboard
        logger.log("FETCH_DATA", `[1/5] Scraping leaderboards...`);
        const fetchedData = await fetchGraphData({ topic }, logger);
        const modelsWithPdfs = (fetchedData.flattened_models || []).filter(m => m.pdf_url);
        if (modelsWithPdfs.length === 0) throw new Error("No papers with PDFs found.");

        // 2. Discover Pass: Extract Abstracts
        logger.log("INITIAL_GROBID_PASS", `[2/5] Extracting abstracts for question generation...`);
        const grobidCache = new Map<string, GrobidOutput>();
        const abstracts: string[] = [];
        for (const model of modelsWithPdfs) {
            let pdfPath: string | null = null;
            try {
                pdfPath = await downloadPdf(model.pdf_url!);
                if (!pdfPath) continue;
                const data = await extractDataFromPdf(pdfPath, model.title!, grobidCache);
                if (data.abstract) abstracts.push(data.abstract);
            } catch (e) {
                console.error(`- ⚠️ Failed discovery for ${model.title}`);
            } finally {
                if (pdfPath) await unlink(pdfPath).catch(() => {});
            }
        }
        if (abstracts.length === 0) throw new Error("Could not extract any abstracts.");

        // 3. Generate 15 Dynamic Questions
        logger.log("GENERATE_QUESTIONS", `[3/5] Generating 15 topic-specific analysis questions...`);
        const analysisQuestions = await generateAnalysisQuestions(topic, abstracts);
        await fs.writeFile(questionsFilePath, JSON.stringify(analysisQuestions, null, 2));

        // 4. Build Citation Graph (Dynamic Analysis)
        logger.log("BUILD_GRAPH", `[4/5] Building graph & performing 15-point analysis...`);
        const graphData = await buildCitationGraph(modelsWithPdfs, analysisQuestions);
        await fs.writeFile(graphFilePath, JSON.stringify(graphData, null, 2));
        
        // 5. Synthesize Summary & Extrapolate Trends (Plateau Analysis)
        logger.log("GENERATE_SUMMARY_AND_TRENDS", `[5/5] Finalizing summary and predicting trends...`);
        const [summaryData, trendsData] = await Promise.all([
            generateDetailedSummary({ graphData, topic, analysisQuestions }),
            extrapolateResearchTrends({ graphData, topic }),
        ]);

        await fs.writeFile(summaryFilePath, JSON.stringify({ status: 'complete', ...summaryData }, null, 2));
        await fs.writeFile(trendsFilePath, JSON.stringify({ status: 'complete', ...trendsData }, null, 2));

        await fs.writeFile(statusFilePath, JSON.stringify({ status: 'complete', topic }));
        logger.log("END_PIPELINE", `🎉 Pipeline Complete for "${topic}"`);
        
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.log("PIPELINE_FAILURE", `❌ Failed: ${msg}`, "FAILURE");
        await fs.writeFile(statusFilePath, JSON.stringify({ status: 'error', error: msg }));
    } finally {
        revalidatePath('/graph');
        revalidatePath('/summary');
        revalidatePath('/trends');
    }
}

export async function POST(request: NextRequest) {
  const topic = request.nextUrl.searchParams.get('topic');
  if (!topic) return NextResponse.json({ error: 'Topic required' }, { status: 400 });
  runFullPipeline(topic).catch(console.error);
  return NextResponse.json({ message: 'Pipeline started' }, { status: 202 });
}
