
'use client';

import { useState } from 'react';
import { runGrobidAndDateTest } from '@/app/debug/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileJson, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

export const GrobidTester = () => {
    const [sourceUrl, setSourceUrl] = useState('https://arxiv.org/abs/2308.15363');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleTest = async () => {
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            const res = await runGrobidAndDateTest(sourceUrl);
            setResult(res);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileJson className="h-6 w-6 text-primary" />
            <CardTitle>GROBID & Date Extraction Pipeline Tester</CardTitle>
          </div>
          <CardDescription>
            Enter a paper's source URL (e.g., an arXiv abstract page) to test the PDF resolution, date scraping, and GROBID processing pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://arxiv.org/abs/..."
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test Pipeline
            </Button>
          </div>
           {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Pipeline Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {result && (
              <Card className="mt-4">
                  <CardHeader>
                      <CardTitle className="text-lg">Pipeline Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96 rounded-md border bg-muted">
                        <pre className="p-4 text-xs">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </ScrollArea>
                  </CardContent>
              </Card>
            )}
        </CardContent>
      </Card>
    );
};
