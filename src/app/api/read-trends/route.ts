// src/app/api/read-trends/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const filePath = path.join(process.cwd(), 'extrapolated_trends.json');
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return NextResponse.json({ error: 'Trends not found' }, { status: 404 });
    }
    console.error('Failed to read trends file:', error);
    return NextResponse.json({ error: 'Failed to read trend data' }, { status: 500 });
  }
}
