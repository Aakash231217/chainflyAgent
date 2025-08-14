"use client";

import React, { useState } from 'react';
import { Bell, ChevronDown, MapPin, User } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const projects = [
  { id: 1, name: 'Site A - Solar Farm', location: 'Gujarat' },
  { id: 2, name: 'Site B - Rooftop Installation', location: 'Mumbai' },
  { id: 3, name: 'Site C - Industrial Complex', location: 'Chennai' },
];

export default function TopBar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedProject, setSelectedProject] = useState(projects[0]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [notifications] = useState([
    { id: 1, message: 'Hotspot found on Site A - Panel 23', type: 'warning' },
    { id: 2, message: 'Battery thermal anomaly detected at Site B', type: 'critical' },
  ]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/auth/signin');
  };

  return (
    <div className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-64 z-10">
      <div className="h-full px-6 flex items-center justify-between">
        {/* Project Location Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <MapPin size={18} className="text-gray-600" />
            <span className="font-medium">{selectedProject.name}</span>
            <ChevronDown size={16} className="text-gray-500" />
          </button>

          {showProjectDropdown && (
            <div className="absolute top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProject(project);
                    setShowProjectDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedProject.id === project.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="font-medium">{project.name}</div>
                  <div className="text-sm text-gray-500">{project.location}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell size={20} className="text-gray-600" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
          </div>

          {/* User Profile */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              {session?.user?.name && (
                <span className="text-sm font-medium text-gray-700">{session.user.name}</span>
              )}
              <ChevronDown size={16} className="text-gray-500" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors">
                  Profile
                </button>
                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors">
                  Account Settings
                </button>
                <hr className="my-1" />
                <button 
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-red-600"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
