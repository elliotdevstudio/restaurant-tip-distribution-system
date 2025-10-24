'use client';

import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { staffMembersAtom, staffGroupsAtom } from '../atoms/staffAtoms';
import { AnyStaffGroup } from '../../types';
import { 
  generateRandomHours, 
  formatCurrency 
} from '../lib/utils/tipCalculations';

interface DemoEntry {
  staffId: string;
  staffName: string;
  groupId: string;
  groupName: string;
  hoursWorked: number;
  salesAmount?: number;
  creditCardTips?: number;
  cashTips?: number;
  isDistributor: boolean;
  // Calculated fields
  totalTips?: number;
  tipOutAmount?: number;
  netTips?: number;
}

const DEMO_DATA_KEY = 'demo_shift_data';
const DEMO_DATE_KEY = 'demo_shift_date';

export default function DemoPage() {
  const [staffMembers, setStaffMembers] = useAtom(staffMembersAtom);
  const [staffGroups, setStaffGroups] = useAtom(staffGroupsAtom);
  const [demoEntries, setDemoEntries] = useState<DemoEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('📊 Current state:', {
      staffMembersCount: staffMembers.length,
      staffGroupsCount: staffGroups.length,
      demoEntriesCount: demoEntries.length
    });
  }, [staffMembers, staffGroups, demoEntries]);

  const loadInitialData = async () => {
    try {
      console.log('📋 Loading staff members and groups...');
      
      // Load staff members
      const membersResponse = await fetch('/api/staff-members');
      const membersData = await membersResponse.json();
      
      if (membersData.success) {
        console.log(`✅ Loaded ${membersData.members.length} staff members`);
        setStaffMembers(membersData.members);
      } else {
        console.error('Failed to load staff members');
      }

      // Load groups
      const groupsResponse = await fetch('/api/staff/groups');
      const groupsData = await groupsResponse.json();
      
      if (groupsData.success) {
        console.log(`✅ Loaded ${groupsData.groups.length} staff groups`);
        setStaffGroups(groupsData.groups);
      } else {
        console.error('Failed to load staff groups');
      }

      // Check if we have cached demo data
      const cachedData = sessionStorage.getItem(DEMO_DATA_KEY);
      const cachedDate = sessionStorage.getItem(DEMO_DATE_KEY);

      if (cachedData && cachedDate) {
        console.log('📋 Loading cached demo data');
        setDemoEntries(JSON.parse(cachedData));
        setSelectedDate(cachedDate);
      } else {
        console.log('✨ No cached data found - ready to generate');
      }

    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Generate realistic sales and tip data
   * Sales: $949.99 to $2,499.99
   * CC Tips: 17% to 23% of sales
   */
  const generateRealisticDistributorData = () => {
    const minSales = 949.99;
    const maxSales = 2499.99;
    const minTipPercent = 0.17; // 17%
    const maxTipPercent = 0.23; // 23%

    // Generate random sales amount
    const salesAmount = parseFloat(
      (Math.random() * (maxSales - minSales) + minSales).toFixed(2)
    );

    // Generate random tip percentage within range
    const tipPercent = Math.random() * (maxTipPercent - minTipPercent) + minTipPercent;
    
    // Calculate CC tips based on sales
    const creditCardTips = parseFloat((salesAmount * tipPercent).toFixed(2));

    return { 
      salesAmount, 
      creditCardTips, 
      cashTips: 0,
      tipPercent 
    };
  };

  /**
   * Calculate how much a distributor tips out based on their group's configuration
   */
  const calculateTipOutForDistributor = (
    distributorEntry: DemoEntry,
    distributorGroup: AnyStaffGroup
  ): number => {
    if (!distributorGroup.gratuityConfig.recipientGroupIds || 
        distributorGroup.gratuityConfig.recipientGroupIds.length === 0) {
      return 0; // No recipients, no tip out
    }

    const totalTips = (distributorEntry.creditCardTips || 0) + (distributorEntry.cashTips || 0);
    const salesAmount = distributorEntry.salesAmount || 0;
    
    // Get distribution basis from the distributor group
    const distributionBasis = distributorGroup.gratuityConfig.distributionBasis || 'gratuities';
    
    let totalTipOut = 0;
    
    distributorGroup.gratuityConfig.recipientGroupIds.forEach(recipientId => {
      const recipientGroup = staffGroups.find(g => g.id === recipientId);
      if (!recipientGroup) return;
      
      const distributionType = recipientGroup.gratuityConfig.distributionType || 'percentage';
      const percentage = recipientGroup.gratuityConfig.percentage;
      const fixedAmount = recipientGroup.gratuityConfig.fixedAmount;
      
      if (distributionType === 'fixed') {
        totalTipOut += fixedAmount || 0;
      } else if (distributionType === 'percentage' && percentage) {
        // Use distribution basis to determine what to calculate from
        const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
        totalTipOut += (baseAmount * percentage) / 100;
      }
    });
    
    return parseFloat(totalTipOut.toFixed(2));
  };

  /**
   * Calculate the total tip out amount a recipient group receives from all distributors
   */
  const calculateRecipientGroupTipOut = (recipientGroupId: string): number => {
    let totalTipOut = 0;
    
    // Find all distributor groups that send to this recipient
    const sourceDistributorGroups = staffGroups.filter(g => 
      g.gratuityConfig.distributesGratuities && 
      g.gratuityConfig.recipientGroupIds?.includes(recipientGroupId)
    );
    
    sourceDistributorGroups.forEach(distributorGroup => {
      // Find recipient group config to get distribution settings
      const recipientGroup = staffGroups.find(g => g.id === recipientGroupId);
      if (!recipientGroup) return;
      
      const distributionType = recipientGroup.gratuityConfig.distributionType || 'percentage';
      const percentage = recipientGroup.gratuityConfig.percentage;
      const fixedAmount = recipientGroup.gratuityConfig.fixedAmount;
      const distributionBasis = distributorGroup.gratuityConfig.distributionBasis || 'gratuities';
      
      // For each distributor in the source group
      const distributorEntries = demoEntries.filter(e => 
        e.groupId === distributorGroup.id && e.isDistributor
      );
      
      distributorEntries.forEach(distributorEntry => {
        const totalTips = (distributorEntry.creditCardTips || 0) + (distributorEntry.cashTips || 0);
        const salesAmount = distributorEntry.salesAmount || 0;
        
        if (distributionType === 'fixed') {
          totalTipOut += fixedAmount || 0;
        } else if (distributionType === 'percentage' && percentage) {
          const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
          totalTipOut += (baseAmount * percentage) / 100;
        }
      });
    });
    
    return parseFloat(totalTipOut.toFixed(2));
  };

  /**
   * Calculate an individual recipient's share based on hours worked
   */
  const calculateRecipientShare = (
    recipientStaffId: string,
    recipientGroupId: string,
    hoursWorked: number
  ): { tipOutReceived: number; tipOutPercentage: number } => {
    const groupTotalTipOut = calculateRecipientGroupTipOut(recipientGroupId);
    
    // Get all recipients in this group with hours
    const recipientEntries = demoEntries.filter(e => 
      e.groupId === recipientGroupId && !e.isDistributor
    );
    
    const totalGroupHours = recipientEntries.reduce((sum, e) => sum + e.hoursWorked, 0);
    
    if (totalGroupHours === 0) {
      return { tipOutReceived: 0, tipOutPercentage: 0 };
    }
    
    // Calculate this person's share based on hours worked
    const tipOutReceived = (hoursWorked / totalGroupHours) * groupTotalTipOut;
    const tipOutPercentage = (hoursWorked / totalGroupHours) * 100;
    
    return {
      tipOutReceived: parseFloat(tipOutReceived.toFixed(2)),
      tipOutPercentage: parseFloat(tipOutPercentage.toFixed(2))
    };
  };

  const handleGenerateData = () => {
    console.log('🎲 Generating demo data...');
    const entries: DemoEntry[] = [];

    // Generate an entry for each staff member
    staffMembers.forEach(member => {
      // Find which group(s) this member belongs to
      const memberGroups = staffGroups.filter(g => g.staffMemberIds.includes(member.id));
      
      if (memberGroups.length > 0) {
        // Use the first group
        const group = memberGroups[0];
        const isDistributor = group.gratuityConfig.distributesGratuities;

        const entry: DemoEntry = {
          staffId: member.id,
          staffName: `${member.firstName} ${member.lastName}`,
          groupId: group.id,
          groupName: group.name,
          hoursWorked: generateRandomHours(4, 8),
          isDistributor: isDistributor
        };

        // Only distributors collect tips/sales
        if (isDistributor) {
          const { salesAmount, creditCardTips, cashTips } = generateRealisticDistributorData();
          
          entry.salesAmount = salesAmount;
          entry.creditCardTips = creditCardTips;
          entry.cashTips = cashTips;
          entry.totalTips = creditCardTips + cashTips;
          
          // Calculate tip out amount
          entry.tipOutAmount = calculateTipOutForDistributor(entry, group);
          
          // Calculate net tips (what they keep after tipping out)
          entry.netTips = entry.totalTips - entry.tipOutAmount;
          
          console.log(
            `💵 ${entry.staffName}: $${salesAmount.toFixed(2)} sales → ` +
            `$${entry.totalTips.toFixed(2)} total tips - ` +
            `$${entry.tipOutAmount.toFixed(2)} tip out = ` +
            `$${entry.netTips.toFixed(2)} net tips`
          );
        }

        entries.push(entry);
      }
    });

    // Save to sessionStorage for persistence
    sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(entries));
    sessionStorage.setItem(DEMO_DATE_KEY, selectedDate);

    setDemoEntries(entries);
    console.log('✅ Generated and cached demo data for', entries.length, 'staff members');
  };

  const handleUpdateEntry = (staffId: string, field: keyof DemoEntry, value: number) => {
    const updatedEntries = demoEntries.map(entry => {
      if (entry.staffId !== staffId) return entry;
      
      // Update the field
      const updated = { ...entry, [field]: value };
      
      // Recalculate derived values for distributors
      if (updated.isDistributor) {
        updated.totalTips = (updated.creditCardTips || 0) + (updated.cashTips || 0);
        
        // Recalculate tip out
        const group = staffGroups.find(g => g.id === updated.groupId);
        if (group) {
          updated.tipOutAmount = calculateTipOutForDistributor(updated, group);
          updated.netTips = updated.totalTips - updated.tipOutAmount;
        }
      }
      
      return updated;
    });
    
    setDemoEntries(updatedEntries);
    
    // Update cache
    sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(updatedEntries));
    console.log('💾 Updated and recalculated entry for staff:', staffId);
  };

  const handleClearData = () => {
    if (!confirm('Are you sure you want to clear all demo data? This cannot be undone.')) {
      return;
    }
    
    sessionStorage.removeItem(DEMO_DATA_KEY);
    sessionStorage.removeItem(DEMO_DATE_KEY);
    setDemoEntries([]);
    console.log('🗑️ Cleared demo data');
  };

  const handleContinueToShiftEntry = async () => {
    try {
      console.log('📝 Creating shift for tip entry...');
      
      // Step 1: Create a shift for the selected date
      const shiftResponse = await fetch('/api/daily-shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          type: 'FULL_DAY'
        })
      });

      const shiftResult = await shiftResponse.json();
      
      if (!shiftResult.success) {
        alert(`Failed to create shift: ${shiftResult.message}`);
        return;
      }

      console.log('✅ Shift created:', shiftResult.shift.id);

      // Step 2: Store demo data for shifts page to pick up
      sessionStorage.setItem('demoShiftId', shiftResult.shift.id);
      sessionStorage.setItem('demoEntries', JSON.stringify(demoEntries));

      // Step 3: Navigate to shifts page
      window.location.href = '/shifts';

    } catch (error) {
      console.error('❌ Failed to create shift:', error);
      alert('Failed to create shift. Please try again.');
    }
  };

  const getTotalTips = (entry: DemoEntry) => {
    if (!entry.creditCardTips && !entry.cashTips) return 0;
    return (entry.creditCardTips || 0) + (entry.cashTips || 0);
  };

  const getTipPercentage = (entry: DemoEntry) => {
    if (!entry.salesAmount || !entry.creditCardTips) return null;
    return ((entry.creditCardTips / entry.salesAmount) * 100).toFixed(1);
  };

  // Group entries by group
  const entriesByGroup = demoEntries.reduce((acc, entry) => {
    if (!acc[entry.groupId]) {
      acc[entry.groupId] = [];
    }
    acc[entry.groupId].push(entry);
    return acc;
  }, {} as Record<string, DemoEntry[]>);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Demo Data Generator</h1>
        <p className="text-gray-600">
          Generate realistic sales and tip data for testing calculations
        </p>
        <div className="mt-2 text-sm text-gray-500">
          💡 Data persists across page refreshes during your session
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-end space-x-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                sessionStorage.setItem(DEMO_DATE_KEY, e.target.value);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          
          <button
            onClick={handleGenerateData}
            disabled={staffMembers.length === 0 || staffGroups.length === 0}
            className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {demoEntries.length > 0 ? 'Regenerate Data' : 'Generate Data'}
          </button>
          
          {demoEntries.length > 0 && (
            <>
              <button
                onClick={handleClearData}
                className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Clear Data
              </button>
              
              <button
                onClick={handleContinueToShiftEntry}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Continue to Shift Entry →
              </button>
            </>
          )}
        </div>

        {/* Info Boxes */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm font-medium text-blue-900 mb-2">Distributor Groups</div>
            <div className="text-xs text-blue-700 space-y-1">
              <div>• Sales: $949.99 - $2,499.99</div>
              <div>• CC Tips: 17% - 23% of sales</div>
              <div>• Tip out calculated and deducted</div>
            </div>
          </div>
          
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <div className="text-sm font-medium text-green-900 mb-2">Recipient Groups</div>
            <div className="text-xs text-green-700 space-y-1">
              <div>• Receive tip outs from distributors</div>
              <div>• Share based on hours worked</div>
              <div>• No direct tip collection</div>
            </div>
          </div>
        </div>

        {(staffMembers.length === 0 || staffGroups.length === 0) && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ Please create staff members and groups before generating demo data
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {demoEntries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Sales</div>
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(demoEntries
                .filter(e => e.isDistributor)
                .reduce((sum, e) => sum + (e.salesAmount || 0), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Tips Collected</div>
            <div className="text-xl font-bold text-blue-600">
              {formatCurrency(demoEntries
                .filter(e => e.isDistributor)
                .reduce((sum, e) => sum + getTotalTips(e), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Total Tipped Out</div>
            <div className="text-xl font-bold text-orange-600">
              {formatCurrency(demoEntries
                .filter(e => e.isDistributor)
                .reduce((sum, e) => sum + (e.tipOutAmount || 0), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Net Kept</div>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(demoEntries
                .filter(e => e.isDistributor)
                .reduce((sum, e) => sum + (e.netTips || 0), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Recipients Received</div>
            <div className="text-xl font-bold text-purple-600">
              {formatCurrency(
                staffGroups
                  .filter(g => !g.gratuityConfig.distributesGratuities)
                  .reduce((sum, g) => sum + calculateRecipientGroupTipOut(g.id), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Staff Count</div>
            <div className="text-xl font-bold text-gray-900">{demoEntries.length}</div>
          </div>
        </div>
      )}

      {/* Data Tables by Group */}
      {demoEntries.length > 0 && (
        <div className="space-y-6">
          {Object.entries(entriesByGroup).map(([groupId, entries]) => {
            const group = staffGroups.find(g => g.id === groupId);
            const isDistributor = group?.gratuityConfig.distributesGratuities;

            return (
              <div key={groupId} className="bg-white rounded-lg shadow">
                {/* Group Header */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {group?.name}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {isDistributor ? '📤 Distributor' : '📥 Recipient'} Group • {entries.length} staff
                      </p>
                    </div>
                    
                    {isDistributor && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Total Tips Collected</div>
                        <div className="text-lg font-bold text-blue-600 mb-2">
                          {formatCurrency(entries.reduce((sum, e) => sum + getTotalTips(e), 0))}
                        </div>
                        <div className="text-xs text-gray-500 mb-1">Total Tipped Out</div>
                        <div className="text-lg font-bold text-orange-600 mb-2">
                          {formatCurrency(entries.reduce((sum, e) => sum + (e.tipOutAmount || 0), 0))}
                        </div>
                        <div className="text-xs text-gray-500 mb-1">Net Kept by Group</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(entries.reduce((sum, e) => sum + (e.netTips || 0), 0))}
                        </div>
                      </div>
                    )}
                    
                    {!isDistributor && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Total Tip Out Received</div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(calculateRecipientGroupTipOut(groupId))}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {entries.reduce((sum, e) => sum + e.hoursWorked, 0).toFixed(1)} total hours
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Data Table - Different columns for distributor vs recipient */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Staff Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Hours
                        </th>
                        
                        {/* DISTRIBUTOR COLUMNS */}
                        {isDistributor && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Sales Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              CC Tips
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Tip %
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Tip Out
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Net Tips
                            </th>
                          </>
                        )}
                        
                        {/* RECIPIENT COLUMNS */}
                        {!isDistributor && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Tip Out Received
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Tip Out %
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {entries.map(entry => {
                        // Calculate recipient data if applicable
                        const recipientData = !isDistributor 
                          ? calculateRecipientShare(entry.staffId, entry.groupId, entry.hoursWorked)
                          : null;
                        
                        return (
                          <tr key={entry.staffId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {entry.staffName}
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="number"
                                value={entry.hoursWorked}
                                onChange={(e) => handleUpdateEntry(entry.staffId, 'hoursWorked', parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                step="0.25"
                                min="0"
                              />
                            </td>
                            
                            {/* DISTRIBUTOR CELLS */}
                            {isDistributor && (
                              <>
                                <td className="px-6 py-4">
                                  <input
                                    type="number"
                                    value={entry.salesAmount || 0}
                                    onChange={(e) => handleUpdateEntry(entry.staffId, 'salesAmount', parseFloat(e.target.value) || 0)}
                                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                                    step="0.01"
                                    min="0"
                                  />
                                </td>
                                <td className="px-6 py-4">
                                  <input
                                    type="number"
                                    value={entry.creditCardTips || 0}
                                    onChange={(e) => handleUpdateEntry(entry.staffId, 'creditCardTips', parseFloat(e.target.value) || 0)}
                                    className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                                    step="0.01"
                                    min="0"
                                  />
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {getTipPercentage(entry) ? `${getTipPercentage(entry)}%` : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-orange-600">
                                  {entry.tipOutAmount ? `- ${formatCurrency(entry.tipOutAmount)}` : '-'}
                                </td>
                                <td className="px-6 py-4 text-sm font-bold text-green-600">
                                  {entry.netTips !== undefined ? formatCurrency(entry.netTips) : '-'}
                                </td>
                              </>
                            )}
                            
                            {/* RECIPIENT CELLS */}
                            {!isDistributor && recipientData && (
                              <>
                                <td className="px-6 py-4 text-sm font-bold text-green-600">
                                  {formatCurrency(recipientData.tipOutReceived)}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">
                                  {recipientData.tipOutPercentage.toFixed(1)}%
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {demoEntries.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-2">
            Click "Generate Data" to create realistic sales and tip entries
          </p>
          <p className="text-sm text-gray-400">
            Data will be saved to your session and persist across page refreshes
          </p>
        </div>
      )}
    </div>
  );
}


// 'use client';

// import { useState, useEffect } from 'react';
// import { useAtom } from 'jotai';
// import { staffMembersAtom, staffGroupsAtom } from '../atoms/staffAtoms';
// import { 
//   generateRandomHours, 
//   formatCurrency,
//   calculateRecipientGroupTotal
// } from '../lib/utils/tipCalculations';
// import { isGratuityRecipientGroup } from '../../types';

// interface DemoEntry {
//   staffId: string;
//   staffName: string;
//   groupId: string;
//   groupName: string;
//   hoursWorked: number;
//   salesAmount?: number;
//   creditCardTips?: number;
//   cashTips?: number;
//   isDistributor: boolean;
//   totalTips?: number;
//   tipOutAmount?: number;
//   netTips?: number;
// }

// const DEMO_DATA_KEY = 'demo_shift_data';
// const DEMO_DATE_KEY = 'demo_shift_date';

// export default function DemoPage() {
//   const [staffMembers, setStaffMembers] = useAtom(staffMembersAtom);
//   const [staffGroups, setStaffGroups] = useAtom(staffGroupsAtom);
//   const [demoEntries, setDemoEntries] = useState<DemoEntry[]>([]);
//   const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     loadInitialData();
//   }, []);

//   useEffect(() => {
//   console.log('📊 Current state:', {
//     staffMembersCount: staffMembers.length,
//     staffGroupsCount: staffGroups.length,
//     demoEntriesCount: demoEntries.length
//   });
//   }, [staffMembers, staffGroups, demoEntries]);

//   const loadInitialData = async () => {
//     try {
//       console.log('📋 Loading staff members and groups...');
      
//       // Load staff members
//       const membersResponse = await fetch('/api/staff-members');
//       const membersData = await membersResponse.json();
      
//       if (membersData.success) {
//         console.log(`✅ Loaded ${membersData.members.length} staff members`);
//         setStaffMembers(membersData.members); // important
//       } else {
//         console.error('Failed to load staff members');
//       }

//       // Load groups
//       const groupsResponse = await fetch('/api/staff/groups');
//       const groupsData = await groupsResponse.json();
      
//       if (groupsData.success) {
//         console.log(`✅ Loaded ${groupsData.groups.length} staff groups`);
//         setStaffGroups(groupsData.groups); // important
//       } else {
//         console.error('Failed to load staff groups');
//       }

//       // Check if we have cached demo data
//       const cachedData = sessionStorage.getItem(DEMO_DATA_KEY);
//       const cachedDate = sessionStorage.getItem(DEMO_DATE_KEY);

//       if (cachedData && cachedDate) {
//         console.log('📋 Loading cached demo data');
//         setDemoEntries(JSON.parse(cachedData));
//         setSelectedDate(cachedDate);
//       } else {
//         console.log('✨ No cached data found - ready to generate');
//       }

//     } catch (error) {
//       console.error('❌ Failed to load initial data:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   /**
//  * Generate realistic sales and tip data
//  * Sales: $949.99 to $2,499.99
//  * CC Tips: 17% to 23% of sales
//  */
//   const generateRealisticDistributorData = () => {
//     const minSales = 949.99;
//     const maxSales = 2499.99;
//     const minTipPercent = 0.17; // 17%
//     const maxTipPercent = 0.23; // 23%

//     // Generate random sales amount
//     const salesAmount = parseFloat(
//       (Math.random() * (maxSales - minSales) + minSales).toFixed(2)
//     );

//     // Generate random tip percentage within range
//     const tipPercent = Math.random() * (maxTipPercent - minTipPercent) + minTipPercent;
    
//     // Calculate CC tips based on sales
//     const creditCardTips = parseFloat((salesAmount * tipPercent).toFixed(2));

//     return { 
//       salesAmount, 
//       creditCardTips, 
//       cashTips: 0, // No cash tips for sales-based
//       tipPercent 
//     };
//   };

//   const handleGenerateData = () => {
//   console.log('🎲 Generating demo data...');
//   const entries: DemoEntry[] = [];

//   // Generate an entry for each staff member
//   staffMembers.forEach(member => {
//     // Find which group(s) this member belongs to
//     const memberGroups = staffGroups.filter(g => g.staffMemberIds.includes(member.id));
    
//     if (memberGroups.length > 0) {
//       // Use the first group
//       const group = memberGroups[0];
//       const isDistributor = group.gratuityConfig.distributesGratuities;

//       const entry: DemoEntry = {
//         staffId: member.id,
//         staffName: `${member.firstName} ${member.lastName}`,
//         groupId: group.id,
//         groupName: group.name,
//         hoursWorked: generateRandomHours(4, 8),
//         isDistributor: isDistributor
//       };

//       // Only distributors collect tips/sales
//       if (isDistributor) {
//         const { salesAmount, creditCardTips, cashTips, tipPercent } = generateRealisticDistributorData();
        
//         entry.salesAmount = salesAmount;
//         entry.creditCardTips = creditCardTips;
//         entry.cashTips = cashTips;
        
//         console.log(
//           `💵 ${entry.staffName}: $${salesAmount.toFixed(2)} sales → ` +
//           `$${creditCardTips.toFixed(2)} tips (${(tipPercent * 100).toFixed(1)}%)`
//         );
//       }

//       entries.push(entry);
//     }
//   });

//   // Save to sessionStorage for persistence
//   sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(entries));
//   sessionStorage.setItem(DEMO_DATE_KEY, selectedDate);

//   setDemoEntries(entries);
//   console.log('✅ Generated and cached demo data for', entries.length, 'staff members');
//   };

//   const handleUpdateEntry = (staffId: string, field: keyof DemoEntry, value: number) => {
//   const updatedEntries = demoEntries.map(entry => {
//     if (entry.staffId !== staffId) return entry;
    
//     // Update the field
//     const updated = { ...entry, [field]: value };
    
//     // Recalculate derived values for distributors
//     if (updated.isDistributor) {
//       updated.totalTips = (updated.creditCardTips || 0) + (updated.cashTips || 0);
      
//       // Recalculate tip out
//       const group = staffGroups.find(g => g.id === updated.groupId);
//       if (group) {
//         updated.tipOutAmount = calculateTipOutForDistributor(updated, group);
//         updated.netTips = updated.totalTips - updated.tipOutAmount;
//       }
//     }
    
//     return updated;
//   });
  
//   setDemoEntries(updatedEntries);
  
//   // Update cache
//   sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(updatedEntries));
//   console.log('💾 Updated and recalculated entry for staff:', staffId);
//   };

//   const handleClearData = () => {
//     if (!confirm('Are you sure you want to clear all demo data? This cannot be undone.')) {
//       return;
//     }
    
//     sessionStorage.removeItem(DEMO_DATA_KEY);
//     sessionStorage.removeItem(DEMO_DATE_KEY);
//     setDemoEntries([]);
//     console.log('🗑️ Cleared demo data');
//   };
//   /**
//  * Calculate how much a distributor tips out based on their group's configuration
//  */
//   /**
//  * Calculate how much a distributor tips out based on their group's configuration
//  */
//   const calculateTipOutForDistributor = (
//     distributorEntry: DemoEntry,
//     distributorGroup: AnyStaffGroup
//   ): number => {
//     if (!distributorGroup.gratuityConfig.recipientGroupIds || 
//         distributorGroup.gratuityConfig.recipientGroupIds.length === 0) {
//       return 0; // No recipients, no tip out
//     }

//     const totalTips = (distributorEntry.creditCardTips || 0) + (distributorEntry.cashTips || 0);
//     const salesAmount = distributorEntry.salesAmount || 0;
    
//     // Get distribution basis from the distributor group
//     const distributionBasis = distributorGroup.gratuityConfig.distributionBasis || 'gratuities';
    
//     let totalTipOut = 0;
    
//     distributorGroup.gratuityConfig.recipientGroupIds.forEach(recipientId => {
//       const recipientGroup = staffGroups.find(g => g.id === recipientId);
//       if (!recipientGroup) return;
      
//       const distributionType = recipientGroup.gratuityConfig.distributionType || 'percentage';
//       const percentage = recipientGroup.gratuityConfig.percentage;
//       const fixedAmount = recipientGroup.gratuityConfig.fixedAmount;
      
//       if (distributionType === 'fixed') {
//         totalTipOut += fixedAmount || 0;
//       } else if (distributionType === 'percentage' && percentage) {
//         // Use distribution basis to determine what to calculate from
//         const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
//         totalTipOut += (baseAmount * percentage) / 100;
//       }
//     });
    
//     return parseFloat(totalTipOut.toFixed(2));
//   };
  
//     /**
//    * Calculate the total tip out amount a recipient group receives from all distributors
//    */

//     /**
//    * Calculate an individual recipient's share based on hours worked
//    */
//   const calculateRecipientShare = (
//     recipientStaffId: string,
//     recipientGroupId: string,
//     hoursWorked: number
//   ): { tipOutReceived: number; tipOutPercentage: number } => {
//     const groupTotalTipOut = calculateRecipientGroupTipOut(recipientGroupId);
    
//     // Get all recipients in this group with hours
//     const recipientEntries = demoEntries.filter(e => 
//       e.groupId === recipientGroupId && !e.isDistributor
//     );
    
//     const totalGroupHours = recipientEntries.reduce((sum, e) => sum + e.hoursWorked, 0);
    
//     if (totalGroupHours === 0) {
//       return { tipOutReceived: 0, tipOutPercentage: 0 };
//     }
    
//     // Calculate this person's share based on hours worked
//     const tipOutReceived = (hoursWorked / totalGroupHours) * groupTotalTipOut;
//     const tipOutPercentage = (hoursWorked / totalGroupHours) * 100;
    
//     return {
//       tipOutReceived: parseFloat(tipOutReceived.toFixed(2)),
//       tipOutPercentage: parseFloat(tipOutPercentage.toFixed(2))
//     };
//   };

  

//   const handleContinueToShiftEntry = async () => {
//     try {
//       console.log('📝 Creating shift for tip entry...');
      
//       // Step 1: Create a shift for the selected date
//       const shiftResponse = await fetch('/api/daily-shifts', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           date: selectedDate,
//           type: 'FULL_DAY'
//         })
//       });

//       const shiftResult = await shiftResponse.json();
      
//       if (!shiftResult.success) {
//         alert(`Failed to create shift: ${shiftResult.message}`);
//         return;
//       }

//       console.log('✅ Shift created:', shiftResult.shift.id);

//       // Step 2: Store demo data for shifts page to pick up
//       sessionStorage.setItem('demoShiftId', shiftResult.shift.id);
//       sessionStorage.setItem('demoEntries', JSON.stringify(demoEntries));

//       // Step 3: Navigate to shifts page
//       window.location.href = '/shifts';

//     } catch (error) {
//       console.error('❌ Failed to create shift:', error);
//       alert('Failed to create shift. Please try again.');
//     }
//   };

//   const getTotalTips = (entry: DemoEntry) => {
//     if (!entry.creditCardTips && !entry.cashTips) return 0;
//     return (entry.creditCardTips || 0) + (entry.cashTips || 0);
//   };

//   const getTipPercentage = (entry: DemoEntry) => {
//     if (!entry.salesAmount || !entry.creditCardTips) return null;
//     return ((entry.creditCardTips / entry.salesAmount) * 100).toFixed(1);
//   };

  
//   // Group entries by group
//   const entriesByGroup = demoEntries.reduce((acc, entry) => {
//     if (!acc[entry.groupId]) {
//       acc[entry.groupId] = [];
//     }
//     acc[entry.groupId].push(entry);
//     return acc;
//   }, {} as Record<string, DemoEntry[]>);

//   // Calculate totals
//   const grandTotals = {
//     totalSales: demoEntries.reduce((sum, e) => sum + (e.salesAmount || 0), 0),
//     totalCCTips: demoEntries.reduce((sum, e) => sum + (e.creditCardTips || 0), 0),
//     totalCashTips: demoEntries.reduce((sum, e) => sum + (e.cashTips || 0), 0),
//     totalHours: demoEntries.reduce((sum, e) => sum + e.hoursWorked, 0),
//     staffCount: demoEntries.length
//   };

//   if (isLoading) {
//     return (
//       <div className="container mx-auto px-4 py-8">
//         <div className="text-center">Loading...</div>
//       </div>
//     );
//   }

//   return (
//     <div className="container mx-auto px-4 py-8">
//       {/* Header */}
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold text-gray-900 mb-2">Demo Data Generator</h1>
//         <p className="text-gray-600">
//           Generate realistic sales and tip data for testing calculations
//         </p>
//         <div className="mt-2 text-sm text-gray-500">
//           💡 Data persists across page refreshes during your session
//         </div>
//       </div>
//     </div>

//       {/* Controls */}
//     <div className="bg-white rounded-lg shadow p-6 mb-6">
//       <div className="flex items-end space-x-4 mb-4">
//         <div className="flex-1">
//           <label className="block text-sm font-medium text-gray-700 mb-1">
//             Date
//           </label>
//           <input
//             type="date"
//             value={selectedDate}
//             onChange={(e) => {
//               setSelectedDate(e.target.value);
//               sessionStorage.setItem(DEMO_DATE_KEY, e.target.value);
//             }}
//             className="w-full border border-gray-300 rounded px-3 py-2"
//             />
//           </div>
          
//           <button
//             onClick={handleGenerateData}
//             disabled={staffMembers.length === 0 || staffGroups.length === 0}
//             className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             {demoEntries.length > 0 ? 'Regenerate Data' : 'Generate Data'}
//           </button>
          
//           {demoEntries.length > 0 && (
//             <>
//               <button
//                 onClick={handleClearData}
//                 className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
//               >
//                 Clear Data
//               </button>
              
//               <button
//                 onClick={handleContinueToShiftEntry}
//                 className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
//               >
//                 Continue to Shift Entry →
//               </button>
//             </>
//           )}
//         </div>

//         {/* Info Boxes */}
//         <div className="grid grid-cols-2 gap-4">
//           <div className="p-4 bg-blue-50 border border-blue-200 rounded">
//             <div className="text-sm font-medium text-blue-900 mb-2">Sales-Based Groups</div>
//             <div className="text-xs text-blue-700 space-y-1">
//               <div>• Sales: $949.99 - $2,499.99</div>
//               <div>• CC Tips: 17% - 23% of sales</div>
//               <div>• Cash Tips: $0</div>
//             </div>
//           </div>
          
//           <div className="p-4 bg-green-50 border border-green-200 rounded">
//             <div className="text-sm font-medium text-green-900 mb-2">Gratuity-Based Groups</div>
//             <div className="text-xs text-green-700 space-y-1">
//               <div>• CC Tips: $50 - $350</div>
//               <div>• Cash Tips: $10 - $100</div>
//             </div>
//           </div>
//         </div>

//         {(staffMembers.length === 0 || staffGroups.length === 0) && (
//           <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
//             ⚠️ Please create staff members and groups before generating demo data
//           </div>
//         )}
//       </div>

//       {/* Summary Stats */}
//       {demoEntries.length > 0 && (
//         <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
//           <div className="bg-white rounded-lg shadow p-4">
//             <div className="text-xs text-gray-500 mb-1">Total Sales</div>
//             <div className="text-xl font-bold text-gray-900">{formatCurrency(grandTotals.totalSales)}</div>
//           </div>
//           <div className="bg-white rounded-lg shadow p-4">
//             <div className="text-xs text-gray-500 mb-1">CC Tips</div>
//             <div className="text-xl font-bold text-green-600">{formatCurrency(grandTotals.totalCCTips)}</div>
//           </div>
//           <div className="bg-white rounded-lg shadow p-4">
//             <div className="text-xs text-gray-500 mb-1">Cash Tips</div>
//             <div className="text-xl font-bold text-blue-600">{formatCurrency(grandTotals.totalCashTips)}</div>
//           </div>
//           <div className="bg-white rounded-lg shadow p-4">
//             <div className="text-xs text-gray-500 mb-1">Total Hours</div>
//             <div className="text-xl font-bold text-gray-900">{grandTotals.totalHours.toFixed(1)}</div>
//           </div>
//           <div className="bg-white rounded-lg shadow p-4">
//             <div className="text-xs text-gray-500 mb-1">Staff Count</div>
//             <div className="text-xl font-bold text-gray-900">{grandTotals.staffCount}</div>
//           </div>
//         </div>
//       )}

//       {/* Data Tables by Group */}
//       {demoEntries.length > 0 && (
//         <div className="space-y-6">
//           {Object.entries(entriesByGroup).map(([groupId, entries]) => {
//             const group = staffGroups.find(g => g.id === groupId);
//             const isDistributor = group?.gratuityConfig.distributesGratuities;
//             const usesSales = group?.gratuityConfig.contributionSource === 'sales';

//             return (
//               <div key={groupId} className="bg-white rounded-lg shadow">
//                 {/* Group Header */}
//                 <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
//                   <div className="flex justify-between items-center">
//                     <div>
//                       <h2 className="text-lg font-semibold text-gray-900">
//                         {group?.name}
//                       </h2>
//                       <p className="text-sm text-gray-500">
//                         {isDistributor ? '📤 Distributor' : '📥 Recipient'} Group • {entries.length} staff
//                       </p>
//                     </div>
                    
                    
//                   </div>
//                 </div>

//                 {/* Data Table - Different columns for distributor vs recipient */}
//                 <div className="overflow-x-auto">
//                   <table className="min-w-full divide-y divide-gray-200">
//                     <thead className="bg-gray-50">
//                       <tr>
//                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                           Staff Member
//                         </th>
//                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                           Hours
//                         </th>
                        
//                         {/* DISTRIBUTOR COLUMNS */}
//                         {isDistributor && (
//                           <>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                               Sales Amount
//                             </th>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                               CC Tips
//                             </th>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                               Tip %
//                             </th>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                               Tip Out
//                             </th>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                               Net Tips
//                             </th>
//                           </>
//                         )}
                        
//                         {/* RECIPIENT COLUMNS */}
//                         {!isDistributor && (
//                           <>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                               Tip Out Received
//                             </th>
//                             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                               Tip Out %
//                             </th>
//                           </>
//                         )}
//                       </tr>
//                     </thead>
//                     <tbody className="bg-white divide-y divide-gray-200">
//                       {entries.map(entry => {
//                         // Calculate recipient data if applicable
//                         const recipientData = !isDistributor 
//                           ? calculateRecipientShare(entry.staffId, entry.groupId, entry.hoursWorked)
//                           : null;
                        
//                         return (
//                           <tr key={entry.staffId} className="hover:bg-gray-50">
//                             <td className="px-6 py-4 text-sm font-medium text-gray-900">
//                               {entry.staffName}
//                             </td>
//                             <td className="px-6 py-4">
//                               <input
//                                 type="number"
//                                 value={entry.hoursWorked}
//                                 onChange={(e) => handleUpdateEntry(entry.staffId, 'hoursWorked', parseFloat(e.target.value) || 0)}
//                                 className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
//                                 step="0.25"
//                                 min="0"
//                               />
//                             </td>
                            
//                             {/* DISTRIBUTOR CELLS */}
//                             {isDistributor && (
//                               <>
//                                 <td className="px-6 py-4">
//                                   <input
//                                     type="number"
//                                     value={entry.salesAmount || 0}
//                                     onChange={(e) => handleUpdateEntry(entry.staffId, 'salesAmount', parseFloat(e.target.value) || 0)}
//                                     className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
//                                     step="0.01"
//                                     min="0"
//                                   />
//                                 </td>
//                                 <td className="px-6 py-4">
//                                   <input
//                                     type="number"
//                                     value={entry.creditCardTips || 0}
//                                     onChange={(e) => handleUpdateEntry(entry.staffId, 'creditCardTips', parseFloat(e.target.value) || 0)}
//                                     className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
//                                     step="0.01"
//                                     min="0"
//                                   />
//                                 </td>
//                                 <td className="px-6 py-4 text-sm text-gray-600">
//                                   {getTipPercentage(entry) ? `${getTipPercentage(entry)}%` : '-'}
//                                 </td>
//                                 <td className="px-6 py-4 text-sm font-medium text-orange-600">
//                                   {entry.tipOutAmount ? `- ${formatCurrency(entry.tipOutAmount)}` : '-'}
//                                 </td>
//                                 <td className="px-6 py-4 text-sm font-bold text-green-600">
//                                   {entry.netTips !== undefined ? formatCurrency(entry.netTips) : '-'}
//                                 </td>
//                               </>
//                             )}
                            
//                             {/* RECIPIENT CELLS */}
//                             {!isDistributor && recipientData && (
//                               <>
//                                 <td className="px-6 py-4 text-sm font-bold text-green-600">
//                                   {formatCurrency(recipientData.tipOutReceived)}
//                                 </td>
//                                 <td className="px-6 py-4 text-sm text-gray-600">
//                                   {recipientData.tipOutPercentage.toFixed(1)}%
//                                 </td>
//                               </>
//                             )}
//                           </tr>
//                         );
//                       })}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
//             );
//           }
//           )
//         }
     

//       {demoEntries.length === 0 && (
//         <div className="bg-gray-50 rounded-lg p-12 text-center">
//           <p className="text-gray-500 mb-2">
//             Click "Generate Data" to create realistic sales and tip entries
//           </p>
//           <p className="text-sm text-gray-400">
//             Data will be saved to your session and persist across page refreshes
//           </p>
//         </div>
//       )}
//     </div>
//   );}
//       <div key={groupId} className="bg-white rounded-lg shadow">
//                 {/* Group Header */}
//                 <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
//                   <div className="flex justify-between items-center">
//                     <div>
//                       <h2 className="text-lg font-semibold text-gray-900">
//                         {group?.name}
//                       </h2>
//                       <p className="text-sm text-gray-500">
//                         {isDistributor ? '📤 Distributor' : '📥 Recipient'} Group • {entries.length} staff
//                       </p>
//                     </div>
                    
//                     {isDistributor && (
//                       <div className="text-right text-sm">
//                         <div className="text-gray-500">Group Total Tips</div>
//                         <div className="text-lg font-bold text-green-600">
//                           {formatCurrency(entries.reduce((sum, e) => sum + getTotalTips(e), 0))}
//                         </div>
//                       </div>
//                     )}
//                   </div>
//                 </div>

//                 {/* Data Table for distributor group */}
//                 <div className="overflow-x-auto">
//                   <table className="min-w-full divide-y divide-gray-200">
//                     <thead className="bg-gray-50">
//                       <tr>
//                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                           Staff Member
//                         </th>
//                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                           Hours
//                         </th>
//                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                           Tip Out Received
//                         </th>
//                         <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
//                           Tip Out % /** this should be the percentage of the total tip out amount for this group */
//                         </th>
//                       </tr>
//                     </thead>
//                     <tbody className="bg-white divide-y divide-gray-200">
//                       {entries.map(entry => (
//                         <tr key={entry.staffId} className="hover:bg-gray-50">
//                           <td className="px-6 py-4 text-sm font-medium text-gray-900">
//                             {entry.staffName}
//                           </td>
//                           <td className="px-6 py-4">
//                             <input
//                               type="number"
//                               value={entry.hoursWorked}
//                               onChange={(e) => handleUpdateEntry(entry.staffId, 'hoursWorked', parseFloat(e.target.value) || 0)}
//                               className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
//                               step="0.25"
//                               min="0"
//                             />
//                           </td>
//                           <td className="px-6 py-4">
//                             <input
//                               type="number"
//                               value={entry.salesAmount || 0}
//                               onChange={(e) => handleUpdateEntry(entry.staffId, 'salesAmount', parseFloat(e.target.value) || 0)}
//                               className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
//                               step="0.01"
//                               min="0"
//                             />
//                           </td>
//                           <td className="px-6 py-4">
//                             <input
//                               type="number"
//                               value={entry.creditCardTips || 0}
//                               onChange={(e) => handleUpdateEntry(entry.staffId, 'creditCardTips', parseFloat(e.target.value) || 0)}
//                               className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
//                               step="0.01"
//                               min="0"
//                             />
//                           </td>
//                           <td className="px-6 py-4 text-sm text-gray-600">
//                             {getTipPercentage(entry) ? `${getTipPercentage(entry)}%` : '-'}
//                           </td>
//                           {/* NEW: Tip Out Amount */}
//                           <td className="px-6 py-4 text-sm font-medium text-orange-600">
//                             {entry.tipOutAmount ? `- ${formatCurrency(entry.tipOutAmount)}` : '-'}
//                           </td>
//                           {/* NEW: Net Tips */}
//                           <td className="px-6 py-4 text-sm font-bold text-green-600">
//                             {entry.netTips !== undefined ? formatCurrency(entry.netTips) : '-'}
//                           </td>
//                         </tr>
//                       ))}
//                     </tbody>
//                   </table>
//                 </div>
//               </div>
//             );
//           })}
   
   

// // {isDistributor && (
// //                       <div className="text-right text-sm">
// //                         <div className="text-gray-500">Group Total Tips</div>
// //                         <div className="text-lg font-bold text-green-600">
// //                           {formatCurrency(entries.reduce((sum, e) => sum + getTotalTips(e), 0))}
// //                         </div>
// //                       </div>
// //                     )}