/**
 * @fileoverview A simple structured logger for capturing pipeline steps.
 * This is used by the debug API to provide a step-by-step view of the process.
 */
import type { LogEntry } from '@/lib/types';

export function createLogger() {
    const logs: LogEntry[] = [];
    let step = 1;

    return {
        log: (
            action: string, 
            details: string, 
            status: LogEntry['status'] = 'INFO',
            output?: any
        ) => {
            const entry: LogEntry = {
                step,
                action,
                details,
                status,
            };
            if(output !== undefined) {
                entry.output = output;
            }
            logs.push(entry);
            console.log(`[Step ${step}: ${action}] ${details} ${status !== 'INFO' ? `(${status})` : ''}`);
            step++;
        },
        getLogs: (): LogEntry[] => {
            return logs;
        }
    };
}
