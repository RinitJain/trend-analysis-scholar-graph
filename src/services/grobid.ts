

/**
 * @fileoverview This file provides functionality for interacting with a GROBID
 * service to extract citations from PDF documents. It includes functions for
 * downloading PDFs, sending them to GROBID, and parsing the resulting XML.
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import * as convert from 'xml-js';
import { z } from 'zod';
// Lazy-load pdf-parse where used to avoid import-time side effects in certain bundlers


const GROBID_URL = "http://127.0.0.1:8070/api/processFulltextDocument";
const CACHE_DIR = join(process.cwd(), '.grobid_cache');


interface TeiElement {
    type: 'element' | 'text';
    name?: string;
    elements?: TeiElement[];
    text?: string;
    attributes?: Record<string, string>;
}

// --- Schemas for detailed GROBID extraction ---
export const GrobidReferenceSchema = z.object({
    id: z.string(), // The xml:id of the biblStruct
    title: z.string(),
    authors: z.array(z.string()).optional(),
    year: z.number().optional(),
});
export type GrobidReference = z.infer<typeof GrobidReferenceSchema>;


export const GrobidMentionSchema = z.object({
    targetId: z.string(), // The xml:id this ref points to
    text: z.string(),     // The text of the mention, e.g., "[12]" or "Smith et al."
});

export const GrobidContextSchema = z.object({
    linkedReference: GrobidReferenceSchema,
    mention: GrobidMentionSchema,
    raw_context: z.string(),
    sentence_snippet: z.string().optional(),
    section_name: z.string().optional(),
});
export type GrobidContext = z.infer<typeof GrobidContextSchema>;


export const GrobidOutputSchema = z.object({
    paperTitle: z.string().optional(),
    abstract: z.string().optional(),
    fullText: z.string(),
    structuredText: z.string(), // New field for structured text
    references: z.array(GrobidReferenceSchema),
    contexts: z.array(GrobidContextSchema),
    publishedDate: z.string().optional().nullable(),
});
export type GrobidOutput = z.infer<typeof GrobidOutputSchema>;


/**
 * Downloads a PDF from a given URL and saves it to a temporary file.
 * @param pdfUrl The URL of the PDF to download.
 * @returns A promise that resolves to the path of the temporary file, or null on failure.
 */
export async function downloadPdf(pdfUrl: string): Promise<string | null> {
    console.log(`  - 📥 Downloading PDF: ${pdfUrl}`);
    try {
        const response = await fetch(pdfUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }, 
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(`Failed to download PDF. Status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const tempFilePath = join(tmpdir(), `scholar-graph-temp-${Date.now()}.pdf`);
        await writeFile(tempFilePath, buffer);
        console.log("  - ✅ PDF downloaded to temp file.");
        return tempFilePath;
    } catch (e) {
        console.error(`  - ❌ Failed to download PDF from ${pdfUrl}:`, e);
        return null;
    }
}

// --- Robust XML Parsing Functions ---

/**
 * Recursively finds all elements with a given name in the TEI tree.
 * @param el The current element to search within.
 * @param name The tag name to search for (e.g., 'p', 'ref').
 * @returns An array of found TeiElement objects.
 */
function findElements(el: TeiElement | undefined, name: string): TeiElement[] {
    let results: TeiElement[] = [];
    if (!el || typeof el !== 'object' || !el.elements) {
        return results;
    }

    for (const child of el.elements) {
        if (child.name === name) {
            results.push(child);
        }
        results = results.concat(findElements(child, name));
    }
    return results;
}

/**
 * Extracts the full, concatenated text content from a TEI element and its children.
 * @param el The element to extract text from.
 * @returns The trimmed text content.
 */
function getElementText(el: TeiElement | undefined): string {
    if (!el) return '';
    let text = '';
    if (el.type === 'text' && el.text) {
        text += el.text;
    }
    if (el.elements) {
        for (const child of el.elements) {
            text += getElementText(child) + ' '; // Add space between elements
        }
    }
    return text.replace(/\s+/g, ' ').trim();
}


/**
 * Creates a structured text representation of the paper, marking different element types.
 * @param tei The root TEI element.
 * @returns A string with structured text content.
 */
function getStructuredText(tei: TeiElement): string {
    const textEl = findElements(tei, 'text')[0];
    if (!textEl) return '';

    const contentParts: string[] = [];
    
    const bodyEl = findElements(textEl, 'body')[0];

    if (bodyEl && bodyEl.elements) {
        bodyEl.elements.forEach(div => {
            if (div.name === 'div') {
                const heading = getElementText(findElements(div, 'head')[0]);
                if(heading) contentParts.push(`\n## ${heading}\n`);

                if (div.elements) {
                     div.elements.forEach(child => {
                        if (child.name === 'p') {
                            contentParts.push(getElementText(child));
                        } else if (child.name === 'figure') {
                            const figText = getElementText(child);
                            if(figText) contentParts.push(`[FIGURE] ${figText}`);
                        }
                    });
                }
            }
        });
    }

    const tables = findElements(textEl, 'figure')
        .filter(fig => fig.attributes?.type === 'table')
        .map(tableEl => `[TABLE]\n${getElementText(tableEl)}\n[/TABLE]`);
        
    contentParts.push(...tables);

    return contentParts.join('\n\n');
}


