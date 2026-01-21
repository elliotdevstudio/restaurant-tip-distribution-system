import { ObjectId } from 'bson';
import { ShiftType } from '../../../types';


// Individual staff member's data within a shift
export interface StaffShiftData {
  staffId: ObjectId;
  firstName: string;  // Denormalized for quick display
  lastName: string;   // Denormalized for quick display
  groupId: ObjectId;
  groupName: string;  // Denormalized for quick display
  hoursWorked: number;
  
  // For distributor group members
  salesAmount?: number;
  creditCardTips?: number;
  cashTips?: number;
  totalTipsCollected?: number; // Calculated: creditCard + cash
  contributionAmount?: number; // What they contributed to recipients
  netTipAmount?: number;       // What they keep after distribution
  
  // For recipient group members
  receivedAmount?: number;     // Tips received from distributor groups
  sourceGroupIds?: ObjectId[]; // Which groups contributed to them
}

// Group-level summary within a shift
export interface GroupShiftSummary {
  groupId: ObjectId;
  groupName: string;
  distributesGratuities: boolean;
  contributionSource?: 'sales' | 'gratuities';
  activeStaffIds: ObjectId[];  // Who was active in this group
  totalHours: number;
  
  // For distributor groups
  totalCollected?: number;
  totalDistributed?: number;
  totalKept?: number;
  
  // For recipient groups
  totalReceived?: number;
  averageHourlyRate?: number;
}

// Complete daily shift document
export interface DailyShiftDocument {
  _id?: ObjectId;
  date: Date | string;  // Stored as midnight UTC for the day
  type: ShiftType; // 'AM' or 'PM' or 'FULL_DAY'
  status: 'draft' | 'active' | 'closed' | 'open';
  
  // All staff data for this shift
  staffData?: StaffShiftData[];
  entries?: any[];
  // Group summaries for this shift
  groupSummaries?: GroupShiftSummary[];
  
  // Overall totals
  shiftTotals?: {
    totalTipsCollected: number;
    totalDistributed: number;
    totalKeptByDistributors: number;
    totalReceivedByRecipients: number;
    totalHoursWorked: number;
    activeStaffCount: number;
    activeGroupCount: number;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  createdBy?: string; // User who created the shift
}

export interface DailyShiftWithId {
  id: string;
  date: Date;
  type: ShiftType;
  status: 'draft' | 'active' | 'closed';
  staffData: Array<{
    staffId: string;
    firstName: string;
    lastName: string;
    groupId: string;
    groupName: string;
    hoursWorked: number;
    salesAmount?: number;
    creditCardTips?: number;
    cashTips?: number;
    totalTipsCollected?: number;
    contributionAmount?: number;
    netTipAmount?: number;
    receivedAmount?: number;
    sourceGroupIds?: string[];
  }>;
  groupSummaries: Array<{
    groupId: string;
    groupName: string;
    distributesGratuities: boolean;
    contributionSource?: 'sales' | 'gratuities';
    activeStaffIds: string[];
    totalHours: number;
    totalCollected?: number;
    totalDistributed?: number;
    totalKept?: number;
    totalReceived?: number;
    averageHourlyRate?: number;
  }>;
  shiftTotals: {
    totalTipsCollected: number;
    totalDistributed: number;
    totalKeptByDistributors: number;
    totalReceivedByRecipients: number;
    totalHoursWorked: number;
    activeStaffCount: number;
    activeGroupCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  createdBy?: string;
}

export function transformDailyShift(doc: any): DailyShiftWithId {
  // Handle both old schema (staffData) and new schema (entries)
  const entries = doc.entries || doc.staffData || [];
  
  return {
    id: doc._id?.toString() || '',
    date: doc.date,
    type: doc.type,
    status: doc.status || 'open',
    staffData: entries.map((staff: any) => ({
      // Handle both ObjectId and string formats
      staffId: staff.staffId?.toString?.() || staff.staffId,
      firstName: staff.firstName || staff.staffName?.split(' ')[0] || '',
      lastName: staff.lastName || staff.staffName?.split(' ').slice(1).join(' ') || '',
      groupId: staff.groupId?.toString?.() || staff.groupId,
      groupName: staff.groupName,
      hoursWorked: staff.hoursWorked || 0,
      salesAmount: staff.salesAmount,
      creditCardTips: staff.creditCardTips,
      cashTips: staff.cashTips,
      // Map between old and new field names
      totalTipsCollected: staff.totalTipsCollected || staff.totalTips,
      contributionAmount: staff.contributionAmount || staff.tipOutAmount,
      netTipAmount: staff.netTipAmount || staff.netTips,
      receivedAmount: staff.receivedAmount || staff.tipsReceived,
      sourceGroupIds: staff.sourceGroupIds?.map((id: any) => id?.toString?.() || id),
      // Preserve new schema fields
      isDistributor: staff.isDistributor,
      staffName: staff.staffName,
      totalTips: staff.totalTips,
      tipOutAmount: staff.tipOutAmount,
      netTips: staff.netTips,
      tipsReceived: staff.tipsReceived
    })),
    groupSummaries: (doc.groupSummaries || []).map((group: any) => ({
      groupId: group.groupId?.toString?.() || group.groupId,
      groupName: group.groupName,
      distributesGratuities: group.distributesGratuities,
      contributionSource: group.contributionSource,
      activeStaffIds: (group.activeStaffIds || []).map((id: any) => id?.toString?.() || id),
      totalHours: group.totalHours || 0,
      totalCollected: group.totalCollected,
      totalDistributed: group.totalDistributed,
      totalKept: group.totalKept,
      totalReceived: group.totalReceived,
      averageHourlyRate: group.averageHourlyRate
    })),
    shiftTotals: doc.shiftTotals || {
      totalTipsCollected: 0,
      totalDistributed: 0,
      totalKeptByDistributors: 0,
      totalReceivedByRecipients: 0,
      totalHoursWorked: 0,
      activeStaffCount: 0,
      activeGroupCount: 0
    },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    closedAt: doc.closedAt,
    createdBy: doc.createdBy
  };
}