'use client';

import React, { useState, useEffect } from 'react';
import { 
  useStaffData, 
  useDailyShifts,
  createDailyShift 
} from '../lib/hooks/useStaffData';

/**
 * Shifts Management Page with SWR
 * 
 * Key changes from original:
 * 1. Replace manual fetch with useStaffData() and useDailyShifts()
 * 2. Remove Jotai atoms for staff/groups (use SWR instead)
 * 3. Keep all existing UI and modal logic
 * 4. Auto-refresh shifts every 30 seconds
 */
export default function ShiftsPage() {
  // Use SWR hooks instead of Jotai + manual fetch
  const { members, groups, isLoading: isLoadingStaff } = useStaffData();
  const { shifts, isLoading: isLoadingShifts, refresh: refreshShifts } = useDailyShifts();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentShift, setCurrentShift] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'dashboard' | 'tip-entry'>('dashboard');
  
  // Your existing state for modals, assignments, etc.
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignments, setAssignments] = useState<Array<{ staffId: string; groupId: string }>>([]);
  
  // Form state
  const [createFormData, setCreateFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'FULL_DAY' as 'FULL_DAY' | 'LUNCH' | 'DINNER'
  });

  // Check for demo data on mount
  useEffect(() => {
    const demoShiftId = sessionStorage.getItem('demoShiftId');
    const demoEntries = sessionStorage.getItem('demoEntries');

    if (demoShiftId && demoEntries) {
      console.log('📋 Found demo data, loading shift...');
      loadDemoShift(demoShiftId, JSON.parse(demoEntries));
      
      // Clear demo data
      sessionStorage.removeItem('demoShiftId');
      sessionStorage.removeItem('demoEntries');
    }
  }, []);

  const loadDemoShift = async (shiftId: string, entries: any[]) => {
    try {
      const response = await fetch(`/api/daily-shifts/${shiftId}`);
      const data = await response.json();

      if (data.success) {
        setCurrentShift(data.shift);
        
        // Populate assignments from demo entries
        const demoAssignments = entries.map(entry => ({
          staffId: entry.staffId,
          groupId: entry.groupId
        }));
        setAssignments(demoAssignments);
        
        // Switch to tip entry view
        setViewMode('tip-entry');
        
        console.log('✅ Demo shift loaded');
      }
    } catch (error) {
      console.error('❌ Failed to load demo shift:', error);
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const shift = await createDailyShift(createFormData.date, createFormData.type);
      
      console.log('✅ Shift created:', shift.id);
      setCurrentShift(shift);
      setShowCreateModal(false);
      setShowAssignmentModal(true);
      
    } catch (error) {
      console.error('❌ Failed to create shift:', error);
      alert('Failed to create shift. It may already exist for this date/type.');
    }
  };

  const handleOpenShift = async (shift: any) => {
    setCurrentShift(shift);
    
    // Load existing staff data if available
    if (shift.staffData && shift.staffData.length > 0) {
      const existingAssignments = shift.staffData.map((sd: any) => ({
        staffId: sd.staffId,
        groupId: sd.groupId
      }));
      setAssignments(existingAssignments);
      setViewMode('tip-entry');
    } else {
      setShowAssignmentModal(true);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Delete this shift? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/daily-shifts/${shiftId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        console.log('✅ Shift deleted');
        refreshShifts(); // Refresh the shifts list
      } else {
        throw new Error('Failed to delete shift');
      }
    } catch (error) {
      console.error('❌ Failed to delete shift:', error);
      alert('Failed to delete shift');
    }
  };

  const isLoading = isLoadingStaff || isLoadingShifts;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading shifts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'tip-entry' && currentShift) {
    // Return your TipEntrySheet component here
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4">
          <button
            onClick={() => {
              setViewMode('dashboard');
              setCurrentShift(null);
            }}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Dashboard
          </button>
        </div>
        
        {/* Your TipEntrySheet component would go here */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Tip Entry for Shift {currentShift.id}</h2>
          <p className="text-gray-600">TipEntrySheet component would render here</p>
          <p className="text-sm text-gray-500 mt-2">
            {assignments.length} staff members assigned
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Shift Management</h1>
            <p className="text-gray-600">Create and manage daily shifts</p>
          </div>
          <div className="flex space-x-3">
            <a 
              href="/demo" 
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              🎲 Demo Generator
            </a>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              + Create New Shift
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Total Shifts (30 days)</div>
          <div className="text-3xl font-bold text-gray-900">{shifts.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Active Staff</div>
          <div className="text-3xl font-bold text-gray-900">{members.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Staff Groups</div>
          <div className="text-3xl font-bold text-gray-900">{groups.length}</div>
        </div>
      </div>

      {/* Recent Shifts */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Recent Shifts</h2>
            <button
              onClick={() => refreshShifts()}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {shifts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 mb-4">No shifts yet</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Your First Shift
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {shifts.slice(0, 10).map((shift: any) => (
              <div key={shift.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-lg font-semibold text-gray-900">
                        {new Date(shift.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded">
                        {shift.type}
                      </span>
                      <span className={`px-2 py-1 text-sm rounded ${
                        shift.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                        shift.status === 'active' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {shift.status}
                      </span>
                    </div>
                    
                    {shift.shiftTotals && (
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>💰 Total Tips: ${shift.shiftTotals.totalTipsCollected?.toFixed(2) || '0.00'}</div>
                        <div>👥 Staff: {shift.shiftTotals.activeStaffCount || 0}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleOpenShift(shift)}
                      className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-300 rounded hover:bg-blue-50"
                    >
                      {shift.status === 'draft' ? 'Continue' : 'View'}
                    </button>
                    <button
                      onClick={() => handleDeleteShift(shift.id)}
                      className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create New Shift</h2>
            <form onSubmit={handleCreateShift} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={createFormData.date}
                  onChange={(e) => setCreateFormData({ ...createFormData, date: e.target.value })}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shift Type
                </label>
                <div className="space-y-2">
                  {['FULL_DAY', 'LUNCH', 'DINNER'].map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="radio"
                        value={type}
                        checked={createFormData.type === type}
                        onChange={(e) => setCreateFormData({ ...createFormData, type: e.target.value as any })}
                        className="mr-2"
                      />
                      <span className="text-sm">{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assignment Modal - placeholder */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Assign Staff to Shift</h2>
            <p className="text-gray-600 mb-4">Staff assignment interface would go here</p>
            <button
              onClick={() => setShowAssignmentModal(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
