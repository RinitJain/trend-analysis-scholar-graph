
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Loader2, PartyPopper } from 'lucide-react';
import type { GraphData } from '@/lib/types';
import { useRouter } from 'next/navigation';


export function InsightGenerator({ graphData, topic }: { graphData: GraphData, topic: string }) {
  const router = useRouter();

  const handleNavigate = () => {
    router.push(`/summary?topic=${encodeURIComponent(topic)}`);
  };

  return (
    <Card>
        <CardHeader>
          <CardTitle>View Detailed Analysis</CardTitle>
          <CardDescription>
            The full 13-point analysis and synthesized summaries have already been generated for this topic. Click the button below to view the full report.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Powered by Genkit AI</p>
            <Button onClick={handleNavigate}>
              <PartyPopper className="mr-2 h-4 w-4" />
              View Full Analysis
            </Button>
        </CardFooter>
    </Card>
  );
}
