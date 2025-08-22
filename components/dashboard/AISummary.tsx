"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Info, AlertCircle, RefreshCw, Loader2, MessageSquare, Send, X } from 'lucide-react';
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function AISummary() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [summaryType, setSummaryType] = useState<'executive' | 'technical' | 'maintenance'>('executive');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
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

  // Scroll to bottom when new chat messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      // Prepare context for the chat
      const context = {
        defects: defects.map(d => ({
          type: d.type,
          severity: d.severity,
          location: d.location,
          description: d.description,
        })),
        summaries: summaries.map(s => ({
          text: s.text,
          severity: s.severity,
          actionItems: s.metadata?.actionItems || [],
        })),
        statistics: getDefectsBySeverity(),
      };

      const response = await fetch('/api/chat/defects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          context,
        }),
      });

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toLocaleTimeString(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

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
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-1.5 rounded transition-colors ${
              showChat 
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            title="Chat about defects"
          >
            <MessageSquare className="w-4 h-4" />
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

      {/* Chat Interface - Slide-out Panel */}
      {showChat && (
        <>
          {/* Invisible backdrop for click-to-close */}
          <div 
            className="fixed inset-0 bg-transparent z-40"
            onClick={() => setShowChat(false)}
          />
          
          {/* Chat Panel */}
          <div 
            className="fixed right-0 top-0 h-full w-[400px] bg-white shadow-2xl transform transition-transform duration-300 z-50"
          >
        <div className="h-full flex flex-col">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Chat about Defects
            </h3>
            <button
              onClick={() => setShowChat(false)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Ask me anything about the detected defects!</p>
                  <p className="text-xs mt-2">For example:</p>
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => setChatInput("What are the most critical issues I should address first?")}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
                    >
                      What are the most critical issues?
                    </button>
                    <button
                      onClick={() => setChatInput("How can I prevent these defects in the future?")}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors mx-2"
                    >
                      How to prevent these defects?
                    </button>
                    <button
                      onClick={() => setChatInput("What's the estimated repair cost for these issues?")}
                      className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-colors"
                    >
                      Estimated repair costs?
                    </button>
                  </div>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">{message.timestamp}</p>
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about the defects..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
