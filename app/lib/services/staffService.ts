import { DatabaseConnection } from '../mongodb';
import { ObjectId } from 'bson';
import { 
  StaffMemberDocument, 
  StaffMemberWithId, 
  transformStaffMember 
} from '../models/StaffMember';
import { 
  StaffGroupDocument, 
  StaffGroupWithId, 
  transformStaffGroup 
} from '../models/StaffGroup';
import { CreateStaffGroupRequest, ShiftType } from '../../../types';
import {
  StaffShiftData,
  GroupShiftSummary,
  DailyShiftDocument,
  DailyShiftWithId,
  transformDailyShift
} from '../models/DailyShift';

export class StaffService {
  private static async getDb() {
    return DatabaseConnection.getDatabase('staff_management');
  }

  static async ensureIndexes(): Promise<void> {
    console.log('🔧 Creating database indexes...');
    const db = await this.getDb();
    
    try {
      // Staff Members indexes
      await db.collection('staff_members').createIndexes([
        { key: { dateCreated: -1 } },
        { key: { lastName: 1, firstName: 1 } }
      ]);
      console.log('✅ Staff members indexes created');
      
      // Staff Groups indexes
      await db.collection('staff_groups').createIndexes([
        { key: { staffMemberIds: 1 } },
        { key: { 'gratuityConfig.recipientGroupIds': 1 } }
      ]);
      console.log('✅ Staff groups indexes created');
      
      // Daily Shifts indexes
      await db.collection('daily_shifts').createIndexes([
        { key: { date: -1, type: 1 }, unique: true },
        { key: { status: 1, date: -1 } }
      ]);
      console.log('✅ Daily shifts indexes created');
      
      console.log('✅ All database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating indexes:', error);
      throw error;
    }
  }

  static async getAllStaffMembers(): Promise<StaffMemberWithId[]> {
    console.log('📋 Fetching all staff members...');
    
    try {
      const db = await this.getDb();
      const members = await db.collection<StaffMemberDocument>('staff_members')
        .find({})
        .sort({ dateCreated: -1 })
        .toArray();
      
      console.log(`✅ Found ${members.length} members in database`);
      
      return members.map(transformStaffMember);
    } catch (error) {
      console.error('❌ Error getting members:', error);
      throw error;
    }
  }

  static async createStaffMember(
  firstName: string,
  lastName: string,
): Promise<StaffMemberWithId> {
  console.log('📝 Creating staff member:', firstName, lastName );
  const db = await this.getDb();
  
  const memberDoc: StaffMemberDocument = {
    firstName,
    lastName,
    dateCreated: new Date()
  };

  const result = await db.collection<StaffMemberDocument>('staff_members')
    .insertOne(memberDoc);
  
  const created = await db.collection<StaffMemberDocument>('staff_members')
    .findOne({ _id: result.insertedId });
  
  if (!created) {
    throw new Error('Failed to create staff member');
  }

  console.log('✅ Successfully created staff member');
  return transformStaffMember(created);
}
  

  static async getAllStaffGroups(): Promise<StaffGroupWithId[]> {
    console.log('📋 Fetching all staff groups...');
    const db = await this.getDb();
    const groups = await db.collection<StaffGroupDocument>('staff_groups')
      .find({})
      .sort({ dateCreated: -1 })
      .toArray();
    
    console.log(`✅ Found ${groups.length} staff groups`);
    return groups.map(transformStaffGroup);
  }


