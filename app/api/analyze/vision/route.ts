import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const type = formData.get('type') as string; // 'battery' or 'inverter'

    if (!image || !type) {
      return NextResponse.json(
        { error: 'Image and type are required' },
        { status: 400 }
      );
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Create appropriate prompt based on component type
    const prompts = {
      battery: `Analyze this battery system image for defects. Look for:
        1. Thermal anomalies or hot spots
        2. Physical damage or corrosion
        3. Improper connections or loose terminals
        4. Swelling or deformation
        5. Electrolyte leakage
        
        Provide a detailed analysis including:
        - Defect type and severity (critical/high/medium/low)
        - Specific location of issues
        - Recommended actions
        - Safety concerns if any`,
      
      inverter: `Analyze this inverter image for defects. Look for:
        1. Overheating signs or thermal stress
        2. Component damage or burn marks
        3. Dust accumulation affecting cooling
        4. LED indicator status
        5. Cable or connection issues
        
        Provide a detailed analysis including:
        - Defect type and severity (critical/high/medium/low)
        - Specific component affected
        - Recommended maintenance actions
        - Operational impact assessment`
    };

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-2025-04-14",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompts[type as keyof typeof prompts] || "Analyze this image for defects",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              },
            },
          ],
        },
      ],
      max_tokens: 10000,
    });

    const analysis = response.choices[0].message.content;

    // Parse the analysis to extract structured data
    const structuredResult = {
      type,
      analysis,
      timestamp: new Date().toISOString(),
      defectsFound: analysis?.toLowerCase().includes('defect') || 
                    analysis?.toLowerCase().includes('issue') ||
                    analysis?.toLowerCase().includes('problem'),
      confidence: 0.85, // You could implement more sophisticated confidence scoring
    };

    return NextResponse.json(structuredResult);

  } catch (error) {
    console.error('Vision analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
