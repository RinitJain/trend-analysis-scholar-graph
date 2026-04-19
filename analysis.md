# ScholarGraph: Performance-Driven Semantic Mapping of Research Landscapes


### Abstract
As scientific publication volume increases exponentially, researchers face a "signal-to-noise" crisis. Standard tools like Google Scholar focus on citation counts—a measure of popularity, not necessarily technical evolution. We present **ScholarGraph**, an automated pipeline that synthesizes research landscapes by combining performance metric extraction with semantic citation intent analysis. By introducing **Performance Plateau Detection**, ScholarGraph identifies historical bottlenecks and extrapolates future research directions with higher precision than traditional keyword-based trend analysis.

### 1. Introduction
The journey of ScholarGraph began with a simple premise: **Why is a paper cited?** A citation in the "Related Work" section (Background) is fundamentally different from a citation in the "Introduction" (Motivation) where a researcher explicitly states that an existing model fails. ScholarGraph was built to automate the extraction of these "Motivation" statements to map the "Gaps" in a field.

### 2. Methodology: The Plateau-Extrapolation Framework

#### 2.1 Dynamic Query Scaffolding
Traditional analysis uses a fixed set of questions. ScholarGraph utilizes a two-pass LLM strategy. The "Discovery Pass" reads the abstracts of all retrieved papers to identify the unique dimensions of the topic. It then scaffolds a 15-question evaluation framework specific to that field (e.g., identifying "Dataset Synthesis" as a key challenge in NL-to-SQL vs. "Image-Text Alignment" in VQA).

#### 2.2 Performance Plateau Detection
We define a **Research Plateau** as a sequence of chronologically ordered papers where:
$$\Delta \text{Accuracy} < \epsilon$$
over a window of $N$ papers. 
When the system detects a plateau, it signals a "Technical Wall." Our extrapolation logic focuses its semantic analysis on the "Motivation" citations of papers published during and immediately after this period, as these papers contain the first documented attempts to break the bottleneck.

#### 2.3 Semantic Intent Classification
Using GROBID-extracted TEI XML, we extract the precise 3-sentence window surrounding every citation. An LLM classifies these into a taxonomy of seven intents. The most critical, `motivation`, is used to populate our **Research Gap Analyzer**, which tracks the "inherited problems" passed down from seminal papers to current SOTA models.

### 3. Journey and Evolution
1. **MVP**: Basic PDF extraction and summarization.
2. **Scaling Phase**: Implementation of a 6-key Gemini rotation system to survive industrial-scale processing of 30+ papers per topic.
3. **Intelligence Phase**: Shifting from fixed questions to dynamic abstract-driven scaffolding.
4. **Final Refinement**: Integrating the Plateau algorithm to move trend prediction from "educated guessing" to "evidence-based extrapolation."

### 4. Comparison with Existing Tools
| Feature | Semantic Scholar | Elicit | ScholarGraph |
| :--- | :--- | :--- | :--- |
| Metric Tracking | Basic | Key Findings | **Normalized Performance Over Time** |
| Intent Analysis | Yes | No | **Full Context + Reasoning** |
| Future Prediction | No | Literature Review | **Plateau-Driven Extrapolation** |
| Dynamic Scaffolding | No | No | **Yes (15 topic-specific points)** |

### 5. Conclusion and Future Directions
ScholarGraph represents a shift from "Search" to "Synthesis." By quantifying the "technical struggle" of a field through plateau detection, we provide a clearer signal of where a field is going. Future versions could integrate multi-metric normalization (balancing Accuracy vs. Latency) to identify "Pareto-Optimal" plateaus, offering even deeper insights into the cost-benefit trade-offs of modern AI research.
