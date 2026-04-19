
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import type { GraphData, GraphNode, GraphEdge } from '@/lib/types';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CitationIntentViewer } from './CitationIntentViewer';

interface CitationTableProps {
  data: GraphData;
}

export function CitationTable({ data }: CitationTableProps) {
  const [highlightedEdgeKey, setHighlightedEdgeKey] = useState<string | null>(null);

  useEffect(() => {
    const handleEdgeHighlight = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { edgeKey } = customEvent.detail;
        if (!edgeKey) return;
        
        setHighlightedEdgeKey(edgeKey);
        const timer = setTimeout(() => setHighlightedEdgeKey(null), 3000);
        return () => clearTimeout(timer);
    };
    
    document.addEventListener('highlight-edge-row', handleEdgeHighlight);
    
    return () => {
        document.removeEventListener('highlight-edge-row', handleEdgeHighlight);
    };
  }, []);

  const uniqueEdges = useMemo(() => {
    const edgeMap = new Map<string, GraphEdge>();
    data.edges.forEach(edge => {
        if (!edge.from || !edge.to) return;
        const key = `${edge.from}->${edge.to}`;
        if (!edgeMap.has(key)) {
            edgeMap.set(key, edge);
        }
    });
    return Array.from(edgeMap.values());
  }, [data.edges]);


  if (uniqueEdges.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>No citation links were found between the papers in this graph.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky top-0 bg-card w-[30%]">Cited Paper (From)</TableHead>
                <TableHead className="sticky top-0 bg-card w-[30%]">Citing Paper (To)</TableHead>
                <TableHead className="sticky top-0 bg-card w-[40%]">Citation Intent Analysis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueEdges.map((edge) => {
                const fromNode = data.nodes.find(n => n.id === edge.from);
                const toNode = data.nodes.find(n => n.id === edge.to);

                if (!fromNode || !toNode) return null;

                const edgeKey = `${edge.from}->${edge.to}`;
                const isHighlighted = highlightedEdgeKey === edgeKey;

                return (
                  <TableRow
                    key={edgeKey}
                    id={`edge-row-${edgeKey}`}
                    className={cn('transition-colors duration-500', isHighlighted && 'bg-accent/20')}
                  >
                    <TableCell className="align-top py-4">
                      {fromNode ? (
                        <a href={fromNode.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 font-medium text-primary hover:underline">
                          {fromNode.id}
                          <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        </a>
                      ) : <span className="font-medium">{edge.from}</span>}
                    </TableCell>
                    <TableCell className="align-top py-4">
                       {toNode ? (
                        <a href={toNode.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 font-medium text-primary hover:underline">
                          {toNode.id}
                          <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        </a>
                      ) : <span className="font-medium">{edge.to}</span>}
                    </TableCell>
                    <TableCell className="align-top py-4">
                      <CitationIntentViewer fromPaper={edge.from} toPaper={edge.to} citationData={edge} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
