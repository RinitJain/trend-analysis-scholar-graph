
'use client';

import React from 'react';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Lightbulb, Search, ExternalLink } from 'lucide-react';
import type { GraphEdge, GraphNode } from '@/lib/types';

interface ResearchGapAnalyzerProps {
  edges: GraphEdge[];
  nodes: GraphNode[];
}

export function ResearchGapAnalyzer({ edges, nodes }: ResearchGapAnalyzerProps) {
  
  const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes]);

  const researchGaps = useMemo(() => {
    // 1. Filter for motivation intents with high confidence
    const motivationCitations = edges.filter(
        edge => edge.citation_intent === 'motivation' && (edge.citation_confidence ?? 0) >= 0.6
    );

    // 2. Group by the paper being cited (the source of the gap)
    const gaps = new Map<string, { citedPaper: string; citations: GraphEdge[]; strength: number }>();
    
    motivationCitations.forEach(edge => {
      if (!gaps.has(edge.from)) {
        gaps.set(edge.from, { citedPaper: edge.from, citations: [], strength: 0 });
      }
      const gap = gaps.get(edge.from)!;
      gap.citations.push(edge);
      gap.strength += 1;
    });

    // 3. Sort by strength (how many papers identified this gap)
    return Array.from(gaps.values()).sort((a, b) => b.strength - a.strength);
  }, [edges]);

  return (
    <div className="space-y-6">
      {researchGaps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Search className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
            <h3 className="font-semibold text-lg">No High-Confidence Research Gaps Found</h3>
            <p className="text-sm">The AI did not identify any citations with a "Motivation" intent, which are used to highlight research gaps.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {researchGaps.map((gap) => (
            <Card key={gap.citedPaper} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start gap-2">
                    <Target className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-semibold uppercase text-green-700">Identified Gap In</p>
                        <CardTitle className="text-base leading-snug">{gap.citedPaper}</CardTitle>
                    </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                    Strength: {gap.strength}
                  </Badge>
                  <Badge variant="secondary">
                    {gap.citations.length} Paper{gap.citations.length > 1 ? 's' : ''} Motivated
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1">
                <div className="space-y-3">
                    {gap.citations.map((citation, idx) => (
                        <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                           <div className="flex items-center gap-2 mb-1">
                             <Lightbulb className="h-4 w-4 text-primary" />
                             <h4 className="font-semibold text-sm text-foreground">
                               Motivated Paper: <a href={nodeMap.get(citation.to)?.pdf_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{citation.to}</a>
                             </h4>
                           </div>
                           <p className="text-xs text-muted-foreground pl-6 italic">
                             "{citation.research_gap_summary || citation.citation_context}"
                           </p>
                        </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

    