'use client'

import  { 
  atom
} from 'jotai';
import { 
  StaffMember, 
  AnyStaffGroup, 
  StaffGroupFormState, 
  NestedGroupCreationState,
  ShiftType,
  ContributionSourceType
} from '../../types';



// Staff roster (master list of all staff)
export const staffMembersAtom = atom<StaffMember[]>([]);

// All staff groups created
export const staffGroupsAtom = atom<AnyStaffGroup[]>([]);

// FORM STATE ATOMS 

export const staffGroupFormAtom = atom<StaffGroupFormState>({
  name: '',
  description: '',
  selectedStaffMemberIds: [],
  distributesGratuities: undefined,
  contributionSource: undefined,
  sourceGroupIds: [],
  distributionType: undefined,
  fixedAmount: undefined,
  percentage: undefined,
  isCreatingSourceGroup: false,
  showGratuityModal: false,
  step: 'basic'
});


export const nestedGroupCreationAtom = atom<NestedGroupCreationState>({
  isOpen: false,
  parentGroupFormState: {
    name: '',
    description: '',
    selectedStaffMemberIds: [],
    isCreatingSourceGroup: false,
    showGratuityModal: false,
    step: 'basic'
  },
  currentGroupFormState: {
    name: '',
    description: '',
    selectedStaffMemberIds: [],
    isCreatingSourceGroup: false,
    showGratuityModal: false,
    step: 'basic'
  }
});

// UI state atoms
export const isLoadingAtom = atom<boolean>(false);
export const errorMessageAtom = atom<string | null>(null);

// DAILY SHIFT STATE ATOMS
// ============================================

// Current active shift being worked on
export const currentShiftAtom = atom<{
  id: string;
  date: Date;
  type: ShiftType;
  status: 'draft' | 'active' | 'closed';
} | null>(null);

// Staff assignments for current shift (who's working in which group)
export interface ShiftStaffAssignment {
  staffId: string;
  staffFirstName: string;
  staffLastName: string;
  activeGroupId: string;
  activeGroupName: string;
  hoursWorked: number;
}

export const shiftStaffAssignmentsAtom = atom<ShiftStaffAssignment[]>([]);

// ============================================
// TIP ENTRY ATOMS (User Input)
// ============================================

export interface TipEntryInput {
  staffId: string;
  groupId: string;
  
  // For distributor groups using "sales" as contribution source
  salesAmount?: number;
  
  // For distributor groups using "gratuities" as contribution source
  creditCardTips?: number;
  cashTips?: number;
  
  hoursWorked: number;
}

// Raw tip inputs from the spreadsheet
export const tipEntriesAtom = atom<TipEntryInput[]>([]);


// CALCULATION CASCADE ATOMS (DERIVED)

// STEP 1: Calculate base amounts for each staff member
export const staffBaseAmountsAtom = atom((get) => {
  const tipEntries = get(tipEntriesAtom);
  const groups = get(staffGroupsAtom);
  
  return tipEntries.map(entry => {
    const group = groups.find(g => g.id === entry.groupId);
    
    let baseAmount = 0;
    let isDistributor = false;
    
    if (group?.gratuityConfig.distributesGratuities) {
      isDistributor = true;
      if (group.gratuityConfig.contributionSource === 'sales') {
        baseAmount = entry.salesAmount || 0;
      } else if (group.gratuityConfig.contributionSource === 'gratuities') {
        baseAmount = (entry.creditCardTips || 0) + (entry.cashTips || 0);
      }
    }
    
    return {
      staffId: entry.staffId,
      groupId: entry.groupId,
      baseAmount,
      isDistributor,
      hoursWorked: entry.hoursWorked,
      salesAmount: entry.salesAmount,
      creditCardTips: entry.creditCardTips,
      cashTips: entry.cashTips
    };
  });
});

// STEP 2: Calculate individual contributions from distributors
export interface IndividualContribution {
  staffId: string;
  groupId: string;
  baseAmount: number;
  contributions: Record<string, number>; // { recipientGroupId: amount }
  totalContribution: number;
  netTakeHome: number;
}

