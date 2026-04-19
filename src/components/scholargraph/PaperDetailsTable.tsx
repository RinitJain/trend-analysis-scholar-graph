
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import type { GraphData, GraphNode } from '@/lib/types';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';

interface PaperDetailsTableProps {
  data: GraphData;
}

const AnalysisDetail = ({ label, value }: { label: string, value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">{label}</h4>
      <p className="text-sm text-foreground/90">{value}</p>
    </div>
  );
};

export function PaperDetailsTable({ data }: PaperDetailsTableProps) {
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleNodeHighlight = (event: Event) => {
        const customEvent = event as CustomEvent;
        const { nodeId } = customEvent.detail as { nodeId: string };
        if (!nodeId) return;

        setHighlightedNodeId(nodeId);
        // Automatically expand the row when highlighted
        setExpandedRows(prev => new Set(prev).add(nodeId)); 
        
        const timer = setTimeout(() => setHighlightedNodeId(null), 3000);
        return () => clearTimeout(timer);
    };
    
    document.addEventListener('highlight-paper-row', handleNodeHighlight);
    
    return () => {
        document.removeEventListener('highlight-paper-row', handleNodeHighlight);
    };
  }, []);

  const toggleRow = (nodeId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const sortedNodes = useMemo(() => {
      return [...data.nodes].sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [data.nodes]);


  if (!sortedNodes || sortedNodes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>No papers found in this graph.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead className="sticky top-0 bg-card">Paper Title</TableHead>
                <TableHead className="sticky top-0 bg-card">Year</TableHead>
                <TableHead className="sticky top-0 bg-card">Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedNodes.map((node) => {
                const isHighlighted = highlightedNodeId === node.id;
                const isExpanded = expandedRows.has(node.id);
                const hasAnalysis = !!node.analysis;

                return (
                  <React.Fragment key={node.id}>
                    <TableRow
                      id={`paper-row-${node.id}`}
                      className={cn('transition-colors duration-500', isHighlighted && 'bg-accent/20')}
                    >
                      <TableCell>
                        {hasAnalysis && (
                          <Button variant="ghost" size="icon" onClick={() => toggleRow(node.id)} className="h-8 w-8">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium max-w-md truncate">
                        <a href={node.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-primary hover:underline" title={node.id}>
                          {node.id}
                          <ExternalLink className="h-4 w-4 flex-shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell>{node.year}</TableCell>
                      <TableCell>
                        {node.accuracy !== null ? 
                          `${node.accuracy.toFixed(2)}% (${node.primary_metric || 'score'})` : 
                          'N/A'
                        }
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasAnalysis && (
                      <TableRow className={cn(isHighlighted && 'bg-accent/20', 'bg-muted/30 hover:bg-muted/30')}>
                        <TableCell colSpan={4} className="p-0">
                          <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
                              <AnalysisDetail label="Research Problem" value={node.analysis?.research_problem} />
                              <AnalysisDetail label="Technique" value={node.analysis?.technique} />
                              <AnalysisDetail label="Evaluation Result" value={node.analysis?.evaluation_result} />
                              <AnalysisDetail label="Identified Research Gap" value={node.analysis?.research_gap} />
                              <AnalysisDetail label="Limitations & Scope" value={node.analysis?.limitation_scope} />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
