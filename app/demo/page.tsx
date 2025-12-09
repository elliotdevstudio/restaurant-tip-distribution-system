'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
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

//Memoized Dist. Row Component

const DistributorRow = memo(({
  entry,
  onUpdate,
  getTipPercentage
}: {
  entry: DemoEntry;
  onUpdate: (StaffId: string, field: keyof DemoEntry, value: number) => void;
  getTipPercentage: (entry: DemoEntry) => string | null;
}) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 text-sm font-medium text-gray-900">
        {entry.staffName}
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={entry.hoursWorked}
          onChange={(e) => onUpdate(entry.staffId, 'hoursWorked', parseFloat(e.target.value) || 0)}
          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
          step="0.25"
          min="0"
        />
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={entry.salesAmount || 0}
          onChange={(e) => onUpdate(entry.staffId, 'salesAmount', parseFloat(e.target.value) || 0)}
          className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
          step="0.01"
          min="0"
        />
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={entry.creditCardTips || 0}
          onChange={(e) => onUpdate(entry.staffId, 'creditCardTips', parseFloat(e.target.value) || 0)}
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
    </tr>
  )
});

DistributorRow.displayName = 'DistributorRow';

// Memoized Recipient Row Component 

const RecipientRow = memo(({
  entry,
  groupTipOut,
  groupHours,
  onUpdate
}: {
  entry: DemoEntry;
  groupTipOut: number;
  groupHours: number;
  onUpdate: (staffId: string, field: keyof DemoEntry, value: number) => void;
}) => {
  // Calculate share O(1)
  const recipientData = useMemo(() => {
  // Add logging to debug
  console.log('🧮 RecipientRow calculation:', {
    staffName: entry.staffName,
    hoursWorked: entry.hoursWorked,
    groupHours,
    groupTipOut,
    isValidHours: typeof entry.hoursWorked === 'number' && !isNaN(entry.hoursWorked)
  });

  if (groupHours === 0 || !groupHours) {
    return { tipOutReceived: 0, tipOutPercentage: 0 };
  }

  // Add safety checks
  const safeHoursWorked = entry.hoursWorked || 0;
  const safeTipOut = groupTipOut || 0;
  const safeGroupHours = groupHours || 1; // Prevent division by zero

  const tipOutReceived = (safeHoursWorked / safeGroupHours) * safeTipOut;
  const tipOutPercentage = (safeHoursWorked / safeGroupHours) * 100;

  // Check for NaN
  const finalTipOut = isNaN(tipOutReceived) ? 0 : tipOutReceived;
  const finalPercentage = isNaN(tipOutPercentage) ? 0 : tipOutPercentage;

  console.log('✅ Calculation result:', {
    tipOutReceived: finalTipOut,
    tipOutPercentage: finalPercentage
  });

  return {
    tipOutReceived: parseFloat(finalTipOut.toFixed(2)),
    tipOutPercentage: parseFloat(finalPercentage.toFixed(2))
  };

  }, [entry.hoursWorked, groupTipOut, groupHours, entry.staffName]);

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 text-sm font-medium text-gray-900">
        {entry.staffName}
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={entry.hoursWorked}
          onChange={(e) => onUpdate(entry.staffId, 'hoursWorked', parseFloat(e.target.value) || 0)}
          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
          step="0.25"
          min="0"
        />
      </td>
      <td className="px-6 py-4 text-sm font-bold text-green-600">
        {formatCurrency(recipientData.tipOutReceived)}
      </td>
      <td className="px-6 py-4 text-sm text-gray-600">
        {recipientData.tipOutPercentage.toFixed(1)}%
      </td>
    </tr>
  );
});

