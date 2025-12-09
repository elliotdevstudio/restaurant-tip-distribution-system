import { 
  StaffMember, 
  AnyStaffGroup, 
  ShiftType,
  IndividualContribution,
  MemberPayout,
  RecipientPool
} from '../../../types';

// RANDOM DATA GENERATION (For Demo/Testing)
// ============================================

/**
 * Generate random hours worked between min and max
 * @param min Minimum hours (default: 4)
 * @param max Maximum hours (default: 8.5)
 * @returns Random hours to 2 decimal places
 */
export function generateRandomHours(min: number = 4, max: number = 8.5): number {
  const hours = Math.random() * (max - min) + min;
  return parseFloat(hours.toFixed(2));
}

/**
 * Generate random tip amount between min and max
 * @param min Minimum amount (default: 20)
 * @param max Maximum amount (default: 300)
 * @returns Random amount to 2 decimal places
 */
export function generateRandomTipAmount(min: number = 20, max: number = 300): number {
  const amount = Math.random() * (max - min) + min;
  return parseFloat(amount.toFixed(2));
}

/**
 * Generate random sales amount
 * @param min Minimum sales (default: 200)
 * @param max Maximum sales (default: 1500)
 * @returns Random sales amount to 2 decimal places
 */
export function generateRandomSalesAmount(min: number = 200, max: number = 1500): number {
  const sales = Math.random() * (max - min) + min;
  return parseFloat(sales.toFixed(2));
}

/**
 * Generate demo tip data for all assigned staff
 */
export function generateDemoTipData(
  assignments: Array<{ staffId: string; groupId: string }>,
  groups: AnyStaffGroup[]
): Array<{
  staffId: string;
  groupId: string;
  hoursWorked: number;
  salesAmount?: number;
  creditCardTips?: number;
  cashTips?: number;
}> {
  return assignments.map(assignment => {
    const group = groups.find(g => g.id === assignment.groupId);
    const isDistributor = group?.gratuityConfig.distributesGratuities;
    const useSales = group?.gratuityConfig.contributionSource === 'sales';
    
    const entry: any = {
      staffId: assignment.staffId,
      groupId: assignment.groupId,
      hoursWorked: generateRandomHours()
    };
    
    if (isDistributor) {
      if (useSales) {
        entry.salesAmount = generateRandomSalesAmount();
      } else {
        entry.creditCardTips = generateRandomTipAmount(50, 250);
        entry.cashTips = generateRandomTipAmount(10, 100);
      }
    }
    
    return entry;
  });
}
/**
 * Calculate tip out for distributor, accounting for shared tip pools
 */
export function calculateTipOutForDistributor(
  distributorSales: number,
  distributorTips: number,
  distributorGroup: AnyStaffGroup,
  allGroups: AnyStaffGroup[]
): number {
  if (!distributorGroup.gratuityConfig.recipientGroupIds || 
      distributorGroup.gratuityConfig.recipientGroupIds.length === 0) {
    return 0;
  }

  const distributionBasis = distributorGroup.gratuityConfig.distributionBasis || 'gratuities';
  const baseAmount = distributionBasis === 'sales' ? distributorSales : distributorTips;
  
  // Track which pools we've already calculated
  const processedPools = new Set<string>();
  let totalTipOut = 0;
  
  distributorGroup.gratuityConfig.recipientGroupIds.forEach(recipientId => {
    const recipientGroup = allGroups.find(g => g.id === recipientId);
    if (!recipientGroup) return;
    
    const tipPoolId = recipientGroup.gratuityConfig.tipPoolId;
    const distributionType = recipientGroup.gratuityConfig.distributionType || 'percentage';
    const percentage = recipientGroup.gratuityConfig.percentage;
    const fixedAmount = recipientGroup.gratuityConfig.fixedAmount;
    
    if (tipPoolId) {
      // POOLED: Only calculate once per pool
      if (processedPools.has(tipPoolId)) {
        return; // Already calculated this pool
      }
      processedPools.add(tipPoolId);
      
      // Calculate ONCE for the entire pool
      const poolAmount = calculateDistributionAmount(
        distributorSales,
        distributorTips,
        distributionBasis,
        distributionType,
        percentage,
        fixedAmount
      );
      
      totalTipOut += poolAmount;
      
    } else {
      // STANDALONE: Calculate for this recipient alone
      const amount = calculateDistributionAmount(
        distributorSales,
        distributorTips,
        distributionBasis,
        distributionType,
        percentage,
        fixedAmount
      );
      
      totalTipOut += amount;
    }
  });
  
  return parseFloat(totalTipOut.toFixed(2));
}

