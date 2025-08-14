import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DefectData {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { defects, projectName, summaryType = 'executive' } = body;

    if (!defects || !Array.isArray(defects)) {
      return NextResponse.json(
        { error: 'Defects array is required' },
        { status: 400 }
      );
    }

    // Create different prompts based on summary type
    const prompts = {
      executive: `As an AI analyst for solar infrastructure, create a concise executive summary (2-3 sentences) of the following defects found at ${projectName || 'the project site'}. 
        Focus on business impact, urgency, and recommended actions. Use clear, non-technical language suitable for executives.
        
        Defects found:
        ${defects.map((d: DefectData) => `- ${d.type} (${d.severity} severity) at ${d.location}: ${d.description}`).join('\n')}
        
        Format the response as a single paragraph highlighting the most critical issues first.`,
      
      technical: `As an AI analyst, create a technical summary of the following defects found at ${projectName || 'the project site'}.
        Include specific technical details, root causes, and detailed remediation steps.
        
        Defects found:
        ${defects.map((d: DefectData) => `- ${d.type} (${d.severity} severity) at ${d.location}: ${d.description}`).join('\n')}
        
        Structure the response with:
        1. Overview of technical issues
        2. Root cause analysis
        3. Recommended technical interventions`,
      
      maintenance: `As an AI analyst, create a maintenance-focused summary for the following defects at ${projectName || 'the project site'}.
        Prioritize by urgency and group by maintenance type (immediate, scheduled, preventive).
        
        Defects found:
        ${defects.map((d: DefectData) => `- ${d.type} (${d.severity} severity) at ${d.location}: ${d.description}`).join('\n')}
        
        Organize by maintenance priority and include estimated time/resources needed.`
    };

    // Generate summary using GPT-4
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-2025-04-14",
      messages: [
        {
          role: "system",
          content: "You are an expert AI analyst specializing in solar infrastructure defect analysis and reporting."
        },
        {
          role: "user",
          content: prompts[summaryType as keyof typeof prompts] || prompts.executive
        }
      ],
      temperature: 0.7,
      max_tokens: 8192,
    });

    const summary = response.choices[0].message.content;

    // Calculate overall severity based on defects
    const severityScores = { critical: 4, high: 3, medium: 2, low: 1 };
    const avgSeverity = defects.reduce((sum: number, d: DefectData) => 
      sum + (severityScores[d.severity] || 0), 0) / (defects.length || 1);
    
    let overallSeverity: string;
    if (avgSeverity >= 3.5) overallSeverity = 'critical';
    else if (avgSeverity >= 2.5) overallSeverity = 'high';
    else if (avgSeverity >= 1.5) overallSeverity = 'medium';
    else overallSeverity = 'low';

    // Generate action items based on severity
    const actionItems = [];
    const criticalCount = defects.filter((d: DefectData) => d.severity === 'critical').length;
    const highCount = defects.filter((d: DefectData) => d.severity === 'high').length;

    if (criticalCount > 0) {
      actionItems.push(`Immediate action required for ${criticalCount} critical defect(s)`);
    }
    if (highCount > 0) {
      actionItems.push(`Schedule urgent maintenance for ${highCount} high-severity issue(s)`);
    }
    if (defects.length > 5) {
      actionItems.push('Comprehensive site inspection recommended');
    }

    return NextResponse.json({
      summary,
      metadata: {
        summaryType,
        projectName,
        totalDefects: defects.length,
        overallSeverity,
        actionItems,
        generatedAt: new Date().toISOString(),
        model: 'gpt-4.1-2025-04-14'
      }
    });

  } catch (error) {
    console.error('Summarization error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
