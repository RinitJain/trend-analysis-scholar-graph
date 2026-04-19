

/**
 * @fileoverview This file provides functionality to resolve and find the
 * best PDF link from a given data row, which may contain various links.
 * It includes logic for handling direct PDF links, arXiv pages, and
 * fetching content from other pages to find the PDF.
 */
import { fetchHtmlWithTimeout } from '@/services/scraper';
import * as cheerio from 'cheerio';

/**
 * Checks if a given URL string points directly to a PDF file.
 * @param url The URL to check.
 * @returns True if the URL ends with '.pdf', case-insensitively.
 */
function isPdfUrl(url: string): boolean {
    try {
        const path = new URL(url).pathname.toLowerCase();
        return path.endsWith('.pdf') || isArxivPdf(url);
    } catch {
        return false;
    }
}

/**
 * Checks if a given URL is an arXiv abstract page.
 * @param url The URL to check.
 * @returns True if the URL is from 'arxiv.org/abs/'.
 */
function isArxivAbs(url: string): boolean {
    return url.includes('arxiv.org/abs/');
}

/**
 * Checks if a given URL is an arXiv PDF page.
 * @param url The URL to check.
 * @returns True if the URL is from 'arxiv.org/pdf/'.
 */
function isArxivPdf(url: string): boolean {
    return url.includes('arxiv.org/pdf/');
}

/**
 * Converts known URL patterns to their direct PDF equivalents.
 * @param url The URL to convert.
 * @returns A direct PDF URL string, or null if no pattern matches.
 */
export function convertKnownPdfPatterns(url:string): string | null {
    if (isArxivAbs(url)) {
        const arxivId = url.split('arxiv.org/abs/').pop()?.replace(/\.pdf$/i, ''); // More robustly remove .pdf
        return arxivId ? `https://arxiv.org/pdf/${arxivId}.pdf` : null;
    }

    if (url.includes('openreview.net/forum?id=')) {
        const paperId = new URL(url).searchParams.get('id');
        return paperId ? `https://openreview.net/pdf?id=${paperId}` : null;
    }

    // Handle ACL Anthology links (e.g., .../2020.findings-emnlp.438/)
    if (url.includes('aclanthology.org') && !url.endsWith('.pdf')) {
        // Avoid adding .pdf if it's already there
        const path = new URL(url).pathname;
        if (path.endsWith('/')) {
             return `${url.slice(0, -1)}.pdf`;
        }
        return `${url}.pdf`;
    }

    return null;
}

/**
 * Scrapes the publication date from an arXiv abstract page.
 * @param html The HTML content of the arXiv page.
 * @returns The publication date string, or null if not found.
 */
export function scrapeArxivDate(html: string): string | null {
    const $ = cheerio.load(html);
    
    // First, try the specific proceedings format
    const proceedingsText = $('body').text();
    const proceedingsMatch = proceedingsText.match(/(\w+\s+\d{1,2}-\d{1,2},\s+\d{4})/);
    if(proceedingsMatch && proceedingsMatch[1]) {
        try {
            // Take the first part of the date range
            const dateStr = proceedingsMatch[1].split('-')[0] + ', ' + proceedingsMatch[1].split(', ')[1];
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate.toISOString().split('T')[0];
            }
        } catch(e){}
    }
    
    // Fallback to arXiv dateline
    const dateline = $('.dateline').text(); // e.g., "[Submitted on 31 Aug 2017 (v1), last revised 9 Nov 2017 (this version, v7)]"
    const match = dateline.match(/(?:revised|Submitted on) (.*?)(?: \s*\(|\])/);
    
    if (match && match[1]) {
        try {
            const parsedDate = new Date(match[1]);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate.toISOString().split('T')[0];
            }
            return match[1].trim(); 
        } catch (e) {
            return match[1].trim(); 
        }
    }
    return null;
}

/**
 * Extracts all potential URL candidates from a data row object.
 * It intelligently looks for links in cell objects and string values that are valid URLs.
 * @param row The data row object from the parsed table.
 * @returns A list of candidate URL strings.
 */
