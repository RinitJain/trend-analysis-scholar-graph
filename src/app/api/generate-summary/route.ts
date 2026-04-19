
// src/app/api/generate-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { generateDetailedSummary } from '@/ai/flows/generate-detailed-summary';
import { DetailedAnalysisInputSchema } from '@/lib/types';


// This tells Next.js to not wait for the function to finish.
export const dynamic = 'force-dynamic';
export const maxDuration = 900; 

async function runSummaryGeneration(input: any) {
    const { topic, graphData } = DetailedAnalysisInputSchema.parse(input);

    console.log(`--- 🚀 Starting BACKGROUND Detailed Summary Generation for Topic: "${topic}" ---`);
    const filePath = path.join(process.cwd(), 'detailed_summary.json');

    try {
        // Clear the summary file first to ensure the UI shows a loading state.
        await fs.writeFile(filePath, JSON.stringify({ status: 'pending' }, null, 2), 'utf-8');
        console.log(`- Cleared detailed_summary.json to signal a new build.`);
        revalidatePath('/summary'); // Revalidate to show loading state

        
        const summaryData = await generateDetailedSummary({ graphData, topic });

        // Save the newly generated summary to the JSON file
        await fs.writeFile(filePath, JSON.stringify({ status: 'complete', ...summaryData }, null, 2), 'utf-8');
        
        console.log(`--- ✅ Finished BACKGROUND Detailed Summary Generation for Topic: "${topic}" ---`);
        
    } catch (error) {
        console.error(`--- ❌ CRITICAL: Background summary generation failed for topic "${topic}" ---`, error);
        const errorSummary = { status: 'error', error: (error as Error).message };
        await fs.writeFile(filePath, JSON.stringify(errorSummary, null, 2), 'utf-8');
    } finally {
        // Final revalidation to make sure the client gets the latest data (or error state).
        revalidatePath('/summary');
    }
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = DetailedAnalysisInputSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid input data.', details: validatedData.error.flatten() },
        { status: 400 }
      );
    }
    
    // Fire-and-forget: Start the process but don't wait for it to finish.
    runSummaryGeneration(validatedData.data).catch(error => {
        console.error(`--- ❌ CRITICAL: The runSummaryGeneration promise was rejected for topic "${validatedData.data.topic}" ---`, error);
    });

    // Respond immediately to the client.
    return NextResponse.json(
      { message: 'Summary generation started in the background.' },
      { status: 202 } // 202 Accepted
    );
  } catch (error) {
     return NextResponse.json(
        { error: 'Failed to parse request body.' },
        { status: 400 }
      );
  }
}
