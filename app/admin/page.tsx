'use client';

import { useState } from 'react';

export default function AdminPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);
  const [message, setMessage] = useState('');

  const handleGenerateHistory = async () => {
    if (!confirm('Generate 90 days of historical shift data? This may take a minute.')) {
      return;
    }

    setIsGenerating(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/generate-history', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Success! Generated 90 days of shift data for ${data.staffCount} staff members in ${data.groupCount} groups.`);
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunMaintenance = async () => {
    setIsRunningMaintenance(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/daily-maintenance', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Maintenance completed at ${data.timestamp}`);
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (error) {
      setMessage(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunningMaintenance(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
        <p className="text-gray-600 mb-8">Manage demo data and maintenance tasks</p>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Generate Historical Data */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold mb-2">Generate Historical Data</h2>
            <p className="text-sm text-gray-600 mb-4">
              Creates 90 days of shift data with realistic sales and tip amounts.
              Monday/Tuesday shifts will be closed (all zeros).
            </p>
            <button
              onClick={handleGenerateHistory}
              disabled={isGenerating}
              className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate 90 Days of Data'}
            </button>
          </div>

          {/* Run Maintenance */}
          <div className="border-b pb-6">
            <h2 className="text-xl font-semibold mb-2">Run Daily Maintenance</h2>
            <p className="text-sm text-gray-600 mb-4">
              Manually trigger the daily maintenance job. This will:
              <ul className="list-disc ml-5 mt-2">
                <li>Delete shifts older than 90 days</li>
                <li>Create today's shift if it doesn't exist</li>
              </ul>
            </p>
            <button
              onClick={handleRunMaintenance}
              disabled={isRunningMaintenance}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunningMaintenance ? 'Running...' : 'Run Maintenance Now'}
            </button>
          </div>

          {/* Status Message */}
          {message && (
            <div className={`p-4 rounded ${
              message.startsWith('✅') 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <h3 className="font-medium text-blue-900 mb-2">ℹ️ Important Notes</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Generate historical data ONCE after setting up staff and groups</li>
              <li>• Daily maintenance runs automatically via cron job</li>
              <li>• Closed days (Mon/Tue) have zero sales and tips</li>
              <li>• Each shift contains realistic randomized data</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