function extractCandidateLinks(row: Record<string, any>): string[] {
    const links = new Set<string>();

    // This order matters: prioritize specific fields first
    const prioritizedFields = ['result_url', 'paper_url', 'pdf_url', 'Model', 'paper_title', 'code_url'];

    for (const field of prioritizedFields) {
        const value = row[field];
        if (!value) continue;

        if (typeof value === 'string' && value.startsWith('http')) {
             links.add(value);
        }
         if (typeof value === 'object' && value !== null && 'links' in value && Array.isArray(value.links)) {
            for (const link of value.links) {
                if (typeof link === 'string' && link.startsWith('http')) {
                    links.add(link);
                }
            }
        }
    }

    // Fallback to checking all other values
    for (const value of Object.values(row)) {
        // Case 1: The value is a cell object with a 'links' array (from parser)
        if (typeof value === 'object' && value !== null && 'links' in value && Array.isArray(value.links)) {
            for (const link of value.links) {
                if (typeof link === 'string' && link.startsWith('http')) {
                    links.add(link);
                }
            }
        }
        // Case 2: The value is a string that is a URL, with additional filtering
        else if (typeof value === 'string' && value.startsWith('http') && !value.includes('github.com/blob/') && !value.startsWith('mailto:')) {
            links.add(value);
        }
    }
    return Array.from(links);
}

/**
 * Extracts all links from an HTML string, analyzing the link text for clues.
 * @param html The HTML content.
 * @param base_url The base URL for resolving relative links.
 * @returns A list of objects containing the URL and link text.
 */
export function extractLinksFromHtml(html: string, base_url: string): {url: string, text: string}[] {
    const $ = cheerio.load(html);
    const links: {url: string, text: string}[] = [];
    const seenUrls = new Set<string>();

    $('a[href]').each((i, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const linkText = $(el).text().trim();
        try {
            const absoluteUrl = new URL(href, base_url).toString();
            if (!seenUrls.has(absoluteUrl)) {
                links.push({ url: absoluteUrl, text: linkText });
                seenUrls.add(absoluteUrl);
            }
        } catch (e) {
            // Ignore invalid URLs
        }
    });
    return links;
}


/**
 * Given a list of URLs, finds the "best" one that points to a PDF using a scoring heuristic.
 * @param links A list of URLs found on a page.
 * @param baseUrl The base URL of the page.
 * @returns The best PDF link, or null if none is suitable.
 */
export function getBestPdfLink(links: { url: string; text: string }[], baseUrl: string): string | null {
    if (!links.length) return null;

    const priorityDomains = [
        "arxiv.org", "aclweb.org", "openaccess.thecvf.com", "papers.nips.cc",
        "openreview.net", "ieeexplore.ieee.org", "aclanthology.org", "springer.com",
        "jmlr.org", "semanticscholar.org", "nature.com"
    ];

    const scoredLinks: { url: string; score: number }[] = [];

    for (const link of links) {
        let score = 0;
        const linkText = link.text.toLowerCase();
        const linkUrl = link.url.toLowerCase();

        if (linkUrl.endsWith(".pdf")) score += 100;
        if (linkText.includes("pdf") || linkText.includes("download")) score += 50;
        if (linkText.includes("paper") || linkText.includes("full text")) score += 25;
        if (linkUrl.includes("/pdf/") || linkUrl.includes("download")) score += 20;
        if (linkUrl.includes("supplementary") || linkText.includes("supp")) score -= 20;

        for (const domain of priorityDomains) {
            if (linkUrl.includes(domain)) score += 30;
        }

        if (score > 0) {
            try {
                const absoluteUrl = new URL(link.url, baseUrl).toString();
                scoredLinks.push({ url: absoluteUrl, score });
            } catch (e) {
                // Ignore invalid URL
            }
        }
    }

    if (!scoredLinks.length) {
         return null;
    }

    scoredLinks.sort((a, b) => b.score - a.score);
    return scoredLinks[0].url;
}

/**
 * Checks if a URL should be skipped from processing.
 * @param url The URL to check.
 * @returns True if the URL points to a non-paper file or a code repo view.
 */
function shouldSkipUrl(url: string): boolean {
    const excludedExtensions = ['.md', '.zip', '.txt', '.bib'];
    const excludedPathSegments = ['/blob/', '/tree/'];
    
    try {
        const lowerUrl = url.toLowerCase();
        const pathname = new URL(lowerUrl).pathname;

        if (excludedExtensions.some(ext => pathname.endsWith(ext))) {
            return true;
        }
        if (excludedPathSegments.some(seg => pathname.includes(seg))) {
            return true;
        }
    } catch(e) {
        // Invalid URL, should be skipped
        return true;
    }

    return false;
}