export const individualContributionsAtom = atom((get) => {
  const baseAmounts = get(staffBaseAmountsAtom);
  const groups = get(staffGroupsAtom);
  
  const contributions: IndividualContribution[] = [];
  
  baseAmounts.forEach(staff => {
    if (!staff.isDistributor) return;
    
    const group = groups.find(g => g.id === staff.groupId);
    if (!group) return;
    
    const staffContributions: Record<string, number> = {};
    
    // Calculate contribution to each recipient group
    group.gratuityConfig.recipientGroupIds?.forEach(recipientId => {
      const recipient = groups.find(g => g.id === recipientId);
      if (!recipient) return;
      
      let amount = 0;
      
      if (recipient.gratuityConfig.distributionType === 'fixed') {
        amount = recipient.gratuityConfig.fixedAmount || 0;
      } else if (recipient.gratuityConfig.distributionType === 'percentage') {
        amount = staff.baseAmount * ((recipient.gratuityConfig.percentage || 0) / 100);
      }
      
      staffContributions[recipientId] = amount;
    });
    
    const totalContribution = Object.values(staffContributions).reduce((sum, amt) => sum + amt, 0);
    const netTakeHome = staff.baseAmount - totalContribution;
    
    contributions.push({
      staffId: staff.staffId,
      groupId: staff.groupId,
      baseAmount: staff.baseAmount,
      contributions: staffContributions,
      totalContribution,
      netTakeHome
    });
  });
  
  return contributions;
});

// STEP 3: Aggregate recipient pools by group
export interface RecipientPool {
  groupId: string;
  totalPool: number;
  sourceBreakdown: Array<{
    sourceGroupId: string;
    amount: number;
  }>;
}

export const recipientPoolsAtom = atom((get) => {
  const contributions = get(individualContributionsAtom);
  
  // Map to accumulate pools
  const poolMap = new Map<string, { total: number; sources: Map<string, number> }>();
  
  contributions.forEach(contrib => {
    Object.entries(contrib.contributions).forEach(([recipientId, amount]) => {
      if (!poolMap.has(recipientId)) {
        poolMap.set(recipientId, { total: 0, sources: new Map() });
      }
      
      const pool = poolMap.get(recipientId)!;
      pool.total += amount;
      
      const currentFromSource = pool.sources.get(contrib.groupId) || 0;
      pool.sources.set(contrib.groupId, currentFromSource + amount);
    });
  });
  
  // Convert to array format
  const pools: RecipientPool[] = [];
  poolMap.forEach((data, groupId) => {
    const sourceBreakdown = Array.from(data.sources.entries()).map(([sourceGroupId, amount]) => ({
      sourceGroupId,
      amount
    }));
    
    pools.push({
      groupId,
      totalPool: data.total,
      sourceBreakdown
    });
  });
  
  return pools;
});

// STEP 4: Calculate individual payouts for recipient group members
export interface MemberPayout {
  staffId: string;
  groupId: string;
  hoursWorked: number;
  hourlyRate: number;
  payout: number;
  sourceGroups: string[];
}

export const memberPayoutsAtom = atom((get) => {
  const pools = get(recipientPoolsAtom);
  const assignments = get(shiftStaffAssignmentsAtom);
  const baseAmounts = get(staffBaseAmountsAtom);
  
  const payouts: MemberPayout[] = [];
  
  pools.forEach(pool => {
    // Find all staff members assigned to this recipient group
    const groupMembers = assignments.filter(a => a.activeGroupId === pool.groupId);
    
    // Filter to only include members who actually have tip entries
    const activeMembers = groupMembers.filter(member => 
      baseAmounts.some(ba => ba.staffId === member.staffId)
    );
    
    if (activeMembers.length === 0) return;
    
    // Calculate total hours for this group
    const totalHours = activeMembers.reduce((sum, member) => {
      const staffBase = baseAmounts.find(ba => ba.staffId === member.staffId);
      return sum + (staffBase?.hoursWorked || 0);
    }, 0);
    
    if (totalHours === 0) return;
    
    // Calculate hourly rate
    const hourlyRate = pool.totalPool / totalHours;
    
    // Calculate payout for each member
    activeMembers.forEach(member => {
      const staffBase = baseAmounts.find(ba => ba.staffId === member.staffId);
      const hoursWorked = staffBase?.hoursWorked || 0;
      
      payouts.push({
        staffId: member.staffId,
        groupId: pool.groupId,
        hoursWorked,
        hourlyRate,
        payout: hourlyRate * hoursWorked,
        sourceGroups: pool.sourceBreakdown.map(s => s.sourceGroupId)
      });
    });
  });
  
  return payouts;
});

// SUMMARY & VALIDATION ATOMS
// ============================================

// Group-level summaries
export interface GroupSummary {
  groupId: string;
  groupName: string;
  distributesGratuities: boolean;
  activeStaffCount: number;
  totalHours: number;
  