RecipientRow.displayName = 'RecipientRow';

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
  // useEffect(() => {
  //   console.log('📊 Current state:', {
  //     staffMembersCount: staffMembers.length,
  //     staffGroupsCount: staffGroups.length,
  //     demoEntriesCount: demoEntries.length
  //   });
  // }, [staffMembers, staffGroups, demoEntries]);

  const loadInitialData = async () => {
    try {
      console.log('📋 Loading staff members and groups...');
      
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
        console.log('📦 API returned groups:', groupsData.groups);
        console.log(`✅ Loaded ${groupsData.groups.length} staff groups`);
        const distributorGroups = groupsData.groups.filter(g => g.gratuityConfig.distributesGratuities);
        console.log('🔍 Distributor groups from API:', distributorGroups.map(g => ({
          name: g.name,
          distributionBasis: g.gratuityConfig.distributionBasis
        })));
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
  const calculateTipOutForDistributor = useCallback((
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
    console.log('🔍 Distribution basis check:', {
      groupName: distributorGroup.name,
      distributionBasis,
      fullConfig: distributorGroup.gratuityConfig
    });
    console.log('🔍 calculateTipOutForDistributor:', {
    staffName: distributorEntry.staffName,
    salesAmount,
    totalTips,
    distributionBasis,
    recipientCount: distributorGroup.gratuityConfig.recipientGroupIds.length
    });

    let totalTipOut = 0;
    
    distributorGroup.gratuityConfig.recipientGroupIds.forEach(recipientId => {
      const recipientGroup = staffGroups.find(g => g.id === recipientId);
      if (!recipientGroup) return;
      
      const distributionType = recipientGroup.gratuityConfig.distributionType || 'percentage';
      const percentage = recipientGroup.gratuityConfig.percentage;
      const fixedAmount = recipientGroup.gratuityConfig.fixedAmount;

      console.log('💡 Recipient config:', {
      recipientGroupName: recipientGroup.name,
      distributionType,
      percentage,  // ← KEY: What is this value?
      fixedAmount,
      distributionBasis
    });
      
      if (distributionType === 'fixed') {
        totalTipOut += fixedAmount || 0;
      } else if (distributionType === 'percentage' && percentage) {
        // Use distribution basis to determine what to calculate from
        const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
        totalTipOut += (baseAmount * percentage) / 100;
      }
    });
    
    return parseFloat(totalTipOut.toFixed(2));
  }, [staffGroups]);

  // PRE-CALCULATE group totals (runs once per demoEntries change)

  const recipientGroupTipOuts = useMemo(() => {
    console.log('🔄 Recalculating recipient group tip outs...');
    const totals = new Map<string, number>();
    
    const recipientGroups = staffGroups.filter(g => !g.gratuityConfig.distributesGratuities);
    
    recipientGroups.forEach(recipientGroup => {
      let totalTipOut = 0;
      
      const sourceDistributorGroups = staffGroups.filter(g => 
        g.gratuityConfig.distributesGratuities && 
        g.gratuityConfig.recipientGroupIds?.includes(recipientGroup.id)
      );
      
      sourceDistributorGroups.forEach(distributorGroup => {
        const distributionType = recipientGroup.gratuityConfig.distributionType || 'percentage';
        const percentage = recipientGroup.gratuityConfig.percentage;
        const fixedAmount = recipientGroup.gratuityConfig.fixedAmount;
        const distributionBasis = distributorGroup.gratuityConfig.distributionBasis || 'gratuities';
        
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
      const validTipOut = isNaN(totalTipOut) ? 0 : totalTipOut;
      totals.set(recipientGroup.id, parseFloat(validTipOut.toFixed(2)));  
      // totals.set(recipientGroup.id, parseFloat(totalTipOut.toFixed(2)));
    });
    
    return totals;
  }, [demoEntries, staffGroups]);

    // PRE-CALCULATE group hour totals
  const groupHourTotals = useMemo(() => {
    const totals = new Map<string, number>();
    
    staffGroups
      .filter(g => !g.gratuityConfig.distributesGratuities)
      .forEach(group => {
        const groupEntries = demoEntries.filter(e => e.groupId === group.id);
        const totalHours = groupEntries.reduce((sum, e) => sum + e.hoursWorked, 0);
        totals.set(group.id, totalHours);
      });
    
    return totals;
  }, [demoEntries, staffGroups]);

  const handleGenerateData = () => {
    console.log('🎲 Generating demo data...');
    const entries: DemoEntry[] = [];

    staffMembers.forEach(member => {
      const memberGroups = staffGroups.filter(g => g.staffMemberIds.includes(member.id));
      
      if (memberGroups.length > 0) {
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

        if (isDistributor) {
          const { salesAmount, creditCardTips, cashTips } = generateRealisticDistributorData();
          
          entry.salesAmount = salesAmount;
          entry.creditCardTips = creditCardTips;
          entry.cashTips = cashTips;
          entry.totalTips = creditCardTips + cashTips;
          entry.tipOutAmount = calculateTipOutForDistributor(entry, group);
          entry.netTips = entry.totalTips - entry.tipOutAmount;
        }

        entries.push(entry);
      }
    });

    sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(entries));
    sessionStorage.setItem(DEMO_DATE_KEY, selectedDate);

    setDemoEntries(entries);
    console.log('✅ Generated and cached demo data for', entries.length, 'staff members');
  };
  const handleUpdateEntry = useCallback((staffId: string, field: keyof DemoEntry, value: number) => {
    setDemoEntries(prev => {
      const updatedEntries = prev.map(entry => {
        if (entry.staffId !== staffId) return entry;
        
        const updated = { ...entry, [field]: value };
        
        if (updated.isDistributor) {
          updated.totalTips = (updated.creditCardTips || 0) + (updated.cashTips || 0);
          
          const group = staffGroups.find(g => g.id === updated.groupId);
          if (group) {
            updated.tipOutAmount = calculateTipOutForDistributor(updated, group);
            updated.netTips = (updated.totalTips || 0) - (updated.tipOutAmount || 0);
          } else {
          // If group not found, set defaults
            updated.tipOutAmount = 0;
            updated.netTips = updated.totalTips || 0;
          }
        }
        
        return updated;
      });
      
      // Save to sessionStorage
      sessionStorage.setItem(DEMO_DATA_KEY, JSON.stringify(updatedEntries));
      
      return updatedEntries;
    });
  }, [staffGroups, calculateTipOutForDistributor]);

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

      sessionStorage.setItem('demoShiftId', shiftResult.shift.id);
      sessionStorage.setItem('demoEntries', JSON.stringify(demoEntries));

      window.location.href = '/shifts';

    } catch (error) {
      console.error('❌ Failed to create shift:', error);
      alert('Failed to create shift. Please try again.');
    }
  };

  const getTotalTips = (entry: DemoEntry) => {
    return (entry.creditCardTips || 0) + (entry.cashTips || 0);
  };

  const getTipPercentage = (entry: DemoEntry) => {
    if (!entry.salesAmount || !entry.creditCardTips) return null;
    return ((entry.creditCardTips / entry.salesAmount) * 100).toFixed(1);
  };

  const entriesByGroup = useMemo(() => {
    return demoEntries.reduce((acc, entry) => {
      if (!acc[entry.groupId]) {
        acc[entry.groupId] = [];
      }
      acc[entry.groupId].push(entry);
      return acc;
    }, {} as Record<string, DemoEntry[]>);
  }, [demoEntries]);

  useEffect(() => {
  if (demoEntries.length === 0) return;
  
  const distributors = demoEntries.filter(e => e.isDistributor);
  if (distributors.length === 0) return;
  
  const totalSales = distributors.reduce((sum, e) => sum + (e.salesAmount || 0), 0);
  const totalTipOut = distributors.reduce((sum, e) => sum + (e.tipOutAmount || 0), 0);
  const expectedTipOut = totalSales * 0.035;
  
  console.log('📊 VERIFICATION RESULTS:');
  console.log('========================');
  console.log('Total Sales:', formatCurrency(totalSales));
  console.log('Total Tip Out:', formatCurrency(totalTipOut));
  console.log('Expected (3.5%):', formatCurrency(expectedTipOut));
  console.log('Actual %:', ((totalTipOut / totalSales) * 100).toFixed(4) + '%');
  console.log('Match?', Math.abs(totalTipOut - expectedTipOut) < 1 ? '✅ YES' : '❌ NO');
  console.log('========================');
  
  // Individual breakdown
  console.log('Per-person breakdown:');
  distributors.forEach(d => {
    const expected = (d.salesAmount || 0) * 0.035;
    console.log(`  ${d.staffName}: $${d.salesAmount?.toFixed(2)} sales → $${d.tipOutAmount?.toFixed(2)} tip out (expected: $${expected.toFixed(2)}) ${Math.abs((d.tipOutAmount || 0) - expected) < 0.5 ? '✅' : '❌'}`);
  });
}, [demoEntries]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Demo Data Generator</h1>
        <p className="text-gray-600">
          Generate realistic sales and tip data for testing calculations
        </p>
        <div className="mt-2 text-sm text-gray-500">
          💡 Data persists across page refreshes during your session
        </div>
      </div>

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
              <div>• Optimized calculations (O(1) per row)</div>
            </div>
          </div>
        </div>

        {(staffMembers.length === 0 || staffGroups.length === 0) && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ Please create staff members and groups before generating demo data
          </div>
        )}
      </div>

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
                Array.from(recipientGroupTipOuts.values()).reduce((sum, val) => sum + (val || 0))
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-xs text-gray-500 mb-1">Staff Count</div>
            <div className="text-xl font-bold text-gray-900">{demoEntries.length}</div>
          </div>
        </div>
      )}

      {demoEntries.length > 0 && (
        <div className="space-y-6">
          {Object.entries(entriesByGroup).map(([groupId, entries]) => {
            const group = staffGroups.find(g => g.id === groupId);
            const isDistributor = group?.gratuityConfig.distributesGratuities;
            const groupTipOut = recipientGroupTipOuts.get(groupId) || 0;
            const groupHours = groupHourTotals.get(groupId) || 0;

            return (
              <div key={groupId} className="bg-white rounded-lg shadow">
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
                          {formatCurrency(groupTipOut || 0)}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {groupHours.toFixed(1)} total hours
                        </div>
                      </div>
                    )}
                  </div>
                </div>

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
                        // ADD DEBUG LOGGING FOR RECIPIENT ROWS
                        if (!isDistributor) {
                          console.log('🔍 RecipientRow props for', entry.staffName, {
                            groupTipOut,
                            groupHours,
                            groupId,
                            isValidTipOut: typeof groupTipOut === 'number' && !isNaN(groupTipOut),
                            isValidHours: typeof groupHours === 'number' && !isNaN(groupHours)
                          });
                        }
                        
                        return isDistributor ? (
                          <DistributorRow
                            key={entry.staffId}
                            entry={entry}
                            onUpdate={handleUpdateEntry}
                            getTipPercentage={getTipPercentage}
                          />
                        ) : (
                          <RecipientRow
                            key={entry.staffId}
                            entry={entry}
                            groupTipOut={groupTipOut}
                            groupHours={groupHours}
                            onUpdate={handleUpdateEntry}
                          />
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