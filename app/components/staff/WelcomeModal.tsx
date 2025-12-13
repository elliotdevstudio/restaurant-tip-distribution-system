'use client';

import { useState, useEffect } from 'react';
import { X, TrendingUp, Users, FileText, Calendar } from 'lucide-react';

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenModal, setHasSeenModal] = useState(false);

  useEffect(() => {
    // Check if user has seen the modal before
    const seen = localStorage.getItem('welcome_modal_seen');
    
    if (!seen) {
      // Show modal after 500ms delay
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('welcome_modal_seen', 'true');
    setHasSeenModal(true);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className="bg-white rounded-lg shadow-2xl max-w-2xl w-full transform transition-all duration-500 ease-out animate-slide-up"
          style={{
            animation: 'slideUp 0.5s ease-out'
          }}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-lg">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold">Welcome to Gratuity Manager</h2>
            </div>
            <p className="text-blue-100">
              Restaurant Tip Distribution System
            </p>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            <p className="text-gray-700 text-lg leading-relaxed">
              This application streamlines the payroll process for restaurant businesses by automating tip distribution calculations. 
              This demo simulates a fictitious restaurant with an established tip-sharing system already in place.
            </p>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Explore the Features:
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span><strong>Staff Members & Groups:</strong> Manage your team and configure tip distribution settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span><strong>Daily Shift Generator:</strong> The heart of the system—generate realistic shift data and see calculations in action</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5">•</span>
                  <span><strong>Shift Reports:</strong> Analyze historical data with aggregated analytics and CSV exports</span>
                </li>
              </ul>
            </div>

            <div className="flex items-start gap-3 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
              <FileText className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-purple-800">
                <strong>Pro Tip:</strong> Start with the Daily Shift Generator to see how tip pooling, 
                percentage-based distributions, and hour-based sharing all work together seamlessly.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-between items-center">
            <p className="text-sm text-gray-600">
              This message won't show again
            </p>
            <button
              onClick={handleClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}