/**
 * Parses the bibliography section of the TEI XML to extract structured references.
 * @param tei The root TEI element.
 * @returns An array of GrobidReference objects.
 */
function parseBibliography(tei: TeiElement): GrobidReference[] {
    const listBibl = findElements(tei, 'listBibl')[0];
    if (!listBibl) {
        console.log('  - ⚠️ No bibliography list found in GROBID output');
        return [];
    }
    
    const biblStructs = findElements(listBibl, 'biblStruct');
    const results: GrobidReference[] = [];
    
    for (const bibl of biblStructs) {
        if (!bibl.attributes || !bibl.attributes['xml:id']) continue;
        
        const id = bibl.attributes['xml:id'];
        const analytic = findElements(bibl, 'analytic')[0];
        const monogr = findElements(bibl, 'monogr')[0];
        
        if (!analytic && !monogr) continue;

        const titleEl = findElements(analytic || monogr, 'title')[0];
        const title = getElementText(titleEl);

        if (!title) continue;

        const authors = findElements(analytic || monogr, 'author').map(authorEl => {
            const persName = findElements(authorEl, 'persName')[0];
            const forename = getElementText(findElements(persName, 'forename')[0]);
            const surname = getElementText(findElements(persName, 'surname')[0]);
            return `${forename} ${surname}`.trim();
        }).filter(Boolean);

        const dateEl = findElements(monogr, 'date')[0];
        const yearStr = dateEl?.attributes?.when;
        const year = yearStr ? parseInt(yearStr.substring(0, 4), 10) : undefined;
        
        results.push({ id, title, authors, year });
    }
    
    return results;
}

/**
 * Parses the main body of the TEI XML to find citation contexts.
 * It links in-text <ref> tags to the bibliography.
 * @param tei The root TEI element.
 * @param references A list of parsed bibliography references.
 * @returns An array of GrobidContext objects.
 */
