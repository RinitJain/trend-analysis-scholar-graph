
'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2 } from 'lucide-react';
import { searchAction } from '@/app/actions';
import { useState } from 'react';

export function SearchForm() {
    const [pending, setPending] = useState(false);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        setPending(true);
        // The form submission will be handled by the action, which causes a redirect.
        // The `pending` state is primarily for the UI feedback on this page.
        // We don't need to set pending back to false because the page will navigate away.
    };

    return (
        <form action={searchAction} onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
            <Input
                name="topic"
                type="text"
                placeholder="e.g., 'Text-to-SQL'"
                className="flex-1"
                required
                disabled={pending}
            />
            <Button type="submit" disabled={pending}>
                {pending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Search className="mr-2 h-4 w-4" />
                )}
                {pending ? 'Analyzing...' : 'Analyze'}
            </Button>
        </form>
    );
}
