"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ImageViewer from '@/components/dashboard/ImageViewer';
import AISummary from '@/components/dashboard/AISummary';
import DefectLog from '@/components/dashboard/DefectLog';
import ReportExport from '@/components/dashboard/ReportExport';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Agent Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Real-time defect detection and analysis for solar infrastructure
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Viewer - Full Width on Mobile, Half on Desktop */}
          <div className="lg:col-span-1">
            <ImageViewer />
          </div>

          {/* AI Summary - Full Width on Mobile, Half on Desktop */}
          <div className="lg:col-span-1">
            <AISummary />
          </div>

          {/* Defect Log - Full Width */}
          <div className="lg:col-span-2">
            <DefectLog />
          </div>

          {/* Report Export - Full Width on Mobile, Half on Desktop */}
          <div className="lg:col-span-1">
            <ReportExport />
          </div>

          {/* Optional: GIS Map Placeholder */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 h-full flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl mb-4 block">🗺️</span>
                <h3 className="text-lg font-semibold text-gray-700">GIS Defect Map</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Interactive heatmap visualization coming soon
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
