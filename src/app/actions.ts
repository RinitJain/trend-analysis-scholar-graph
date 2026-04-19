
'use server';

import { summarizeInsights } from '@/ai/flows/summarize-insights';
import { GraphDataSchema } from '@/lib/types';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import fs from 'fs/promises';
import path from 'path';

export async function searchAction(formData: FormData) {
  const topic = formData.get('topic') as string;
  if (topic) {
    const statusFilePath = path.join(process.cwd(), 'pipeline_status.json');
    const graphFilePath = path.join(process.cwd(), 'citation_graph.json');
    const summaryFilePath = path.join(process.cwd(), 'detailed_summary.json');
    const trendsFilePath = path.join(process.cwd(), 'extrapolated_trends.json');
    
    // CRITICAL FIX: Delete old result files BEFORE setting the new pending status.
    await fs.unlink(graphFilePath).catch(() => {}); // Delete old graph, ignore if it doesn't exist
    await fs.unlink(summaryFilePath).catch(() => {}); // Delete old summary
    await fs.unlink(trendsFilePath).catch(() => {}); // Delete old trends

    // Set status to pending.
    await fs.writeFile(statusFilePath, JSON.stringify({ status: 'pending', topic }), 'utf-8');

    // This background process now runs the entire pipeline.
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/api/generate-graph?topic=${encodeURIComponent(topic)}`, {
      method: 'POST',
    });
    
    // Revalidate paths to ensure client gets the new 'pending' status
    revalidatePath('/graph');
    revalidatePath('/summary');
    revalidatePath('/trends');
    
    // Redirect to the graph page. It will now correctly show a loading state.
    redirect(`/graph?topic=${encodeURIComponent(topic)}`);
  }
}

const actionInputSchema = z.object({
  graphData: GraphDataSchema,
  topic: z.string().min(3, 'Topic must be at least 3 characters long.'),
});

export async function generateInsightsAction(formData: FormData) {
  const rawFormData = {
    graphData: JSON.parse(formData.get('graphData') as string),
    topic: formData.get('topic') as string,
  };

  const validatedFields = actionInputSchema.safeParse(rawFormData);
  
  if (!validatedFields.success) {
    return {
      message: 'Invalid form data.',
      errors: validatedFields.error.flatten().fieldErrors,
      summary: null,
    };
  }

  // Fire off the background generation and redirect immediately
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'}/api/generate-summary`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(validatedFields.data),
  });

  redirect(`/summary?topic=${encodeURIComponent(validatedFields.data.topic)}`);
}
