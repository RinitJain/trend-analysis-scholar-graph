// src/app/api/read-graph/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const filePath = path.join(process.cwd(), 'citation_graph.json');
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error) {
    // If the file doesn't exist, it's a legitimate loading state, not an error.
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }
    // For any other error (like a parsing error if the file is corrupt), log it and return a server error.
    console.error('Failed to read or parse graph file:', error);
    return NextResponse.json({ error: 'Failed to read graph data' }, { status: 500 });
  }
}
