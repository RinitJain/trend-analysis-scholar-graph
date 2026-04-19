'use client';

import type { GraphData } from '@/lib/types';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, BookCopy, Calendar, Link2, GitBranch } from 'lucide-react';

interface GraphAnalyticsProps {
    data: GraphData;
}

const AnalyticsCard = ({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            {children}
        </CardContent>
    </Card>
);

export function GraphAnalytics({ data }: GraphAnalyticsProps) {
    const analytics = useMemo(() => {
        if (!data || !data.nodes || !data.edges) {
            return {
                peakPerformance: null,
                mostCited: null,
                yearRange: { min: 0, max: 0 },
                totalPapers: 0,
                totalCitations: 0,
            };
        }

        // Peak Performance
        const nodesWithAccuracy = data.nodes.filter(n => n.accuracy !== null && n.accuracy > 0);
        const peakPerformance = nodesWithAccuracy.length > 0
            ? nodesWithAccuracy.reduce((max, node) => (node.accuracy! > max.accuracy! ? node : max), nodesWithAccuracy[0])
            : null;

        // Most Cited Paper
        const citationCounts = new Map<string, number>();
        data.edges.forEach(edge => {
            const targetId = edge.to.toLowerCase();
            citationCounts.set(targetId, (citationCounts.get(targetId) || 0) + 1);
        });

        let mostCitedPaper = null;
        let maxCitations = 0;
        if(citationCounts.size > 0) {
            const mostCitedId = [...citationCounts.entries()].reduce((a, b) => b[1] > a[1] ? b : a)[0];
            const paperInfo = data.nodes.find(n => n.id.toLowerCase() === mostCitedId);
            if (paperInfo) {
                mostCitedPaper = paperInfo;
                maxCitations = citationCounts.get(mostCitedId) || 0;
            }
        }

        // Year Range
        const years = data.nodes.map(n => n.year).filter(y => y !== null) as number[];
        const yearRange = {
            min: years.length > 0 ? Math.min(...years) : 0,
            max: years.length > 0 ? Math.max(...years) : 0,
        };

        return {
            peakPerformance,
            mostCited: mostCitedPaper ? { ...mostCitedPaper, citationCount: maxCitations } : null,
            yearRange,
            totalPapers: data.nodes.length,
            totalCitations: data.edges.length,
        };
    }, [data]);

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <AnalyticsCard title="Peak Performance" icon={<Award className="h-4 w-4 text-muted-foreground" />}>
                {analytics.peakPerformance ? (
                    <>
                        <div className="text-2xl font-bold">{analytics.peakPerformance.accuracy?.toFixed(2)}%</div>
                        <p className="text-xs text-muted-foreground truncate" title={analytics.peakPerformance.id}>
                            {analytics.peakPerformance.id} ({analytics.peakPerformance.year})
                        </p>
                    </>
                ) : (
                    <div className="text-lg font-semibold text-muted-foreground">N/A</div>
                )}
            </AnalyticsCard>
            <AnalyticsCard title="Most Cited Paper" icon={<BookCopy className="h-4 w-4 text-muted-foreground" />}>
                 {analytics.mostCited ? (
                    <>
                        <div className="text-2xl font-bold">{analytics.mostCited.citationCount} citations</div>
                        <p className="text-xs text-muted-foreground truncate" title={analytics.mostCited.id}>
                            {analytics.mostCited.id} ({analytics.mostCited.year})
                        </p>
                    </>
                ) : (
                    <div className="text-lg font-semibold text-muted-foreground">N/A</div>
                )}
            </AnalyticsCard>
            <AnalyticsCard title="Year Range" icon={<Calendar className="h-4 w-4 text-muted-foreground" />}>
                <div className="text-2xl font-bold">
                    {analytics.yearRange.min} - {analytics.yearRange.max}
                </div>
                 <p className="text-xs text-muted-foreground">
                    Timespan of collected papers
                </p>
            </AnalyticsCard>
            <AnalyticsCard title="Total Papers" icon={<Link2 className="h-4 w-4 text-muted-foreground" />}>
                <div className="text-2xl font-bold">{analytics.totalPapers}</div>
                <p className="text-xs text-muted-foreground">
                    Unique research papers in the graph
                </p>
            </AnalyticsCard>
            <AnalyticsCard title="Total Citations" icon={<GitBranch className="h-4 w-4 text-muted-foreground" />}>
                <div className="text-2xl font-bold">{analytics.totalCitations}</div>
                <p className="text-xs text-muted-foreground">
                    Connections between papers
                </p>
            </AnalyticsCard>
        </div>
    );
}
