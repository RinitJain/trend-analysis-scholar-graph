
import { z } from 'zod';


// --- Schemas for Dynamic Analysis ---
export const AnalysisQuestionSchema = z.object({
  key: z.string().describe("A concise, camelCase key for the question (e.g., 'modelArchitecture')."),
  question: z.string().describe("The detailed, topic-specific evaluation question."),
});
export type AnalysisQuestion = z.infer<typeof AnalysisQuestionSchema>;


// --- Schemas for Detailed Summary and Paper Analysis ---

// This is a dynamic type, representing the answers to the generated analysis questions.
export const PaperAnalysisSchema = z.record(z.string(), z.any());
export type PaperAnalysis = z.infer<typeof PaperAnalysisSchema>;


// --- Graph Schemas ---

export const GraphNodeSchema = z.object({
  id: z.string(),
  year: z.number().nullable(),
  accuracy: z.number().nullable(),
  pdf_url: z.string().url().or(z.string()),
  publishedDate: z.string().optional().nullable(),
  normalizedAccuracy: z.number().optional().nullable(),
  primary_metric: z.string().optional().nullable(),
  scraped_from: z.array(z.string()).optional(),
  analysis: PaperAnalysisSchema.optional(),
});


export const GraphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  citation_intent: z.enum(['background', 'motivation', 'extension', 'comparison', 'methodology', 'limitation', 'uncertain']).optional(),
  citation_confidence: z.number().min(0).max(1).optional(),
  citation_context: z.string().optional().describe("Brief context snippet around the citation"),
  citation_section: z.string().optional(),
  citation_reasoning: z.string().optional().describe("AI reasoning for the intent classification"),
  research_gap_summary: z.string().optional().describe("A 1-2 sentence summary of the research gap if intent is 'motivation'"),
});

export const GraphDataSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});


export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphData = z.infer<typeof GraphDataSchema>;


export const ModelSchema = z.object({
    title: z.string().nullable(),
    pdf_url: z.string().url().nullable().or(z.string().nullable()),
    accuracy: z.number().nullable(),
    primary_metric: z.string().nullable(),
    year: z.number().nullable(),
    model_name: z.string().nullable(),
    source: z.string().url().nullable(),
    publishedDate: z.string().nullable(),
    normalizedAccuracy: z.number().nullable(),
});
export type BuildCitationGraphInput = z.infer<typeof ModelSchema>[];


export const BuildCitationGraphOutputSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
});
export type BuildCitationGraphOutput = z.infer<typeof BuildCitationGraphOutputSchema>;

// --- Schemas for In-Memory Cache ---
export const PaperCacheEntrySchema = z.object({
  id: z.string(),
  true_title: z.string(),
  aliases: z.array(z.string()),
  pdf_url: z.string().url().nullable(),
  source_urls: z.array(z.string().url()),
  scraped_from: z.array(z.string()),
  publishedDate: z.string().optional().nullable(),
  year: z.number().nullable(),
  metrics: z.array(z.object({
    source: z.string(),
    primary_metric_name: z.string().nullable(),
    primary_metric_value: z.number().nullable(),
    values: z.any(),
  })),
});
export type PaperCacheEntry = z.infer<typeof PaperCacheEntrySchema>;


// --- Schemas for fetch-graph-data flow ---

export const LeaderboardEntrySchema = z.object({
  rank: z.number().optional().nullable(),
  name: z.string(),
  metrics: z.any().optional().nullable(),
  paper_title: z.string().optional().nullable(),
  code_url: z.string().optional().nullable(),
  result_url: z.string().optional().nullable(),
  year: z.number().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  pdf_url: z.string().optional().nullable(),
  publishedDate: z.string().optional().nullable(),
  primary_metric_name: z.string().optional().nullable(),
  primary_metric_value: z.number().optional().nullable(),
});

export const PromptLeaderboardEntrySchema = z.object({
  rank: z.number().optional().nullable(),
  name: z.string().describe("The clean name of the model or method, with extra text like authors removed."),
  primary_metric_name: z.string().optional().nullable().describe("The name of the main ranking metric."),
  primary_metric_value: z.number().optional().nullable().describe("The numeric value of the main ranking metric."),
  metrics: z.any().optional().nullable().describe("An object containing ALL other metric columns and their values."),
  paper_title: z.string().optional().nullable(),
  code_url: z.string().optional().nullable().describe("A string that can be a URL or 'N/A'"),
  result_url: z.string().optional().nullable().describe("A string that can be a URL or 'N/A'"),
  year: z.number().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

export const LeaderboardMetadataSchema = z.object({
  source_url: z.string(),
  source_platform: z.string(),
});

export const PromptLeaderboardMetadataSchema = z.object({
    source_url: z.string().describe("The source URL of the leaderboard page."),
    source_platform: z.string().describe("The platform name, e.g., 'PapersWithCode', 'Kaggle', 'GitHub'"),
});


export const FetchGraphDataInputSchema = z.object({
  topic: z.string().describe('The research topic to generate a graph for.'),
});
export type FetchGraphDataInput = z.infer<typeof FetchGraphDataInputSchema>;

export const DatasetsOutputSchema = z.object({
  datasets: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
    })
  ),
});

export const PromptLeaderboardOutputSchema = z.object({
    top_models: z.array(PromptLeaderboardEntrySchema),
    notes: z.string().optional().nullable(),
    final_leaderboard_used: PromptLeaderboardMetadataSchema,
});

