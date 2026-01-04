'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useAtom } from 'jotai';
import { staffMembersAtom, staffGroupsAtom } from '../atoms/staffAtoms';
import { AnyStaffGroup } from '../../types';
import { 
  generateRandomHours, 
  formatCurrency 
} from '../lib/utils/tipCalculations';
import { Calendar, TrendingUp, DollarSign, Users, AlertCircle } from 'lucide-react';

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
  totalTips?: number;
  tipOutAmount?: number;
  netTips?: number;
}

const DEMO_DATA_KEY = 'demo_shift_data';
const DEMO_DATE_KEY = 'demo_shift_date';

// Memoized Distributor Row Component
const DistributorRow = memo(({
  entry,
  onUpdate,
  getTipPercentage
}: {
  entry: DemoEntry;
  onUpdate: (staffId: string, field: keyof DemoEntry, value: number) => void;
  getTipPercentage: (entry: DemoEntry) => string | null;
}) => {
  return (
    <tr className="hover:bg-blue-50 transition-colors">
      <td className="px-6 py-4 text-sm font-medium text-gray-900">
        {entry.staffName}
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={entry.hoursWorked || ''}
          onChange={(e) => onUpdate(entry.staffId, 'hoursWorked', parseFloat(e.target.value) || 0)}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          step="0.25"
          min="0"
          placeholder="0"
        />
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={entry.salesAmount || ''}
          onChange={(e) => onUpdate(entry.staffId, 'salesAmount', parseFloat(e.target.value) || 0)}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          step="0.01"
          min="0"
          placeholder="0.00"
        />
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={entry.creditCardTips || ''}
          onChange={(e) => onUpdate(entry.staffId, 'creditCardTips', parseFloat(e.target.value) || 0)}
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          step="0.01"
          min="0"
          placeholder="0.00"
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
  );
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
  const recipientData = useMemo(() => {
    if (groupHours === 0 || !groupHours) {
      return { tipOutReceived: 0, tipOutPercentage: 0 };
    }

    const safeHoursWorked = entry.hoursWorked || 0;
    const safeTipOut = groupTipOut || 0;
    const safeGroupHours = groupHours || 1;

    const tipOutReceived = (safeHoursWorked / safeGroupHours) * safeTipOut;
    const tipOutPercentage = (safeHoursWorked / safeGroupHours) * 100;

    const finalTipOut = isNaN(tipOutReceived) ? 0 : tipOutReceived;
    const finalPercentage = isNaN(tipOutPercentage) ? 0 : tipOutPercentage;

    return {
      tipOutReceived: parseFloat(finalTipOut.toFixed(2)),
      tipOutPercentage: parseFloat(finalPercentage.toFixed(2))
    };
  }, [entry.hoursWorked, groupTipOut, groupHours]);

  return (
    <tr className="hover:bg-green-50 transition-colors">
      <td className="px-6 py-4 text-sm font-medium text-gray-900">
        {entry.staffName}
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          value={entry.hoursWorked || ''}
          onChange={(e) => onUpdate(entry.staffId, 'hoursWorked', parseFloat(e.target.value) || 0)}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          step="0.25"
          min="0"
          placeholder="0"
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

  const loadInitialData = async () => {
    try {
      const membersResponse = await fetch('/api/staff-members');
      const membersData = await membersResponse.json();
      
      if (membersData.success) {
        setStaffMembers(membersData.members);
      }

      const groupsResponse = await fetch('/api/staff/groups');
      const groupsData = await groupsResponse.json();
      
      if (groupsData.success) {
        setStaffGroups(groupsData.groups);
      }

      const cachedData = sessionStorage.getItem(DEMO_DATA_KEY);
      const cachedDate = sessionStorage.getItem(DEMO_DATE_KEY);

      if (cachedData && cachedDate) {
        setDemoEntries(JSON.parse(cachedData));
        setSelectedDate(cachedDate);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateRealisticDistributorData = () => {
    const minSales = 949.99;
    const maxSales = 2499.99;
    const minTipPercent = 0.17;
    const maxTipPercent = 0.23;

    const salesAmount = parseFloat(
      (Math.random() * (maxSales - minSales) + minSales).toFixed(2)
    );

    const tipPercent = Math.random() * (maxTipPercent - minTipPercent) + minTipPercent;
    const creditCardTips = parseFloat((salesAmount * tipPercent).toFixed(2));

    return { salesAmount, creditCardTips, cashTips: 0, tipPercent };
  };

  const calculateTipOutForDistributor = useCallback((
    distributorEntry: DemoEntry,
    distributorGroup: AnyStaffGroup
  ): number => {
    if (!distributorGroup.gratuityConfig.recipientGroupIds || 
        distributorGroup.gratuityConfig.recipientGroupIds.length === 0) {
      return 0;
    }

    const totalTips = (distributorEntry.creditCardTips || 0) + (distributorEntry.cashTips || 0);
    const salesAmount = distributorEntry.salesAmount || 0;
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
        const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
        totalTipOut += (baseAmount * percentage) / 100;
      }
    });
    
    return parseFloat(totalTipOut.toFixed(2));
  }, [staffGroups]);

  const recipientGroupTipOuts = useMemo(() => {
    const totals = new Map<string, number>();
    const recipientGroups = staffGroups.filter(g => !g.gratuityConfig.distributesGratuities);
    const poolGroups = new Map<string, typeof recipientGroups>();
    const standaloneGroups: typeof recipientGroups = [];
    
    recipientGroups.forEach(recipientGroup => {
      const tipPoolId = recipientGroup.gratuityConfig.tipPoolId;
      if (tipPoolId) {
        if (!poolGroups.has(tipPoolId)) {
          poolGroups.set(tipPoolId, []);
        }
        poolGroups.get(tipPoolId)!.push(recipientGroup);
      } else {
        standaloneGroups.push(recipientGroup);
      }
    });
    
    poolGroups.forEach((groupsInPool, poolId) => {
      const poolConfig = groupsInPool[0].gratuityConfig;
      let poolTotalTipOut = 0;
      
      const sourceDistributorGroups = staffGroups.filter(g => 
        g.gratuityConfig.distributesGratuities && 
        groupsInPool.some(poolGroup => 
          g.gratuityConfig.recipientGroupIds?.includes(poolGroup.id)
        )
      );
      
      sourceDistributorGroups.forEach(distributorGroup => {
        const distributionType = poolConfig.distributionType || 'percentage';
        const percentage = poolConfig.percentage;
        const fixedAmount = poolConfig.fixedAmount;
        const distributionBasis = distributorGroup.gratuityConfig.distributionBasis || 'gratuities';
        
        const distributorEntries = demoEntries.filter(e => 
          e.groupId === distributorGroup.id && e.isDistributor
        );
        
        distributorEntries.forEach(distributorEntry => {
          const totalTips = (distributorEntry.creditCardTips || 0) + (distributorEntry.cashTips || 0);
          const salesAmount = distributorEntry.salesAmount || 0;
          
          if (distributionType === 'fixed') {
            poolTotalTipOut += fixedAmount || 0;
          } else if (distributionType === 'percentage' && percentage) {
            const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
            poolTotalTipOut += (baseAmount * percentage) / 100;
          }
        });
      });
      
      const validPoolTotal = isNaN(poolTotalTipOut) ? 0 : parseFloat(poolTotalTipOut.toFixed(2));
      let totalPoolHours = 0;
      const groupHoursMap = new Map<string, number>();
      
      groupsInPool.forEach(poolGroup => {
        const groupEntries = demoEntries.filter(e => e.groupId === poolGroup.id);
        const groupHours = groupEntries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
        groupHoursMap.set(poolGroup.id, groupHours);
        totalPoolHours += groupHours;
      });
      
      if (totalPoolHours > 0) {
        groupsInPool.forEach(poolGroup => {
          const groupHours = groupHoursMap.get(poolGroup.id) || 0;
          const groupShare = (groupHours / totalPoolHours) * validPoolTotal;
          const validGroupShare = isNaN(groupShare) ? 0 : parseFloat(groupShare.toFixed(2));
          totals.set(poolGroup.id, validGroupShare);
        });
      } else {
        const equalShare = validPoolTotal / groupsInPool.length;
        groupsInPool.forEach(poolGroup => {
          totals.set(poolGroup.id, parseFloat(equalShare.toFixed(2)));
        });
      }
    });
    
    standaloneGroups.forEach(recipientGroup => {
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
      
      const validTipOut = isNaN(totalTipOut) ? 0 : parseFloat(totalTipOut.toFixed(2));
      totals.set(recipientGroup.id, validTipOut);
    });
    
    return totals;
  }, [demoEntries, staffGroups]);

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
            updated.tipOutAmount = 0;
            updated.netTips = updated.totalTips || 0;
          }
        }
        
        return updated;
      });
      
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
  };

  const handleSaveShift = async () => {
  if (demoEntries.length === 0) {
    alert('Please generate data first');
    return;
  }

  try {
    setIsLoading(true);
    
    // Save shift with demo entries
    const shiftResponse = await fetch('/api/daily-shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: selectedDate,
        type: 'FULL_DAY',
        entries: demoEntries
      })
    });

    const shiftResult = await shiftResponse.json();
    
    if (!shiftResult.success) {
      alert(`Failed to save shift: ${shiftResult.message}`);
      setIsLoading(false);
      return;
    }

    alert('✅ Shift saved successfully! You can now view it in Shift Reports.');
    
    // Optionally clear demo data after successful save
    // sessionStorage.removeItem(DEMO_DATA_KEY);
    // sessionStorage.removeItem(DEMO_DATE_KEY);
    // setDemoEntries([]);
    
  } catch (error) {
    console.error('Failed to save shift:', error);
    alert('Failed to save shift. Please try again.');
  } finally {
    setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading demo data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Daily Shift Generator</h1>
        </div>
        <p className="text-gray-600">
          Click "Generate Data" to create realistic sales and tip data from a restaurant point of sale system
        </p>
      </div>

      {/* Controls Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-end gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Shift Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                sessionStorage.setItem(DEMO_DATE_KEY, e.target.value);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <button
            onClick={handleGenerateData}
            disabled={staffMembers.length === 0 || staffGroups.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {demoEntries.length > 0 ? 'Regenerate Data' : 'Generate Data'}
          </button>
          
          {demoEntries.length > 0 && (
            <>
              <button
                onClick={handleClearData}
                className="px-6 py-2 border-2 border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium"
              >
                Clear Data
              </button>
              
              <button
                onClick={handleSaveShift}
                disabled={isLoading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : '💾 Save Shift'}
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
            <div className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Distributor Groups
            </div>
            <div className="text-xs text-blue-700 space-y-1">
              <div>• Assign a tip out source from sales or tips received</div>
              <div>• Choose a percentage or fixed amount from the source</div>
              <div>• Tip out is calculated and deducted from tips earned by distributor</div>
            </div>
          </div>
          
          <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="text-sm font-semibold text-green-900 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Recipient Groups
            </div>
            <div className="text-xs text-green-700 space-y-1">
              <div>• Receive tip outs from distributors</div>
              <div>• Tips are shared based on hours worked among all recipient staff</div>
              <div>• Groups can be pooled together or receive their own distributions</div>
              {/* <div>• Optimized calculations (O(1) per row)</div> */}
            </div>
          </div>
        </div>

        {(staffMembers.length === 0 || staffGroups.length === 0) && (
          <div className="mt-4 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Note:</strong> Please create staff members and groups before generating demo data
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {demoEntries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-gray-400">
            <div className="text-xs font-medium text-gray-500 mb-1">Total Sales</div>
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(demoEntries
                .filter(e => e.isDistributor)
                .reduce((sum, e) => sum + (e.salesAmount || 0), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <div className="text-xs font-medium text-gray-500 mb-1">Tips Collected</div>
            <div className="text-xl font-bold text-blue-600">
              {formatCurrency(demoEntries
                .filter(e => e.isDistributor)
                .reduce((sum, e) => sum + getTotalTips(e), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-500">
            <div className="text-xs font-medium text-gray-500 mb-1">Total Tipped Out</div>
            <div className="text-xl font-bold text-orange-600">
              {formatCurrency(demoEntries
                .filter(e => e.isDistributor)
                .reduce((sum, e) => sum + (e.tipOutAmount || 0), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <div className="text-xs font-medium text-gray-500 mb-1">Net Kept</div>
            <div className="text-xl font-bold text-green-600">
              {formatCurrency(demoEntries
                .filter(e => e.isDistributor)
                .reduce((sum, e) => sum + (e.netTips || 0), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
            <div className="text-xs font-medium text-gray-500 mb-1">Recipients Received</div>
            <div className="text-xl font-bold text-purple-600">
              {formatCurrency(
                Array.from(recipientGroupTipOuts.values()).reduce((sum, val) => sum + (val || 0), 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-gray-400">
            <div className="text-xs font-medium text-gray-500 mb-1">Staff Count</div>
            <div className="text-xl font-bold text-gray-900">{demoEntries.length}</div>
          </div>
        </div>
      )}

      {/* Group Tables */}
      {demoEntries.length > 0 && (
        <div className="space-y-6">
          {Object.entries(entriesByGroup).map(([groupId, entries]) => {
            const group = staffGroups.find(g => g.id === groupId);
            const isDistributor = group?.gratuityConfig.distributesGratuities;
            const groupTipOut = recipientGroupTipOuts.get(groupId) || 0;
            const groupHours = groupHourTotals.get(groupId) || 0;

            return (
              <div key={groupId} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b-2 border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">
                        {group?.name}
                      </h2>
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          isDistributor 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {isDistributor ? '📤 Distributor' : '📥 Recipient'}
                        </span>
                        <span>{entries.length} staff members</span>
                      </p>
                    </div>
                    
                    {isDistributor && (
                      <div className="text-right space-y-2">
                        <div>
                          <div className="text-xs text-gray-500">Total Tips Collected</div>
                          <div className="text-lg font-bold text-blue-600">
                            {formatCurrency(entries.reduce((sum, e) => sum + getTotalTips(e), 0))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Total Tipped Out</div>
                          <div className="text-lg font-bold text-orange-600">
                            {formatCurrency(entries.reduce((sum, e) => sum + (e.tipOutAmount || 0), 0))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Net Kept by Group</div>
                          <div className="text-lg font-bold text-green-600">
                            {formatCurrency(entries.reduce((sum, e) => sum + (e.netTips || 0), 0))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!isDistributor && (
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Total Tip Out Received</div>
                        <div className="text-2xl font-bold text-green-600 mb-2">
                          {formatCurrency(groupTipOut || 0)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {groupHours.toFixed(1)} total hours worked
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Staff Member
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Hours
                        </th>
                        
                        {isDistributor && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Sales Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              CC Tips
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Tip %
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Tip Out
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Net Tips
                            </th>
                          </>
                        )}
                        
                        {!isDistributor && (
                          <>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Tip Out Received
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Share %
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {entries.map(entry => {
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

      {/* Empty State */}
      {demoEntries.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12">
          <div className="text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Data Generated Yet
            </h3>
            <p className="text-gray-600 mb-4">
              Click "Generate Data" to create realistic sales and tip data
            </p>
            <p className="text-sm text-gray-500">
              Data will be saved to your session and persist across page refreshes
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
