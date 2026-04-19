
'use client';

import { useState } from 'react';
import { runScrapingTest } from '@/app/debug/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, AlertCircle, VenetianMask } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

export const ScrapingTester = () => {
    const [url, setUrl] = useState('https://bird-bench.github.io/');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleTest = async () => {
        setLoading(true);
        setResult(null);
        setError(null);
        try {
            const res = await runScrapingTest(url);
            setResult(res.scrapedRows);
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
            <VenetianMask className="h-6 w-6 text-primary" />
            <CardTitle>Scraping Inspector</CardTitle>
          </div>
          <CardDescription>
            Enter a leaderboard URL to see the raw data extracted by the `parseTable` function. This is useful for debugging why certain links or data points might be missed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter a leaderboard URL..."
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Inspect
            </Button>
          </div>
           {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Scraping Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {result && (
              <Card className="mt-4">
                  <CardHeader>
                      <CardTitle className="text-lg">Raw Scraped Data</CardTitle>
                      <CardDescription>Found {result.length} rows. Inspect the `links` array inside cell objects.</CardDescription>
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
