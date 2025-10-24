import { ObjectId } from 'bson';

export type {
  DailyShift,
  StaffShiftData,
  GroupShiftSummary,
  ShiftTotals,
  ShiftStatus
} from '../app/lib/models/DailyShift';

export type {
  StaffGroup,
  DistributorStaffGroup,
  RecipientStaffGroup,
  AnyStaffGroup,
  StaffGroupDocument,
  StaffGroupWithId,
  GratuityConfig
} from '../app/lib/models/StaffGroup';

export type { 
  StaffMember,
  StaffMemberDocument,
  StaffMemberWithId 
} from '../app/lib/models/StaffMember';

// base staffmember type
export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  dateCreated: Date;
  collectsSales: boolean;
}

// TIP CALCULATION RESULT TYPES
export interface IndividualContribution {
  staffId: string;
  groupId: string;
  baseAmount: number; // Total tips or sales amount
  contributions: Record<string, number>; // { recipientGroupId: amount }
  totalContribution: number; // Sum of all contributions
  netTakeHome: number; // What they keep after distributions
}

// Recipient group's total pool from all sources
export interface RecipientPool {
  groupId: string;
  totalPool: number;
  sourceBreakdown: Array<{
    sourceGroupId: string;
    amount: number;
  }>;
}

// Individual recipient member's payout
export interface MemberPayout {
  staffId: string;
  groupId: string;
  hoursWorked: number;
  hourlyRate: number;
  payout: number;
  sourceGroups: string[]; // Which distributor groups contributed
}

// Complete shift calculation summary
export interface ShiftCalculationSummary {
  shiftId: string;
  distributorTotals: {
    groupId: string;
    totalCollected: number;
    totalDistributed: number;
    totalKept: number;
  }[];
  recipientTotals: {
    groupId: string;
    totalReceived: number;
    totalHours: number;
    averageHourlyRate: number;
  }[];
  individualContributions: IndividualContribution[];
  recipientPools: RecipientPool[];
  memberPayouts: MemberPayout[];
  grandTotals: {
    totalTipsCollected: number;
    totalDistributed: number;
    totalKeptByDistributors: number;
    balanced: boolean;
    discrepancy: number;
  };
}


// gratuity dist. types
export type GratuityDistributionType = 'fixed' | 'percentage';
export type ContributionSourceType = 'sales' | 'gratuities';

// gratuity configuration interface
// export interface GratuityConfig {
//   distributesGratuities: boolean;
//   sourceGroupIds?: string[];
//   distributionType?: GratuityDistributionType
//   contributionSource?: ContributionSourceType;
//   fixedAmount?: number;
//   percentage?: number;
//   recipientGroupIds?: string[];
// }

export interface GratuityConfig {
  distributesGratuities: boolean;
  contributionSource?: 'sales' | 'gratuities';
  distributionBasis?: 'sales' | 'gratuities';  // NEW
  
  sourceGroupIds?: string[];
  recipientGroupIds?: string[];
  distributionType?: 'fixed' | 'percentage';
  fixedAmount?: number;
  percentage?: number;
}
// base staff group interface
export interface StaffGroup  {
  id: string;
  name: string;
  description?: string;
  staffMemberIds: string[];
  dateCreated: Date;
  dateUpdated: Date;
  gratuityConfig: GratuityConfig;
}

// Individual staff member's collected gratuities for a specific day/session
export interface StaffMemberTips {
  staffId: string;
  groupId: string;
  
  // For distributor groups
  salesAmount?: number;        // If group uses "% of sales"
  creditCardTips?: number;     // If group uses "total gratuities"
  cashTips?: number;           // If group uses "total gratuities"
  
  hoursWorked: number;         // Always required
  recordedAt: Date;
}

// extended interface for groups that RECEIVE gratuities 
export interface GratuityRecipientGroup extends StaffGroup {
  gratuityConfig: GratuityConfig & {
    distributesGratuities: false; // group receives, does not distribute
    sourceGroupIds: string[];
    distributionType: GratuityDistributionType; 
  } & (
    | { distributionType: 'fixed'; fixedAmount: number}
    | { distibutionType: 'percentage'; percentage: number }
  );
}

// extended interface for groups that distribute gratuities
export interface GratuityDistributorGroup extends StaffGroup {
  gratuityConfig: GratuityConfig & {
    contributionSource: ContributionSourceType;
    distributesGratuities: true;
  };
  recipientGroups?: string[];// IDs of groups that receive gratuities from this group
}

// union type for all possible group types
export type AnyStaffGroup = StaffGroup | GratuityRecipientGroup | GratuityDistributorGroup;

// SHIFT TYPES

export type ShiftType = 'AM' | 'PM' | 'FULL_DAY';
export type ShiftStatus = 'active' | 'closed' | 'draft';

export interface Shift {
  id: string;
  date: Date;
  type: ShiftType;
  status: ShiftStatus;
  createdAt: Date;
  closedAt?: Date;
}