/**
 * Calculate total distribution for a recipient group from all source groups
 * 
 * @param recipientGroup - The recipient group receiving tips
 * @param allGroups - All staff groups for lookup
 * @param staffTipData - Map of staffId to their tip/sales data
 * @returns Total amount this recipient group should receive
 */
export function calculateRecipientGroupTotal(
  recipientGroup: AnyStaffGroup,
  allGroups: AnyStaffGroup[],
  staffTipData: Map<string, { 
    salesAmount: number; 
    totalTips: number;
    hoursWorked: number;
  }>
): {
  totalReceived: number;
  sourceBreakdown: Array<{
    sourceGroupId: string;
    sourceGroupName: string;
    amountFromSource: number;
    contributorCount: number;
  }>;
  isPooled: boolean;
  poolInfo?: {
    poolId: string;
    poolTotal: number;
    poolGroups: string[];
    thisGroupShare: number;
  };
} {
  const sourceBreakdown: Array<{
    sourceGroupId: string;
    sourceGroupName: string;
    amountFromSource: number;
    contributorCount: number;
  }> = [];
  
  let totalReceived = 0;
  const tipPoolId = recipientGroup.gratuityConfig.tipPoolId;
  const isPooled = !!tipPoolId;
  
  // Get all source groups that distribute to this recipient
  const sourceGroupIds = recipientGroup.gratuityConfig.sourceGroupIds || [];
  
  sourceGroupIds.forEach(sourceGroupId => {
    const sourceGroup = allGroups.find(g => g.id === sourceGroupId);
    if (!sourceGroup) return;
    
    let amountFromSource = 0;
    let contributorCount = 0;
    
    const distributionType = recipientGroup.gratuityConfig.distributionType;
    const percentage = recipientGroup.gratuityConfig.percentage;
    const fixedAmount = recipientGroup.gratuityConfig.fixedAmount;
    const distributionBasis = sourceGroup.gratuityConfig.distributionBasis || 'gratuities';
    
    if (isPooled) {
      // POOLED: Share percentage with other groups in the same pool
      
      // Find all groups in the same pool that receive from this source
      const poolGroups = allGroups.filter(g => 
        g.gratuityConfig.tipPoolId === tipPoolId &&
        g.gratuityConfig.sourceGroupIds?.includes(sourceGroupId)
      );
      
      // Calculate total pool amount ONCE for this source
      let poolTotalFromSource = 0;
      let poolTotalHours = 0;
      
      // Get hours for all pool groups from this source
      poolGroups.forEach(poolGroup => {
        sourceGroup.staffMemberIds.forEach(staffId => {
          const staffData = staffTipData.get(staffId);
          if (!staffData) return;
          poolTotalHours += staffData.hoursWorked;
        });
      });
      
      // Calculate pool amount from each contributor
      sourceGroup.staffMemberIds.forEach(staffId => {
        const staffData = staffTipData.get(staffId);
        if (!staffData) return;
        
        contributorCount++;
        
        const distributionAmount = calculateDistributionAmount(
          staffData.salesAmount,
          staffData.totalTips,
          distributionBasis,
          distributionType || 'percentage',
          percentage,
          fixedAmount
        );
        
        poolTotalFromSource += distributionAmount;
      });
      
      // This group's share is proportional to its hours in the pool
      const thisGroupHours = sourceGroup.staffMemberIds.reduce((sum, staffId) => {
        const staffData = staffTipData.get(staffId);
        return sum + (staffData?.hoursWorked || 0);
      }, 0);
      
      const thisGroupShare = poolTotalHours > 0 
        ? (thisGroupHours / poolTotalHours) * poolTotalFromSource
        : poolTotalFromSource / poolGroups.length; // Equal split if no hours
      
      amountFromSource = thisGroupShare;
      
    } else {
      // STANDALONE: Gets full percentage (current behavior)
      
      sourceGroup.staffMemberIds.forEach(staffId => {
        const staffData = staffTipData.get(staffId);
        if (!staffData) return;
        
        contributorCount++;
        
        const distributionAmount = calculateDistributionAmount(
          staffData.salesAmount,
          staffData.totalTips,
          distributionBasis,
          distributionType || 'percentage',
          percentage,
          fixedAmount
        );
        
        amountFromSource += distributionAmount;
      });
    }
    
    sourceBreakdown.push({
      sourceGroupId,
      sourceGroupName: sourceGroup.name,
      amountFromSource: parseFloat(amountFromSource.toFixed(2)),
      contributorCount
    });
    
    totalReceived += amountFromSource;
  });
  
  // Build pool info if this is a pooled recipient
  let poolInfo;
  if (isPooled && tipPoolId) {
    const poolGroups = allGroups.filter(g => g.gratuityConfig.tipPoolId === tipPoolId);
    const poolTotal = poolGroups.reduce((sum, group) => {
      // Would need to recursively calculate, simplified here
      return sum + totalReceived; // Approximation
    }, 0);
    
    poolInfo = {
      poolId: tipPoolId,
      poolTotal,
      poolGroups: poolGroups.map(g => g.name),
      thisGroupShare: totalReceived
    };
  }
  
  return {
    totalReceived: parseFloat(totalReceived.toFixed(2)),
    sourceBreakdown,
    isPooled,
    poolInfo
  };
}

