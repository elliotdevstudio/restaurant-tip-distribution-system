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
  date: Date;  // Stored as midnight UTC for the day
  type: ShiftType; // 'AM' or 'PM' or 'FULL_DAY'
  status: 'draft' | 'active' | 'closed';
  
  // All staff data for this shift
  staffData: StaffShiftData[];
  
  // Group summaries for this shift
  groupSummaries: GroupShiftSummary[];
  
  // Overall totals
  shiftTotals: {
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

export function transformDailyShift(doc: DailyShiftDocument): DailyShiftWithId {
  return {
    id: doc._id!.toString(),
    date: doc.date,
    type: doc.type,
    status: doc.status,
    staffData: doc.staffData.map(staff => ({
      staffId: staff.staffId.toString(),
      firstName: staff.firstName,
      lastName: staff.lastName,
      groupId: staff.groupId.toString(),
      groupName: staff.groupName,
      hoursWorked: staff.hoursWorked,
      salesAmount: staff.salesAmount,
      creditCardTips: staff.creditCardTips,
      cashTips: staff.cashTips,
      totalTipsCollected: staff.totalTipsCollected,
      contributionAmount: staff.contributionAmount,
      netTipAmount: staff.netTipAmount,
      receivedAmount: staff.receivedAmount,
      sourceGroupIds: staff.sourceGroupIds?.map(id => id.toString())
    })),
    groupSummaries: doc.groupSummaries.map(group => ({
      groupId: group.groupId.toString(),
      groupName: group.groupName,
      distributesGratuities: group.distributesGratuities,
      contributionSource: group.contributionSource,
      activeStaffIds: group.activeStaffIds.map(id => id.toString()),
      totalHours: group.totalHours,
      totalCollected: group.totalCollected,
      totalDistributed: group.totalDistributed,
      totalKept: group.totalKept,
      totalReceived: group.totalReceived,
      averageHourlyRate: group.averageHourlyRate
    })),
    shiftTotals: doc.shiftTotals,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    closedAt: doc.closedAt,
    createdBy: doc.createdBy
  };
}