// Staff assignment for a specific shift (with hours worked)
export interface ShiftStaffAssignment {
  staffId: string;
  activeGroupId: string;
  hoursWorked: number;
}

export interface StaffGroupFormState {
  name: string;
  description?: string;
  selectedStaffMemberIds: string[];
  
  // Gratuity configuration
  distributesGratuities?: boolean;
  contributionSource?: ContributionSourceType; // NEW: For distributors
  sourceGroupIds?: string[];
  distributionType?: GratuityDistributionType;
  fixedAmount?: number;
  percentage?: number;
  recipientGroupIds?: string[];
  
  // UI state
  isCreatingSourceGroup: boolean;
  showGratuityModal: boolean;
  step: 'basic' | 'contribution-source' | 'gratuity-setup' | 'connection-setup' | 'review';
}

// Modal state for nested group creation
export interface NestedGroupCreationState {
  isOpen: boolean;
  parentGroupFormState: StaffGroupFormState;
  currentGroupFormState: StaffGroupFormState;
}

//API response/request types
export interface CreateStaffGroupRequest {
  name: string;
  description?: string;
  staffMemberIds: string[];
  gratuityConfig: GratuityConfig;
}

export interface CreateStaffGroupResponse {
  group: StaffGroup;
  success: boolean;
  message?: string;
}

export interface CreateShiftRequest {
  date: Date;
  type: ShiftType;
}

export interface CreateShiftResponse {
  shift: Shift;
  success: boolean;
  message?: string;
}

export interface UpdateShiftAssignmentsRequest {
  shiftId: string;
  assignments: ShiftStaffAssignment[];
}

export interface RecordTipsRequest {
  shiftId: string;
  tips: StaffMemberTips[];
}

export interface SaveShiftCalculationsRequest {
  shiftId: string;
  calculations: ShiftCalculationSummary;
}

//Utility types for type chekcing
export type GroupWithGratuityDistribution = Extract<AnyStaffGroup, { gratuityConfig: {distributesGratuities: true} }>;
export type GroupWithGratuityReceipt = Extract<AnyStaffGroup, { gratuityConfig: { distributesGratuities: false } }>;

// type guards for runtime type checking
export function isGratuityDistributorGroup(group: AnyStaffGroup): group is GratuityDistributorGroup {
  return group.gratuityConfig.distributesGratuities === true;
}

export function isGratuityRecipientGroup(group: AnyStaffGroup): group is GratuityRecipientGroup {
  return (
    group.gratuityConfig.distributesGratuities === false &&
    group.gratuityConfig.sourceGroupIds !== undefined &&
    group.gratuityConfig.sourceGroupIds.length > 0
  );
}

export function hasFixedGratuityAmount(
  group: GratuityRecipientGroup
): group is GratuityRecipientGroup & {
  gratuityConfig: { distributionType: 'fixed'; fixedAmount: number };
} {
  return group.gratuityConfig.distributionType === 'fixed';
}

export function hasPercentageGratuity(
  group: GratuityRecipientGroup
): group is GratuityRecipientGroup & {
  gratuityConfig: { distributionType: 'percentage'; percentage: number };
} {
  return group.gratuityConfig.distributionType === 'percentage';
}

export function useSalesAsContributionSource(
  group: GratuityDistributorGroup
): boolean {
  return group.gratuityConfig.contributionSource === 'sales';
}

export function usesGratuitiesAsContributionSource(
  group: GratuityDistributorGroup
): boolean {
  return group.gratuityConfig.contributionSource === 'gratuities';
}

// component prop types 

export interface StaffGroupFormProps {
  availableStaffMembers: StaffMember[];
  existingGroups: AnyStaffGroup[];
  onCreateGroup: (request: CreateStaffGroupRequest) => Promise<CreateStaffGroupResponse>;
  onUpdateFormState: (state: Partial<StaffGroupFormState>) => void;
  formState: StaffGroupFormState;
}

export interface GratuityModalProps {
  isOpen: boolean;
  existingGroups: AnyStaffGroup[];
  onSelectExistingGroup: (groupId: string) => void;
  onCreateNewGroup: () => void;
  onClose: () => void;
}

export interface TipEntrySheetProps {
  shift: Shift;
  assignments: ShiftStaffAssignment[];
  groups: AnyStaffGroup[];
  staffMembers: StaffMember[];
  onSave: (calculations: ShiftCalculationSummary) => Promise<void>;
  onClose: () => void;
}

// ============================================
// UTILITY TYPES
// ============================================

// For displaying staff info in UI
export interface StaffMemberDisplay extends StaffMember {
  fullName: string;
  groupNames: string[];
}

// For validation results
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// For percentage validation
export interface PercentageValidation {
  groupId: string;
  groupName: string;
  totalPercentage: number;
  exceedsLimit: boolean;
  exceedsWarningThreshold: boolean;
}