/**
 * The main resolver function. It takes a row of data from a parsed table
 * and attempts to find the most likely PDF URL and publication date.
 * @param row A data object representing a row from a table.
 * @returns A promise that resolves to the PDF URL, source URL, and date, or nulls if not found.
 */
export async function resolvePdfUrlAndDateFromRow(row: Record<string, any>): Promise<{ pdfUrl: string | null, sourceUrl: string | null, publishedDate: string | null }> {
    const candidateLinks = extractCandidateLinks(row);
    
    let resolvedPdfUrl: string | null = null;
    let resolvedSourceUrl: string | null = null;
    let resolvedDate: string | null = null;
    
    // --- Pass 1: Prioritize finding a direct PDF link ---
    for (const link of candidateLinks) {
        if (isPdfUrl(link)) {
            resolvedPdfUrl = link;
            if (isArxivPdf(link)) {
                // If it's a direct arXiv PDF, derive the abstract page to scrape the date
                const absUrl = link.replace('/pdf/', '/abs/').replace('.pdf', '');
                resolvedSourceUrl = absUrl;
                try {
                    const pageHtml = await fetchHtmlWithTimeout(absUrl);
                    resolvedDate = scrapeArxivDate(pageHtml);
                } catch (e) {
                    console.error(`      - ⚠️ Failed to scrape date from derived arXiv page ${absUrl}: ${(e as Error).message}`);
                }
            } else {
                // For any other direct PDF, the source is the PDF link itself
                resolvedSourceUrl = link;
            }
            // A direct PDF is the best possible outcome, so we can stop here.
            return { pdfUrl: resolvedPdfUrl, sourceUrl: resolvedSourceUrl, publishedDate: resolvedDate };
        }
    }

    // --- Pass 2: If no direct PDF, look for convertible links (e.g., arXiv abstract pages) ---
    for (const link of candidateLinks) {
        if (shouldSkipUrl(link)) continue;
        
        try {
            const convertedPdfUrl = convertKnownPdfPatterns(link);
            if (convertedPdfUrl) {
                resolvedPdfUrl = convertedPdfUrl;
                resolvedSourceUrl = link; 

                // If it's an arXiv link, scrape the date from the source page.
                if (isArxivAbs(link)) {
                    const pageHtml = await fetchHtmlWithTimeout(link);
                    resolvedDate = scrapeArxivDate(pageHtml);
                }
                // Found a high-confidence convertible link, stop here.
                return { pdfUrl: resolvedPdfUrl, sourceUrl: resolvedSourceUrl, publishedDate: resolvedDate };
            }
        } catch(e) {
             console.error(`      - ❌ Unhandled error processing convertible link "${link}". Error: ${(e as Error).message}`);
             continue;
        }
    }
    
    // --- Pass 3: If still no PDF, scrape landing pages to find a link ---
     for (const link of candidateLinks) {
        if (shouldSkipUrl(link)) continue;
        
         try {
            const domainsToSkip = ['github.com', 'huggingface.co'];
            if(domainsToSkip.some(domain => new URL(link).hostname.includes(domain))) {
                continue;
            }
            
            const paperHtml = await fetchHtmlWithTimeout(link);
            const bestPdf = getBestPdfLink(extractLinksFromHtml(paperHtml, link), link);
            
            if (bestPdf) {
                resolvedPdfUrl = bestPdf;
                resolvedSourceUrl = link;
                
                const scrapedDate = scrapeArxivDate(paperHtml);
                 if (scrapedDate) {
                    resolvedDate = scrapedDate;
                 }
                // Found a PDF by scraping, this is our best bet.
                return { pdfUrl: resolvedPdfUrl, sourceUrl: resolvedSourceUrl, publishedDate: resolvedDate };
            }
        } catch(e) {
             console.error(`      - ❌ Unhandled error scraping page "${link}". Error: ${(e as Error).message}`);
             continue;
        }
    }


    return { pdfUrl: null, sourceUrl: null, publishedDate: null };
}


    

    