function parseCitationContexts(tei: TeiElement, references: GrobidReference[]): GrobidContext[] {
    const contexts: GrobidContext[] = [];
    const refMap = new Map(references.map(r => [`#${r.id}`, r]));
    const textEl = findElements(tei, 'text')[0];

    if (!textEl) {
        console.log('  - ⚠️ No <text> element found in GROBID output');
        return [];
    }

    const paragraphs = findElements(textEl, 'p');
    console.log(`  - 🔍 Found ${paragraphs.length} paragraphs to analyze for contexts`);

    for (const p of paragraphs) {
        const refs = findElements(p, 'ref');
        if (refs.length === 0) continue;

        const rawContext = getElementText(p);
        
        // This simplistic section finding can be improved if needed
        const sectionName = p.elements?.find(el => el.name === 'head')?.text || 'unknown';
        
        for (const ref of refs) {
            if (!ref.attributes || !ref.attributes.target) continue;
            
            const targetId = ref.attributes.target; 
            if (!refMap.has(targetId)) continue;
            
            const linkedRef = refMap.get(targetId)!;
            const mentionText = getElementText(ref);

            contexts.push({
                linkedReference: linkedRef,
                mention: {
                    targetId: targetId.substring(1), // remove '#' for consistency
                    text: mentionText,
                },
                raw_context: rawContext,
                section_name: sectionName,
            });
        }
    }
    return contexts;
}


/**
 * Creates the cache directory if it doesn't exist.
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create GROBID cache directory:', error);
  }
}

/**
 * Extracts the abstract from the raw text of the first few pages of a PDF.
 * @param rawText The concatenated text from the first 1-2 pages.
 * @returns The abstract string, or an empty string if not found.
 */
function extractAbstractFromPdfText(rawText: string): string {
    const lines = rawText.split('\n').map(line => line.trim());
    
    // Find the line index where "Abstract" or "ABSTRACT" is mentioned
    const abstractIndex = lines.findIndex(line => line.toLowerCase() === 'abstract');

    if (abstractIndex === -1) {
        console.log("  - ⚠️ 'Abstract' keyword not found in the first two pages.");
        return "";
    }

    // Start collecting lines after the "Abstract" heading
    let abstractLines: string[] = [];
    for (let i = abstractIndex + 1; i < lines.length; i++) {
        const line = lines[i];

        // Stop condition: a new section heading (e.g., "1. Introduction", "Introduction", "I. INTRODUCTION")
        const isNewSection = /^(i\. |1\.? |introduction)/i.test(line);

        if (isNewSection && abstractLines.length > 0) {
            break;
        }
        
        if (line) { // Add non-empty lines
            abstractLines.push(line);
        }
    }
    
    const abstract = abstractLines.join(' ');
    console.log(`  - ✅ Extracted abstract using pdf-parse (${abstract.length} chars).`);
    return abstract;
}

/**
 * Processes a PDF with GROBID to get structured data, excluding the abstract.
 * @param pdfPath The local path to the PDF file.
 * @returns A promise resolving to the GROBID data.
 */
async function extractGrobidData(pdfPath: string) {
    console.log(`  - 🤖 Sending PDF to GROBID for processing...`);
    try {
        const pdfBuffer = await readFile(pdfPath);
        const formData = new FormData();
        const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
        formData.append('input', pdfBlob, 'input.pdf');
        formData.append('consolidateCitations', '1'); 

        const response = await fetch(GROBID_URL, { method: 'POST', body: formData });

        if (!response.ok) {
            throw new Error(`GROBID API error! status: ${response.status}, message: ${await response.text()}`);
        }

        const teiXml = await response.text();
        const teiJs = convert.xml2js(teiXml, { compact: false }) as TeiElement;
        
        if (!teiJs || !teiJs.elements || teiJs.elements.length === 0) {
            throw new Error('Invalid TEI XML structure received from GROBID');
        }
        
        const fileDesc = findElements(teiJs, 'fileDesc')[0];
        const titleStmt = findElements(fileDesc, 'titleStmt')[0];
        const extractedTitle = getElementText(findElements(titleStmt, 'title')[0]);
        
        const bodyText = getElementText(findElements(teiJs, 'text')[0]);
        const structuredText = getStructuredText(teiJs);

        const publicationStmt = findElements(fileDesc, 'publicationStmt')[0];
        const publishedDate = findElements(publicationStmt, 'date')[0]?.attributes?.when || null;
        
        const references = parseBibliography(teiJs);
        const contexts = parseCitationContexts(teiJs, references);

        console.log(`  - ✅ GROBID processing successful. Found ${references.length} biblio entries and ${contexts.length} contexts.`);
        
        return {
            paperTitle: extractedTitle,
            fullText: bodyText,
            structuredText,
            references,
            contexts,
            publishedDate,
        };

    } catch (e) {
        const msg = e instanceof Error ? e.message : "An unknown error occurred";
        if(msg.includes('fetch failed')) {
            console.error(`  - ❌ GROBID connection failed. Is the GROBID Docker container running on port 8070?`);
        } else {
             console.error(`  - ❌ GROBID processing failed:`, msg);
        }
        throw e;
    }
}


