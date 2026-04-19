'use client';

import type { GraphData } from '@/lib/types';
import dynamic from 'next/dynamic';

const InsightGenerator = dynamic(
  () => import('@/components/scholargraph/InsightGenerator').then(mod => mod.InsightGenerator),
  { ssr: false }
);

interface InsightGeneratorWrapperProps {
  graphData: GraphData;
  topic: string;
}

export function InsightGeneratorWrapper({ graphData, topic }: InsightGeneratorWrapperProps) {
  return <InsightGenerator graphData={graphData} topic={topic} />;
}