// CALCULATION VALIDATION
// ============================================

/**
 * Validate that distributed amounts equal received amounts
 */
export function validateShiftBalance(
  totalDistributed: number,
  totalReceived: number,
  tolerance: number = 0.01
): {
  balanced: boolean;
  discrepancy: number;
  message: string;
} {
  const discrepancy = Math.abs(totalDistributed - totalReceived);
  const balanced = discrepancy <= tolerance;
  
  let message = '';
  if (balanced) {
    message = 'All calculations are balanced.';
  } else {
    message = `Warning: Discrepancy of $${discrepancy.toFixed(2)} between distributed and received amounts.`;
  }
  
  return { balanced, discrepancy, message };
}

/**
 * Validate percentage distribution for a group
 */
export function validatePercentageDistribution(
  recipientGroups: AnyStaffGroup[],
  warningThreshold: number = 30,
  maxThreshold: number = 100
): {
  totalPercentage: number;
  valid: boolean;
  hasWarning: boolean;
  message: string;
} {
  const totalPercentage = recipientGroups.reduce((sum, group) => {
    if (group.gratuityConfig.distributionType === 'percentage') {
      return sum + (group.gratuityConfig.percentage || 0);
    }
    return sum;
  }, 0);
  
  const valid = totalPercentage <= maxThreshold;
  const hasWarning = totalPercentage > warningThreshold;
  
  let message = '';
  if (!valid) {
    message = `Error: Total percentage (${totalPercentage}%) exceeds 100%.`;
  } else if (hasWarning) {
    message = `Warning: Total percentage (${totalPercentage}%) exceeds ${warningThreshold}%. Are you sure?`;
  } else {
    message = `Total percentage: ${totalPercentage}%`;
  }
  
  return { totalPercentage, valid, hasWarning, message };
}

/**
 * Check for circular dependencies in group relationships
 */
export function detectCircularDependency(
  startGroupId: string,
  groups: AnyStaffGroup[]
): {
  hasCircular: boolean;
  path: string[];
  message: string;
} {
  const visited = new Set<string>();
  const path: string[] = [];
  
  function traverse(currentId: string): boolean {
    if (visited.has(currentId)) {
      if (currentId === startGroupId) {
        path.push(currentId);
        return true;
      }
      return false;
    }
    
    visited.add(currentId);
    path.push(currentId);
    
    const group = groups.find(g => g.id === currentId);
    if (!group) return false;
    
    if (group.gratuityConfig.recipientGroupIds) {
      for (const recipientId of group.gratuityConfig.recipientGroupIds) {
        if (traverse(recipientId)) {
          return true;
        }
      }
    }
    
    path.pop();
    return false;
  }
  
  const hasCircular = traverse(startGroupId);
  
  let message = '';
  if (hasCircular) {
    const groupNames = path.map(id => {
      const group = groups.find(g => g.id === id);
      return group?.name || id;
    });
    message = `Circular dependency detected: ${groupNames.join(' → ')}`;
  } else {
    message = 'No circular dependencies detected.';
  }
  
  return { hasCircular, path, message };
}

// FORMATTING UTILITIES
// ============================================

/**
 * Format currency amount
 */
export function formatCurrency(amount: number | undefined | null, showCents: boolean = true): string {
  // Defensive check - handle invalid values
  if (amount === undefined || amount === null || isNaN(amount)) {
    console.warn('⚠️ formatCurrency called with invalid amount:', amount);
    console.trace(); // This will show you the call stack
    return showCents ? '$0.00' : '$0';
  }
  
  if (showCents) {
    return `$${amount.toFixed(2)}`;
  }
  return `$${Math.round(amount)}`;
}

