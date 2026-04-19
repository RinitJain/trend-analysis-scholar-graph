
'use client';

import { useState } from 'react';
import { runLeaderboardTester } from '@/app/debug/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, TestTube2, AlertCircle, FileText, Bot, ListChecks, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '../ui/scroll-area';

export const LeaderboardTester = () => {
    const [leaderboardUrl, setLeaderboardUrl] = useState('https://paperswithcode.com/sota/text-to-sql-on-spider');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleTest = async () => {
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            const res = await runLeaderboardTester(leaderboardUrl);
            setResult(res);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const ResultAccordion = ({ title, icon, data }: { title: string, icon: React.ReactNode, data: any }) => (
      <AccordionItem value={title}>
        <AccordionTrigger>
          <div className="flex items-center gap-3">
            {icon}
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <ScrollArea className="h-96 rounded-md border bg-muted">
            <pre className="p-4 text-xs">{JSON.stringify(data, null, 2)}</pre>
          </ScrollArea>
        </AccordionContent>
      </AccordionItem>
    );

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TestTube2 className="h-6 w-6 text-primary" />
            <CardTitle>End-to-End Leaderboard Tester</CardTitle>
          </div>
          <CardDescription>
            Enter a leaderboard URL to test the full data extraction pipeline: scrape raw data, structure with AI, resolve PDFs, and normalize scores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              value={leaderboardUrl}
              onChange={(e) => setLeaderboardUrl(e.target.value)}
              placeholder="https://paperswithcode.com/sota/..."
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test Full Pipeline
            </Button>
          </div>
           {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Leaderboard Tester Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {result && (
              <Card className="mt-4">
                  <CardHeader>
                      <CardTitle className="text-lg">Pipeline Results</CardTitle>
                      <CardDescription>Inspect the output of each stage of the data extraction process.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                       <ResultAccordion 
                          title="1. Raw Scraped Rows" 
                          icon={<ListChecks className="h-5 w-5 text-primary" />} 
                          data={result.rawRows} 
                       />
                       <ResultAccordion 
                          title="2. Structured AI Output" 
                          icon={<Bot className="h-5 w-5 text-primary" />} 
                          data={result.aiOutput} 
                       />
                       <AccordionItem value="final-models">
                          <AccordionTrigger>
                             <div className="flex items-center gap-3">
                               <CheckCircle className="h-5 w-5 text-primary" />
                               <h3 className="text-lg font-semibold">3. Final Processed Models</h3>
                             </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[30%]">Model Name</TableHead>
                                            <TableHead>Primary Metric</TableHead>
                                            <TableHead>Raw Score</TableHead>
                                            <TableHead>Normalized Score</TableHead>
                                            <TableHead>PDF Link</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {result.finalModels.map((model: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{model.model_name}</TableCell>
                                                <TableCell className="text-muted-foreground text-xs">{model.primary_metric || 'N/A'}</TableCell>
                                                <TableCell className="font-mono">{model.accuracy !== null ? model.accuracy.toFixed(2) : 'N/A'}</TableCell>
                                                <TableCell className="font-mono">{model.normalizedAccuracy !== null ? model.normalizedAccuracy.toFixed(4) : 'N/A'}</TableCell>
                                                <TableCell>
                                                    {model.pdf_url ? (
                                                        <Button variant="ghost" size="sm" asChild>
                                                            <Link href={model.pdf_url} target="_blank" rel="noopener noreferrer">
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                View PDF
                                                            </Link>
                                                        </Button>
                                                    ) : (
                                                        <span className="text-xs text-destructive">Not Found</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                          </AccordionContent>
                       </AccordionItem>
                    </Accordion>
                  </CardContent>
              </Card>
            )}
        </CardContent>
      </Card>
    );
};
