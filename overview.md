# ScholarGraph: Technical Handover Overview

## 1. Project Purpose
ScholarGraph is an end-to-end automated research engine. It doesn't just search for papers; it maps the **evolution of a research field** by identifying performance plateaus, analyzing citation intents, and predicting future research gaps based on the full-text analysis of academic PDFs.

## 2. The Core Pipeline Architecture
The heart of the application is the **Full Background Pipeline**, located in `src/app/api/generate-graph/route.ts`. It executes 5 distinct passes:

### Pass 1: Data Acquisition (`fetch-graph-data.ts`)
- **Benchmark Discovery**: Uses AI to find canonical dataset names for the topic.
- **Leaderboard Scraping**: Uses Google CSE to find "PapersWithCode" or similar leaderboard URLs.
- **Scraper Service (`scraper.ts`)**: Uses a dual-mode strategy. It tries a fast static fetch first, falling back to **Playwright (Headless Chromium)** for JavaScript-heavy tables.
- **PDF Resolution (`pdf-resolver.ts`)**: A complex heuristic engine that resolves abstract pages (arXiv, OpenReview) into direct PDF download links.

### Pass 2: Discovery & Scaffolding (`generate-analysis-questions.ts`)
- **Initial GROBID Run**: Downloads all PDFs and uses GROBID to extract only titles and **Abstracts**.
- **Dynamic Question Generation**: Instead of fixed questions, the AI reads the abstracts to generate **15 topic-specific analysis questions**. (e.g., for "Text-to-SQL", it asks about schema encoding; for "VQA", it asks about image-text fusion).

### Pass 3: Detailed Paper Analysis (`build-citation-graph.ts`)
- **Full-Text Processing**: Sends PDFs to a local **GROBID Docker container** (`port 8070`) to get TEI XML.
- **15-Point Extraction**: The AI answers the dynamically generated questions by reading the `structuredText` (body, tables, figures) of the paper.

### Pass 4: Citation Intent Mapping (`build-citation-graph.ts` & `citation-intent-analyzer.ts`)
- **Contextual Extraction**: GROBID identifies the exact sentence and paragraph where a specific paper is cited.
- **Intent Classification**: AI classifies the citation as *Motivation*, *Background*, *Comparison*, *Extension*, etc.
- **Research Gap Summarization**: If the intent is `motivation`, the AI extracts the specific technical problem the newer paper identified in the older one.

### Pass 5: Plateau-Aware Synthesis (`extrapolate-research-trends.ts`)
- **Plateau Detection Logic**: An algorithm identifies sequences of papers where the "Normalized Performance Score" has stalled (a flat line in accuracy).
- **Trend Extrapolation**: The AI analyzes the papers specifically from these plateau periods to predict 7–10 future research directions that address these "stubborn" bottlenecks.

## 3. Mission-Critical Services

### Industrial-Grade Key Rotation (`geminiKeyManager.ts` & `ai-utils.ts`)
- **The Problem**: Gemini Free Tier has strict rate limits.
- **The Solution**: A singleton manager that holds 6 different API keys.
- **Retry Logic**: `callWithRetry` wraps every AI call. If it hits a `429` (Quota) or a `403` (Service Disabled), it automatically rotates to the next key and retries mid-execution. 
- **Dynamic Binding**: Prompts are defined *inside* functions to ensure they always bind to the currently active rotated client.

### GROBID Integration (`grobid.ts`)
- ScholarGraph depends on a **GROBID server**.
- It uses `xml-js` to parse TEI (Text Encoding Initiative) XML into a flattened `structuredText` format that the LLM can easily consume.
- It implements a two-tier cache (In-memory + `.grobid_cache` folder) to avoid re-processing expensive PDF-to-XML conversions.

## 4. UI Components (`src/components/scholargraph/`)
- **CitationGraph.tsx**: A custom SVG-based visualization mapping papers on an X-axis (Time) and Y-axis (Normalized Performance).
- **ResearchGapAnalyzer.tsx**: Aggregates `motivation` citations to show which older papers are the "sources" of most modern research problems.
- **InsightGenerator.tsx**: Handles the polling of the background JSON files (`citation_graph.json`, `detailed_summary.json`).

## 5. Development Setup
1. **GROBID**: Must run `docker run --rm --init -p 8070:8070 grobid/grobid:0.8.2`.
2. **Playwright**: Run `npx playwright install` to enable leaderboard scraping.
3. **Environment**: Ensure `GEMINI_KEY_1` through `GEMINI_KEY_6` are set in `.env`.
