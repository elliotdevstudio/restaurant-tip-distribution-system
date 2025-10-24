'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useState, useEffect } from 'react';
import {
  staffMembersAtom,
  staffGroupsAtom,
  currentShiftAtom,
  shiftStaffAssignmentsAtom,
  tipEntriesAtom,
  initializeTipEntriesAtom
} from '../atoms/staffAtoms';
import TipEntrySheet from '../components/shift/TipEntrySheet';
import { DailyShift, ShiftType, ShiftStaffAssignment } from '../../types';
import { formatCurrency, formatShiftDate, formatShiftType } from '../lib/utils/tipCalculations';
import { useShiftCalculations } from '../hooks/useShiftCalculations';

type ViewMode = 'dashboard' | 'tip-entry';

export default function ShiftsPage() {
  const [staffMembers] = useAtom(staffMembersAtom);
  const [staffGroups] = useAtom(staffGroupsAtom);
  const [currentShift, setCurrentShift] = useAtom(currentShiftAtom);
  const [assignments, setAssignments] = useAtom(shiftStaffAssignmentsAtom);
  const setTipEntries = useSetAtom(tipEntriesAtom);
  const initializeTipEntries = useSetAtom(initializeTipEntriesAtom);

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [recentShifts, setRecentShifts] = useState<DailyShift[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // Create shift form state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedType, setSelectedType] = useState<ShiftType>('AM');
  
  // Staff assignment state
  const [tempAssignments, setTempAssignments] = useState<ShiftStaffAssignment[]>([]);

  // Load recent shifts on mount
  useEffect(() => {
    loadRecentShifts();
  }, []);

  const loadRecentShifts = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/daily-shifts');
      const data = await response.json();
      
      if (data.success) {
        setRecentShifts(data.shifts);
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateShift = async () => {
    try {
      const response = await fetch('/api/daily-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          type: selectedType
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setCurrentShift(result.shift);
        setShowCreateModal(false);
        setShowAssignModal(true); // Move to assignment step
        
        // Initialize temp assignments
        setTempAssignments([]);
      } else {
        alert(result.message || 'Failed to create shift');
      }
    } catch (error) {
      console.error('Failed to create shift:', error);
      alert('Failed to create shift. Please try again.');
    }
  };

  const handleOpenShift = async (shift: DailyShift) => {
    setCurrentShift(shift);
    
    // Load shift assignments (from shift.staffData)
    if (shift.staffData && shift.staffData.length > 0) {
      const loadedAssignments: ShiftStaffAssignment[] = shift.staffData.map(sd => ({
        staffId: sd.staffId,
        activeGroupId: sd.groupId,
        activeGroupName: sd.groupName
      }));
      setAssignments(loadedAssignments);
      
      // Initialize tip entries from saved data
      const entries = shift.staffData.map(sd => ({
        staffId: sd.staffId,
        groupId: sd.groupId,
        hoursWorked: sd.hoursWorked,
        salesAmount: sd.salesAmount,
        creditCardTips: sd.creditCardTips,
        cashTips: sd.cashTips
      }));
      setTipEntries(entries);
      
      setViewMode('tip-entry');
    } else {
      // No assignments yet, show assignment modal
      setShowAssignModal(true);
    }
  };

  const handleAddStaffToAssignment = (staffId: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return;

    // Find first group this staff member belongs to
    const staffGroup = staffGroups.find(g => g.staffMemberIds.includes(staffId));
    if (!staffGroup) {
      alert('This staff member is not assigned to any group');
      return;
    }

    // Check if already assigned
    if (tempAssignments.some(a => a.staffId === staffId)) {
      alert('This staff member is already assigned to this shift');
      return;
    }

    setTempAssignments(prev => [...prev, {
      staffId,
      activeGroupId: staffGroup.id,
      activeGroupName: staffGroup.name
    }]);
  };

  const handleRemoveStaffFromAssignment = (staffId: string) => {
    setTempAssignments(prev => prev.filter(a => a.staffId !== staffId));
  };

  const handleChangeStaffGroup = (staffId: string, newGroupId: string) => {
    const newGroup = staffGroups.find(g => g.id === newGroupId);
    if (!newGroup) return;

    setTempAssignments(prev => prev.map(a => 
      a.staffId === staffId 
        ? { ...a, activeGroupId: newGroupId, activeGroupName: newGroup.name }
        : a
    ));
  };

  const handleSaveAssignments = () => {
    if (tempAssignments.length === 0) {
      alert('Please assign at least one staff member');
      return;
    }

    setAssignments(tempAssignments);
    setShowAssignModal(false);
    setViewMode('tip-entry');
  };

  const handleSaveShiftData = async () => {
  if (!currentShift) return;

  try {
    const shiftData = prepareShiftDataForSave();
    
    const response = await fetch(`/api/daily-shifts/${currentShift.id}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shiftData)
    });

    const result = await response.json();
    
    if (result.success) {
      alert('Shift data saved successfully!');
      await loadRecentShifts();
      handleCloseTipEntry();
    } else {
      alert(result.message || 'Failed to save shift data');
    }
  } catch (error) {
    console.error('Failed to save shift data:', error);
    alert('Failed to save shift data. Please try again.');
  }
};

  const handleCloseShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to close this shift? This will finalize all data.')) {
      return;
    }

    try {
      const response = await fetch(`/api/daily-shifts/${shiftId}/close`, {
        method: 'POST'
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Shift closed successfully!');
        await loadRecentShifts();
      } else {
        alert(result.message || 'Failed to close shift');
      }
    } catch (error) {
      console.error('Failed to close shift:', error);
      alert('Failed to close shift. Please try again.');
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm('Are you sure you want to delete this shift? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/daily-shifts/${shiftId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Shift deleted successfully!');
        await loadRecentShifts();
      } else {
        alert(result.message || 'Failed to delete shift');
      }
    } catch (error) {
      console.error('Failed to delete shift:', error);
      alert('Failed to delete shift. Please try again.');
    }
  };

  const handleCloseTipEntry = () => {
    setViewMode('dashboard');
    setCurrentShift(null);
    setAssignments([]);
    setTipEntries([]);
  };

  // Get staff member name by ID
  const getStaffName = (staffId: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    return staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown';
  };

  // Get groups that a staff member belongs to
  const getStaffGroups = (staffId: string) => {
    return staffGroups.filter(g => g.staffMemberIds.includes(staffId));
  };

  // Render tip entry view
  if (viewMode === 'tip-entry' && currentShift) {
    return (
      <TipEntrySheet
        onSave={handleSaveShiftData}
        onClose={handleCloseTipEntry}
      />
    );
  }

  // Render dashboard view
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-gray-600 mt-1">Create and manage daily shifts</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Create New Shift
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Total Shifts (30 days)</div>
          <div className="text-3xl font-bold text-gray-900">{recentShifts.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Active Staff</div>
          <div className="text-3xl font-bold text-gray-900">{staffMembers.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-500 mb-1">Staff Groups</div>
          <div className="text-3xl font-bold text-gray-900">{staffGroups.length}</div>
        </div>
      </div>

      {/* Recent Shifts */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Shifts</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading shifts...</div>
        ) : recentShifts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No shifts found. Click "Create New Shift" to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentShifts.map(shift => (
              <div key={shift.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {formatShiftDate(shift.date)}
                      </h3>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        shift.type === 'AM' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : shift.type === 'PM'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {formatShiftType(shift.type)}
                      </span>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                        shift.status === 'draft'
                          ? 'bg-gray-100 text-gray-800'
                          : shift.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {shift.status.toUpperCase()}
                      </span>
                    </div>

                    {shift.staffData && shift.staffData.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600">
                          {shift.staffData.length} staff members • {shift.shiftTotals.totalHoursWorked.toFixed(1)} total hours
                        </div>
                        
                        {shift.shiftTotals.totalTipsCollected > 0 && (
                          <div className="flex space-x-6 text-sm">
                            <div>
                              <span className="text-gray-500">Collected:</span>{' '}
                              <span className="font-semibold text-green-600">
                                {formatCurrency(shift.shiftTotals.totalTipsCollected)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Distributed:</span>{' '}
                              <span className="font-semibold text-orange-600">
                                {formatCurrency(shift.shiftTotals.totalDistributed)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Net Kept:</span>{' '}
                              <span className="font-semibold text-blue-600">
                                {formatCurrency(shift.shiftTotals.totalKeptByDistributors)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic">
                        No staff assigned yet
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col space-y-2 ml-4">
                    {shift.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleOpenShift(shift)}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm whitespace-nowrap"
                        >
                          {shift.staffData && shift.staffData.length > 0 ? 'Continue Entry' : 'Assign Staff'}
                        </button>
                        <button
                          onClick={() => handleDeleteShift(shift.id)}
                          className="px-4 py-2 text-red-600 border border-red-300 rounded hover:bg-red-50 text-sm"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {shift.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleOpenShift(shift)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          View/Edit
                        </button>
                        <button
                          onClick={() => handleCloseShift(shift.id)}
                          className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                        >
                          Close Shift
                        </button>
                      </>
                    )}
                    {shift.status === 'closed' && (
                      <button
                        onClick={() => handleOpenShift(shift)}
                        className="px-4 py-2 text-blue-600 border border-blue-300 rounded hover:bg-blue-50 text-sm"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Shift Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create New Shift</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shift Type
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 p-3 border-2 border-gray-200 rounded cursor-pointer hover:border-blue-300">
                    <input
                      type="radio"
                      name="shiftType"
                      value="AM"
                      checked={selectedType === 'AM'}
                      onChange={(e) => setSelectedType(e.target.value as ShiftType)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <span className="font-medium">Morning Shift (AM)</span>
                      <div className="text-sm text-gray-500">Typically breakfast/lunch service</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2 p-3 border-2 border-gray-200 rounded cursor-pointer hover:border-blue-300">
                    <input
                      type="radio"
                      name="shiftType"
                      value="PM"
                      checked={selectedType === 'PM'}
                      onChange={(e) => setSelectedType(e.target.value as ShiftType)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <span className="font-medium">Evening Shift (PM)</span>
                      <div className="text-sm text-gray-500">Typically dinner service</div>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2 p-3 border-2 border-gray-200 rounded cursor-pointer hover:border-blue-300">
                    <input
                      type="radio"
                      name="shiftType"
                      value="FULL_DAY"
                      checked={selectedType === 'FULL_DAY'}
                      onChange={(e) => setSelectedType(e.target.value as ShiftType)}
                      className="text-blue-600"
                    />
                    <div className="flex-1">
                      <span className="font-medium">Full Day</span>
                      <div className="text-sm text-gray-500">All-day service</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateShift}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showAssignModal && currentShift && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Assign Staff to Shift
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {formatShiftDate(currentShift.date)} - {formatShiftType(currentShift.type)}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Available Staff */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Available Staff</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                    {staffMembers
                      .filter(member => !tempAssignments.some(a => a.staffId === member.id))
                      .map(member => {
                        const groups = getStaffGroups(member.id);
                        return (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50"
                          >
                            <div>
                              <div className="font-medium text-gray-900">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                {groups.length > 0 
                                  ? groups.map(g => g.name).join(', ')
                                  : 'No group'
                                }
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddStaffToAssignment(member.id)}
                              disabled={groups.length === 0}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Add
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Assigned Staff */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">
                    Assigned Staff ({tempAssignments.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded p-3">
                    {tempAssignments.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        No staff assigned yet
                      </div>
                    ) : (
                      tempAssignments.map(assignment => {
                        const staff = staffMembers.find(s => s.id === assignment.staffId);
                        const availableGroups = getStaffGroups(assignment.staffId);
                        
                        return (
                          <div
                            key={assignment.staffId}
                            className="p-3 border border-gray-200 rounded bg-blue-50"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-medium text-gray-900">
                                {staff?.firstName} {staff?.lastName}
                              </div>
                              <button
                                onClick={() => handleRemoveStaffFromAssignment(assignment.staffId)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Remove
                              </button>
                            </div>
                            
                            {availableGroups.length > 1 && (
                              <div>
                                <label className="text-xs text-gray-600 mb-1 block">
                                  Active Group:
                                </label>
                                <select
                                  value={assignment.activeGroupId}
                                  onChange={(e) => handleChangeStaffGroup(assignment.staffId, e.target.value)}
                                  className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                                >
                                  {availableGroups.map(group => (
                                    <option key={group.id} value={group.id}>
                                      {group.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                            
                            {availableGroups.length === 1 && (
                              <div className="text-sm text-gray-600">
                                Group: {assignment.activeGroupName}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {tempAssignments.length} staff member{tempAssignments.length !== 1 ? 's' : ''} assigned
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setTempAssignments([]);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAssignments}
                  disabled={tempAssignments.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue to Tip Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}