import { NextRequest, NextResponse } from 'next/server';

// Define types for context data
interface DefectData {
  type: string;
  severity: string;
  location: string;
}

interface SummaryData {
  summary: string;
  timestamp: string;
}

interface DefectContext {
  totalDefects: number;
  statistics: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recentDefects: DefectData[];
  summaries: SummaryData[];
}

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    if (!message || !context) {
      return NextResponse.json(
        { error: 'Message and context are required' },
        { status: 400 }
      );
    }

    const typedContext = context as DefectContext;

    // Prepare context for AI
    const contextSummary = `
Current defects analysis:
- Total defects: ${typedContext.totalDefects}
- Critical: ${typedContext.statistics.critical}
- High: ${typedContext.statistics.high}
- Medium: ${typedContext.statistics.medium}
- Low: ${typedContext.statistics.low}

Recent defects:
${typedContext.recentDefects.map((d) => `- ${d.type} (${d.severity}) at ${d.location}`).join('\n')}

Summaries:
${typedContext.summaries.map((s) => `- ${s.summary} (${s.timestamp})`).join('\n')}
`;

    // Create a prompt that includes all the defect context
    const systemPrompt = `You are an AI assistant helping users understand solar panel defects. You have access to the following information:

${contextSummary}

Provide helpful, specific answers about these defects. Include:
- Explanations of what the defects mean
- Potential causes
- Recommended actions
- Urgency of repairs
- Safety considerations
- Cost estimates when relevant
- Prevention tips

Keep responses concise but informative.`;

    // For demo purposes, we'll use a mock response system
    // In production, you would integrate with your AI service (OpenAI, etc.)
    const response = await generateChatResponse(message, systemPrompt, typedContext.recentDefects);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}

// Mock function to generate responses - replace with actual AI integration
async function generateChatResponse(
  userMessage: string,
  systemPrompt: string,
  defects: DefectData[]
): Promise<string> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  const lowerMessage = userMessage.toLowerCase();

  // Pattern matching for common questions
  if (lowerMessage.includes('critical') || lowerMessage.includes('urgent') || lowerMessage.includes('first')) {
    const criticalDefects = defects.filter(d => d.severity === 'critical' || d.severity === 'high');
    if (criticalDefects.length > 0) {
      return `Based on the analysis, you have ${criticalDefects.length} high-priority issues that need immediate attention:\n\n${
        criticalDefects.map(d => `• ${d.type} at ${d.location}: This ${d.severity} issue ${
          d.severity === 'critical' ? 'requires immediate repair to prevent system failure' : 'should be addressed within 1-2 weeks'
        }`).join('\n')
      }\n\nI recommend scheduling repairs for these critical issues first to prevent further damage and maintain system efficiency.`;
    } else {
      return "Good news! There are no critical issues detected. Focus on addressing the medium and low severity defects during your next scheduled maintenance.";
    }
  }

  if (lowerMessage.includes('prevent') || lowerMessage.includes('avoid') || lowerMessage.includes('future')) {
    return `To prevent these types of defects in the future, I recommend:

1. **Regular Inspections**: Schedule quarterly visual inspections and annual thermal imaging
2. **Proper Cleaning**: Clean panels every 3-6 months to prevent hotspots from dirt accumulation
3. **Vegetation Management**: Keep surrounding area clear to avoid shading
4. **Weather Protection**: Check mounting systems after severe weather events
5. **Electrical Monitoring**: Use monitoring systems to detect performance drops early

These preventive measures can reduce defect occurrence by up to 70% and extend system lifespan.`;
  }

  if (lowerMessage.includes('cost') || lowerMessage.includes('repair') || lowerMessage.includes('price')) {
    const totalDefects = defects.length;
    const criticalCount = defects.filter(d => d.severity === 'critical').length;
    const highCount = defects.filter(d => d.severity === 'high').length;
    
    return `Based on the ${totalDefects} defects detected, here's an estimated repair cost breakdown:

• Critical defects (${criticalCount}): $500-800 per panel
• High severity (${highCount}): $200-400 per panel
• Medium/Low severity: $50-150 per panel

**Total estimated cost**: $${(criticalCount * 650 + highCount * 300 + (totalDefects - criticalCount - highCount) * 100).toLocaleString()}

Note: Costs may vary based on location, contractor, and extent of damage. Getting repairs done promptly can prevent more expensive damage later.`;
  }

  if (lowerMessage.includes('hotspot') || lowerMessage.includes('hot spot')) {
    return `Hotspots are localized areas of elevated temperature on solar panels that can significantly impact performance:

**Causes**: Partial shading, soiling, cell damage, or manufacturing defects
**Impact**: Reduced power output (10-20%), accelerated degradation, potential fire risk in severe cases
**Detection**: Visible as bright spots in thermal imaging
**Solution**: Clean affected panels, check for physical damage, ensure proper ventilation

Regular thermal inspections can detect hotspots early before they cause permanent damage.`;
  }

  if (lowerMessage.includes('crack') || lowerMessage.includes('fracture')) {
    return `Cracks in solar panels are a serious concern:

**Types**: 
- Microcracks (invisible to naked eye)
- Visible cracks (can see on glass surface)

**Causes**: Impact damage, thermal stress, poor handling during installation
**Effects**: Moisture ingress, reduced efficiency (5-30%), potential electrical hazards
**Action**: Replace severely cracked panels, monitor minor cracks for progression

Cracked panels should be evaluated by a professional to determine if replacement is necessary.`;
  }

  if (lowerMessage.includes('performance') || lowerMessage.includes('efficiency') || lowerMessage.includes('output')) {
    const totalDefects = defects.length;
    const estimatedLoss = Math.min(totalDefects * 3, 40); // Rough estimate: 3% loss per defect, max 40%
    
    return `The detected defects are likely impacting your system performance:

**Estimated efficiency loss**: ${estimatedLoss}%
**Annual production impact**: Approximately ${estimatedLoss * 50} kWh per kW installed

**Performance factors**:
• Hotspots: 10-20% local power loss
• Soiling: 5-25% depending on severity
• Cracks: 5-30% depending on extent
• Shading: Variable, can be 50%+ during affected hours

Regular maintenance and prompt repairs can restore most of the lost efficiency.`;
  }

  // Default response for general questions
  return `I can help you understand the ${defects.length} defects detected in your solar system. Based on the analysis, you have a mix of severity levels that should be addressed according to their priority.

Would you like to know more about:
• Which issues to address first?
• Estimated repair costs?
• How to prevent these defects?
• The impact on system performance?
• Specific defect types like hotspots or cracks?

Feel free to ask any specific questions about your solar panel defects!`;
}