  // For distributor groups
  totalCollected?: number;
  totalDistributed?: number;
  totalKept?: number;
  
  // For recipient groups
  totalReceived?: number;
  averageHourlyRate?: number;
}

export const groupSummariesAtom = atom((get) => {
  const groups = get(staffGroupsAtom);
  const assignments = get(shiftStaffAssignmentsAtom);
  const baseAmounts = get(staffBaseAmountsAtom);
  const contributions = get(individualContributionsAtom);
  const pools = get(recipientPoolsAtom);
  const payouts = get(memberPayoutsAtom);
  
  const summaries: GroupSummary[] = [];
  
  groups.forEach(group => {
    const groupMembers = assignments.filter(a => a.activeGroupId === group.id);
    const activeMembers = groupMembers.filter(member =>
      baseAmounts.some(ba => ba.staffId === member.staffId)
    );
    
    if (activeMembers.length === 0) return;
    
    const totalHours = activeMembers.reduce((sum, member) => {
      const staffBase = baseAmounts.find(ba => ba.staffId === member.staffId);
      return sum + (staffBase?.hoursWorked || 0);
    }, 0);
    
    const summary: GroupSummary = {
      groupId: group.id,
      groupName: group.name,
      distributesGratuities: group.gratuityConfig.distributesGratuities,
      activeStaffCount: activeMembers.length,
      totalHours
    };
    
    if (group.gratuityConfig.distributesGratuities) {
      // Distributor group
      const groupContributions = contributions.filter(c => c.groupId === group.id);
      const totalCollected = groupContributions.reduce((sum, c) => sum + c.baseAmount, 0);
      const totalDistributed = groupContributions.reduce((sum, c) => sum + c.totalContribution, 0);
      
      summary.totalCollected = totalCollected;
      summary.totalDistributed = totalDistributed;
      summary.totalKept = totalCollected - totalDistributed;
    } else {
      // Recipient group
      const pool = pools.find(p => p.groupId === group.id);
      const groupPayouts = payouts.filter(p => p.groupId === group.id);
      
      summary.totalReceived = pool?.totalPool || 0;
      summary.averageHourlyRate = groupPayouts.length > 0
        ? groupPayouts[0].hourlyRate
        : 0;
    }
    
    summaries.push(summary);
  });
  
  return summaries;
});

// Overall shift totals
export interface ShiftTotals {
  totalTipsCollected: number;
  totalDistributed: number;
  totalKeptByDistributors: number;
  totalReceivedByRecipients: number;
  totalHoursWorked: number;
  activeStaffCount: number;
  activeGroupCount: number;
  balanced: boolean;
  discrepancy: number;
}

export const shiftTotalsAtom = atom((get) => {
  const baseAmounts = get(staffBaseAmountsAtom);
  const contributions = get(individualContributionsAtom);
  const pools = get(recipientPoolsAtom);
  const summaries = get(groupSummariesAtom);
  
  const totalTipsCollected = contributions.reduce((sum, c) => sum + c.baseAmount, 0);
  const totalDistributed = contributions.reduce((sum, c) => sum + c.totalContribution, 0);
  const totalKeptByDistributors = totalTipsCollected - totalDistributed;
  const totalReceivedByRecipients = pools.reduce((sum, p) => sum + p.totalPool, 0);
  const totalHoursWorked = baseAmounts.reduce((sum, ba) => sum + ba.hoursWorked, 0);
  
  // Check if balanced (total distributed should equal total received)
  const discrepancy = Math.abs(totalDistributed - totalReceivedByRecipients);
  const balanced = discrepancy < 0.01; // Allow 1 cent rounding error
  
  const totals: ShiftTotals = {
    totalTipsCollected,
    totalDistributed,
    totalKeptByDistributors,
    totalReceivedByRecipients,
    totalHoursWorked,
    activeStaffCount: baseAmounts.length,
    activeGroupCount: summaries.length,
    balanced,
    discrepancy
  };
  
  return totals;
});

// VALIDATION ATOMS
// ============================================

// Validate percentage totals don't exceed 100%
export interface PercentageValidation {
  groupId: string;
  groupName: string;
  totalPercentage: number;
  exceedsLimit: boolean;
  exceedsWarningThreshold: boolean; // > 30%
}

