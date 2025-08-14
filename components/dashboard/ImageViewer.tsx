"use client";

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, AlertCircle, CheckCircle, XCircle, Upload, Loader2, AlertTriangle, Download, Eye, X, Calendar, Activity, Info } from 'lucide-react';
import { analyzeWithVision, detectHotspots, fileToBase64, HotspotResult, VisionAnalysisResult } from '@/lib/api';
import { useDefects } from '@/hooks/useDefects';

interface ImageData {
  id: string;
  url: string;
  file?: File;
  type: string;
  componentType?: 'solar' | 'battery' | 'inverter';
  imageType?: 'thermal' | 'visual';
  status: 'critical' | 'warning' | 'normal' | 'analyzing';
  confidence: number;
  timestamp: string;
  defectDetails?: string;
  analysis?: HotspotResult | VisionAnalysisResult;
}

// Removed unused interface - AnalysisResult

export default function ImageViewer() {
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addDefect } = useDefects();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    for (const file of Array.from(files)) {
      try {
        // Create preview
        const url = await fileToBase64(file);
        const newImage: ImageData = {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          url,
          file,
          type: 'Analyzing...',
          status: 'analyzing',
          confidence: 0,
          timestamp: new Date().toLocaleString(),
        };
        
        setImages(prev => [newImage, ...prev]);

        // Determine component type from filename or let user select
        let componentType: 'solar' | 'battery' | 'inverter' = 'solar';
        let imageType: 'thermal' | 'visual' = 'thermal';
        
        const filename = file.name.toLowerCase();
        if (filename.includes('battery')) componentType = 'battery';
        else if (filename.includes('inverter')) componentType = 'inverter';
        if (filename.includes('visual') || filename.includes('rgb')) imageType = 'visual';

        // Analyze the image
        let analysis;
        let defectDetails = '';
        let status: ImageData['status'] = 'normal';
        let confidence = 0;
        let type = '';

        if (componentType === 'solar') {
          // Use hotspot detection for solar panels
          const result = await detectHotspots(file, imageType);
          analysis = result;
          
          // Check if hotspots were detected based on the actual API response
          if (result.hotspots && result.hotspots.length > 0) {
            // Map severity to status
            status = result.severity === 'critical' ? 'critical' : 
                    result.severity === 'warning' ? 'warning' : 'normal';
            
            confidence = result.metadata.confidence * 100;
            type = `Solar Panel ${imageType === 'thermal' ? 'Hotspot' : 'Visual Defect'}`;
            defectDetails = `${result.hotspots.length} defect(s) detected. `;
            
            // Add temperature info if available
            if (result.temperature_estimate) {
              defectDetails += `Max temperature: ${result.temperature_estimate.toFixed(1)}°C. `;
            }
            
            // Calculate max intensity from hotspots
            if (result.hotspots.length > 0) {
              const maxIntensity = Math.max(...result.hotspots.map(h => h.intensity));
              defectDetails += `Maximum defect intensity: ${maxIntensity}%. `;
            }
            
            // Add severity-based recommendations
            if (result.severity === 'critical') {
              defectDetails += 'Immediate maintenance required!';
            } else if (result.severity === 'warning') {
              defectDetails += 'Monitor closely, maintenance recommended within 30 days.';
            }
          } else {
            // No hotspots detected
            status = 'normal';
            type = 'Solar Panel - Normal';
            defectDetails = 'No defects detected. System operating normally.';
            confidence = result.metadata.confidence * 100;
          }
        } else {
          // Use vision API for battery/inverter
          const result = await analyzeWithVision(file, componentType);
          analysis = result;
          
          if (result.defectsFound) {
            // Parse severity from analysis text
            const analysisLower = result.analysis?.toLowerCase() || '';
            if (analysisLower.includes('critical') || analysisLower.includes('immediate')) {
              status = 'critical';
            } else if (analysisLower.includes('warning') || analysisLower.includes('moderate')) {
              status = 'warning';
            }
            
            type = `${componentType.charAt(0).toUpperCase() + componentType.slice(1)} Defect`;
            defectDetails = result.analysis || 'Defect detected';
            confidence = result.confidence * 100;
          } else {
            type = `${componentType.charAt(0).toUpperCase() + componentType.slice(1)} - Normal`;
            defectDetails = result.analysis || 'No defects detected';
            confidence = result.confidence * 100;
          }
        }

        // Update image with analysis results
        setImages(prev => prev.map(img => 
          img.id === newImage.id 
            ? { ...img, type, status, confidence, defectDetails, analysis, componentType, imageType }
            : img
        ));

        // Add to defects if issues found
        if (status !== 'normal') {
          addDefect({
            type,
            severity: status === 'critical' ? 'critical' : status === 'warning' ? 'high' : 'medium',
            status: 'new',
            location: `Component: ${componentType}`,
            description: defectDetails,
            timestamp: new Date().toISOString(),
            imageUrl: url,
            analysis,
            confidence,
          });
        }
      } catch (error) {
        console.error('Error analyzing image:', error);
        // Update image with error status
        setImages(prev => prev.map(img => 
          img.file === file 
            ? { ...img, type: 'Analysis Failed', status: 'warning', defectDetails: 'Failed to analyze image' }
            : img
        ));
      }
    }
    
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'normal':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'analyzing':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'normal':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'analyzing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Inspection Images
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {images.length} images
          </span>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No images uploaded yet</p>
          <p className="text-sm text-gray-400 mt-2">Upload thermal or visual images to start analysis</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative cursor-pointer group hover:shadow-lg transition-shadow rounded-lg overflow-hidden border border-gray-200"
              onClick={() => image.status !== 'analyzing' && setSelectedImage(image)}
            >
              <Image
                src={image.url}
                alt={image.type}
                width={300}
                height={192}
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white transform translate-y-full group-hover:translate-y-0 transition-transform">
                <p className="font-semibold">{image.type}</p>
                <p className="text-sm">Confidence: {image.confidence.toFixed(1)}%</p>
              </div>

              <div className="absolute top-2 right-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(image.status)}`}>
                  {getStatusIcon(image.status)}
                  {image.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for detailed view */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{selectedImage.type}</h3>
                  <p className="text-gray-600">{selectedImage.timestamp}</p>
                  {selectedImage.componentType && (
                    <p className="text-sm text-gray-500">
                      Component: {selectedImage.componentType} | Type: {selectedImage.imageType}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <Image
                src={selectedImage.url}
                alt={selectedImage.type}
                width={800}
                height={600}
                className="w-full rounded-lg mb-4"
              />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Status:</span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedImage.status)}`}>
                    {getStatusIcon(selectedImage.status)}
                    {selectedImage.status}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-semibold">AI Confidence:</span>
                  <span className="text-gray-700">{selectedImage.confidence.toFixed(1)}%</span>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Defect Analysis:</h4>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap">
                    {selectedImage.defectDetails}
                  </p>
                </div>

                {selectedImage.analysis && 'hotspots' in selectedImage.analysis && selectedImage.analysis.hotspots && selectedImage.analysis.hotspots.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Hotspot Locations:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedImage.analysis.hotspots.map((hotspot: { x: number; y: number; intensity: number; radius: number }, idx: number) => (
                        <div key={idx} className="bg-gray-50 p-2 rounded text-sm">
                          <span className="font-medium">Hotspot {idx + 1}:</span>
                          <span className="text-gray-600"> Position ({hotspot.x}%, {hotspot.y}%)</span>
                          <br />
                          <span className="text-gray-600">Intensity: {hotspot.intensity}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
