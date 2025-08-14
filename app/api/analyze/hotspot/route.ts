import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import crypto from 'crypto';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Enterprise-grade constants
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'tiff', 'bmp'];
const MAX_IMAGE_DIMENSION = 8192; // 8K resolution
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Audit logging interface
interface AuditLog {
  requestId: string;
  timestamp: string;
  clientIp: string;
  action: string;
  status: 'success' | 'failure';
  details: Record<string, unknown>;
  processingTime?: number;
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per hour
const RATE_WINDOW = 3600000; // 1 hour in ms

interface HotspotData {
  x: number;
  y: number;
  intensity: number;
  temperature?: number;
}

interface HotspotAnalysisResult {
  hotspots: HotspotData[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  const clientIp = request.headers.get('x-forwarded-for') || 'unknown';

  // Initialize audit log
  const auditLog: AuditLog = {
    requestId,
    timestamp: new Date().toISOString(),
    clientIp,
    action: 'hotspot_analysis',
    status: 'failure',
    details: {}
  };

  try {
    // Rate limiting check
    const rateLimitKey = clientIp;
    const now = Date.now();
    const userLimit = rateLimitStore.get(rateLimitKey);

    if (userLimit) {
      if (userLimit.resetTime > now && userLimit.count >= RATE_LIMIT) {
        auditLog.details = { error: 'Rate limit exceeded' };
        console.error(`[${requestId}] Rate limit exceeded for ${clientIp}`);
        return NextResponse.json(
          { 
            error: 'Too many requests. Please try again later.',
            requestId,
            retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
          },
          { status: 429 }
        );
      }
      
      if (userLimit.resetTime <= now) {
        rateLimitStore.set(rateLimitKey, { count: 1, resetTime: now + RATE_WINDOW });
      } else {
        userLimit.count++;
      }
    } else {
      rateLimitStore.set(rateLimitKey, { count: 1, resetTime: now + RATE_WINDOW });
    }

    // Parse and validate request
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const imageType = formData.get('imageType') as string || 'auto';
    const demoMode = formData.get('demoMode') === 'true';

    // Input validation
    if (!file || !(file instanceof File)) {
      auditLog.details = { error: 'Invalid file upload' };
      return NextResponse.json(
        { error: 'Please provide a valid image file', requestId },
        { status: 400 }
      );
    }
    
    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      auditLog.details = { error: 'File too large', size: file.size };
      return NextResponse.json(
        { 
          error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          requestId 
        },
        { status: 400 }
      );
    }
    
    // File type validation
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !ALLOWED_FORMATS.includes(fileExtension)) {
      auditLog.details = { error: 'Invalid file format', format: fileExtension };
      return NextResponse.json(
        { 
          error: `Invalid file format. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`,
          requestId 
        },
        { status: 400 }
      );
    } // For testing with regular images
    
    auditLog.details.fileInfo = {
      name: file.name,
      size: file.size,
      type: file.type,
      imageType,
      demoMode
    };

