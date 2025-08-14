import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Extend jsPDF type to include autoTable
interface AutoTableOptions {
  startY?: number;
  head?: string[][];
  body?: string[][];
  theme?: 'striped' | 'grid' | 'plain';
  styles?: { fontSize?: number };
  headStyles?: { fillColor?: number[] };
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
    lastAutoTable?: { finalY: number };
  }
}

// Enterprise constants
const VALID_REPORT_TYPES = ['comprehensive', 'defects', 'maintenance', 'executive'];
const VALID_DATE_RANGES = ['today', 'last-7-days', 'last-30-days', 'last-90-days', 'custom'];
const MAX_EXPORT_SIZE = 25 * 1024 * 1024; // 25MB

// Security headers
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'"
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const reportId = crypto.randomUUID();
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  try {
    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body', reportId },
        { status: 400, headers: securityHeaders }
      );
    }
    
    const { dateRange, reportType } = requestBody;
    
    // Input validation
    if (!dateRange || !reportType) {
      return NextResponse.json(
        { error: 'Missing required parameters: dateRange and reportType', reportId },
        { status: 400, headers: securityHeaders }
      );
    }
    
    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return NextResponse.json(
        { 
          error: `Invalid report type. Valid types: ${VALID_REPORT_TYPES.join(', ')}`,
          reportId 
        },
        { status: 400, headers: securityHeaders }
      );
    }
    
    if (!VALID_DATE_RANGES.includes(dateRange)) {
      return NextResponse.json(
        { 
          error: `Invalid date range. Valid ranges: ${VALID_DATE_RANGES.join(', ')}`,
          reportId 
        },
        { status: 400, headers: securityHeaders }
      );
    }
    
    // Create PDF document
    const doc = new jsPDF();
    
    // Add header
    doc.setFontSize(20);
    doc.text('Solar Panel Inspection Report', 14, 22);
    
    // Add metadata
    doc.setFontSize(12);
    doc.text(`Report Type: ${reportType}`, 14, 35);
    doc.text(`Date Range: ${dateRange}`, 14, 42);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 49);
    
    // Add summary section
    doc.setFontSize(16);
    doc.text('Executive Summary', 14, 65);
    
    doc.setFontSize(10);
    const summaryText = `This report provides a comprehensive analysis of solar panel inspections 
conducted during the specified period. The analysis includes defect detection, 
hotspot identification, and maintenance recommendations.`;
    
    const splitText = doc.splitTextToSize(summaryText, 180);
    doc.text(splitText, 14, 75);
    
    // Add inspection data table
    doc.setFontSize(16);
    doc.text('Inspection Results', 14, 100);
    
    // Sample data - in production, this would come from your database
    const tableData = [
      ['Site A - Panel 1', '2024-04-15', 'Critical', 'Hotspot detected', 'Immediate repair'],
      ['Site A - Panel 2', '2024-04-15', 'Normal', 'No issues', 'Routine maintenance'],
      ['Site B - Panel 1', '2024-04-16', 'Warning', 'Minor cracks', 'Monitor closely'],
      ['Site B - Panel 2', '2024-04-16', 'Normal', 'No issues', 'Routine maintenance'],
      ['Site C - Panel 1', '2024-04-17', 'Critical', 'Multiple hotspots', 'Replace panel'],
    ];
    
    autoTable(doc, {
      startY: 110,
      head: [['Location', 'Date', 'Severity', 'Issues Found', 'Recommendation']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [59, 130, 246] }, // Blue color
    });
    
    // Add statistics section with real calculations
    // Get the final Y position from the last autoTable call
    const finalY = doc.lastAutoTable?.finalY || 160;
    doc.setFontSize(16);
    doc.text('Statistics Overview', 14, finalY + 20);
    
    // Calculate real statistics
    const totalInspections = tableData.length;
    const criticalCount = tableData.filter(row => row[2] === 'Critical').length;
    const warningCount = tableData.filter(row => row[2] === 'Warning').length;
    const normalCount = tableData.filter(row => row[2] === 'Normal').length;
    
    doc.setFontSize(10);
    doc.text(`• Total Inspections: ${totalInspections}`, 14, finalY + 30);
    doc.text(`• Critical Issues: ${criticalCount} (${((criticalCount/totalInspections)*100).toFixed(1)}%)`, 14, finalY + 37);
    doc.text(`• Warning Issues: ${warningCount} (${((warningCount/totalInspections)*100).toFixed(1)}%)`, 14, finalY + 44);
    doc.text(`• Normal Status: ${normalCount} (${((normalCount/totalInspections)*100).toFixed(1)}%)`, 14, finalY + 51);
    
    // Add report metadata
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Report ID: ${reportId}`, 14, 280);
    doc.text(`Generated by ChainFly AI Analytics Platform`, 14, 285);
    doc.text('© 2024 ChainFly - Enterprise Solar Intelligence', 14, 290);
    
    // Add recommendations section
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Maintenance Recommendations', 14, 20);
    
    doc.setFontSize(10);
    const recommendations = [
      '1. Priority 1: Replace panels at Site C due to multiple hotspots',
      '2. Priority 2: Immediate repair required for Site A Panel 1',
      '3. Priority 3: Schedule inspection for Site B Panel 1 within 30 days',
      '4. Continue routine maintenance for panels showing normal status',
      '5. Consider thermal imaging inspection for all sites next quarter'
    ];
    
    let yPos = 35;
    recommendations.forEach(rec => {
      const lines = doc.splitTextToSize(rec, 180);
      doc.text(lines, 14, yPos);
      yPos += lines.length * 5 + 5;
    });
    
    // Convert to buffer with size check
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    if (pdfBuffer.length > MAX_EXPORT_SIZE) {
      throw new Error(`Generated PDF exceeds maximum size limit of ${MAX_EXPORT_SIZE / 1024 / 1024}MB`);
    }
    
    // Create secure filename
    const sanitizedReportType = reportType.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `ChainFly_${sanitizedReportType}_${timestamp}_${reportId.slice(0, 8)}.pdf`;
    
    // Save export record with enhanced metadata
    const exportRecord = {
      reportId,
      filename,
      type: 'pdf',
      dateRange,
      reportType,
      createdAt: new Date().toISOString(),
      size: pdfBuffer.length,
      processingTime: Date.now() - startTime,
      userAgent,
      status: 'completed',
      checksum: crypto.createHash('sha256').update(pdfBuffer).digest('hex').slice(0, 16)
    };
    
    // Save to exports history file (in production, use database)
    const exportsPath = path.join(process.cwd(), 'data', 'exports.json');
    let exports = [];
    
    try {
      const exportsData = await fs.readFile(exportsPath, 'utf-8');
      exports = JSON.parse(exportsData);
    } catch {
      // File doesn't exist yet
    }
    
    exports.push(exportRecord);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(exportsPath), { recursive: true });
    await fs.writeFile(exportsPath, JSON.stringify(exports, null, 2));
    
    // Log successful generation
    console.log(`[REPORT] PDF generated successfully: ${JSON.stringify({
      reportId,
      type: reportType,
      dateRange,
      size: pdfBuffer.length,
      processingTime: Date.now() - startTime
    })}`);
    
    // Return PDF as response with security headers
    return new NextResponse(pdfBuffer, {
      headers: {
        ...securityHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${exportRecord.filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'X-Report-ID': reportId,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[REPORT] PDF generation failed: ${JSON.stringify({
      reportId,
      error: errorMessage,
      processingTime: Date.now() - startTime
    })}`);
    
    // Return user-friendly error
    const userError = errorMessage.includes('size limit') 
      ? 'Report too large. Please select a smaller date range.'
      : 'Unable to generate report. Please try again or contact support.';
    
    return NextResponse.json(
      { 
        error: userError,
        reportId,
        timestamp: new Date().toISOString()
      },
      { status: 500, headers: securityHeaders }
    );
  }
}