  // DAILY SHIFT METHODS (Replaces previous shift/assignment/tip methods)
// ============================================

static async createDailyShift(date: Date, type: ShiftType): Promise<DailyShiftWithId> {
  console.log(`📅 Creating daily shift: ${type} on ${date.toISOString()}`);
  const db = await this.getDb();
  
  // Normalize date to midnight UTC
  const normalizedDate = new Date(date.setHours(0, 0, 0, 0));
  
  // Check if shift already exists
  const existing = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ 
      date: normalizedDate,
      type
    });
  
  if (existing) {
    console.log('⚠️ Shift already exists for this date/type');
    return transformDailyShift(existing);
  }
  
  const shiftDoc: DailyShiftDocument = {
    date: normalizedDate,
    type,
    status: 'draft',
    staffData: [],
    groupSummaries: [],
    shiftTotals: {
      totalTipsCollected: 0,
      totalDistributed: 0,
      totalKeptByDistributors: 0,
      totalReceivedByRecipients: 0,
      totalHoursWorked: 0,
      activeStaffCount: 0,
      activeGroupCount: 0
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await db.collection<DailyShiftDocument>('daily_shifts')
    .insertOne(shiftDoc);
  
  const created = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ _id: result.insertedId });
  
  if (!created) {
    throw new Error('Failed to create daily shift');
  }

  console.log('✅ Successfully created daily shift');
  return transformDailyShift(created);
}

static async getDailyShift(date: Date, type: ShiftType): Promise<DailyShiftWithId | null> {
  console.log(`🔍 Fetching daily shift: ${type} on ${date.toISOString()}`);
  const db = await this.getDb();
  
  const normalizedDate = new Date(date.setHours(0, 0, 0, 0));
  
  const shift = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ date: normalizedDate, type });
  
  if (!shift) {
    console.log('❌ Daily shift not found');
    return null;
  }
  
  return transformDailyShift(shift);
}

static async getDailyShiftById(shiftId: string): Promise<DailyShiftWithId | null> {
  console.log('🔍 Fetching daily shift by ID:', shiftId);
  const db = await this.getDb();
  
  const shift = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ _id: new ObjectId(shiftId) });
  
  if (!shift) {
    console.log('❌ Daily shift not found');
    return null;
  }
  
  return transformDailyShift(shift);
}

static async getDailyShiftsByDateRange(
  startDate: Date,
  endDate: Date,
  type?: ShiftType
): Promise<DailyShiftWithId[]> {
  console.log('📋 Fetching daily shifts by date range');
  const db = await this.getDb();
  
  const query: any = {
    date: {
      $gte: new Date(startDate.setHours(0, 0, 0, 0)),
      $lte: new Date(endDate.setHours(23, 59, 59, 999))
    }
  };
  
  if (type) {
    query.type = type;
  }
  
  const shifts = await db.collection<DailyShiftDocument>('daily_shifts')
    .find(query)
    .sort({ date: -1, type: 1 })
    .toArray();
  
  console.log(`✅ Found ${shifts.length} daily shifts in range`);
  return shifts.map(transformDailyShift);
}

static async updateDailyShiftStaffData(
  shiftId: string,
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
  }>
): Promise<DailyShiftWithId> {
  console.log('📝 Updating daily shift staff data');
  const db = await this.getDb();
  
  // Convert to MongoDB format
  const staffDataDoc: StaffShiftData[] = staffData.map(staff => ({
    staffId: new ObjectId(staff.staffId),
    firstName: staff.firstName,
    lastName: staff.lastName,
    groupId: new ObjectId(staff.groupId),
    groupName: staff.groupName,
    hoursWorked: staff.hoursWorked,
    salesAmount: staff.salesAmount,
    creditCardTips: staff.creditCardTips,
    cashTips: staff.cashTips,
    totalTipsCollected: staff.totalTipsCollected,
    contributionAmount: staff.contributionAmount,
    netTipAmount: staff.netTipAmount,
    receivedAmount: staff.receivedAmount,
    sourceGroupIds: staff.sourceGroupIds?.map(id => new ObjectId(id))
  }));
  
  const result = await db.collection<DailyShiftDocument>('daily_shifts')
    .updateOne(
      { _id: new ObjectId(shiftId) },
      { 
        $set: { 
          staffData: staffDataDoc,
          updatedAt: new Date()
        } 
      }
    );
  
  if (result.matchedCount === 0) {
    throw new Error('Daily shift not found');
  }
  
  const updated = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ _id: new ObjectId(shiftId) });
  
  if (!updated) {
    throw new Error('Failed to retrieve updated daily shift');
  }

  console.log('✅ Successfully updated staff data');
  return transformDailyShift(updated);
}

