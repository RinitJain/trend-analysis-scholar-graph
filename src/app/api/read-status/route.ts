
// src/app/api/read-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const filePath = path.join(process.cwd(), 'pipeline_status.json');
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error) {
    // If the file doesn't exist, it's a legitimate loading state for a new search
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return NextResponse.json({ error: 'Status not found' }, { status: 404 });
    }
    // For any other error, log it and return a server error.
    console.error('Failed to read or parse status file:', error);
    return NextResponse.json({ error: 'Failed to read pipeline status' }, { status: 500 });
  }
}