/**
 * Format hours with proper singular/plural
 */
export function formatHours(hours: number): string {
  const rounded = hours.toFixed(2);
  return `${rounded} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * Format percentage
 */
export function formatPercentage(percentage: number, decimals: number = 1): string {
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Format staff member's full name
 */
export function formatStaffName(staff: StaffMember | { firstName: string; lastName: string }): string {
  return `${staff.firstName} ${staff.lastName}`;
}

/**
 * Format date for display
 */

export function formatShiftDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
/**
 * Format shift type for display
 */
export function formatShiftType(type: ShiftType): string {
  const typeMap: Record<ShiftType, string> = {
    'AM': 'Morning Shift',
    'PM': 'Evening Shift',
    'FULL_DAY': 'Full Day'
  };
  return typeMap[type] || type;
}

// CALCULATION HELPERS
// ============================================

/**
 * Calculate total tips collected (CC + Cash)
 */
export function calculateTotalTips(creditCardTips: number = 0, cashTips: number = 0): number {
  return parseFloat((creditCardTips + cashTips).toFixed(2));
}

/**
 * Calculate contribution amount based on distribution type
 */
export function calculateContribution(
  baseAmount: number,
  distributionType: 'fixed' | 'percentage',
  value: number
): number {
  if (distributionType === 'fixed') {
    return value;
  } else {
    return parseFloat((baseAmount * (value / 100)).toFixed(2));
  }
}

/**
 * Calculate hourly rate from pool and hours
 */
export function calculateHourlyRate(poolAmount: number, totalHours: number): number {
  if (totalHours === 0) return 0;
  return parseFloat((poolAmount / totalHours).toFixed(2));
}

/**
 * Calculate payout based on hours and rate
 */
export function calculatePayout(hoursWorked: number, hourlyRate: number): number {
  return parseFloat((hoursWorked * hourlyRate).toFixed(2));
}

/**
 * Round to 2 decimal places (for money)
 */
export function roundMoney(amount: number): number {
  return parseFloat(amount.toFixed(2));
}

/**
 * Calculate net amount after deductions
 */
export function calculateNetAmount(gross: number, deductions: number): number {
  return roundMoney(gross - deductions);
}

// DATA TRANSFORMATION UTILITIES
// ============================================

/**
 * Group contributions by recipient group
 */
export function groupContributionsByRecipient(
  contributions: IndividualContribution[]
): Map<string, { total: number; contributors: string[] }> {
  const grouped = new Map<string, { total: number; contributors: string[] }>();
  
  contributions.forEach(contrib => {
    Object.entries(contrib.contributions).forEach(([recipientId, amount]) => {
      if (!grouped.has(recipientId)) {
        grouped.set(recipientId, { total: 0, contributors: [] });
      }
      const group = grouped.get(recipientId)!;
      group.total += amount;
      group.contributors.push(contrib.staffId);
    });
  });
  
  return grouped;
}

/**
 * Calculate group totals from individual contributions
 */
export function calculateGroupTotals(
  groupId: string,
  contributions: IndividualContribution[]
): {
  totalCollected: number;
  totalDistributed: number;
  totalKept: number;
  averageContribution: number;
  staffCount: number;
} {
  const groupContributions = contributions.filter(c => c.groupId === groupId);
  
  const totalCollected = groupContributions.reduce((sum, c) => sum + c.baseAmount, 0);
  const totalDistributed = groupContributions.reduce((sum, c) => sum + c.totalContribution, 0);
  const totalKept = totalCollected - totalDistributed;
  const staffCount = groupContributions.length;
  const averageContribution = staffCount > 0 ? totalDistributed / staffCount : 0;
  
  return {
    totalCollected: roundMoney(totalCollected),
    totalDistributed: roundMoney(totalDistributed),
    totalKept: roundMoney(totalKept),
    averageContribution: roundMoney(averageContribution),
    staffCount
  };
}

/**
 * Calculate recipient group statistics
 */
export function calculateRecipientStats(
  groupId: string,
  pool: RecipientPool | undefined,
  payouts: MemberPayout[]
): {
  totalReceived: number;
  totalPaidOut: number;
  hourlyRate: number;
  recipientCount: number;
  totalHours: number;
} {
  const groupPayouts = payouts.filter(p => p.groupId === groupId);
  
  const totalReceived = pool?.totalPool || 0;
  const totalPaidOut = groupPayouts.reduce((sum, p) => sum + p.payout, 0);
  const totalHours = groupPayouts.reduce((sum, p) => sum + p.hoursWorked, 0);
  const hourlyRate = groupPayouts.length > 0 ? groupPayouts[0].hourlyRate : 0;
  
  return {
    totalReceived: roundMoney(totalReceived),
    totalPaidOut: roundMoney(totalPaidOut),
    hourlyRate: roundMoney(hourlyRate),
    recipientCount: groupPayouts.length,
    totalHours: roundMoney(totalHours)
  };
}

// EXPORT/REPORT UTILITIES
// ============================================

/**
 * Generate CSV content from shift data
 */
export function generateShiftCSV(data: {
  shiftDate: Date;
  shiftType: ShiftType;
  staffData: Array<{
    name: string;
    groupName: string;
    hoursWorked: number;
    tipsCollected?: number;
    contribution?: number;
    netAmount?: number;
    received?: number;
  }>;
}): string {
  const headers = [
    'Staff Name',
    'Group',
    'Hours Worked',
    'Tips Collected',
    'Contribution',
    'Net Amount',
    'Received'
  ];
  
  const rows = data.staffData.map(staff => [
    staff.name,
    staff.groupName,
    staff.hoursWorked.toFixed(2),
    staff.tipsCollected?.toFixed(2) || '-',
    staff.contribution?.toFixed(2) || '-',
    staff.netAmount?.toFixed(2) || '-',
    staff.received?.toFixed(2) || '-'
  ]);
  
  const csvContent = [
    `Shift Report - ${formatShiftDate(data.shiftDate)} (${formatShiftType(data.shiftType)})`,
    '',
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
  
  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Generate printable summary report
 */
export function generatePrintableSummary(data: {
  shiftDate: Date;
  shiftType: ShiftType;
  totalCollected: number;
  totalDistributed: number;
  totalKept: number;
  totalHours: number;
  groupSummaries: Array<{
    groupName: string;
    staffCount: number;
    totalAmount: number;
  }>;
}): string {
  return `
SHIFT SUMMARY REPORT
====================
Date: ${formatShiftDate(data.shiftDate)}
Shift: ${formatShiftType(data.shiftType)}

OVERALL TOTALS
--------------
Total Tips Collected: ${formatCurrency(data.totalCollected)}
Total Distributed: ${formatCurrency(data.totalDistributed)}
Total Kept: ${formatCurrency(data.totalKept)}
Total Hours Worked: ${formatHours(data.totalHours)}

GROUP SUMMARIES
---------------
${data.groupSummaries.map(group => 
  `${group.groupName}: ${group.staffCount} staff, ${formatCurrency(group.totalAmount)}`
).join('\n')}
`;
}

// SORTING UTILITIES
// ============================================

/**
 * Sort staff members alphabetically by last name
 */
export function sortStaffByLastName<T extends { lastName: string; firstName: string }>(
  staff: T[]
): T[] {
  return [...staff].sort((a, b) => {
    const lastNameCompare = a.lastName.localeCompare(b.lastName);
    if (lastNameCompare !== 0) return lastNameCompare;
    return a.firstName.localeCompare(b.firstName);
  });
}

/**
 * Sort groups by name
 */
export function sortGroupsByName<T extends { name: string }>(groups: T[]): T[] {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sort by tips amount (descending)
 */
export function sortByTipsDescending<T extends { amount: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.amount - a.amount);
}

// SEARCH/FILTER UTILITIES
// ============================================

/**
 * Filter staff by search term (name)
 */
export function filterStaffBySearch(
  staff: StaffMember[],
  searchTerm: string
): StaffMember[] {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return staff;
  
  return staff.filter(s => 
    s.firstName.toLowerCase().includes(term) ||
    s.lastName.toLowerCase().includes(term) ||
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(term)
  );
}

/**
 * Filter groups by type (distributor/recipient)
 */
export function filterGroupsByType(
  groups: AnyStaffGroup[],
  type: 'distributor' | 'recipient' | 'all'
): AnyStaffGroup[] {
  if (type === 'all') return groups;
  
  return groups.filter(g => {
    if (type === 'distributor') {
      return g.gratuityConfig.distributesGratuities === true;
    } else {
      return g.gratuityConfig.distributesGratuities === false;
    }
  });
}

// DATE UTILITIES
// ============================================

/**
 * Get start and end of week for a given date
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Get start and end of month for a given date
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  
  return { start, end };
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Normalize date to midnight
 */
export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

