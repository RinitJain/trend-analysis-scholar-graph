
// src/app/summary/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { DetailedAnalysisOutput, SynthesizedAnalyses, AnalysisQuestion } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, Wrench, Book, FileText, ListOrdered, Bot } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface SummaryDataResponse extends DetailedAnalysisOutput {
    status: 'pending' | 'complete' | 'error';
    error?: string;
}

function PageLoadingState() {
    return (
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h2 className="text-2xl font-bold">Loading Analysis...</h2>
        </div>
    );
}

function SummaryDisplay() {
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "Unknown Topic";
  const [summaryData, setSummaryData] = useState<SummaryDataResponse | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchData = async () => {
        try {
            const response = await fetch(`/api/read-summary?t=${new Date().getTime()}`);
            if (!response.ok) {
                if (response.status === 404) {
                    // 404 means the file doesn't exist, which implies generation is pending
                    setSummaryData({ status: 'pending' } as SummaryDataResponse);
                    return;
                };
                throw new Error(`Failed to fetch summary: ${response.statusText}`);
            }
            const data: SummaryDataResponse = await response.json();
            
            if (data.status === 'complete' || data.status === 'error') {
                setSummaryData(data);
                clearInterval(intervalId);
            } else {
                 setSummaryData(data); // This will be 'pending' state
            }
        } catch (error) {
            console.error(error);
            setSummaryData({ status: 'error', error: "Failed to load summary data." } as SummaryDataResponse);
            clearInterval(intervalId);
        }
    };

    fetchData();
    intervalId = setInterval(fetchData, 5000);

    return () => clearInterval(intervalId);
  }, []);

  if (!summaryData || summaryData.status === 'pending') {
    return (
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h2 className="text-2xl font-bold">Generating Detailed Analysis...</h2>
            <p className="max-w-md text-muted-foreground">
                The AI is analyzing the full text of each paper for "{topic}".
                This may take several minutes. The page will update automatically when ready.
            </p>
        </div>
    );
  }

  if (summaryData.status === 'error') {
     return (
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Alert variant="destructive" className="max-w-lg">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Analysis Generation Failed</AlertTitle>
                <AlertDescription>
                   <p>An error occurred while generating the analysis for "{topic}".</p>
                   <p className="mt-2 text-xs text-muted-foreground/80">Error: {summaryData.error}</p>
                </AlertDescription>
            </Alert>
        </div>
    );
  }
  
  // Defensive check to prevent rendering with incomplete data
  if (!summaryData || !summaryData.synthesizedAnalyses || !summaryData.analysisQuestions) {
      return (
        <div className="container mx-auto flex flex-col items-center justify-center gap-4 py-24 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h2 className="text-2xl font-bold">Waiting for Analysis...</h2>
            <p className="max-w-md text-muted-foreground">
                The research graph has been built. The detailed summary is now being generated.
            </p>
        </div>
      );
  }

  const { synthesizedAnalyses, overallSummary, paperReferenceList, analysisQuestions } = summaryData;

  return (
    <div className="container mx-auto max-w-5xl space-y-12 p-4 pt-8 md:p-8">
        <section>
            <h2 className="text-4xl font-bold tracking-tight">Detailed Analysis: {topic}</h2>
            <p className="mt-4 text-lg text-muted-foreground">
                A comprehensive breakdown of the research landscape based on a dynamic, {analysisQuestions.length}-point analysis of each paper, followed by high-level summaries with inline citations.
            </p>
        </section>

        {paperReferenceList && (
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                    <AccordionTrigger>
                        <div className="flex items-center gap-3">
                            <ListOrdered className="h-6 w-6 text-primary" />
                            <h3 className="text-xl font-semibold">References Used in this Analysis</h3>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ol className="list-decimal list-inside space-y-2 pl-4 text-sm text-muted-foreground">
                            {paperReferenceList.map(ref => (
                                <li key={ref.number}>
                                    <span className="font-semibold text-foreground">[{ref.number}]</span> {ref.title}
                                </li>
                            ))}
                        </ol>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        )}

        <div className="grid gap-8">
            {analysisQuestions.map(question => (
                <Card key={question.key}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <FileText className="h-6 w-6 text-primary" />
                             Synthesized View on: {question.question.split(" ").slice(0, 4).join(" ")}...
                        </CardTitle>
                        <CardDescription>{question.question}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                            {synthesizedAnalyses[question.key as keyof SynthesizedAnalyses] || "No synthesized analysis available for this question."}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
        
        <Separator />

        <section>
            <h2 className="text-3xl font-bold tracking-tight">Overall Summary</h2>
            <Card className="mt-4 border-primary">
                <CardContent className="p-6">
                    <p className="whitespace-pre-wrap text-foreground leading-relaxed">{overallSummary}</p>
                </CardContent>
            </Card>
        </section>
    </div>
  );
}


export default function SummaryPage() {
  const searchParams = useSearchParams();
  const topic = searchParams.get('topic') || "";

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
           <Button asChild variant="secondary">
            <Link href={`/graph?topic=${encodeURIComponent(topic)}`}>Back to Graph</Link>
          </Button>
          <Button asChild>
            <Link href={`/trends?topic=${encodeURIComponent(topic)}`}><Bot className="mr-2" />View Trends</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" title="Debug Pipeline">
            <Link href="/debug"><Wrench className="h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      <main>
        <Suspense fallback={<PageLoadingState />}>
          <SummaryDisplay />
        </Suspense>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ScholarGraph. All rights reserved.</p>
      </footer>
    </div>
  );
}

    