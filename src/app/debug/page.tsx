
// src/app/debug/page.tsx
'use client';

import { useState } from 'react';
import {
  runStep1_findDatasets,
  runStep2_findLeaderboardUrl,
  runStep3_scrapeLeaderboard,
  runStep4_extractModels,
  runStep5_resolveAndCache,
  runStep6_buildGraph,
} from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Beaker, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CitationAnalysisTester } from '@/components/scholargraph/CitationAnalysisTester';
import { LeaderboardTester } from '@/components/scholargraph/LeaderboardTester';
import { ScrapingTester } from '@/components/scholargraph/ScrapingTester';
import { Separator } from '@/components/ui/separator';
import type { PaperCacheEntry } from '@/lib/types';
import { GrobidTester } from '@/components/scholargraph/GrobidTester';


// Define the shape of the pipeline's state
interface PipelineState {
  topic: string;
  datasets: any[] | null;
  currentDatasetIndex: number;
  leaderboardUrl: string | null;
  scrapedRows: any[] | null;
  extractedModels: any | null; // Can be object with top_models
  processedModels: any[] | null;
  finalGraph: any | null;
  pipelineCache: PaperCacheEntry[] | null;
}

const initialState: PipelineState = {
  topic: 'Text-to-SQL',
  datasets: null,
  currentDatasetIndex: 0,
  leaderboardUrl: null,
  scrapedRows: null,
  extractedModels: null,
  processedModels: null,
  finalGraph: null,
  pipelineCache: null,
};

const ResultCard = ({ title, data }: { title: string; data: any }) => (
  <Card className="mt-4">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <pre className="p-4 bg-muted rounded-md overflow-x-auto text-sm">
        {JSON.stringify(data, null, 2)}
      </pre>
    </CardContent>
  </Card>
);

export default function DebugPage() {
  const [state, setState] = useState<PipelineState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const resetState = () => {
    setState({ ...initialState, topic: state.topic });
    setStep(1);
    setError(null);
  };

  const handleRunNextStep = async () => {
    setLoading(true);
    setError(null);
    try {
      if (step === 1) {
        const { datasets } = await runStep1_findDatasets(state.topic);
        setState({ ...state, datasets });
        setStep(2);
      } else if (step === 2) {
        if (!state.datasets || state.datasets.length === 0) throw new Error('No datasets found to process.');
        const dataset = state.datasets[state.currentDatasetIndex];
        const { leaderboardUrl } = await runStep2_findLeaderboardUrl(dataset.name);
        setState({ ...state, leaderboardUrl });
        setStep(3);
      } else if (step === 3) {
        if (!state.leaderboardUrl) throw new Error('No leaderboard URL to scrape.');
        const { scrapedRows } = await runStep3_scrapeLeaderboard(state.leaderboardUrl);
        setState({ ...state, scrapedRows });
        setStep(4);
      } else if (step === 4) {
        if (!state.scrapedRows || !state.leaderboardUrl) throw new Error('No scraped rows to process.');
        const { extractedModels } = await runStep4_extractModels(state.scrapedRows, state.leaderboardUrl);
        setState({ ...state, extractedModels });
        setStep(5);
      } else if (step === 5) {
        if (!state.extractedModels || !state.datasets) throw new Error('No extracted models to process.');
        const dataset = state.datasets[state.currentDatasetIndex];
        const { processedModels, updatedCache } = await runStep5_resolveAndCache(state.extractedModels.top_models, dataset.name, state.pipelineCache);
        setState({ ...state, processedModels, pipelineCache: updatedCache });
        setStep(6);
      } else if (step === 6) {
        if (!state.processedModels) throw new Error('No processed models to build graph from.');
        const { finalGraph } = await runStep6_buildGraph(state.processedModels);
        setState({ ...state, finalGraph });
        setStep(7); // End of pipeline
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const isPipelineComplete = step === 7;
  const isPipelineStarted = state.datasets !== null;

  const stepDescriptions: { [key: number]: { title: string; description: string } } = {
    1: { title: "Step 1: Find Datasets", description: "Use AI to find relevant benchmark datasets for the topic." },
    2: { title: "Step 2: Find Leaderboard URL", description: "Search Google for the official leaderboard URL for the first dataset." },
    3: { title: "Step 3: Scrape Leaderboard", description: "Fetch and parse the HTML table from the leaderboard URL." },
    4: { title: "Step 4: Extract Models from Table", description: "Use AI (in batches) to clean and structure the raw table data into a list of models." },
    5: { title: "Step 5: Resolve, Normalize & Cache", description: "For each model, find its true title & PDF, resolve aliases, normalize scores, and update the cache." },
    6: { title: "Step 6: Build Citation Graph", description: "Download PDFs, extract citations with GROBID, and construct the final graph using the cached data." },
    7: { title: "Pipeline Complete!", description: "All steps have been executed. You can review the final graph below." },
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Card>
            <CardHeader>
            <div className="flex items-center gap-2">
                <Beaker className="h-6 w-6 text-primary" />
                <CardTitle className="text-3xl">Pipeline Debugger</CardTitle>
            </div>
            <CardDescription>
                An interactive tool to run each step of the data acquisition and graph generation pipeline individually.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                <Input
                    value={state.topic}
                    onChange={(e) => setState({ ...initialState, topic: e.target.value })}
                    placeholder="Enter a research topic"
                    className="flex-1"
                    disabled={isPipelineStarted}
                />
                <Button onClick={resetState} variant="outline" disabled={!isPipelineStarted}>Reset</Button>
                </div>
                
                <div className="p-4 border rounded-lg bg-background">
                    <h3 className="font-semibold">{stepDescriptions[step].title}</h3>
                    <p className="text-sm text-muted-foreground">{stepDescriptions[step].description}</p>
                </div>

                <Button onClick={handleRunNextStep} disabled={loading || isPipelineComplete} className="w-full">
                {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executing...</>
                ) : (
                    isPipelineComplete ? 'Finished' : <><ChevronRight className="mr-2 h-4 w-4" /> Run Next Step</>
                )}
                </Button>

                {error && (
                <Alert variant="destructive">
                    <AlertTitle>Error in Step {step}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                )}

                <div className="space-y-4">
                {state.finalGraph && <ResultCard title="Final Graph Output" data={state.finalGraph} />}
                {state.processedModels && <ResultCard title="Step 5 Output: Processed & Normalized Models" data={state.processedModels} />}
                {state.pipelineCache && <ResultCard title="In-Memory Cache State" data={state.pipelineCache} />}
                {state.extractedModels && <ResultCard title="Step 4 Output: Extracted Models (Batched)" data={state.extractedModels} />}
                {state.scrapedRows && <ResultCard title="Step 3 Output: Scraped Table Rows" data={state.scrapedRows} />}
                {state.leaderboardUrl && <ResultCard title="Step 2 Output: Leaderboard URL" data={state.leaderboardUrl} />}
                {state.datasets && <ResultCard title="Step 1 Output: Found Datasets" data={state.datasets} />}
                </div>
            </div>
            </CardContent>
        </Card>
        
        <Separator />

        <ScrapingTester />
        
        <Separator />
        
        <LeaderboardTester />

        <Separator />
        
        <GrobidTester />
        
        <Separator />

        <CitationAnalysisTester />
      </div>
    </div>
  );
}

    
    