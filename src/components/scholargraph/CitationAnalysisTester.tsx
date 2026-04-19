
'use client';

import { useState } from 'react';
import { runMiniGraphPipeline } from '@/app/debug/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Bot, AlertCircle, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '../ui/scroll-area';

const initialUrls = [
    "https://arxiv.org/pdf/2304.11015.pdf",
    "https://arxiv.org/pdf/2308.15363.pdf",
    "https://arxiv.org/pdf/2307.07306.pdf"
].join('\n');

export const CitationAnalysisTester = () => {
    const [urls, setUrls] = useState(initialUrls);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);

    const handleTest = async () => {
        setLoading(true);
        setResult(null);
        try {
            const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
            const res = await runMiniGraphPipeline(urlList);
            setResult(res);
        } catch (err: any) {
            setResult({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            <CardTitle>Mini Graph Pipeline Tester</CardTitle>
          </div>
          <CardDescription>
            Provide 2-4 direct PDF URLs (one per line) to run the full citation graph pipeline. This end-to-end test will download the papers, find citations *between them*, and run the AI intent analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="https://.../paper1.pdf&#10;https://.../paper2.pdf"
              className="flex-1 font-mono"
              rows={4}
            />
            <Button onClick={handleTest} disabled={loading} className="w-full">
              {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
              ) : (
                  <Play className="mr-2 h-4 w-4" />
              )}
              Run Mini Pipeline
            </Button>
          </div>
           {result?.error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Pipeline Error</AlertTitle>
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}
            {result && result.finalGraph && (
              <Card className="mt-4">
                  <CardHeader>
                      <CardTitle className="text-lg">Generated Graph Output</CardTitle>
                      <CardDescription>
                          The final graph object, including nodes and edges with citation intent analysis.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                     <ScrollArea className="h-96 rounded-md border bg-muted">
                        <pre className="p-4 text-xs">
                            {JSON.stringify(result.finalGraph, null, 2)}
                        </pre>
                    </ScrollArea>
                  </CardContent>
              </Card>
            )}
        </CardContent>
      </Card>
    );
};