    // Convert image to buffer
    // Process image with timeout protection
    const arrayBuffer = await Promise.race([
      file.arrayBuffer(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('File processing timeout')), REQUEST_TIMEOUT)
      )
    ]);
    
    const buffer = Buffer.from(arrayBuffer);
    
    // Validate image integrity
    let metadata;
    try {
      metadata = await sharp(buffer).metadata();
      
      // Dimension validation
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image dimensions');
      }
      
      if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
        throw new Error(`Image dimensions exceed maximum allowed size of ${MAX_IMAGE_DIMENSION}px`);
      }
      
      auditLog.details.imageMetadata = {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        channels: metadata.channels
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      auditLog.details = { error: 'Invalid image file', details: errorMessage };
      console.error(`[${requestId}] Image validation failed:`, error);
      return NextResponse.json(
        { 
          error: 'Invalid or corrupted image file. Please upload a valid image.',
          requestId 
        },
        { status: 400 }
      );
    }

    // Process the image using sharp
    const { width = 0, height = 0 } = metadata;

    // Convert to raw pixel data for analysis
    const { data: pixelArray, info } = await sharp(buffer)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width: w, height: h, channels } = info;
    let hotspots: Array<{
      x: number;
      y: number;
      radius: number;
      intensity: number;
      area: number;
      description: string;
    }> = [];
    let severity: 'critical' | 'high' | 'medium' | 'low' | 'none' = 'none';
    let maxTemp: number | null = null;

    // First, check if this looks like a thermal image
    // Thermal images typically have:
    // 1. Limited color palette (often grayscale or false color)
    // 2. Smooth gradients
    // 3. Specific color mappings (e.g., iron, rainbow, grayscale)

    let colorVariance = 0;
    let totalPixels = 0;
    const colorHistogram = new Map<string, number>();

    // Sample the image to check color characteristics
    for (let y = 0; y < h; y += 20) {
      for (let x = 0; x < w; x += 20) {
        const idx = (y * w + x) * channels;
        const r = pixelArray[idx];
        const g = pixelArray[idx + 1];
        const b = pixelArray[idx + 2];

        // Create a color key
        const colorKey = `${Math.floor(r/32)}-${Math.floor(g/32)}-${Math.floor(b/32)}`;
        colorHistogram.set(colorKey, (colorHistogram.get(colorKey) || 0) + 1);
        totalPixels++;

        // Calculate color variance
        const gray = (r + g + b) / 3;
        colorVariance += Math.abs(r - gray) + Math.abs(g - gray) + Math.abs(b - gray);
      }
    }

    // Check if image has thermal characteristics
    const avgColorVariance = colorVariance / totalPixels;
    const uniqueColors = colorHistogram.size;
    
    // Debug logging
    console.log('Image analysis:', {
      uniqueColors,
      avgColorVariance: avgColorVariance.toFixed(2),
      totalPixels,
      imageType: formData.get('imageType'),
      dimensions: `${w}x${h}`
    });
    
    // Check for thermal-specific patterns
    let thermalColorPattern = false;
    
    // Check if colors follow thermal gradients (iron, rainbow, grayscale patterns)
    const redBias = colorVariance > 0 ? 
      Array.from(colorHistogram.keys()).filter(key => {
        const [r, g, b] = key.split('-').map(Number);
        return r > g && r > b; // Red-dominant colors (common in iron palette)
      }).length / colorHistogram.size : 0;
    
    // Check for blue/cyan bias (common in thermal cool zones)
    const blueBias = colorVariance > 0 ?
      Array.from(colorHistogram.keys()).filter(key => {
        const [r, g, b] = key.split('-').map(Number);
        return b > r && b > g; // Blue-dominant colors
      }).length / colorHistogram.size : 0;
    
    // Thermal images have specific characteristics
    const hasHighColorVariance = avgColorVariance > 50; // Significant color differences
    const hasModerateColors = uniqueColors > 50 && uniqueColors < 300; // Not too few, not too many
    const hasColorGradient = uniqueColors > 100 && avgColorVariance > 100; // Rainbow palette
    const hasThermalBias = redBias > 0.3 || blueBias > 0.3; // Significant red OR blue zones
    
    // Check for thermal-like characteristics (more inclusive)
    thermalColorPattern = (
      (hasThermalBias && hasModerateColors) || // Iron/hot-cold palette
      (hasColorGradient && hasHighColorVariance) || // Rainbow thermal palette  
      (uniqueColors < 50 && avgColorVariance < 10) || // Grayscale thermal
      (avgColorVariance > 150 && uniqueColors > 100) // High contrast thermal
    );
    
    // If imageType is explicitly set to thermal WITHOUT being 'visual', trust it
    // In demo mode, treat all images as thermal for testing
    // Otherwise, use thermal-specific heuristics
    const isThermalImage = demoMode || 
      (imageType === 'thermal' && thermalColorPattern) || // Must match thermal patterns if explicitly set
      (imageType !== 'visual' && thermalColorPattern); // Auto-detect only if patterns match
    
    console.log('Thermal detection result:', {
      isThermalImage,
      imageType,
      demoMode,
      thermalColorPattern,
      redBias: redBias?.toFixed(2) || '0',
      blueBias: blueBias?.toFixed(2) || '0',
      conditions: {
        highColorVariance: hasHighColorVariance,
        moderateColors: hasModerateColors,
        colorGradient: hasColorGradient,
        thermalBias: hasThermalBias
      }
    });

    // If not a thermal image, return no hotspots
    if (!isThermalImage) {
      return NextResponse.json({
        hotspots: [],
        severity: 'none',
        confidence: 0.95,
        metadata: {
          totalHotspots: 0,
          maxTemperature: null,
          affectedArea: 0,
          message: 'Image does not appear to be a thermal image'
        }
      });
    }

    // Use OpenAI Vision API for thermal image analysis
    let response: { 
      metadata?: {
        confidence?: number;
        avgTemperature?: number;
        maxTemperature?: number;
        minTemperature?: number;
        temperatureUnit?: string;
        [key: string]: unknown;
      } 
    } = {};
    
    try {
      // Convert buffer to base64 for OpenAI
      const base64Image = buffer.toString('base64');
      const mimeType = `image/${formData}`;
      
      // Call OpenAI Vision API with specialized thermal analysis prompt
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          {
            role: "system",
            content: "You are an expert thermal imaging analyst specializing in solar panel defect detection. Analyze thermal images to identify hotspots, temperature anomalies, and potential failures."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this thermal image of solar panels and identify all hotspots and defects. 
                
                Return a JSON response with the following structure:
                {
                  "hotspots": [
                    {
                      "x": percentage from left (0-100),
                      "y": percentage from top (0-100),
                      "radius": approximate size in pixels,
                      "intensity": severity percentage (0-100),
                      "area": affected area in pixels,
                      "description": "brief description of the defect"
                    }
                  ],
                  "severity": "critical" | "high" | "medium" | "low" | "none",
                  "maxTemperature": estimated maximum temperature in Celsius,
                  "analysis": "detailed technical analysis",
                  "recommendations": ["action item 1", "action item 2", ...],
                  "confidence": confidence score (0-1)
                }
                
                Focus on:
                - Hot spots indicating cell failures or bypass diode activation
                - Temperature gradients suggesting electrical issues
                - Uniform heating patterns indicating soiling or shading
                - Module-level vs cell-level defects
                - Severity classification based on temperature differential`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 8192,
        response_format: { type: "json_object" }
      });

      // Parse the response
      const visionResult = JSON.parse(visionResponse.choices[0].message.content || '{}');
      
      // Extract hotspots and ensure proper format
      hotspots = (visionResult.hotspots || []).map((h: {
        x?: number;
        y?: number;
        radius?: number;
        intensity?: number;
        area?: number;
        description?: string;
      }) => ({
        x: Math.round(h.x || 0),
        y: Math.round(h.y || 0),
        radius: Math.round(h.radius || 20),
        intensity: Math.round(h.intensity || 50),
        area: h.area || 1000,
        description: h.description || 'Thermal anomaly detected'
      }));

      // Use OpenAI's severity assessment
      severity = visionResult.severity || 'medium';
      
      // Store additional analysis data
      maxTemp = visionResult.maxTemperature || null;
      const analysis = visionResult.analysis || 'Thermal analysis completed';
      const recommendations = visionResult.recommendations || [];
      const aiConfidence = visionResult.confidence || 0.85;
      
      // Store AI-powered metadata
      response = {
        metadata: {
          analysis,
          recommendations,
          aiModel: 'gpt-4o',
          confidence: aiConfidence
        }
      };

    } catch (visionError) {
      console.error('OpenAI Vision API error:', visionError);
      
      // Fallback to basic detection if OpenAI fails
      // This ensures the service remains available even if OpenAI is down
      return NextResponse.json({
        hotspots: [],
        severity: 'unknown',
        confidence: 0.5,
        metadata: {
          totalHotspots: 0,
          maxTemperature: null,
          affectedArea: 0,
          message: 'Advanced analysis temporarily unavailable. Please try again.',
          error: 'vision_api_error'
        }
      });
    }


    // Calculate metadata
    const totalArea = hotspots.reduce((sum, h) => sum + (h.area || Math.PI * h.radius * h.radius), 0);
    
    // Prepare response with AI-enhanced data
    const finalResponse = {
      requestId,
      severity,
      hotspots: hotspots.slice(0, 50), // Increased limit for AI detection
      confidence: isThermalImage ? 0.85 : 0,
      metadata: {
        totalHotspots: hotspots.length,
        maxTemperature: maxTemp,
        affectedArea: Math.round(totalArea / 100), // Convert to percentage
        imageType: isThermalImage ? 'thermal' : 'visual',
        dimensions: { width, height },
        processingTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      }
    };
    
    // Merge AI metadata if available
    if (response.metadata) {
      finalResponse.metadata = { ...finalResponse.metadata, ...response.metadata };
      if (response.metadata.confidence) {
        // Normalize confidence to 0-1 range if AI returns percentage
        let normalizedConfidence = response.metadata.confidence;
        if (normalizedConfidence > 1) {
          normalizedConfidence = normalizedConfidence / 100;
        }
        finalResponse.confidence = normalizedConfidence;
      }
    }
    
    // Update audit log for success
    auditLog.status = 'success';
    auditLog.processingTime = Date.now() - startTime;
    auditLog.details.results = {
      severity,
      hotspotCount: hotspots.length,
      confidence: isThermalImage ? 0.85 : 0
    };
    
    // Log audit trail (in production, save to database)
    console.log(`[AUDIT] ${JSON.stringify(auditLog)}`);
    
    return NextResponse.json(finalResponse);
    
  } catch (error) {
    // Enhanced error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    auditLog.details.error = errorMessage;
    auditLog.processingTime = Date.now() - startTime;
    
    console.error(`[${requestId}] Hotspot analysis failed:`, error);
    console.log(`[AUDIT] ${JSON.stringify(auditLog)}`);
    
    // Sanitize error message for client
    const clientError = errorMessage.includes('timeout') 
      ? 'Request timed out. Please try with a smaller image.'
      : 'An error occurred during analysis. Please try again.';
    
    return NextResponse.json(
      { 
        error: clientError,
        requestId,
        support: 'If this issue persists, please contact support with the request ID.'
      },
      { status: 500 }
    );
  }
}