static async updateDailyShiftGroupSummaries(
  shiftId: string,
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
  }>
): Promise<DailyShiftWithId> {
  console.log('📝 Updating daily shift group summaries');
  const db = await this.getDb();
  
  // Convert to MongoDB format
  const groupSummariesDoc: GroupShiftSummary[] = groupSummaries.map(group => ({
    groupId: new ObjectId(group.groupId),
    groupName: group.groupName,
    distributesGratuities: group.distributesGratuities,
    contributionSource: group.contributionSource,
    activeStaffIds: group.activeStaffIds.map(id => new ObjectId(id)),
    totalHours: group.totalHours,
    totalCollected: group.totalCollected,
    totalDistributed: group.totalDistributed,
    totalKept: group.totalKept,
    totalReceived: group.totalReceived,
    averageHourlyRate: group.averageHourlyRate
  }));
  
  const result = await db.collection<DailyShiftDocument>('daily_shifts')
    .updateOne(
      { _id: new ObjectId(shiftId) },
      { 
        $set: { 
          groupSummaries: groupSummariesDoc,
          updatedAt: new Date()
        } 
      }
    );
  
  if (result.matchedCount === 0) {
    throw new Error('Daily shift not found');
  }
  
  const updated = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ _id: new ObjectId(shiftId) });
  
  if (!updated) {
    throw new Error('Failed to retrieve updated daily shift');
  }

  console.log('✅ Successfully updated group summaries');
  return transformDailyShift(updated);
}

static async updateDailyShiftTotals(
  shiftId: string,
  totals: {
    totalTipsCollected: number;
    totalDistributed: number;
    totalKeptByDistributors: number;
    totalReceivedByRecipients: number;
    totalHoursWorked: number;
    activeStaffCount: number;
    activeGroupCount: number;
  }
): Promise<DailyShiftWithId> {
  console.log('📝 Updating daily shift totals');
  const db = await this.getDb();
  
  const result = await db.collection<DailyShiftDocument>('daily_shifts')
    .updateOne(
      { _id: new ObjectId(shiftId) },
      { 
        $set: { 
          shiftTotals: totals,
          updatedAt: new Date()
        } 
      }
    );
  
  if (result.matchedCount === 0) {
    throw new Error('Daily shift not found');
  }
  
  const updated = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ _id: new ObjectId(shiftId) });
  
  if (!updated) {
    throw new Error('Failed to retrieve updated daily shift');
  }

  console.log('✅ Successfully updated shift totals');
  return transformDailyShift(updated);
}

static async saveCompleteDailyShift(
  shiftId: string,
  data: {
    staffData: DailyShiftWithId['staffData'];
    groupSummaries: DailyShiftWithId['groupSummaries'];
    shiftTotals: DailyShiftWithId['shiftTotals'];
  }
): Promise<DailyShiftWithId> {
  console.log('💾 Saving complete daily shift data');
  const db = await this.getDb();
  
  // Convert to MongoDB format
  const staffDataDoc: StaffShiftData[] = data.staffData.map(staff => ({
    staffId: new ObjectId(staff.staffId),
    firstName: staff.firstName,
    lastName: staff.lastName,
    groupId: new ObjectId(staff.groupId),
    groupName: staff.groupName,
    hoursWorked: staff.hoursWorked,
    salesAmount: staff.salesAmount,
    creditCardTips: staff.creditCardTips,
    cashTips: staff.cashTips,
    totalTipsCollected: staff.totalTipsCollected,
    contributionAmount: staff.contributionAmount,
    netTipAmount: staff.netTipAmount,
    receivedAmount: staff.receivedAmount,
    sourceGroupIds: staff.sourceGroupIds?.map(id => new ObjectId(id))
  }));
  
  const groupSummariesDoc: GroupShiftSummary[] = data.groupSummaries.map(group => ({
    groupId: new ObjectId(group.groupId),
    groupName: group.groupName,
    distributesGratuities: group.distributesGratuities,
    contributionSource: group.contributionSource,
    activeStaffIds: group.activeStaffIds.map(id => new ObjectId(id)),
    totalHours: group.totalHours,
    totalCollected: group.totalCollected,
    totalDistributed: group.totalDistributed,
    totalKept: group.totalKept,
    totalReceived: group.totalReceived,
    averageHourlyRate: group.averageHourlyRate
  }));
  
  const result = await db.collection<DailyShiftDocument>('daily_shifts')
    .updateOne(
      { _id: new ObjectId(shiftId) },
      { 
        $set: { 
          staffData: staffDataDoc,
          groupSummaries: groupSummariesDoc,
          shiftTotals: data.shiftTotals,
          updatedAt: new Date()
        } 
      }
    );
  
  if (result.matchedCount === 0) {
    throw new Error('Daily shift not found');
  }
  
  const updated = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ _id: new ObjectId(shiftId) });
  
  if (!updated) {
    throw new Error('Failed to retrieve updated daily shift');
  }

  console.log('✅ Successfully saved complete daily shift');
  return transformDailyShift(updated);
}

