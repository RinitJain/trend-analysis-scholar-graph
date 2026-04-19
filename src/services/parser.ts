
/**
 * @fileoverview This file contains a function to parse an HTML table into a
 * structured format (an array of row objects). It's designed to handle
 * tables with and without `<th>` headers and to extract links from cells.
 */
import * as cheerio from 'cheerio';
import { URL } from 'url';

interface CellData {
    text: string;
    links: string[];
}

export type RowData = Record<string, string | CellData>;

/**
 * Parses the first HTML `<table>` found in a string of HTML.
 * It extracts each row into a dictionary where keys are the header columns.
 * It also captures all `<a>` tags within each cell.
 *
 * @param html The raw HTML string to parse.
 * @param base_url The base URL used to resolve any relative links (e.g., '/paper/123').
 * @returns An array of objects, where each object represents a row in the table.
 * @throws An error if no `<table>` element is found in the HTML.
 */
export function parseTable(html: string, base_url: string = ""): RowData[] {
    const $ = cheerio.load(html);
    const table = $('table').first();
    if (!table.length) {
        throw new Error('❌ No <table> found in the HTML');
    }

    let headers: string[] = [];
    table.find('th').each((i, el) => {
        headers[i] = $(el).text().trim();
    });
    
    let dataRows = table.find('tbody tr');
    // If no <tbody>, look for <tr> directly under <table>
     if (dataRows.length === 0) {
        dataRows = table.find('tr');
    }

    if (headers.length === 0 && dataRows.length > 0) {
        const firstRow = dataRows.first();
        headers = firstRow.find('td').map((i, el) => $(el).text().trim()).get();
        dataRows = dataRows.slice(1);
    }

    const rows: RowData[] = [];
    
    const rowsToProcess = dataRows;

    rowsToProcess.each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length === 0) return;
        
        let hasMeaningfulContent = false;

        const values: (string | CellData)[] = [];
        cells.each((j, cell) => {
            const cellText = $(cell).text().trim();
            if (cellText) hasMeaningfulContent = true;
            
            const links: string[] = [];
            $(cell).find('a').each((k, link) => {
                const href = $(link).attr('href');
                if (href) {
                    try {
                        const fullUrl = new URL(href, base_url).toString();
                        links.push(fullUrl);
                    } catch (e) {
                         // Invalid URLs are skipped silently
                    }
                }
            });

            if (links.length > 0) {
                values.push({ text: cellText, links });
                hasMeaningfulContent = true;
            } else {
                values.push(cellText);
            }
        });
        
        if (!hasMeaningfulContent) {
            return;
        }

        const paddedValues = [...values];
        while (paddedValues.length < headers.length) {
            paddedValues.push('');
        }

        const rowDict: RowData = {};
        headers.forEach((header, index) => {
             if (header && index < paddedValues.length) {
                rowDict[header] = paddedValues[index];
            }
        });
        rows.push(rowDict);
    });

    return rows;
}

    