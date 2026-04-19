
// src/app/api/debug-graph-data/route.ts
import { fetchGraphData } from '@/ai/flows/fetch-graph-data';
import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/services/logger';
import { paperCache } from '@/services/in-memory-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 900; 

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const topic = searchParams.get('topic');
  const logger = createLogger();

  if (!topic) {
    return NextResponse.json(
      { error: 'Topic query parameter is required.' },
      { status: 400 }
    );
  }

  try {
    // We don't need the result itself for this debug endpoint,
    // as the logger will capture everything.
    await fetchGraphData({ topic }, logger);
    
    // After the pipeline runs, dump the cache into the logs.
    logger.log("CACHE_DUMP", "Final state of the in-memory paper cache.", "INFO", paperCache.getAllEntries());
    
    // Return the captured logs as a structured JSON response.
    return NextResponse.json(logger.getLogs(), {
        headers: {
            'Content-Type': 'application/json'
        }
    });

  } catch (error) {
    console.error('Error in debug API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Add the final error to the logs and return them.
    logger.log("FATAL_ERROR", `The pipeline failed with an unrecoverable error.`, "FAILURE", { error: errorMessage });
    return NextResponse.json(logger.getLogs(), { status: 500 });
  }
}
