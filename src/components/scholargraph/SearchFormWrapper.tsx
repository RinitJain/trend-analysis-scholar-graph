'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const SearchForm = dynamic(() => import('@/components/scholargraph/SearchForm').then(mod => mod.SearchForm), {
  ssr: false,
  loading: () => (
    <div className="flex w-full items-center space-x-2">
      <Skeleton className="h-10 flex-1" />
      <Skeleton className="h-10 w-24" />
    </div>
  ),
});

export function SearchFormWrapper() {
  return <SearchForm />;
}
