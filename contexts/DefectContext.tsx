'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { VisionAnalysisResult, HotspotResult } from '@/lib/api';

export interface Defect {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'new' | 'in-progress' | 'resolved';
  location: string;
  description: string;
  timestamp: string;
  imageUrl?: string;
  analysis?: VisionAnalysisResult | HotspotResult;
  confidence?: number;
}

interface DefectContextType {
  defects: Defect[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  addDefect: (defect: Omit<Defect, 'id'>) => Defect;
  updateDefect: (id: string, updates: Partial<Defect>) => void;
  deleteDefect: (id: string) => void;
  getDefectsBySeverity: () => Record<Defect['severity'], number>;
  getDefectsByStatus: () => Record<Defect['status'], number>;
}

const DefectContext = createContext<DefectContextType | undefined>(undefined);

export function DefectProvider({ children }: { children: ReactNode }) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);

  const addDefect = useCallback((defect: Omit<Defect, 'id'>) => {
    const newDefect: Defect = {
      ...defect,
      id: `defect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setDefects(prev => [newDefect, ...prev]);
    return newDefect;
  }, []);

  const updateDefect = useCallback((id: string, updates: Partial<Defect>) => {
    setDefects(prev => 
      prev.map(d => d.id === id ? { ...d, ...updates } : d)
    );
  }, []);

  const deleteDefect = useCallback((id: string) => {
    setDefects(prev => prev.filter(d => d.id !== id));
  }, []);

  const getDefectsBySeverity = useCallback(() => {
    const counts: Record<Defect['severity'], number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    
    defects.forEach(d => {
      counts[d.severity]++;
    });
    
    return counts;
  }, [defects]);

  const getDefectsByStatus = useCallback(() => {
    const counts: Record<Defect['status'], number> = {
      'new': 0,
      'in-progress': 0,
      'resolved': 0,
    };
    
    defects.forEach(d => {
      counts[d.status]++;
    });
    
    return counts;
  }, [defects]);

  return (
    <DefectContext.Provider
      value={{
        defects,
        loading,
        setLoading,
        addDefect,
        updateDefect,
        deleteDefect,
        getDefectsBySeverity,
        getDefectsByStatus,
      }}
    >
      {children}
    </DefectContext.Provider>
  );
}

export function useDefects() {
  const context = useContext(DefectContext);
  if (!context) {
    throw new Error('useDefects must be used within a DefectProvider');
  }
  return context;
}
