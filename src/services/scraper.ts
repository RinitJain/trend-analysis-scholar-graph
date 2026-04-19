

/**
 * @fileoverview This file contains functions for fetching HTML content from URLs.
 * It provides a robust `fetchHtmlAuto` function that first attempts a lightweight
 * static fetch and falls back to a full browser rendering with Playwright if
 * necessary.
 */

import * as playwright from 'playwright-core';
import * as cheerio from 'cheerio';

/**
 * Wraps a promise with a timeout.
 * @param promise The promise to wrap.
 * @param timeoutMs The timeout in milliseconds.
 * @param timeoutMessage The message for the error thrown on timeout.
 * @returns A new promise that rejects on timeout.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(timeoutMessage));
        }, timeoutMs);

        promise.then(
            (res) => {
                clearTimeout(timeoutId);
                resolve(res);
            },
            (err) => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
}


/**
 * Fetches HTML content using a simple HTTP GET request.
 * @param url The URL to fetch.
 * @returns A promise that resolves to the HTML content.
 */
async function fetchHtmlWithRequests(url: string): Promise<string> {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }});
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.text();
}

/**
 * Fetches HTML content using a headless browser (Playwright).
 * @param url The URL to fetch.
 * @returns A promise that resolves to the HTML content.
 */
async function fetchHtmlWithPlaywright(url: string): Promise<string> {
    let browser = null;
    try {
        console.log("  - 🌐 Launching headless browser to render JS...");
        browser = await playwright.chromium.launch({ headless: true });
        const page = await browser.newPage();
        await withTimeout(
            page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
            60000,
            `Playwright navigation to ${url} timed out.`
        );
        const html = await page.content();
        return html;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Automatically determines the best method to fetch HTML.
 * It first tries a simple static request with a timeout. If that fails or
 * doesn't contain a `<table>` element, it falls back to using a headless
 * browser to render the page fully.
 * @param url The URL to fetch.
 * @returns A promise that resolves to the HTML content.
 */
export async function fetchHtmlAuto(url: string): Promise<string> {
    try {
        const staticFetchPromise = fetchHtmlWithRequests(url);
        const html = await withTimeout(staticFetchPromise, 10000, `Static fetch for ${url} timed out.`);

        const $ = cheerio.load(html);
        // A page is considered "good enough" if it has a table, links, or a title.
        // This is a heuristic to avoid using Playwright unless necessary.
        if ($('table').length || $('a').length || $('title').text()) {
            return html;
        } else {
            console.log('  - ⚠️ No meaningful content found with static request, trying Playwright...');
        }
    } catch (e) {
        const error = e as Error;
        console.log(`  - ⚠️ Static request failed: ${error.message}, falling back to Playwright...`);
    }

    const html = await fetchHtmlWithPlaywright(url);
    console.log('  - ✅ Loaded via Playwright (JS-rendered)');
    return html;
}


/**
 * Extracts the primary title from an HTML document.
 * It prioritizes the <meta property="og:title"> tag, then the main <title> tag.
 * @param html The HTML content of the paper's source page (e.g., arXiv abstract page).
 * @param fallbackTitle A title to use if no suitable title can be extracted.
 * @returns The extracted "true" title of the paper.
 */
export function extractTruePaperTitle(html: string, fallbackTitle: string): string {
    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle) {
        return ogTitle.trim();
    }
    const pageTitle = $('title').first().text();
    if (pageTitle) {
        // Clean up titles that often include site names or other cruft
        return pageTitle.split('|')[0].split(' - ')[0].trim();
    }
    return fallbackTitle;
}


/**
 * Wraps the fetchHtmlAuto function. The timeout is now handled internally
 * by fetchHtmlAuto, making this wrapper simpler.
 * @param url The URL to fetch.
 * @returns A promise that resolves to the HTML content or rejects on timeout.
 */
export async function fetchHtmlWithTimeout(url: string): Promise<string> {
    return fetchHtmlAuto(url);
}
