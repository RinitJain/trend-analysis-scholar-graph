
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import type { GraphData, GraphNode, GraphEdge } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, Database, Target, Lightbulb } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface CitationGraphProps {
  data: GraphData;
}

interface HoveredEdgeInfo {
    source: GraphNode;
    target: GraphNode;
    edge: GraphEdge;
}

const PADDING = 60;
const NODE_RADIUS = 8;
const TOOLTIP_WIDTH = 320; // 20rem

// Helper to convert date string or year to a Date object
const parseDate = (node: GraphNode): Date => {
  if (node.publishedDate) {
    const d = new Date(node.publishedDate);
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback: place in the middle of the year
  return new Date(node.year || 1970, 5, 15);
};

const NodeTooltip = ({ node, style }: { node: GraphNode; style: React.CSSProperties }) => (
    <div
      className="absolute w-80 rounded-lg border bg-popover p-4 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 pointer-events-none"
      style={style}
    >
      <h4 className="font-bold text-base">{node.id}</h4>
      <p className="text-sm text-muted-foreground">
        {node.publishedDate ? new Date(node.publishedDate).toLocaleDateString() : node.year}
      </p>
      <Separator className="my-2" />
      {node.accuracy !== null ? (
        <p className="text-sm">
          <span className="font-semibold text-accent-foreground">{node.accuracy?.toFixed(2)}%</span>
          <span className="text-muted-foreground"> {node.primary_metric || 'Accuracy'}</span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Performance: N/A</p>
      )}
      {node.scraped_from && node.scraped_from.length > 0 && (
        <>
            <Separator className="my-2" />
            <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Database className="h-3 w-3" />
                    Found On Leaderboards
                </p>
                <div className="flex flex-wrap gap-1">
                     {node.scraped_from.map(source => (
                        <span key={source} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{source.replace(/ Leaderboard/gi, '')}</span>
                     ))}
                </div>
            </div>
        </>
      )}
    </div>
);

const EdgeTooltip = ({ info, style }: { info: HoveredEdgeInfo; style: React.CSSProperties }) => (
    <Card
      className="absolute w-auto max-w-2xl rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 pointer-events-none"
      style={style}
    >
      <CardContent className="p-4 text-sm">
        <div className="flex items-start justify-center gap-4">
            <div className="w-56 space-y-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Cited Paper (Older)</p>
                <p className="font-bold">{info.source.id}</p>
            </div>
            <div className="flex-shrink-0 pt-4">
                <ArrowRight className="h-5 w-5 text-accent" />
            </div>
            <div className="w-56 space-y-1">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Citing Paper (Newer)</p>
                <p className="font-bold">{info.target.id}</p>
            </div>
        </div>
        <Separator className="my-3" />
        {/* Enhanced Citation Intent Display */}
        {info.edge.citation_intent ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Intent:</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                info.edge.citation_intent === 'motivation' ? 'bg-green-100 text-green-800 border border-green-200' :
                info.edge.citation_intent === 'limitation' ? 'bg-red-100 text-red-800 border border-red-200' :
                info.edge.citation_intent === 'background' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                info.edge.citation_intent === 'extension' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                info.edge.citation_intent === 'comparison' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                info.edge.citation_intent === 'methodology' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                'bg-gray-100 text-gray-800 border border-gray-200'
              }`}>
                {info.edge.citation_intent.charAt(0).toUpperCase() + info.edge.citation_intent.slice(1)}
              </span>
              {info.edge.citation_confidence && (
                <span className="text-xs text-muted-foreground">
                  ({(info.edge.citation_confidence * 100).toFixed(0)}% confidence)
                </span>
              )}
               {info.edge.citation_section && (
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full border border-slate-200">
                  Section: {info.edge.citation_section.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {info.edge.research_gap_summary && (
              <div className="p-3 rounded-md bg-green-50 border border-green-200">
                  <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-green-700" />
                      <h5 className="font-semibold text-green-800 text-xs uppercase">Identified Research Gap</h5>
                  </div>
                  <p className="text-sm text-green-900">The paper <span className="font-bold">{info.target.id}</span> is motivated by a gap in <span className="font-bold">{info.source.id}</span>. Specifically, {info.edge.research_gap_summary}</p>
              </div>
            )}
            
            {info.edge.citation_context && (
              <div>
                <p className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded italic">
                  "...{info.edge.citation_context}..."
                </p>
              </div>
            )}
            
            {info.edge.citation_reasoning && (
              <div className="p-3 rounded-md bg-blue-50/50 mt-2">
                 <div className="flex items-center gap-2 mb-1">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    <h5 className="font-semibold text-blue-800 text-xs uppercase">AI Reasoning</h5>
                 </div>
                <p className="text-xs text-blue-900">
                  {info.edge.citation_reasoning}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Citation Relationship</p>
            <p className="text-xs text-muted-foreground mt-1">
              This work builds upon the previous one. Intent analysis not available.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
);


export function CitationGraph({ data }: CitationGraphProps) {
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(900);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoveredEdgeInfo, setHoveredEdgeInfo] = useState<HoveredEdgeInfo | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      setWidth(ref.current.offsetWidth);
    }
    const handleResize = () => {
      if (ref.current) {
        setWidth(ref.current.offsetWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { xScale, yScale, nodePositions, dateDomain } = useMemo(() => {
    if (!data.nodes || data.nodes.length === 0) {
        return { xScale: () => 0, yScale: () => 0, nodePositions: new Map(), dateDomain: [new Date(), new Date()] };
    }
    
    const dates = data.nodes.map(parseDate);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add padding to the date domain
    const dateDomain = [
      new Date(minDate.getFullYear() - 1, 0, 1),
      new Date(maxDate.getFullYear() + 1, 11, 31)
    ];

    const xScale = (date: Date) =>
      PADDING + ((date.getTime() - dateDomain[0].getTime()) / (dateDomain[1].getTime() - dateDomain[0].getTime())) * (width - 2 * PADDING);

    const yScale = (normalizedAccuracy: number | null) => {
        // Y-axis now represents normalized score from 0 to 1
        if (normalizedAccuracy === null) return height - PADDING;
        return height - PADDING - (normalizedAccuracy * (height - 2 * PADDING));
    }
    
    const nodeIdentifier = (node: GraphNode) => node.id;

    const nodePositions = new Map(
      data.nodes.map((node) => [
          nodeIdentifier(node), 
          { x: xScale(parseDate(node)), y: yScale(node.normalizedAccuracy ?? null) }
      ])
    );
    return { xScale, yScale, nodePositions, dateDomain };
  }, [data, width, height]);


  const handleNodeClick = (node: GraphNode) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeKey(null);
    document.dispatchEvent(new CustomEvent('highlight-paper-row', { detail: { nodeId: node.id } }));
    
    const tableRowId = `paper-row-${node.id}`;
    const element = document.getElementById(tableRowId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  
  const handleEdgeClick = (edge: GraphEdge) => {
    if (!edge.from || !edge.to) return;
    const edgeKey = `${edge.from}->${edge.to}`;
    setSelectedEdgeKey(edgeKey);
    setSelectedNodeId(null);
    
    document.dispatchEvent(new CustomEvent('highlight-edge-row', { detail: { edgeKey } }));

    const tableRowId = `edge-row-${edgeKey}`;
    const element = document.getElementById(tableRowId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleEdgeHover = (edge: GraphEdge | null) => {
    if (!edge || !edge.from || !edge.to) {
      setHoveredEdgeInfo(null);
      return;
    }
    
    const sourceNodeInfo = data.nodes.find(node => node.id === edge.from);
    const targetNodeInfo = data.nodes.find(node => node.id === edge.to);

    if (sourceNodeInfo && targetNodeInfo) {
        setHoveredEdgeInfo({source: sourceNodeInfo, target: targetNodeInfo, edge});
    } else {
        setHoveredEdgeInfo(null);
    }
  };
  
  const nodeIdentifier = (node: GraphNode) => node.id;

  const getNodeTooltipPosition = (node: GraphNode) => {
      if (!node) return {};
      
      const pos = nodePositions.get(nodeIdentifier(node));
      if (!pos) return {};

      const style: React.CSSProperties = { position: 'absolute' };
      const tooltipHeight = 120; // rough estimate
      
      let left = pos.x + NODE_RADIUS + 10;
      let top = pos.y;
      
      style.transform = `translate(0, -50%)`;

      // Boundary checks
      if (left + TOOLTIP_WIDTH > width - PADDING) {
          left = pos.x - TOOLTIP_WIDTH - NODE_RADIUS - 10;
      }
      if (top - tooltipHeight/2 < PADDING) {
          top = PADDING + tooltipHeight/2;
      }
      if (top + tooltipHeight/2 > height - PADDING) {
          top = height - PADDING - tooltipHeight/2;
      }
      
      style.left = `${left}px`;
      style.top = `${top}px`;

      return style;
  }

  const getEdgeTooltipPosition = () => {
    if (!hoveredEdgeInfo) return {};

    const sourcePos = nodePositions.get(nodeIdentifier(hoveredEdgeInfo.source));
    const targetPos = nodePositions.get(nodeIdentifier(hoveredEdgeInfo.target));

    if (!sourcePos || !targetPos) return {};
    
    const edgeTooltipWidth = 672; // max-w-2xl
    const edgeTooltipHeight = 250; // estimate

    const midpoint = { x: (sourcePos.x + targetPos.x) / 2, y: (sourcePos.y + targetPos.y) / 2 };

    const style: React.CSSProperties = {
        position: 'absolute',
        transform: 'translate(-50%, -100%)', // Default to above midpoint
    };

    let left = midpoint.x;
    let top = midpoint.y - 20; // 20px offset above the edge

    // Boundary checks
    if (left - edgeTooltipWidth / 2 < PADDING) {
        left = PADDING + edgeTooltipWidth / 2;
    }
    if (left + edgeTooltipWidth / 2 > width - PADDING) {
        left = width - PADDING - edgeTooltipWidth / 2;
    }
    if (top - edgeTooltipHeight < PADDING) {
        // Not enough space above, move it below
        top = midpoint.y + 20;
        style.transform = 'translate(-50%, 0)';
    }
     if (top + edgeTooltipHeight > height - PADDING) {
        top = height - PADDING - edgeTooltipHeight;
    }
    
    style.left = `${left}px`;
    style.top = `${top}px`;

    return style;
}


  const xAxisTicks = useMemo(() => {
    if (!dateDomain || !dateDomain[0]) return [];
    const ticks: { date: Date; label: string; isQuarter: boolean }[] = [];
    const [minDate, maxDate] = dateDomain;
    const startYear = minDate.getFullYear();
    const endYear = maxDate.getFullYear();

    for (let year = startYear; year <= endYear; year++) {
      // Year tick
      ticks.push({ date: new Date(year, 0, 1), label: String(year), isQuarter: false });
      // Quarter ticks
      for (let quarter = 1; quarter <= 3; quarter++) {
        ticks.push({ date: new Date(year, quarter * 3, 1), label: `Q${quarter + 1}`, isQuarter: true });
      }
    }
    return ticks;
  }, [dateDomain]);

  const yAxisTicks = useMemo(() => {
    // Ticks for normalized values 0, 0.25, 0.5, 0.75, 1.0
    return [0, 0.25, 0.5, 0.75, 1.0];
  }, []);

  const isNodePartOfHoveredEdge = (node: GraphNode) => {
      if (!hoveredEdgeInfo) return false;
      const sourceId = nodeIdentifier(hoveredEdgeInfo.source);
      const targetId = nodeIdentifier(hoveredEdgeInfo.target);
      const currentNodeId = nodeIdentifier(node);
      return currentNodeId === sourceId || currentNodeId === targetId;
  };
  
  const isEdgeSelected = (edge: GraphEdge) => {
    if (!selectedEdgeKey || !edge.from || !edge.to) return false;
    return `${edge.from}->${edge.to}` === selectedEdgeKey;
  }

  const edgeTooltipStyle = getEdgeTooltipPosition();


  return (
    <Card className="w-full overflow-hidden">
        <CardContent className="p-0 relative" ref={ref}>
            <svg width={width} height={height} className="bg-card">
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" 
                refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" className="fill-muted-foreground/60" />
                </marker>
                <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" 
                refX="8" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" className="fill-accent" />
                </marker>
            </defs>

            {xAxisTicks.map(tick => (
                <line key={`x-grid-${tick.date.toISOString()}`} x1={xScale(tick.date)} y1={PADDING} x2={xScale(tick.date)} y2={height - PADDING} className={cn("stroke-border/50", tick.isQuarter ? "stroke-dashed" : "")} strokeDasharray={tick.isQuarter ? "2 2" : "4"}/>
            ))}
            {yAxisTicks.map(tick => (
                <line key={`y-grid-${tick}`} x1={PADDING} y1={yScale(tick)} x2={width-PADDING} y2={yScale(tick)} className="stroke-border/50" strokeDasharray="4"/>
            ))}

            <line x1={PADDING} y1={height - PADDING} x2={width - PADDING} y2={height - PADDING} className="stroke-muted-foreground" />
            <line x1={PADDING} y1={PADDING} x2={PADDING} y2={height - PADDING} className="stroke-muted-foreground" />

            {xAxisTicks.map(tick => (
                <g key={`x-tick-${tick.date.toISOString()}`} transform={`translate(${xScale(tick.date)}, ${height - PADDING})`}>
                <line y2="5" className="stroke-muted-foreground" />
                <text y="20" textAnchor="middle" className={cn("fill-muted-foreground text-xs", tick.isQuarter && "text-[10px]")}>
                    {tick.label}
                </text>
                </g>
            ))}
            <text x={width / 2} y={height - 15} textAnchor="middle" className="fill-foreground font-medium text-sm">
                Publication Date
            </text>

            {yAxisTicks.map(tick => (
                <g key={`y-tick-${tick}`} transform={`translate(${PADDING}, ${yScale(tick)})`}>
                <line x2="-5" className="stroke-muted-foreground" />
                <text x="-10" dy="0.32em" textAnchor="end" className="fill-muted-foreground text-xs">
                    {(tick * 100).toFixed(0)}
                </text>
                </g>
            ))}
            <text transform={`translate(20, ${height/2}) rotate(-90)`} textAnchor="middle" className="fill-foreground font-medium text-sm">
                Normalized Performance Score
            </text>

            <g>
                {data.edges.map((edge, i) => {
                if (!edge.from || !edge.to) {
                    return null;
                }
                
                const sourceNodeInfo = data.nodes.find(node => node.id === edge.from);
                const targetNodeInfo = data.nodes.find(node => node.id === edge.to);

                if (!sourceNodeInfo || !targetNodeInfo) return null;

                const sourcePos = nodePositions.get(nodeIdentifier(sourceNodeInfo));
                const targetPos = nodePositions.get(nodeIdentifier(targetNodeInfo));

                if (!sourcePos || !targetPos) return null;

                const isHovered = hoveredEdgeInfo?.edge === edge;
                const isSelected = isEdgeSelected(edge);
                
                return (
                    <line
                      key={`edge-${i}`}
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      className={cn(
                          "stroke-muted-foreground/60 transition-all cursor-pointer",
                          (isHovered || isSelected) && "stroke-accent",
                      )}
                      strokeWidth={isHovered || isSelected ? 4 : 2}
                      onMouseEnter={() => handleEdgeHover(edge)}
                      onMouseLeave={() => handleEdgeHover(null)}
                      onClick={() => handleEdgeClick(edge)}
                      markerEnd={(isHovered || isSelected) ? "url(#arrowhead-hover)" : "url(#arrowhead)"}
                    />
                );
                })}
            </g>

            <g>
                {data.nodes.map((node, i) => {
                    const pos = nodePositions.get(nodeIdentifier(node));
                    if (!pos) return null;
    
                    const isNodeHovered = hoveredNode === node;
                    const isEdgeNodeHovered = isNodePartOfHoveredEdge(node);
                    const isSelected = selectedNodeId === node.id;
                    
                    return (
                        <circle
                            key={`${node.id}-${i}`}
                            cx={pos.x}
                            cy={pos.y}
                            r={NODE_RADIUS}
                            className={cn(
                                "fill-primary stroke-card transition-all cursor-pointer", 
                                (isNodeHovered || isEdgeNodeHovered) && "fill-accent stroke-accent-foreground",
                                isSelected && "ring-2 ring-offset-2 ring-accent"
                            )}
                            strokeWidth={2}
                            onMouseEnter={() => setHoveredNode(node)}
                            onMouseLeave={() => setHoveredNode(null)}
                            onClick={() => handleNodeClick(node)}
                        />
                    );
                })}
            </g>
            </svg>
             {hoveredNode && !hoveredEdgeInfo && (
                <NodeTooltip 
                    node={hoveredNode}
                    style={getNodeTooltipPosition(hoveredNode)}
                />
            )}
            {hoveredEdgeInfo && (
                <EdgeTooltip 
                    info={hoveredEdgeInfo}
                    style={edgeTooltipStyle} 
                />
            )}
        </CardContent>
    </Card>
  );
}
