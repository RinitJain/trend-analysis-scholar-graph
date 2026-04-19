# **App Name**: ScholarGraph

## Core Features:

- Citation Graph Visualization: Display the citation graph with paper nodes positioned according to publication year (x-axis) and model accuracy (y-axis).
- Node Hover Details: Enable users to hover over nodes to display detailed information about each paper (e.g., title, authors, abstract).
- Edge Highlighting: Highlight edges (citation links) between nodes to show relationships. Make edges hoverable.
- Citation Table Navigation: Provide a table below the graph listing all citations (edges), with links to the corresponding papers. Clicking an edge highlights the citation and scrolls/redirects to the row on the table that contains the info about that edge.
- Data Fetching & Graph Generation: Fetch data from PapersWithCode, ArXiv, and other sources via API to dynamically generate the citation graph based on a user-specified research topic.
- Insight Generation Tool: A tool that analyzes the metadata from a set of related publications to produce a brief summary of insights that can be gleaned from their co-citation relationships.

## Style Guidelines:

- Primary color: Soft blue (#77B5FE) to represent knowledge and clarity.
- Background color: Light gray (#F0F4F8) to provide a clean, unobtrusive backdrop for the data visualization.
- Accent color: Subtle orange (#FFB347) to highlight key data points and interactive elements.
- Body and headline font: 'Inter', a sans-serif typeface providing a modern and readable look for both headlines and body text.
- Use minimalist icons to represent data sources and categories. Icons should be monochrome, matching the primary color.
- Arrange the citation graph at the top, with the citation table below. Ensure the layout is responsive for different screen sizes.
- Use smooth transitions when hovering over nodes and edges, and when navigating from the graph to the citation table.