import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface ExportRecord {
  reportId: string;
  filename: string;
  type: string;
  createdAt: string;
  size: number;
  dateRange?: string;
  reportType?: string;
  processingTime?: number;
  userAgent?: string;
  status?: string;
  checksum?: string;
}

export async function GET() {
  try {
    const exportsPath = path.join(process.cwd(), 'data', 'exports.json');
    
    try {
      const exportsData = await fs.readFile(exportsPath, 'utf-8');
      const exports = JSON.parse(exportsData);
      
      // Sort by date, most recent first
      exports.sort((a: ExportRecord, b: ExportRecord) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Return only the most recent 10 exports
      return NextResponse.json({
        exports: exports.slice(0, 10)
      });
      
    } catch {
      console.error('Failed to read exports');
      return NextResponse.json(
        { error: 'Failed to fetch export history' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Failed to fetch export history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch export history' },
      { status: 500 }
    );
  }
}
