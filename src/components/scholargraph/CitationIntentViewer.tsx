'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronDown, 
  ChevronRight, 
  BookOpen, 
  Target, 
  TrendingUp, 
  Scale, 
  Wrench, 
  AlertTriangle,
  Lightbulb,
  FileText,
  HelpCircle
} from 'lucide-react';

interface CitationIntentData {
  citation_intent?: 'background' | 'motivation' | 'extension' | 'comparison' | 'methodology' | 'limitation' | 'uncertain';
  citation_confidence?: number;
  citation_context?: string;
  citation_section?: 'introduction' | 'related_work' | 'methodology' | 'experiments' | 'discussion' | 'conclusion' | 'other';
  citation_reasoning?: string;
}

interface CitationIntentViewerProps {
  fromPaper: string;
  toPaper: string;
  citationData: CitationIntentData;
}

const intentIcons = {
  background: BookOpen,
  motivation: Target,
  extension: TrendingUp,
  comparison: Scale,
  methodology: Wrench,
  limitation: AlertTriangle,
  uncertain: HelpCircle,
};

const intentColors = {
  background: 'bg-blue-100 text-blue-800 border-blue-200',
  motivation: 'bg-green-100 text-green-800 border-green-200',
  extension: 'bg-purple-100 text-purple-800 border-purple-200',
  comparison: 'bg-orange-100 text-orange-800 border-orange-200',
  methodology: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  limitation: 'bg-red-100 text-red-800 border-red-200',
  uncertain: 'bg-gray-100 text-gray-800 border-gray-200',
};

const sectionColors = {
  introduction: 'bg-slate-100 text-slate-700 border-slate-200',
  related_work: 'bg-amber-100 text-amber-700 border-amber-200',
  methodology: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  experiments: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  discussion: 'bg-violet-100 text-violet-700 border-violet-200',
  conclusion: 'bg-rose-100 text-rose-700 border-rose-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200',
};

export function CitationIntentViewer({ fromPaper, toPaper, citationData }: CitationIntentViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullContext, setShowFullContext] = useState(false);

  const {
    citation_intent,
    citation_confidence,
    citation_context,
    citation_section,
    citation_reasoning
  } = citationData;

  if (!citation_intent) {
    return (
      <Card className="border-dashed border-gray-300 bg-gray-50">
        <CardContent className="p-4 text-center text-gray-500">
          <FileText className="mx-auto h-8 w-8 mb-2" />
          <p>Citation intent not analyzed</p>
        </CardContent>
      </Card>
    );
  }

  const IntentIcon = intentIcons[citation_intent] || HelpCircle;
  const confidencePercentage = citation_confidence ? Math.round(citation_confidence * 100) : 0;

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IntentIcon className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">
              Citation Intent: {citation_intent.charAt(0).toUpperCase() + citation_intent.slice(1)}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={intentColors[citation_intent]}>
              {confidencePercentage}% confidence
            </Badge>
            {citation_section && (
              <Badge className={sectionColors[citation_section as keyof typeof sectionColors] || sectionColors.other}>
                {citation_section.replace('_', ' ')}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          <span className="font-medium">{fromPaper}</span>
          <span className="mx-2">→</span>
          <span className="font-medium">{toPaper}</span>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Context Snippet */}
            {citation_context && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-600" />
                  <h4 className="font-medium text-sm">Citation Context</h4>
                </div>
                <div className="bg-gray-50 p-3 rounded-md text-sm">
                  {showFullContext ? citation_context : citation_context.substring(0, 200)}
                  {citation_context.length > 200 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-blue-600"
                      onClick={() => setShowFullContext(!showFullContext)}
                    >
                      {showFullContext ? 'Show less' : '...Show more'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {citation_reasoning && (
              <div>
                <h4 className="font-medium text-sm mb-2">AI Reasoning</h4>
                <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded-md">
                  {citation_reasoning}
                </p>
              </div>
            )}

            {/* Intent Explanation */}
            <div>
              <h4 className="font-medium text-sm mb-2">What this means:</h4>
              <div className="text-sm text-gray-700">
                {citation_intent === 'motivation' && (
                  <p className="bg-green-50 p-3 rounded-md border-l-4 border-l-green-400">
                    <strong>Research Gap Identified:</strong> This citation indicates that the cited paper 
                    identifies a problem or limitation that motivates the current research. This is crucial 
                    for understanding the research landscape and identifying opportunities for new contributions.
                  </p>
                )}
                {citation_intent === 'background' && (
                  <p className="bg-blue-50 p-3 rounded-md border-l-4 border-l-blue-400">
                    <strong>Foundational Knowledge:</strong> This citation provides background information, 
                    definitions, or establishes the research field context. It helps readers understand 
                    the foundation upon which the current work builds.
                  </p>
                )}
                {citation_intent === 'extension' && (
                  <p className="bg-purple-50 p-3 rounded-md border-l-4 border-l-purple-400">
                    <strong>Work Extension:</strong> This citation shows that the current work extends, 
                    improves, or applies the cited paper's approach to new domains or problems.
                  </p>
                )}
                {citation_intent === 'comparison' && (
                  <p className="bg-orange-50 p-3 rounded-md border-l-4 border-l-orange-400">
                    <strong>Benchmark Comparison:</strong> This citation is used to compare performance, 
                    evaluate approaches, or benchmark results against the cited work.
                  </p>
                )}
                {citation_intent === 'methodology' && (
                  <p className="bg-indigo-50 p-3 rounded-md border-l-4 border-l-indigo-400">
                    <strong>Methodology Reference:</strong> This citation references the methods, techniques, 
                    or approaches from the cited paper that are being used or adapted.
                  </p>
                )}
                {citation_intent === 'limitation' && (
                  <p className="bg-red-50 p-3 rounded-md border-l-4 border-l-red-400">
                    <strong>Limitation Discussion:</strong> This citation discusses the limitations or 
                    shortcomings of the cited work, often to motivate improvements or alternative approaches.
                  </p>
                )}
                 {citation_intent === 'uncertain' && (
                  <p className="bg-gray-50 p-3 rounded-md border-l-4 border-l-gray-400">
                    <strong>Uncertain Intent:</strong> The AI could not determine a clear, primary intent 
                    for this citation based on the available context. It may serve multiple purposes or be a simple acknowledgement.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

    