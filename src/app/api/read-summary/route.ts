
// src/app/api/read-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const filePath = path.join(process.cwd(), 'detailed_summary.json');
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
    }
    console.error('Failed to read summary file:', error);
    return NextResponse.json({ error: 'Failed to read summary data' }, { status: 500 });
  }
}
