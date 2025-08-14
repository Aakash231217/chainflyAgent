"use client";

import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Filter, Loader2 } from 'lucide-react';

interface ExportRecord {
  filename: string;
  type: string;
  dateRange: string;
  reportType: string;
  createdAt: string;
  size: number;
}

export default function ReportExport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [dateRange, setDateRange] = useState('last-7-days');
  const [reportType, setReportType] = useState('comprehensive');
  const [exportHistory, setExportHistory] = useState<ExportRecord[]>([]);

  useEffect(() => {
    fetchExportHistory();
  }, []);

  const fetchExportHistory = async () => {
    try {
      const response = await fetch('/api/reports/history');
      const data = await response.json();
      setExportHistory(data.exports || []);
    } catch (error) {
      console.error('Failed to fetch export history:', error);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    setIsGenerating(true);
    
    try {
      const response = await fetch(`/api/reports/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRange,
          reportType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${reportType}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Refresh export history
      await fetchExportHistory();
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center">
        <span className="mr-2">📄</span>
        Report Export
      </h2>

      {/* Report Configuration */}
      <div className="space-y-4 mb-6">
        {/* Date Range Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Date Range
          </label>
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Today</option>
              <option value="last-7-days">Last 7 Days</option>
              <option value="last-30-days">Last 30 Days</option>
              <option value="last-quarter">Last Quarter</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Report Type Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Report Type
          </label>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="comprehensive">Comprehensive Analysis</option>
              <option value="defects-only">Defects Summary</option>
              <option value="maintenance">Maintenance Report</option>
              <option value="performance">Performance Metrics</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Content Preview */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Report will include:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            Defect analysis with AI annotations
          </li>
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            High-resolution images with highlights
          </li>
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            GPS locations and severity mapping
          </li>
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            Recommended action steps
          </li>
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            Historical trend analysis
          </li>
        </ul>
      </div>

      {/* Export Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={() => handleExport('pdf')}
          disabled={isGenerating}
          className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              <span>Export PDF</span>
            </>
          )}
        </button>

        <button
          onClick={() => handleExport('csv')}
          disabled={isGenerating}
          className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </>
          )}
        </button>
      </div>

      {/* Recent Exports */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Exports</h3>
        {exportHistory.length > 0 ? (
          <div className="space-y-2">
            {exportHistory.slice(0, 5).map((export_, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="truncate max-w-[200px]" title={export_.filename}>
                    {export_.filename}
                  </span>
                </div>
                <span className="text-gray-500">
                  {new Date(export_.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No exports yet</p>
        )}
      </div>
    </div>
  );
}
