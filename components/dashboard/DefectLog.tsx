"use client";

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { AlertTriangle, AlertCircle, Info, CheckCircle, Filter, Download, Trash2, Eye } from 'lucide-react';
import { useDefects } from '@/hooks/useDefects';

export default function DefectLog() {
  const { defects, updateDefect, deleteDefect } = useDefects();
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDefect, setSelectedDefect] = useState<string | null>(null);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high':
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Info className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-purple-100 text-purple-800';
      case 'in-progress':
        return 'bg-indigo-100 text-indigo-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredDefects = useMemo(() => {
    return defects.filter(defect => {
      const severityMatch = selectedSeverity === 'all' || defect.severity === selectedSeverity;
      const statusMatch = selectedStatus === 'all' || defect.status === selectedStatus;
      return severityMatch && statusMatch;
    });
  }, [defects, selectedSeverity, selectedStatus]);

  const handleStatusChange = (defectId: string, newStatus: typeof defects[0]['status']) => {
    updateDefect(defectId, { status: newStatus });
  };

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Component', 'Type', 'Severity', 'Status', 'Description', 'Confidence'],
      ...filteredDefects.map(d => [
        d.timestamp,
        d.location,
        d.type,
        d.severity,
        d.status,
        d.description,
        d.confidence?.toString() || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `defect-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <span>📋</span>
          Defect Log
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="in-progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <button 
            onClick={handleExport}
            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Time</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Location</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Type</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Severity</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Status</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Description</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDefects.map((defect) => (
              <tr key={defect.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 text-sm text-gray-600">
                  {new Date(defect.timestamp).toLocaleString()}
                </td>
                <td className="py-2 px-3 text-sm font-medium text-gray-800">
                  {defect.location}
                </td>
                <td className="py-2 px-3 text-sm text-gray-700">
                  {defect.type}
                </td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1">
                    {getSeverityIcon(defect.severity)}
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityStyle(defect.severity)}`}>
                      {defect.severity.toUpperCase()}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-3">
                  <select
                    value={defect.status}
                    onChange={(e) => handleStatusChange(defect.id, e.target.value as typeof defect.status)}
                    className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${getStatusStyle(defect.status)}`}
                  >
                    <option value="new">NEW</option>
                    <option value="in-progress">IN PROGRESS</option>
                    <option value="resolved">RESOLVED</option>
                  </select>
                </td>
                <td className="py-2 px-3 text-sm text-gray-600 max-w-xs">
                  <div className="truncate" title={defect.description}>
                    {defect.description}
                  </div>
                  {defect.confidence && (
                    <span className="text-xs text-gray-500">
                      Confidence: {Math.round(defect.confidence * 100)}%
                    </span>
                  )}
                </td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedDefect(defect.id)}
                      className="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDefect(defect.id)}
                      className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredDefects.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Info className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No defects found</p>
            <p className="text-sm mt-1">
              {defects.length === 0 
                ? 'Upload images to begin defect detection' 
                : 'Try adjusting the filters'}
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedDefect && (() => {
        const defect = defects.find(d => d.id === selectedDefect);
        if (!defect) return null;
        
        return (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setSelectedDefect(null)}
          >
            <div 
              className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Defect Details</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Location:</span>
                    <p className="font-medium">{defect.location}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Type:</span>
                    <p className="font-medium">{defect.type}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Severity:</span>
                    <div className="flex items-center gap-1 mt-1">
                      {getSeverityIcon(defect.severity)}
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityStyle(defect.severity)}`}>
                        {defect.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Status:</span>
                    <p className="mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusStyle(defect.status)}`}>
                        {defect.status.replace('-', ' ').toUpperCase()}
                      </span>
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Detected:</span>
                    <p className="font-medium">{new Date(defect.timestamp).toLocaleString()}</p>
                  </div>
                  {defect.confidence && (
                    <div>
                      <span className="text-sm text-gray-600">AI Confidence:</span>
                      <p className="font-medium">{Math.round(defect.confidence * 100)}%</p>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-sm text-gray-600">Description:</span>
                  <p className="mt-1">{defect.description}</p>
                </div>
                {defect.imageUrl && (
                  <div>
                    <span className="text-sm text-gray-600">Associated Image:</span>
                    <Image 
                      src={defect.imageUrl} 
                      alt="Defect" 
                      width={300}
                      height={192}
                      className="mt-2 rounded border border-gray-200 max-h-48 object-contain"
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setSelectedDefect(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
