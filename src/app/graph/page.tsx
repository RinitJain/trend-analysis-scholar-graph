
// src/app/graph/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CitationGraph } from '@/components/scholargraph/CitationGraph';
import { CitationTable } from '@/components/scholargraph/CitationTable';
import { InsightGeneratorWrapper } from '@/components/scholargraph/InsightGeneratorWrapper';
import { GraphAnalytics } from '@/components/scholargraph/GraphAnalytics';
import { Book, Sparkles, ArrowUp, Loader2, Wrench, AlertCircle, Target, ListChecks, FileText, Bot } from 'lucide-react';
import type { GraphData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ResearchGapAnalyzer } from '@/components/scholargraph/ResearchGapAnalyzer';
import { PaperDetailsTable } from '@/components/scholargraph/PaperDetailsTable';

interface GraphDataResponse extends GraphData {
    error?: string;
}

interface PipelineStatus {
    status: 'pending' | 'complete' | 'error';
    topic?: string;
    error?: string;
}

// Loading state for when the page itself is loading, separate from the graph generation.
function PageLoadingState() {
    return (
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h2 className="text-2xl font-bold">Loading Visualization...</h2>
        </div>
    );
}

function GraphDisplay() {
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Text-to-SQL (Sample)";
  const [graphData, setGraphData] = useState<GraphDataResponse | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let isMounted = true;

    const fetchStatus = async () => {
        if (!isMounted) return;
        try {
            const statusResponse = await fetch(`/api/read-status?t=${new Date().getTime()}`);
            if (!isMounted) return;

            if (statusResponse.status === 404) {
                setPipelineStatus(null);
                if (intervalId) clearInterval(intervalId);
                return;
            }

             if (!statusResponse.ok) {
                throw new Error(`Failed to fetch status: ${statusResponse.statusText}`);
            }
            
            const status: PipelineStatus = await statusResponse.json();
            if (isMounted) setPipelineStatus(status);

            if (status.status === 'complete' || status.status === 'error') {
                if (intervalId) clearInterval(intervalId);
                const graphResponse = await fetch(`/api/read-graph?t=${new Date().getTime()}`);
                if (graphResponse.ok) {
                    const data: GraphDataResponse = await graphResponse.json();
                    if(isMounted) setGraphData(data);
                }
            } else if (status.status === 'pending' && !intervalId) {
                intervalId = setInterval(fetchStatus, 5000);
            }
        } catch (error) {
            console.error("Error fetching status:", error);
            if(isMounted) {
                setPipelineStatus({ status: 'error', error: 'Could not retrieve pipeline status.' });
            }
        } finally {
            if(isMounted) setInitialLoad(false);
        }
    };

    const fetchInitialGraph = async () => {
      try {
        const graphResponse = await fetch(`/api/read-graph?t=${new Date().getTime()}`);
        if(graphResponse.ok) {
          const data = await graphResponse.json();
          if(isMounted) {
            setGraphData(data);
            setInitialLoad(false);
          }
          return true;
        }
        return false;
      } catch {
        return false;
      }
    };
    
    const startMonitoring = async () => {
      const graphExists = await fetchInitialGraph();
      if (!graphExists) {
        fetchStatus();
      }
    };

    startMonitoring();

    return () => {
        isMounted = false;
        if(intervalId) {
            clearInterval(intervalId);
        }
    };
  }, [topic]);

  if (initialLoad) {
      return <PageLoadingState />;
  }
  
  if (pipelineStatus?.status === 'pending') {
    return (
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h2 className="text-2xl font-bold">Building Research Graph...</h2>
            <p className="max-w-md text-muted-foreground">
                Your research graph for "{pipelineStatus.topic || topic}" is being generated.
                This page will automatically update when it's ready. This may take a few minutes.
            </p>
        </div>
    );
  }

  if (pipelineStatus?.status === 'error' || graphData?.error) {
     return (
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Alert variant="destructive" className="max-w-lg">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Graph Generation Failed</AlertTitle>
                <AlertDescription>
                   <p>An error occurred while building the graph for "{pipelineStatus?.topic || topic}". Please try a different topic or check the debug logs.</p>
                   <p className="mt-2 text-xs text-muted-foreground/80">Error: {pipelineStatus?.error || graphData?.error}</p>
                </AlertDescription>
            </Alert>
        </div>
    );
  }
  
  if (!graphData) {
      return (
         <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Alert className="max-w-lg">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Data Found</AlertTitle>
                <AlertDescription>
                   No existing graph was found. Please start a new search to generate one.
                </AlertDescription>
            </Alert>
        </div>
      );
  }
  
  const hasData = graphData.nodes.length > 0;

  return (
    <>
      {hasData ? (
        <div className="mx-auto max-w-screen-2xl flex flex-col gap-12 p-4 pt-8 md:p-8">
          <section id="analytics-section">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">Analytics for "{topic}"</h2>
            <p className="mb-6 max-w-2xl text-muted-foreground">
              A high-level overview of the research landscape based on the generated citation data.
            </p>
            <GraphAnalytics data={graphData} />
          </section>

          <section id="graph-section">
            <h2 className="mb-4 text-3xl font-bold tracking-tight">Citation Graph</h2>
            <p className="mb-6 max-w-2xl text-muted-foreground">
              Visualizing the evolution of research. Each node is a paper, plotted by publication year and accuracy. Lines represent citations. Hover over nodes for details and click edges to highlight citations in the table below.
            </p>
            <CitationGraph data={graphData} />
          </section>

          <div className="grid md:grid-cols-2 gap-8">
            <section id="insights-section">
              <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold tracking-tight">
                <Sparkles className="h-7 w-7 text-accent" />
                AI-Generated Insights
              </h2>
              <p className="mb-6 max-w-2xl text-muted-foreground">
                Generate a detailed 13-point analysis of all papers in the graph.
              </p>
              <InsightGeneratorWrapper graphData={graphData} topic={topic} />
            </section>
            <section id="trends-section">
              <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold tracking-tight">
                <Bot className="h-7 w-7 text-accent" />
                Extrapolate Trends
              </h2>
              <p className="mb-6 max-w-2xl text-muted-foreground">
                Use AI to analyze the entire landscape and predict future research directions.
              </p>
              <Button asChild className="w-full md:w-auto">
                <Link href={`/trends?topic=${encodeURIComponent(topic)}`}>View Predicted Trends</Link>
              </Button>
            </section>
          </div>
          
          {graphData?.edges.some(e => e.citation_intent === 'motivation') && (
              <section id="gaps-section">
                 <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold tracking-tight">
                    <Target className="h-7 w-7 text-accent" />
                    Research Gap Analysis
                </h2>
                <p className="mb-6 max-w-2xl text-muted-foreground">
                    Automatically identifying research opportunities where newer papers cite older ones to state a problem or motivation.
                </p>
                <ResearchGapAnalyzer edges={graphData.edges} nodes={graphData.nodes} />
              </section>
          )}

          <section id="paper-details-section">
            <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold tracking-tight">
              <FileText className="h-7 w-7 text-primary" />
              Paper Details
            </h2>
            <p className="mb-6 max-w-2xl text-muted-foreground">
              A detailed list of all papers in the graph with their AI-generated analysis. Click a node on the graph to jump to its corresponding entry.
            </p>
            <PaperDetailsTable data={graphData} />
          </section>

          <section id="citations-table-section">
            <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold tracking-tight">
              <ListChecks className="h-7 w-7 text-primary" />
              Citation Intent Analysis
            </h2>
            <p className="mb-6 max-w-2xl text-muted-foreground">
              A detailed list of all citations in the graph. Click an edge on the graph to jump to its corresponding entry.
            </p>
            <CitationTable data={graphData} />
          </section>

          <Link href="#graph-section" passHref>
            <Button
              variant="outline"
              size="icon"
              className="fixed bottom-8 right-8 z-50 h-12 w-12 rounded-full shadow-lg"
              aria-label="Scroll to graph"
            >
              <ArrowUp className="h-6 w-6" />
            </Button>
          </Link>
        </div>
      ) : (
         <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Alert className="max-w-lg">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Data Found</AlertTitle>
                <AlertDescription>
                   We couldn't find any papers or leaderboard data for the topic "{topic}". Please try a different or more specific topic.
                </AlertDescription>
            </Alert>
        </div>
      )}
    </>
  );
}


export default function GraphPage() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-8">
        <div className="flex items-center gap-2">
          <Book className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">ScholarGraph</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/">New Search</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" title="Debug Pipeline">
            <Link href="/debug"><Wrench className="h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      <main>
        <Suspense fallback={<PageLoadingState />}>
          <GraphDisplay />
        </Suspense>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ScholarGraph. All rights reserved.</p>
      </footer>
    </div>
  );
}