static async closeDailyShift(shiftId: string): Promise<DailyShiftWithId> {
  console.log('🔒 Closing daily shift');
  const db = await this.getDb();
  
  const result = await db.collection<DailyShiftDocument>('daily_shifts')
    .updateOne(
      { _id: new ObjectId(shiftId) },
      { 
        $set: { 
          status: 'closed',
          closedAt: new Date(),
          updatedAt: new Date()
        } 
      }
    );
  
  if (result.matchedCount === 0) {
    throw new Error('Daily shift not found');
  }
  
  const updated = await db.collection<DailyShiftDocument>('daily_shifts')
    .findOne({ _id: new ObjectId(shiftId) });
  
  if (!updated) {
    throw new Error('Failed to retrieve updated daily shift');
  }

  console.log('✅ Successfully closed daily shift');
  return transformDailyShift(updated);
}

static async deleteDailyShift(shiftId: string): Promise<void> {
  console.log('🗑️ Deleting daily shift:', shiftId);
  const db = await this.getDb();
  
  const result = await db.collection('daily_shifts').deleteOne({ 
    _id: new ObjectId(shiftId) 
  });
  
  if (result.deletedCount === 0) {
    throw new Error('Daily shift not found or already deleted');
  }
  
  console.log('✅ Successfully deleted daily shift');
}

// ============================================
// REPORTING / ANALYTICS METHODS
// ============================================