export const percentageValidationAtom = atom((get) => {
  const groups = get(staffGroupsAtom);
  const validations: PercentageValidation[] = [];
  
  groups.forEach(group => {
    if (!group.gratuityConfig.distributesGratuities) return;
    if (!group.gratuityConfig.recipientGroupIds) return;
    
    let totalPercentage = 0;
    
    group.gratuityConfig.recipientGroupIds.forEach(recipientId => {
      const recipient = groups.find(g => g.id === recipientId);
      if (recipient?.gratuityConfig.distributionType === 'percentage') {
        totalPercentage += recipient.gratuityConfig.percentage || 0;
      }
    });
    
    validations.push({
      groupId: group.id,
      groupName: group.name,
      totalPercentage,
      exceedsLimit: totalPercentage > 100,
      exceedsWarningThreshold: totalPercentage > 30
    });
  });
  
  return validations;
});

// Check for circular dependencies in group relationships
export const circularDependencyCheckAtom = atom((get) => {
  const groups = get(staffGroupsAtom);
  
  const findCircularPath = (
    startGroupId: string,
    currentGroupId: string,
    visited: Set<string>,
    path: string[]
  ): string[] | null => {
    if (visited.has(currentGroupId)) {
      if (currentGroupId === startGroupId) {
        return [...path, currentGroupId];
      }
      return null;
    }
    
    visited.add(currentGroupId);
    path.push(currentGroupId);
    
    const group = groups.find(g => g.id === currentGroupId);
    if (!group) return null;
    
    // Check recipient connections
    if (group.gratuityConfig.recipientGroupIds) {
      for (const recipientId of group.gratuityConfig.recipientGroupIds) {
        const circularPath = findCircularPath(startGroupId, recipientId, new Set(visited), [...path]);
        if (circularPath) return circularPath;
      }
    }
    
    return null;
  };
  
  const circularPaths: Array<{ groupIds: string[]; groupNames: string[] }> = [];
  
  groups.forEach(group => {
    const path = findCircularPath(group.id, group.id, new Set(), []);
    if (path) {
      circularPaths.push({
        groupIds: path,
        groupNames: path.map(id => groups.find(g => g.id === id)?.name || id)
      });
    }
  });
  
  return circularPaths;
});

// EDITABLE ATOMS (For spreadsheet updates)
// ============================================

// Writable atom for updating a single tip entry
export const updateTipEntryAtom = atom(
  null,
  (get, set, update: { staffId: string; field: keyof TipEntryInput; value: any }) => {
    const entries = get(tipEntriesAtom);
    const newEntries = entries.map(entry => {
      if (entry.staffId === update.staffId) {
        return { ...entry, [update.field]: update.value };
      }
      return entry;
    });
    set(tipEntriesAtom, newEntries);
  }
);

// Writable atom for updating hours worked
export const updateHoursWorkedAtom = atom(
  null,
  (get, set, update: { staffId: string; hours: number }) => {
    const entries = get(tipEntriesAtom);
    const newEntries = entries.map(entry => {
      if (entry.staffId === update.staffId) {
        return { ...entry, hoursWorked: update.hours };
      }
      return entry;
    });
    set(tipEntriesAtom, newEntries);
  }
);

// Writable atom for bulk initialization of tip entries
export const initializeTipEntriesAtom = atom(
  null,
  (get, set, assignments: ShiftStaffAssignment[]) => {
    const entries: TipEntryInput[] = assignments.map(assignment => ({
      staffId: assignment.staffId,
      groupId: assignment.activeGroupId,
      hoursWorked: assignment.hoursWorked || 0,
      salesAmount: 0,
      creditCardTips: 0,
      cashTips: 0
    }));
    set(tipEntriesAtom, entries);
  }
);

// // ATOM 3: Hours-based payouts
// const memberPayoutsAtom = atom((get) => { 
//   const pools = get(recipientPoolsAtom);
//   const assignments = get(shiftStaffAssignmentsAtom);
//   const groups = get(staffGroupsAtom);
  
//   const payouts = [];
  
//   pools.forEach(({ groupId, totalPool }) => {
//     const groupMembers = assignments.filter(a => a.activeGroupId === groupId);
//     const totalHours = groupMembers.reduce((sum, m) => sum + m.hoursWorked, 0);
//     const hourlyRate = totalPool / totalHours;
    
//     groupMembers.forEach(member => {
//       payouts.push({
//         staffId: member.staffId,
//         groupId,
//         hoursWorked: member.hoursWorked,
//         hourlyRate,
//         payout: hourlyRate * member.hoursWorked
//       });
//     });
//   });
  
//   return payouts;
// });





