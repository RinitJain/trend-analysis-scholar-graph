
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Book } from 'lucide-react';
import { SearchFormWrapper } from '@/components/scholargraph/SearchFormWrapper';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GrobidTester } from '@/components/scholargraph/GrobidTester';
import { Separator } from '@/components/ui/separator';

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm md:px-8">
        <div className="flex items-center gap-2">
          <Book className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">ScholarGraph</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Explore a Research Topic</CardTitle>
              <CardDescription>
                Enter a topic to generate a full analysis of its research landscape, from seminal papers to the latest breakthroughs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SearchFormWrapper />
              <div className="mt-4 text-center">
                  <Button variant="link" asChild>
                      <Link href="/graph?topic=Text-to-SQL+(Sample)">Or view a sample graph for "Text-to-SQL"</Link>
                  </Button>
              </div>
            </CardContent>
          </Card>
          
          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Citation Intent Analysis</CardTitle>
                <CardDescription>
                  Understand the "why" behind citations and identify research gaps
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href="/citation-intent">Explore Citation Intents</Link>
                </Button>
              </CardContent>
            </Card>

            <GrobidTester />
          </div>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} ScholarGraph. All rights reserved.</p>
      </footer>
    </div>
  );
}
