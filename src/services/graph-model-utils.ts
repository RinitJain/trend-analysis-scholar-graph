
/**
 * @fileoverview Utility functions for processing and transforming leaderboard
 * data into a flattened model structure suitable for the citation graph.
 */

import type { ModelSchema, PaperCacheEntry } from "@/lib/types";
import type { z } from "zod";


/**
 * Extracts the single best performance metric from a list of metric objects.
 * It iterates through all collected metrics for a paper and uses a predefined 
 * priority list to select the most important one.
 * @param metrics A list of metric objects, each from a different source.
 * @returns A tuple containing the metric value and its name, or [null, null].
 */
function extractBestMetric(metrics: PaperCacheEntry['metrics']): [number | null, string | null] {
    if (!metrics || metrics.length === 0) {
        return [null, null];
    }
    
    // First, try to find a metric that was explicitly marked as primary by the AI
    for (const metricSet of metrics) {
        if(metricSet.primary_metric_value !== null && metricSet.primary_metric_name !== null) {
            return [metricSet.primary_metric_value, metricSet.primary_metric_name];
        }
    }

    // Fallback logic if the primary metric wasn't explicitly identified
    const metricPriority = [
        "exact match", "exec", "accuracy", "acc", "em",
        "execution accuracy", "test_accuracy", "Top-1 Accuracy", 
        "BLEU", "ROUGE", "WER", "F1",
        "FID", "FD",
        "Precision", "Recall", "Coverage", "Density",
        "score"
    ];

    let bestFound: [number, string] | null = null;

    for (const metricSet of metrics) {
        const values = metricSet.values;
        if (values === null || values === undefined) continue;

        // Handle case where metrics is just a single value
        if (typeof values === 'number') {
            if (!bestFound || values > bestFound[0]) {
                bestFound = [values, 'score'];
            }
            continue;
        }
        if (typeof values === 'string') {
            const parsed = parseFloat(String(values).replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsed) && (!bestFound || parsed > bestFound[0])) {
                bestFound = [parsed, 'score'];
            }
            continue;
        }

        // Handle case where metrics is an object
        if (typeof values === 'object' && !Array.isArray(values)) {
            // Case-insensitive check for priority metrics
            for (const priorityKey of metricPriority) {
                for (const actualKey in values) {
                    if (actualKey.toLowerCase().trim().includes(priorityKey.toLowerCase())) {
                        const value = (values as any)[actualKey];
                        if (value !== null && value !== undefined) {
                            try {
                                const parsedValue = parseFloat(String(value).replace(/[^0-9.%]/g, ''));
                                if (!isNaN(parsedValue) && (!bestFound || parsedValue > bestFound[0])) {
                                    bestFound = [parsedValue, actualKey];
                                }
                            } catch (e) {}
                        }
                    }
                }
            }
        }
    }

    return bestFound || [null, null];
}

/**
 * Normalizes a score based on the min and max scores in a dataset.
 * @param score The score to normalize.
 * @param min The minimum score in the dataset.
 * @param max The maximum score in the dataset.
 * @returns A normalized score between 0 and 1.
 */
function normalizeScore(score: number, min: number, max: number): number {
    if (max === min) {
        return 1.0; // All scores are the same, so they are all "max"
    }
    return (score - min) / (max - min);
}

/**
 * Flattens the de-duplicated paper cache entries into a simple list of model objects.
 * This is the step before normalization.
 * @param cachedPapers A list of unique PaperCacheEntry objects.
 * @returns A list of flattened model dictionaries with the best score selected.
 */
export function flattenLeaderboardModels(cachedPapers: PaperCacheEntry[]): z.infer<typeof ModelSchema>[] {
    const flattened_models: z.infer<typeof ModelSchema>[] = [];
    
    for (const paper of cachedPapers) {
        const [score, metric_name] = extractBestMetric(paper.metrics);
        
        flattened_models.push({
            "title": paper.true_title,
            "pdf_url": paper.pdf_url,
            "accuracy": score,
            "primary_metric": metric_name,
            "year": paper.year,
            "model_name": paper.aliases[0] || paper.true_title, // Use first alias as model name
            "source": paper.source_urls[0] || null, // Use first source URL
            "publishedDate": paper.publishedDate || null,
            "normalizedAccuracy": null // Will be calculated later
        });
    }
    return flattened_models;
}


/**
 * Applies Min-Max normalization to accuracy scores for a list of models.
 * It filters out unknown models or models without a score before calculating 
 * the normalization range.
 * @param models A list of model objects.
 * @returns The same list of models with the `normalizedAccuracy` field populated for valid models.
 */
export function normalizeLeaderboardScores(models: z.infer<typeof ModelSchema>[]): z.infer<typeof ModelSchema>[] {
    // A model is valid for normalization if it has a valid accuracy score.
    const validScores = models
        .map(m => m.accuracy)
        .filter(score => score !== null && score !== undefined) as number[];

    if (validScores.length < 2) {
        return models.map(m => ({
            ...m,
            normalizedAccuracy: m.accuracy !== null ? 1.0 : null, // If only one item, its score is 1.0
        }));
    }
    
    const min_score = Math.min(...validScores);
    const max_score = Math.max(...validScores);

    return models.map(model => {
        if (model.accuracy !== null && model.accuracy !== undefined) {
            return {
                ...model,
                normalizedAccuracy: normalizeScore(model.accuracy, min_score, max_score)
            };
        } else {
            // Ensure non-valid models have null
            return {
                ...model,
                normalizedAccuracy: null
            };
        }
    });
}

    