/**
 * Extracts comprehensive data from a PDF file using a two-step process and a file-based cache.
 * Step 1: Use `pdf-parse` to quickly extract the abstract.
 * Step 2: Use GROBID to extract body text, references, and citation contexts.
 * Step 3: Combine results and save to a persistent file cache.
 * @param pdfPath The local path to the PDF file.
 * @param paperTitle The true title of the paper, used to generate the cache key.
 * @param cache The in-memory cache for the current pipeline run.
 * @returns A promise resolving to the final structured GrobidOutput object.
 */
export async function extractDataFromPdf(pdfPath: string, paperTitle: string, cache: Map<string, GrobidOutput>): Promise<GrobidOutput> {
    const cacheKey = paperTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check in-memory cache first
    if (cache.has(cacheKey)) {
        console.log(`  - ✅ Using in-memory GROBID data for: ${paperTitle}`);
        return cache.get(cacheKey)!;
    }
    
    await ensureCacheDir();
    const cacheFilePath = join(CACHE_DIR, `${cacheKey}.json`);

    try {
        const cachedData = await readFile(cacheFilePath, 'utf-8');
        console.log(`  - ✅ Using file-cached GROBID data for: ${paperTitle}`);
        const parsedData = JSON.parse(cachedData);
        cache.set(cacheKey, parsedData); // Add to in-memory cache for this run
        return parsedData;
    } catch (e) {
        if (e instanceof Error && 'code' in e && e.code !== 'ENOENT') {
            console.warn(`  - ⚠️ Could not read GROBID cache file:`, e.message);
        }
    }
    
    // --- Step 1: New Abstract Extraction with pdf-parse ---
    let abstract = '';
    try {
        const dataBuffer = await readFile(pdfPath);
        // Lazy import to prevent import-time execution in some SSR builds
        const pdf = (await import('pdf-parse')).default;
        // Limit parsing to the first 2 pages for efficiency
        const pdfData = await pdf(dataBuffer, { max: 2 });
        abstract = extractAbstractFromPdfText(pdfData.text);
    } catch(err) {
        console.error('  - ❌ Failed to extract abstract with pdf-parse:', err);
    }

    // --- Step 2: Run GROBID for everything else ---
    const grobidData = await extractGrobidData(pdfPath);
    
    // --- Step 3: Combine Results, using abstract from pdf-parse
    const finalOutput: GrobidOutput = {
        paperTitle: grobidData.paperTitle || paperTitle,
        abstract: abstract,
        fullText: (abstract ? abstract + '\n\n' : '') + grobidData.fullText,
        structuredText: (abstract ? `## Abstract\n${abstract}\n\n` : '') + grobidData.structuredText,
        references: grobidData.references,
        contexts: grobidData.contexts,
        publishedDate: grobidData.publishedDate,
    };
    
    // --- Step 4: Save to cache ---
    try {
        await writeFile(cacheFilePath, JSON.stringify(finalOutput, null, 2), 'utf-8');
        console.log(`  - 💾 Saved combined output to cache for "${paperTitle}"`);
    } catch (cacheError) {
        console.error(`  - ❌ Failed to write to GROBID cache:`, cacheError);
    }

    cache.set(cacheKey, finalOutput); // Add to in-memory cache for this run
    
    return finalOutput;
}
