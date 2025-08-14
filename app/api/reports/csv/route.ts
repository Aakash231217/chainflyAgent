import { NextRequest, NextResponse } from 'next/server';
import { createObjectCsvStringifier } from 'csv-writer';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Enterprise constants
const VALID_REPORT_TYPES = ['comprehensive', 'defects', 'maintenance', 'executive'];
const VALID_DATE_RANGES = ['today', 'last-7-days', 'last-30-days', 'last-90-days', 'custom'];
const MAX_EXPORT_ROWS = 100000; // 100k rows max
const MAX_EXPORT_SIZE = 50 * 1024 * 1024; // 50MB

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
    
    // In production, this would query from database with proper pagination
    // For now, using sample data with row limit check
    const inspectionData = [
      {
        location: 'Site A - Panel 1',
        date: '2024-04-15',
        severity: 'Critical',
        issuesFound: 'Hotspot detected',
        recommendation: 'Immediate repair',
        temperature: '85°C',
        efficiency: '72%',
        defectType: 'Thermal',
        gpsLat: '37.7749',
        gpsLng: '-122.4194'
      },
      {
        location: 'Site A - Panel 2',
        date: '2024-04-15',
        severity: 'Normal',
        issuesFound: 'No issues',
        recommendation: 'Routine maintenance',
        temperature: '45°C',
        efficiency: '95%',
        defectType: 'None',
        gpsLat: '37.7749',
        gpsLng: '-122.4194'
      },
      {
        location: 'Site B - Panel 1',
        date: '2024-04-16',
        severity: 'Warning',
        issuesFound: 'Minor cracks',
        recommendation: 'Monitor closely',
        temperature: '65°C',
        efficiency: '85%',
        defectType: 'Physical',
        gpsLat: '37.7849',
        gpsLng: '-122.4094'
      },
      {
        location: 'Site B - Panel 2',
        date: '2024-04-16',
        severity: 'Normal',
        issuesFound: 'No issues',
        recommendation: 'Routine maintenance',
        temperature: '48°C',
        efficiency: '94%',
        defectType: 'None',
        gpsLat: '37.7849',
        gpsLng: '-122.4094'
      },
      {
        location: 'Site C - Panel 1',
        date: '2024-04-17',
        severity: 'Critical',
        issuesFound: 'Multiple hotspots',
        recommendation: 'Replace panel',
        temperature: '92°C',
        efficiency: '65%',
        defectType: 'Thermal',
        gpsLat: '37.7949',
        gpsLng: '-122.3994'
      }
    ];
    
    // Create CSV stringifier
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'location', title: 'Location' },
        { id: 'date', title: 'Inspection Date' },
        { id: 'severity', title: 'Severity' },
        { id: 'issuesFound', title: 'Issues Found' },
        { id: 'recommendation', title: 'Recommendation' },
        { id: 'temperature', title: 'Temperature' },
        { id: 'efficiency', title: 'Efficiency' },
        { id: 'defectType', title: 'Defect Type' },
        { id: 'gpsLat', title: 'GPS Latitude' },
        { id: 'gpsLng', title: 'GPS Longitude' }
      ]
    });
    
    // Generate CSV content
    const csvHeader = csvStringifier.getHeaderString();
    const csvRecords = csvStringifier.stringifyRecords(inspectionData);
    const csvContent = csvHeader + csvRecords;
    
    // Add summary section
    const summaryData = [
      [''],
      ['Summary Statistics'],
      ['Total Inspections', inspectionData.length.toString()],
      ['Critical Issues', inspectionData.filter(d => d.severity === 'Critical').length.toString()],
      ['Warning Issues', inspectionData.filter(d => d.severity === 'Warning').length.toString()],
      ['Normal Status', inspectionData.filter(d => d.severity === 'Normal').length.toString()],
      ['Average Temperature', `${Math.round(inspectionData.reduce((sum, d) => sum + parseInt(d.temperature), 0) / inspectionData.length)}°C`],
      ['Average Efficiency', `${Math.round(inspectionData.reduce((sum, d) => sum + parseInt(d.efficiency), 0) / inspectionData.length)}%`],
      [''],
      ['Report Details'],
      ['Report Type', reportType],
      ['Date Range', dateRange],
      ['Generated', new Date().toLocaleString()]
    ];
    
    // Append summary
    const summaryCSV = summaryData.map(row => row.join(',')).join('\n');
    const fullCSV = csvContent + '\n' + summaryCSV;
    
    // Convert to buffer with sanitization
    const csvBuffer = Buffer.from(fullCSV, 'utf-8');
    
    // Size validation
    if (csvBuffer.length > MAX_EXPORT_SIZE) {
      throw new Error(`Generated CSV exceeds maximum size limit of ${MAX_EXPORT_SIZE / 1024 / 1024}MB`);
    }
    
    // Row count validation
    const rowCount = inspectionData.length;
    if (rowCount > MAX_EXPORT_ROWS) {
      throw new Error(`Export exceeds maximum row limit of ${MAX_EXPORT_ROWS.toLocaleString()} rows`);
    }
    
    // Create secure filename
    const sanitizedReportType = reportType.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `ChainFly_${sanitizedReportType}_${timestamp}_${reportId.slice(0, 8)}.csv`;
    
    // Save export record with enhanced metadata
    const exportRecord = {
      reportId,
      filename,
      type: 'csv',
      dateRange,
      reportType,
      createdAt: new Date().toISOString(),
      size: csvBuffer.length,
      rowCount,
      processingTime: Date.now() - startTime,
      userAgent,
      status: 'completed',
      checksum: crypto.createHash('sha256').update(csvBuffer).digest('hex').slice(0, 16)
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
    console.log(`[REPORT] CSV generated successfully: ${JSON.stringify({
      reportId,
      type: reportType,
      dateRange,
      size: csvBuffer.length,
      rowCount,
      processingTime: Date.now() - startTime
    })}`);
    
    // Return CSV as response with security headers
    return new NextResponse(csvBuffer, {
      headers: {
        ...securityHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${exportRecord.filename}"`,
        'Content-Length': csvBuffer.length.toString(),
        'X-Report-ID': reportId,
        'X-Row-Count': rowCount.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[REPORT] CSV generation failed: ${JSON.stringify({
      reportId,
      error: errorMessage,
      processingTime: Date.now() - startTime
    })}`);
    
    // Return user-friendly error
    const userError = errorMessage.includes('size limit') 
      ? 'Report too large. Please select a smaller date range.'
      : errorMessage.includes('row limit')
      ? 'Too many records. Please narrow your search criteria.'
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