export const LeaderboardOutputSchema = z.object({
    top_models: z.array(LeaderboardEntrySchema),
    notes: z.string().optional().nullable(),
    final_leaderboard_used: LeaderboardMetadataSchema,
});

export const DatasetWithLeaderboardSchema = z.object({
  dataset_name: z.string(),
  dataset_url: z.string(),
  leaderboard: LeaderboardMetadataSchema,
  top_models: z.array(LeaderboardEntrySchema),
  notes: z.string(),
  extra_fields: z.record(z.any()).optional().default({}),
});


export const FetchGraphDataOutputSchema = z.object({
  datasets: z.array(DatasetWithLeaderboardSchema),
  flattened_models: z.array(ModelSchema).optional(),
});
export type FetchGraphDataOutput = z.infer<typeof FetchGraphDataOutputSchema>;


// --- Schemas for summarize-insights flow ---
export const CitationGraphSchema = z.object({
  nodes: z.array(GraphNodeSchema).describe('The list of paper nodes in the citation graph.'),
  edges: z.array(GraphEdgeSchema).describe('The list of citation edges in the citation graph.'),
});

export const SummarizeInsightsInputSchema = z.object({
  graphData: CitationGraphSchema.describe('The citation graph data in JSON format.'),
  topic: z.string().describe('The research topic of the citation graph.'),
});
export type SummarizeInsightsInput = z.infer<typeof SummarizeInsightsInputSchema>;

export const SummarizeInsightsOutputSchema = z.object({
  summary: z.string().describe('A summary of the key insights and trends in the research area.'),
});
export type SummarizeInsightsOutput = z.infer<typeof SummarizeInsightsOutputSchema>;


// --- Schemas for Debug Logger ---
export const LogEntrySchema = z.object({
    step: z.number(),
    action: z.string(),
    details: z.string(),
    status: z.enum(['SUCCESS', 'FAILURE', 'INFO']).optional(),
    output: z.any().optional(),
});
export type LogEntry = z.infer<typeof LogEntrySchema>;


// --- Schemas for Detailed Summary Flow ---

// This schema is now dynamic, representing a collection of synthesized answers.
export const SynthesizedAnalysesSchema = z.record(z.string(), z.string());
export type SynthesizedAnalyses = z.infer<typeof SynthesizedAnalysesSchema>;


export const DetailedAnalysisInputSchema = z.object({
  graphData: GraphDataSchema,
  topic: z.string(),
  analysisQuestions: z.array(AnalysisQuestionSchema),
});
export type DetailedAnalysisInput = z.infer<typeof DetailedAnalysisInputSchema>;

export const PaperReferenceSchema = z.object({
    number: z.number(),
    title: z.string(),
});
export const PaperReferenceListSchema = z.array(PaperReferenceSchema);

export const DetailedAnalysisOutputSchema = z.object({
    topic: z.string(),
    paperReferenceList: PaperReferenceListSchema,
    synthesizedAnalyses: SynthesizedAnalysesSchema,
    overallSummary: z.string(),
    analysisQuestions: z.array(AnalysisQuestionSchema), // Pass the questions through
});
export type DetailedAnalysisOutput = z.infer<typeof DetailedAnalysisOutputSchema>;


// --- GROBID Service Schemas ---

export const GrobidReferenceSchema = z.object({
    id: z.string(), // The xml:id of the biblStruct
    title: z.string(),
    authors: z.array(z.string()).optional(),
    year: z.number().optional(),
});
export type GrobidReference = z.infer<typeof GrobidReferenceSchema>;

export const GrobidContextSchema = z.object({
    linkedReference: GrobidReferenceSchema,
    mention: z.object({ targetId: z.string(), text: z.string() }),
    raw_context: z.string(),
    sentence_snippet: z.string().optional(),
    section_name: z.string().optional(),
});
export type GrobidContext = z.infer<typeof GrobidContextSchema>;


export const GrobidOutputSchema = z.object({
  paperTitle: z.string().optional(),
  abstract: z.string().optional(),
  fullText: z.string(),
  structuredText: z.string(),
  references: z.array(GrobidReferenceSchema),
  contexts: z.array(GrobidContextSchema),
  publishedDate: z.string().optional().nullable(),
});
export type GrobidOutput = z.infer<typeof GrobidOutputSchema>;


// --- Research Trend Extrapolation Schemas ---
export const TrendExtrapolationInputSchema = z.object({
  graphData: GraphDataSchema,
  topic: z.string(),
});
export type TrendExtrapolationInput = z.infer<typeof TrendExtrapolationInputSchema>;

export const PredictedGapSchema = z.object({
  predicted_research_gap: z.string().describe("A concise, well-formulated research question or problem statement that represents a likely next step in the field."),
  description: z.string().describe("A detailed explanation of why this gap is important and what it entails, synthesizing the limitations and opportunities from the source papers."),
  confidence: z.number().min(0).max(1).describe("A confidence score (0.0 to 1.0) indicating how likely this is to be a key future research direction."),
  supporting_papers: z.array(z.string()).describe("A list of 2-3 paper titles that most strongly inform this prediction."),
});

export const TrendExtrapolationOutputSchema = z.object({
  topic: z.string(),
  overall_summary: z.string().describe("A high-level summary of the current state of research for the topic, including major achievements and dominant challenges."),
  predicted_gaps: z.array(PredictedGapSchema).describe("A list of 3-5 predicted future research gaps or problem statements."),
});
export type TrendExtrapolationOutput = z.infer<typeof TrendExtrapolationOutputSchema>;

    