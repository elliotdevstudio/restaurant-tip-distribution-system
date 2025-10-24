'use client';

import { useState, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  currentShiftAtom,
  shiftStaffAssignmentsAtom,
  tipEntriesAtom,
  staffBaseAmountsAtom,
  individualContributionsAtom,
  recipientPoolsAtom,
  memberPayoutsAtom,
  groupSummariesAtom,
  shiftTotalsAtom,
  updateTipEntryAtom,
  initializeTipEntriesAtom
} from '../../atoms/staffAtoms';
import { staffMembersAtom, staffGroupsAtom } from '../../atoms/staffAtoms';
import {
  formatCurrency,
  formatHours,
  formatShiftDate,
  formatShiftType,
  generateRandomHours,
  generateDemoTipData,
  downloadCSV,
  generateShiftCSV
} from '../../lib/utils/tipCalculations';
import { ShiftType } from '../../../types';

interface TipEntrySheetProps {
  onSave: () => Promise<void>;
  onClose: () => void;
}

export default function TipEntrySheet({ onSave, onClose }: TipEntrySheetProps) {
  const currentShift = useAtomValue(currentShiftAtom);
  const [assignments, setAssignments] = useAtom(shiftStaffAssignmentsAtom);
  const [tipEntries, setTipEntries] = useAtom(tipEntriesAtom);
  const staffMembers = useAtomValue(staffMembersAtom);
  const groups = useAtomValue(staffGroupsAtom);
  
  // Calculation results
  const baseAmounts = useAtomValue(staffBaseAmountsAtom);
  const contributions = useAtomValue(individualContributionsAtom);
  const pools = useAtomValue(recipientPoolsAtom);
  const payouts = useAtomValue(memberPayoutsAtom);
  const groupSummaries = useAtomValue(groupSummariesAtom);
  const shiftTotals = useAtomValue(shiftTotalsAtom);
  
  // Update atoms
  const updateTipEntry = useSetAtom(updateTipEntryAtom);
  const initializeTipEntries = useSetAtom(initializeTipEntriesAtom);
  
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'entry' | 'summary'>('entry');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Initialize tip entries when component mounts
  useEffect(() => {
    if (assignments.length > 0 && tipEntries.length === 0) {
      initializeTipEntries(assignments);
    }
  }, [assignments, tipEntries.length, initializeTipEntries]);

  if (!currentShift) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">No active shift selected</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    );
  }

  const handleUpdateField = (staffId: string, field: string, value: any) => {
    updateTipEntry({ staffId, field: field as any, value });
  };

  const handleGenerateDemoData = () => {
    const demoData = generateDemoTipData(
      assignments.map(a => ({ staffId: a.staffId, groupId: a.activeGroupId })),
      groups
    );
    setTipEntries(demoData);
  };

  const handleGenerateRandomHours = () => {
    const updatedEntries = tipEntries.map(entry => ({
      ...entry,
      hoursWorked: generateRandomHours()
    }));
    setTipEntries(updatedEntries);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    const csvData = {
      shiftDate: currentShift.date,
      shiftType: currentShift.type,
      staffData: assignments.map(assignment => {
        const staff = staffMembers.find(s => s.id === assignment.staffId);
        const entry = tipEntries.find(e => e.staffId === assignment.staffId);
        const contribution = contributions.find(c => c.staffId === assignment.staffId);
        const payout = payouts.find(p => p.staffId === assignment.staffId);
        
        return {
          name: `${staff?.firstName} ${staff?.lastName}`,
          groupName: assignment.activeGroupName,
          hoursWorked: entry?.hoursWorked || 0,
          tipsCollected: contribution?.baseAmount,
          contribution: contribution?.totalContribution,
          netAmount: contribution?.netTakeHome,
          received: payout?.payout
        };
      })
    };
    
    const csv = generateShiftCSV(csvData);
    const filename = `shift-report-${currentShift.date.toISOString().split('T')[0]}-${currentShift.type}.csv`;
    downloadCSV(csv, filename);
  };

  const toggleGroupExpanded = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Group assignments by group
  const assignmentsByGroup = assignments.reduce((acc, assignment) => {
    if (!acc[assignment.activeGroupId]) {
      acc[assignment.activeGroupId] = [];
    }
    acc[assignment.activeGroupId].push(assignment);
    return acc;
  }, {} as Record<string, typeof assignments>);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Tip Entry Sheet
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {formatShiftDate(currentShift.date)} - {formatShiftType(currentShift.type)}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleGenerateDemoData}
              className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            >
              Generate Demo Data
            </button>
            <button
              onClick={handleGenerateRandomHours}
              className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Random Hours
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mt-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('entry')}
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'entry'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tip Entry
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'summary'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Summary
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'entry' ? (
          <div className="space-y-6">
            {/* Distributor Groups */}
            {Object.entries(assignmentsByGroup).map(([groupId, groupAssignments]) => {
              const group = groups.find(g => g.id === groupId);
              if (!group?.gratuityConfig.distributesGratuities) return null;

              const isExpanded = expandedGroups.has(groupId);
              const groupSummary = groupSummaries.find(s => s.groupId === groupId);

              return (
                <div key={groupId} className="bg-white rounded-lg shadow">
                  {/* Group Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleGroupExpanded(groupId)}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{group.name}</h3>
                        <p className="text-sm text-gray-500">
                          Distributor Group • {groupAssignments.length} staff
                        </p>
                      </div>
                    </div>
                    
                    {groupSummary && (
                      <div className="flex space-x-6 text-sm">
                        <div>
                          <span className="text-gray-500">Collected:</span>{' '}
                          <span className="font-semibold text-green-600">
                            {formatCurrency(groupSummary.totalCollected || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Distributed:</span>{' '}
                          <span className="font-semibold text-orange-600">
                            {formatCurrency(groupSummary.totalDistributed || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Net:</span>{' '}
                          <span className="font-semibold text-blue-600">
                            {formatCurrency(groupSummary.totalKept || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Group Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Staff Member
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Hours
                            </th>
                            {group.gratuityConfig.contributionSource === 'sales' ? (
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Sales Amount
                              </th>
                            ) : (
                              <>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  CC Tips
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Cash Tips
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                  Total Tips
                                </th>
                              </>
                            )}
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Contribution
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Net Take Home
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {groupAssignments.map(assignment => {
                            const staff = staffMembers.find(s => s.id === assignment.staffId);
                            const entry = tipEntries.find(e => e.staffId === assignment.staffId);
                            const contribution = contributions.find(c => c.staffId === assignment.staffId);

                            return (
                              <tr key={assignment.staffId} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {staff?.firstName} {staff?.lastName}
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    value={entry?.hoursWorked || 0}
                                    onChange={(e) => handleUpdateField(
                                      assignment.staffId,
                                      'hoursWorked',
                                      parseFloat(e.target.value) || 0
                                    )}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                    step="0.25"
                                    min="0"
                                  />
                                </td>
                                {group.gratuityConfig.contributionSource === 'sales' ? (
                                  <td className="px-4 py-3">
                                    <input
                                      type="number"
                                      value={entry?.salesAmount || 0}
                                      onChange={(e) => handleUpdateField(
                                        assignment.staffId,
                                        'salesAmount',
                                        parseFloat(e.target.value) || 0
                                      )}
                                      className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                                      step="0.01"
                                      min="0"
                                    />
                                  </td>
                                ) : (
                                  <>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        value={entry?.creditCardTips || 0}
                                        onChange={(e) => handleUpdateField(
                                          assignment.staffId,
                                          'creditCardTips',
                                          parseFloat(e.target.value) || 0
                                        )}
                                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                                        step="0.01"
                                        min="0"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input
                                        type="number"
                                        value={entry?.cashTips || 0}
                                        onChange={(e) => handleUpdateField(
                                          assignment.staffId,
                                          'cashTips',
                                          parseFloat(e.target.value) || 0
                                        )}
                                        className="w-28 px-2 py-1 border border-gray-300 rounded text-sm"
                                        step="0.01"
                                        min="0"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                      {formatCurrency(
                                        (entry?.creditCardTips || 0) + (entry?.cashTips || 0)
                                      )}
                                    </td>
                                  </>
                                )}
                                <td className="px-4 py-3 text-sm font-medium text-orange-600">
                                  {formatCurrency(contribution?.totalContribution || 0)}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                                  {formatCurrency(contribution?.netTakeHome || 0)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Recipient Groups */}
            {Object.entries(assignmentsByGroup).map(([groupId, groupAssignments]) => {
              const group = groups.find(g => g.id === groupId);
              if (group?.gratuityConfig.distributesGratuities) return null;

              const isExpanded = expandedGroups.has(groupId);
              const groupSummary = groupSummaries.find(s => s.groupId === groupId);
              const pool = pools.find(p => p.groupId === groupId);

              return (
                <div key={groupId} className="bg-white rounded-lg shadow">
                  {/* Group Header */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleGroupExpanded(groupId)}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-lg">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{group?.name}</h3>
                        <p className="text-sm text-gray-500">
                          Recipient Group • {groupAssignments.length} staff
                        </p>
                      </div>
                    </div>
                    
                    {groupSummary && (
                      <div className="flex space-x-6 text-sm">
                        <div>
                          <span className="text-gray-500">Pool:</span>{' '}
                          <span className="font-semibold text-green-600">
                            {formatCurrency(groupSummary.totalReceived || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">Hourly Rate:</span>{' '}
                          <span className="font-semibold text-blue-600">
                            {formatCurrency(groupSummary.averageHourlyRate || 0)}/hr
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Group Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      {pool && pool.sourceBreakdown.length > 0 && (
                        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                          <p className="text-sm text-blue-800 font-medium">
                            Receiving from:{' '}
                            {pool.sourceBreakdown.map(source => {
                              const sourceGroup = groups.find(g => g.id === source.sourceGroupId);
                              return `${sourceGroup?.name} (${formatCurrency(source.amount)})`;
                            }).join(', ')}
                          </p>
                        </div>
                      )}
                      
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Staff Member
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Hours Worked
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Hourly Rate
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Payout
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {groupAssignments.map(assignment => {
                            const staff = staffMembers.find(s => s.id === assignment.staffId);
                            const entry = tipEntries.find(e => e.staffId === assignment.staffId);
                            const payout = payouts.find(p => p.staffId === assignment.staffId);

                            return (
                              <tr key={assignment.staffId} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {staff?.firstName} {staff?.lastName}
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    value={entry?.hoursWorked || 0}
                                    onChange={(e) => handleUpdateField(
                                      assignment.staffId,
                                      'hoursWorked',
                                      parseFloat(e.target.value) || 0
                                    )}
                                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                    step="0.25"
                                    min="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {formatCurrency(payout?.hourlyRate || 0)}/hr
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-green-600">
                                  {formatCurrency(payout?.payout || 0)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Summary Tab */
          <div className="space-y-6">
            {/* Overall Totals Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Totals</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Total Collected</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(shiftTotals.totalTipsCollected)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Distributed</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(shiftTotals.totalDistributed)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Net Kept</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(shiftTotals.totalKeptByDistributors)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Hours</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {shiftTotals.totalHoursWorked.toFixed(2)}
                  </p>
                </div>
              </div>
              
              {/* Balance Status */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                {shiftTotals.balanced ? (
                  <div className="flex items-center text-green-600">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">All calculations are balanced</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">
                      Warning: Discrepancy of {formatCurrency(shiftTotals.discrepancy)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Group Summaries */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Group Summaries</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {groupSummaries.map(summary => (
                  <div key={summary.groupId} className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">{summary.groupName}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {summary.distributesGratuities ? 'Distributor Group' : 'Recipient Group'} •{' '}
                          {summary.activeStaffCount} staff • {formatHours(summary.totalHours)}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        {summary.distributesGratuities ? (
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="text-gray-500">Collected:</span>{' '}
                              <span className="font-semibold text-green-600">
                                {formatCurrency(summary.totalCollected || 0)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-500">Distributed:</span>{' '}
                              <span className="font-semibold text-orange-600">
                                {formatCurrency(summary.totalDistributed || 0)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-500">Net:</span>{' '}
                              <span className="font-semibold text-blue-600">
                                {formatCurrency(summary.totalKept || 0)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="text-sm">
                              <span className="text-gray-500">Received:</span>{' '}
                              <span className="font-semibold text-green-600">
                                {formatCurrency(summary.totalReceived || 0)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-500">Avg Rate:</span>{' '}
                              <span className="font-semibold text-blue-600">
                                {formatCurrency(summary.averageHourlyRate || 0)}/hr
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {assignments.length} staff assigned • Last updated: {new Date().toLocaleTimeString()}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !shiftTotals.balanced}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Shift Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}