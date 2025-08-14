"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { generateSummary } from '@/lib/api';
import { useDefects } from '@/hooks/useDefects';

interface Summary {
  id: string;
  text: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  timestamp: string;
  metadata?: {
    actionItems?: string[];
    totalDefects?: number;
    [key: string]: unknown;
  };
}

export default function AISummary() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryType, setSummaryType] = useState<'executive' | 'technical' | 'maintenance'>('executive');
  const { defects, getDefectsBySeverity } = useDefects();

  const generateNewSummary = async () => {
    if (defects.length === 0) return;

    setLoading(true);
    try {
      // Prepare defect data for summarization
      const defectData = defects.map(d => ({
        type: d.type,
        severity: d.severity,
        location: d.location,
        description: d.description,
        timestamp: d.timestamp,
      }));

      const result = await generateSummary(
        defectData,
        'Solar Farm Alpha', // This could be dynamic based on selected project
        summaryType
      );

      const newSummary: Summary = {
        id: `summary-${Date.now()}`,
        text: result.summary,
        severity: result.metadata.overallSeverity as Summary['severity'],
        timestamp: new Date().toLocaleTimeString(),
        metadata: result.metadata,
      };

      setSummaries(prev => [newSummary, ...prev].slice(0, 5)); // Keep last 5 summaries
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate initial summary when defects change
  useEffect(() => {
    if (defects.length > 0 && summaries.length === 0) {
      generateNewSummary();
    }
  }, [defects.length, summaries.length, generateNewSummary]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'warning':
      case 'high':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
      case 'medium':
        return <Info className="w-5 h-5 text-blue-500" />;
      case 'success':
      case 'low':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return null;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
      case 'high':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
      case 'medium':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'success':
      case 'low':
        return 'bg-green-50 border-green-200 text-green-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  // Get defect statistics
  const defectStats = getDefectsBySeverity();
  const hasDefects = defects.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <span>🤖</span>
          AI Summary
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={summaryType}
            onChange={(e) => setSummaryType(e.target.value as typeof summaryType)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="executive">Executive</option>
            <option value="technical">Technical</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <button
            onClick={generateNewSummary}
            disabled={loading || !hasDefects}
            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate new summary"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Defect Statistics */}
      {hasDefects && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center p-2 bg-red-50 rounded">
            <div className="text-2xl font-bold text-red-600">{defectStats.critical}</div>
            <div className="text-xs text-red-600">Critical</div>
          </div>
          <div className="text-center p-2 bg-yellow-50 rounded">
            <div className="text-2xl font-bold text-yellow-600">{defectStats.high}</div>
            <div className="text-xs text-yellow-600">High</div>
          </div>
          <div className="text-center p-2 bg-blue-50 rounded">
            <div className="text-2xl font-bold text-blue-600">{defectStats.medium}</div>
            <div className="text-xs text-blue-600">Medium</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-2xl font-bold text-green-600">{defectStats.low}</div>
            <div className="text-xs text-green-600">Low</div>
          </div>
        </div>
      )}
      
      <div className="space-y-3 flex-1 overflow-y-auto">
        {summaries.length === 0 && !hasDefects ? (
          <div className="text-center py-8 text-gray-500">
            <Info className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No defects to summarize</p>
            <p className="text-sm mt-1">Upload images to begin analysis</p>
          </div>
        ) : summaries.length === 0 && loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-sm text-gray-500 mt-2">Generating AI summary...</p>
          </div>
        ) : (
          summaries.map((summary) => (
            <div
              key={summary.id}
              className={`p-4 rounded-lg border ${getSeverityStyles(summary.severity)} transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getSeverityIcon(summary.severity)}
                </div>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed">
                    {summary.text}
                  </p>
                  {summary.metadata?.actionItems && summary.metadata.actionItems.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold mb-1">Action Items:</p>
                      <ul className="text-xs space-y-0.5">
                        {summary.metadata.actionItems.map((item: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-xs mt-2 opacity-70">
                    {summary.timestamp} • {summary.metadata?.totalDefects || 0} defects analyzed
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