static async getStaffMemberShiftHistory(
  staffId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{
  date: Date;
  type: ShiftType;
  groupName: string;
  hoursWorked: number;
  earned: number; // netTipAmount or receivedAmount
}>> {
  console.log('📊 Fetching staff member shift history');
  const db = await this.getDb();
  
  const shifts = await db.collection<DailyShiftDocument>('daily_shifts')
    .find({
      date: {
        $gte: new Date(startDate.setHours(0, 0, 0, 0)),
        $lte: new Date(endDate.setHours(23, 59, 59, 999))
      },
      'staffData.staffId': new ObjectId(staffId)
    })
    .sort({ date: -1 })
    .toArray();
  
  const history = shifts.flatMap(shift => {
    const staffEntry = shift.staffData.find(s => s.staffId.toString() === staffId);
    if (!staffEntry) return [];
    
    return [{
      date: shift.date,
      type: shift.type,
      groupName: staffEntry.groupName,
      hoursWorked: staffEntry.hoursWorked,
      earned: staffEntry.netTipAmount || staffEntry.receivedAmount || 0
    }];
  });
  
  console.log(`✅ Found ${history.length} shifts for staff member`);
  return history;
}

static async getGroupPerformanceReport(
  groupId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalShifts: number;
  totalHours: number;
  totalCollected?: number;
  totalDistributed?: number;
  totalReceived?: number;
  averagePerShift: number;
}> {
  console.log('📊 Generating group performance report');
  const db = await this.getDb();
  
  const shifts = await db.collection<DailyShiftDocument>('daily_shifts')
    .find({
      date: {
        $gte: new Date(startDate.setHours(0, 0, 0, 0)),
        $lte: new Date(endDate.setHours(23, 59, 59, 999))
      },
      'groupSummaries.groupId': new ObjectId(groupId)
    })
    .toArray();
  
  let totalHours = 0;
  let totalCollected = 0;
  let totalDistributed = 0;
  let totalReceived = 0;
  
  shifts.forEach(shift => {
    const groupSummary = shift.groupSummaries.find(g => g.groupId.toString() === groupId);
    if (groupSummary) {
      totalHours += groupSummary.totalHours;
      totalCollected += groupSummary.totalCollected || 0;
      totalDistributed += groupSummary.totalDistributed || 0;
      totalReceived += groupSummary.totalReceived || 0;
    }
  });
  
  const report = {
    totalShifts: shifts.length,
    totalHours,
    totalCollected: totalCollected > 0 ? totalCollected : undefined,
    totalDistributed: totalDistributed > 0 ? totalDistributed : undefined,
    totalReceived: totalReceived > 0 ? totalReceived : undefined,
    averagePerShift: shifts.length > 0 ? (totalCollected + totalReceived) / shifts.length : 0
  };
  
  console.log('✅ Generated group performance report');
  return report;
}

// STAFF GROUP CREATE METHODS
  
  static async createStaffGroup(request: CreateStaffGroupRequest): Promise<StaffGroupWithId> {
    console.log('📝 Creating staff group:', request.name);
    const db = await this.getDb();
    
    const staffMemberObjectIds = request.staffMemberIds.map(id => new ObjectId(id));
    
    const groupDoc: StaffGroupDocument = {
      name: request.name,
      description: request.description,
      staffMemberIds: staffMemberObjectIds,
      dateCreated: new Date(),
      dateUpdated: new Date(),
      gratuityConfig: {
        ...request.gratuityConfig,
        sourceGroupIds: request.gratuityConfig.sourceGroupIds?.map(id => new ObjectId(id)) || [],    // Map array
        recipientGroupIds: request.gratuityConfig.recipientGroupIds?.map(id => new ObjectId(id)) || [] // Map array
      }
    };

    const result = await db.collection<StaffGroupDocument>('staff_groups').insertOne(groupDoc);
    const createdGroup = await db.collection<StaffGroupDocument>('staff_groups')
      .findOne({ _id: result.insertedId });
    
    if (!createdGroup) {
      throw new Error('Failed to create staff group');
    }

    console.log('✅ Successfully created staff group');
    return transformStaffGroup(createdGroup);
  }

  static async updateGroupConnections(
    sourceGroupId: string, 
    recipientGroupId: string, 
    action: 'add' | 'remove'
  ): Promise<void> {
    console.log(`🔗 ${action === 'add' ? 'Adding' : 'Removing'} connection:`, { sourceGroupId, recipientGroupId });
    const db = await this.getDb();

    if (action === 'add') {
    // Add recipientGroupId to source group's recipientGroupIds array
      await db.collection('staff_groups').updateOne(
        { _id: new ObjectId(sourceGroupId) },
        { $addToSet: { 'gratuityConfig.recipientGroupIds': new ObjectId(recipientGroupId) } } as any
      );

    // Add sourceGroupId to recipient group's sourceGroupIds array
      await db.collection('staff_groups').updateOne(
        { _id: new ObjectId(recipientGroupId) },
        { $addToSet: { 'gratuityConfig.sourceGroupIds': new ObjectId(sourceGroupId) } } as any
      );
    } else {
    // Remove recipientGroupId from source group's recipientGroupIds array
      await db.collection('staff_groups').updateOne(
        { _id: new ObjectId(sourceGroupId) },
        { $pull: { 'gratuityConfig.recipientGroupIds': new ObjectId(recipientGroupId) } } as any
      );

    // Remove sourceGroupId from recipient group's sourceGroupIds array
      await db.collection('staff_groups').updateOne(
        { _id: new ObjectId(recipientGroupId) },
        { $pull: { 'gratuityConfig.sourceGroupIds': new ObjectId(sourceGroupId) } } as any
      );
    }

    console.log(`✅ Successfully ${action === 'add' ? 'added' : 'removed'} bidirectional connection`);
  }

  static async updateStaffGroup(groupId: string, updates: {
    name?: string;
    description?: string;
    staffMemberIds?: string[];
    gratuityConfig?: any;
  }): Promise<StaffGroupWithId> {
    console.log('📝 Updating staff group:', groupId);
    const db = await this.getDb();
  
    // Get current group to compare connections
    const currentGroup = await db.collection<StaffGroupDocument>('staff_groups').findOne({_id: new ObjectId(groupId)});

    if (!currentGroup) {
     throw new Error('Group not found')
    }

    // Prepare the update document
    const updateDoc: any = {
      dateUpdated: new Date()
    };
  
    if (updates.name !== undefined) updateDoc.name = updates.name;
    if (updates.description !== undefined) updateDoc.description = updates.description;
    if (updates.staffMemberIds) {
      updateDoc.staffMemberIds = updates.staffMemberIds.map(id => new ObjectId(id));
    }
    if (updates.gratuityConfig) {
      updateDoc.gratuityConfig = {
        distributesGratuities: updates.gratuityConfig.distributesGratuities,
        contributionSource: updates.gratuityConfig.contributionSource,
        distributionBasis: updates.gratuityConfig.distributionBasis,
        sourceGroupIds: updates.gratuityConfig.sourceGroupIds?.map((id: string) => new ObjectId(id)) || [],
        recipientGroupIds: updates.gratuityConfig.recipientGroupIds?.map((id: string) => new ObjectId(id)) || [],
        distributionType: updates.gratuityConfig.distributionType,
        fixedAmount: updates.gratuityConfig.fixedAmount,
        percentage: updates.gratuityConfig.percentage,
        tipPoolId: updates.gratuityConfig.tipPoolId  // ✅ ADD THIS LINE
      };

    // HANDLE BIDIRECTIONAL CONNECTION UPDATES
      const currentRecipients = currentGroup.gratuityConfig.sourceGroupIds?.map(id => id.toString()) || [];
      const newRecipients = updates.gratuityConfig.recipientGroupIds || [];

      const currentSources = currentGroup.gratuityConfig.sourceGroupIds?.map(id => id.toString()) || [];
      const newSources = updates.gratuityConfig.sourceGroupIds || [];

      // UPDATE RECIPIENT CONNECTIONS
      const recipientsToAdd = newRecipients.filter(id => !currentRecipients.includes(id));
      const recipientsToRemove = currentRecipients.filter(id => !newRecipients.includes(id));

      // UPDATE SOURCE CONNECTIONS
      const sourcesToAdd = newSources.filter(id => !currentSources.includes(id));
      const sourcesToRemove = currentSources.filter(id => !newSources.includes(id));

      // Apply bidirectional updates
      for (const recipientId of recipientsToAdd) {
        await this.updateGroupConnections(groupId, recipientId, 'add');
      }
      for (const recipientId of recipientsToRemove) {
        await this.updateGroupConnections(groupId, recipientId, 'remove');
      }
      for (const sourceId of sourcesToAdd) {
        await this.updateGroupConnections(sourceId, groupId, 'add');
      }
      for (const sourceId of sourcesToRemove) {
        await this.updateGroupConnections(sourceId, groupId, 'remove');
      }
    }
    const result = await db.collection<StaffGroupDocument>('staff_groups')
      .updateOne({ _id: new ObjectId(groupId) }, { $set: updateDoc });
    
    if (result.matchedCount === 0) {
      throw new Error('Group not found');
    }
  
    // Return the updated group
    const updatedGroup = await db.collection<StaffGroupDocument>('staff_groups')
      .findOne({ _id: new ObjectId(groupId) });
    
    if (!updatedGroup) {
      throw new Error('Failed to retrieve updated group');
    }

    console.log('✅ Successfully updated staff group with bidirectional connections');
    return transformStaffGroup(updatedGroup);
  }
    

  static async deleteStaffGroup(groupId: string): Promise<void> {
    console.log('🗑️ Deleting staff group:', groupId);
    const db = await this.getDb();
    
    const result = await db.collection('staff_groups').deleteOne({ 
      _id: new ObjectId(groupId) 
    });
    
    if (result.deletedCount === 0) {
      throw new Error('Group not found or already deleted');
    }
    
    console.log('✅ Successfully deleted staff group');
  }

  static async seedInitialData(): Promise<void> {
  console.log('🌱 Checking if seeding is needed...');
  const db = await this.getDb();
  
  const existingCount = await db.collection('staff_members').countDocuments();
  console.log(`📊 Existing members: ${existingCount}`);
  
  if (existingCount > 0) {
    console.log('✅ Data already exists');
    return;
  }

  console.log('🌱 Starting seeding...');
  
  try {
    const { mockStaffMembers } = await import('../../../mock-data');
    console.log(`📋 Loaded ${mockStaffMembers.length} members from mock data`);
    
    const membersToInsert: StaffMemberDocument[] = mockStaffMembers.map(member => ({
      firstName: member.firstName,
      lastName: member.lastName,
      dateCreated: member.dateCreated,
    }));

    const result = await db.collection<StaffMemberDocument>('staff_members').insertMany(membersToInsert);
    console.log(`✅ Successfully seeded ${result.insertedCount} members`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}



  // static async seedInitialData(): Promise<void> {
  //   console.log('🌱 === STARTING SEED CHECK ===');
    
  //   try {
  //     const db = await this.getDb();
  //     console.log('✅ Database connected');
      
  //     // Check existing data
  //     const existingCount = await db.collection('staff_members').countDocuments();
  //     console.log(`📊 Existing members: ${existingCount}`);
      
  //     if (existingCount > 0) {
  //       console.log('✅ Data already exists, skipping seed');
  //       return;
  //     }

  //     console.log('🌱 No data found, starting seeding...');
      
  //     // Try to import mock data
  //     let mockStaffMembers;
  //     try {
  //       console.log('📁 Attempting to load mock-data.ts...');
  //       const mockData = await import('../../../mock-data');
  //       mockStaffMembers = mockData.mockStaffMembers;
  //       console.log(`✅ Loaded ${mockStaffMembers.length} members from mock data`);
  //     } catch (importError) {
  //       console.error('❌ Failed to import mock-data.ts:', importError);
        
  //       // Fallback: Create some test data
  //       console.log('📝 Creating fallback test data...');
  //       mockStaffMembers = [
  //         { firstName: 'John', lastName: 'Doe', dateCreated: new Date() },
  //         { firstName: 'Jane', lastName: 'Smith', dateCreated: new Date() },
  //         { firstName: 'Mike', lastName: 'Johnson', dateCreated: new Date() }
  //       ];
  //     }
      
  //     // Prepare documents for insertion
  //     const membersToInsert: StaffMemberDocument[] = mockStaffMembers.map(member => ({
  //       firstName: member.firstName,
  //       lastName: member.lastName,
  //       dateCreated: member.dateCreated
  //     }));

  //     console.log(`💾 Inserting ${membersToInsert.length} members...`);
      
  //     const result = await db.collection<StaffMemberDocument>('staff_members')
  //       .insertMany(membersToInsert);
      
  //     console.log(`✅ SUCCESS! Inserted ${result.insertedCount} members`);
  //     console.log(`🔑 Sample IDs: ${Object.values(result.insertedIds).slice(0, 3).join(', ')}`);

  //   } catch (error) {
  //     console.error('❌ SEEDING FAILED:', error);
  //     throw error;
  //   }
  // }

  static async forceSeedData(): Promise<void> {
    console.log('🔄 === FORCE SEEDING ===');
    
    try {
      const db = await this.getDb();
      
      // Clear existing
      console.log('🗑️ Clearing existing data...');
      const deleted = await db.collection('staff_members').deleteMany({});
      console.log(`🗑️ Deleted ${deleted.deletedCount} existing members`);
      
      // Re-seed
      await this.seedInitialData();
      
    } catch (error) {
      console.error('❌ Force seeding failed:', error);
      throw error;
    }
  }
}







