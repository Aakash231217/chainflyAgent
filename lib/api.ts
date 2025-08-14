// API utility functions for Chainfly dashboard

export interface VisionAnalysisResult {
  type: string;
  analysis: string;
  timestamp: string;
  defectsFound: boolean;
  confidence: number;
}

export interface HotspotResult {
  detected: boolean;
  hotspots: Array<{
    x: number;
    y: number;
    intensity: number;
    radius: number;
  }>;
  severity: 'normal' | 'warning' | 'critical';
  temperature_estimate?: number;
  metadata: {
    imageType: string;
    dimensions: { width: number; height: number };
    processedAt: string;
    confidence: number;
  };
}

export interface SummaryResult {
  summary: string;
  metadata: {
    summaryType: string;
    projectName: string;
    totalDefects: number;
    overallSeverity: string;
    actionItems: string[];
    generatedAt: string;
    model: string;
  };
}

// Analyze battery or inverter image using OpenAI Vision
export async function analyzeWithVision(
  image: File,
  type: 'battery' | 'inverter'
): Promise<VisionAnalysisResult> {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('type', type);

  const response = await fetch('/api/analyze/vision', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Vision analysis failed');
  }

  return response.json();
}

// Detect hotspots in solar panel images
export async function detectHotspots(
  image: File,
  imageType: 'thermal' | 'visual' = 'thermal'
): Promise<HotspotResult> {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('imageType', imageType);

  const response = await fetch('/api/analyze/hotspot', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Hotspot detection failed');
  }

  return response.json();
}

// Generate AI summary of defects
export async function generateSummary(
  defects: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    location: string;
    description: string;
    timestamp: string;
  }>,
  projectName?: string,
  summaryType: 'executive' | 'technical' | 'maintenance' = 'executive'
): Promise<SummaryResult> {
  const response = await fetch('/api/analyze/summarize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      defects,
      projectName,
      summaryType,
    }),
  });

  if (!response.ok) {
    throw new Error('Summary generation failed');
  }

  return response.json();
}

// Helper function to convert File to base64 for preview
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}
