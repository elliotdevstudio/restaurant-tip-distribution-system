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

// CREATE

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

  // UPDATE

  static async updateStaffMember(
    memberId: string,
    updates: { firstName: string; lastName: string }
  ): Promise<StaffMemberWithId> {
    const db = await this.getDb();
    const { firstName, lastName } = updates;
    
    const result = await db.collection<StaffMemberDocument>('staff_members').findOneAndUpdate(
      { _id: new ObjectId(memberId) },
      { 
        $set: { 
          firstName, 
          lastName,
          updatedAt: new Date()
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result) {
      throw new Error('Staff member not found');
    }
    
    return {
      id: result._id.toString(),
      firstName: result.firstName,
      lastName: result.lastName,
      dateCreated: result.dateCreated,
    };
  }

  // DELETE

  static async deleteStaffMember(memberId: string): Promise<void> {
    const db = await this.getDb();
    
    const result = await db.collection<StaffMemberDocument>('staff_members').deleteOne({
      _id: new ObjectId(memberId)
    });
    
    if (result.deletedCount === 0) {
      throw new Error('Staff member not found');
    }
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

  // Replace the createDailyShift method in app/lib/services/staffService.ts with this:

static async createDailyShift(date: Date, type: ShiftType, entries?: any[]): Promise<DailyShiftWithId> {
  console.log(`📅 Creating/updating daily shift: ${type} on ${date.toISOString()}`);
  const db = await this.getDb();
  
  // Format date as YYYY-MM-DD string (matching working documents)
  const dateString = date.toISOString().split('T')[0];
  
  console.log(`📅 Date string for storage: ${dateString}`);
  console.log(`📋 Entries to save: ${entries?.length || 0}`);

  // Clean up any old-format dates for this date (Date objects instead of strings)
  await db.collection('daily_shifts').deleteMany({
    date: { $type: 'date' },  // Any document where date is a Date object
    type
  });
  // UPSERT: Update if exists, create if not
  const result = await db.collection<DailyShiftDocument>('daily_shifts').findOneAndUpdate(
    { 
      date: dateString,  // Query by string date
      type 
    },
    {
      $set: {
        date: dateString,      // Store as string "YYYY-MM-DD"
        type,
        status: 'open',        // Changed from 'draft' to 'open'
        entries: entries || [], // Changed from "staffData" to "entries"
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { 
      upsert: true,
      returnDocument: 'after'
    }
  );
  
  if (!result) {
    throw new Error('Failed to create/update daily shift');
  }
  
  console.log(`✅ Shift created/updated for ${dateString} with ${result.entries?.length || 0} entries`);
  return transformDailyShift(result);
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

  static async getDailyShiftsByDateRange(
    startDate: Date,
    endDate: Date,
    type?: ShiftType
  ): Promise<DailyShiftWithId[]> {
    console.log(`📅 Fetching shifts from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    const db = await this.getDb();
    
    // Convert to UTC midnight and format as YYYY-MM-DD strings
    const utcStart = new Date(startDate);
    utcStart.setUTCHours(0, 0, 0, 0);this.calculateTipOutForDistributor
    const startDateString = utcStart.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const utcEnd = new Date(endDate);
    utcEnd.setUTCHours(23, 59, 59, 999);
    const endDateString = utcEnd.toISOString().split('T')[0]; // YYYY-MM-DD
    
    console.log(`📅 Query range: ${startDateString} to ${endDateString}`);
    
    const query: any = {
      date: {
        $gte: startDateString,  // String comparison
        $lte: endDateString     // String comparison
      }
    };
    
    if (type) {
      query.type = type;
    }
    
    const shifts = await db.collection<DailyShiftDocument>('daily_shifts')
      .find(query)
      .sort({ date: 1 })
      .toArray();
    
    console.log(`✅ Found ${shifts.length} shifts in date range`);
    return shifts.map(transformDailyShift);
    }

// ============================================
// REPORTING / ANALYTICS METHODS
// ============================================

  static async getStaffMemberShiftHistory(
    staffId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    date: Date | string;
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
    const staffEntry = (shift.staffData || []) .find(s => s.staffId.toString() === staffId);
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
      const groupSummary = (shift.groupSummaries || []).find(g => g.groupId.toString() === groupId);
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
      const recipientsToAdd = newRecipients.filter((id: string) => !currentRecipients.includes(id));
      const recipientsToRemove = currentRecipients.filter(id => !newRecipients.includes(id));

      // UPDATE SOURCE CONNECTIONS
      const sourcesToAdd = newSources.filter((id: string) => !currentSources.includes(id));
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
  const objectId = new ObjectId(groupId);
  
  try {
    // STEP 1: Remove this group from all other groups' recipientGroupIds
    console.log(`  Removing ${groupId} from recipientGroupIds in other groups...`);
    const removeFromRecipients = await db.collection('staff_groups').updateMany(
      { 'gratuityConfig.recipientGroupIds': objectId },
      { $pull: { 'gratuityConfig.recipientGroupIds': objectId } } as any
    );
    console.log(`  ✓ Updated ${removeFromRecipients.modifiedCount} groups (removed from recipientGroupIds)`);
    
    // STEP 2: Remove this group from all other groups' sourceGroupIds
    console.log(`  Removing ${groupId} from sourceGroupIds in other groups...`);
    const removeFromSources = await db.collection('staff_groups').updateMany(
      { 'gratuityConfig.sourceGroupIds': objectId },
      { $pull: { 'gratuityConfig.sourceGroupIds': objectId } } as any
    );
    console.log(`  ✓ Updated ${removeFromSources.modifiedCount} groups (removed from sourceGroupIds)`);
    
    // STEP 3: Delete the group itself
    console.log(`  Deleting group document...`);
    const deleteResult = await db.collection('staff_groups').deleteOne({ 
      _id: objectId 
    });
    
    if (deleteResult.deletedCount === 0) {
      throw new Error('Group not found or already deleted');
    }
    
    console.log('✅ Successfully deleted staff group and cleaned up all references');
  } catch (error) {
    console.error('❌ Error deleting staff group:', error);
    throw error;
  }
}

  
  /**
   * Generate a single shift for a specific date
   */
  private static async generateShiftForDate(
    date: Date,
    staffMembers: any[],
    staffGroups: any[],
    isClosed: boolean
  ): Promise<any> {
    
    if (isClosed) {
      // Closed day - all zeros
      return {
        date: date,
        type: 'FULL_DAY',
        status: 'closed',
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
        createdAt: date,
        updatedAt: date
      };
    }
    
    // Open day - generate realistic data
    const staffData: any[] = [];
    const groupSummariesMap = new Map<string, any>();
    
    // Generate data for each staff member
    staffMembers.forEach(member => {
      const memberGroups = staffGroups.filter(g => 
        g.staffMemberIds.includes(member.id)
      );
      
      if (memberGroups.length === 0) return;
      
      const group = memberGroups[0];
      const isDistributor = group.gratuityConfig.distributesGratuities;
      
      // Random hours worked (4-8 hours, with some variation)
      const hoursWorked = this.generateRandomHours(4, 8);
      
      const staffEntry: any = {
        staffId: member.id,
        staffName: `${member.firstName} ${member.lastName}`,
        groupId: group.id,
        groupName: group.name,
        hoursWorked: hoursWorked,
        isDistributor: isDistributor
      };
      
      if (isDistributor) {
        // Generate sales and tips
        const salesData = this.generateRealisticSalesData();
        staffEntry.salesAmount = salesData.salesAmount;
        staffEntry.creditCardTips = salesData.creditCardTips;
        staffEntry.cashTips = salesData.cashTips || 0;
        staffEntry.totalTips = salesData.creditCardTips + (salesData.cashTips || 0);
        
        // Calculate tip out
        staffEntry.tipOutAmount = this.calculateTipOutForDistributor(
          salesData.salesAmount,
          staffEntry.totalTips,
          group,
          staffGroups
        );
        
        staffEntry.netTips = staffEntry.totalTips - staffEntry.tipOutAmount;
      }
      
      staffData.push(staffEntry);
      
      // Update group summaries
      if (!groupSummariesMap.has(group.id)) {
        groupSummariesMap.set(group.id, {
          groupId: group.id,
          groupName: group.name,
          totalTips: 0,
          totalHours: 0,
          memberCount: 0
        });
      }
      
      const summary = groupSummariesMap.get(group.id);
      summary.totalHours += hoursWorked;
      summary.memberCount += 1;
      if (staffEntry.totalTips) {
        summary.totalTips += staffEntry.totalTips;
      }
    });
    
    // Calculate shift totals
    const shiftTotals = {
      totalTipsCollected: staffData
        .filter(s => s.isDistributor)
        .reduce((sum, s) => sum + (s.totalTips || 0), 0),
      totalDistributed: staffData
        .filter(s => s.isDistributor)
        .reduce((sum, s) => sum + (s.tipOutAmount || 0), 0),
      totalKeptByDistributors: staffData
        .filter(s => s.isDistributor)
        .reduce((sum, s) => sum + (s.netTips || 0), 0),
      totalReceivedByRecipients: 0, // Would need to calculate based on recipient shares
      totalHoursWorked: staffData.reduce((sum, s) => sum + s.hoursWorked, 0),
      activeStaffCount: staffData.length,
      activeGroupCount: groupSummariesMap.size
    };
    
    return {
      date: date,
      type: 'FULL_DAY',
      status: 'completed',
      staffData: staffData,
      groupSummaries: Array.from(groupSummariesMap.values()),
      shiftTotals: shiftTotals,
      createdAt: date,
      updatedAt: date
    };
  }
  
  /**
   * Generate realistic sales data for a distributor
   */
  private static generateRealisticSalesData(): {
    salesAmount: number;
    creditCardTips: number;
    cashTips: number;
    tipPercent: number;
  } {
    const minSales = 949.99;
    const maxSales = 2499.99;
    const minTipPercent = 0.17;
    const maxTipPercent = 0.23;
  
    const salesAmount = parseFloat(
      (Math.random() * (maxSales - minSales) + minSales).toFixed(2)
    );
  
    const tipPercent = Math.random() * (maxTipPercent - minTipPercent) + minTipPercent;
    const creditCardTips = parseFloat((salesAmount * tipPercent).toFixed(2));
    const cashTips = 0;
  
    return { 
      salesAmount, 
      creditCardTips, 
      cashTips,
      tipPercent 
    };
  }
  
  /**
   * Generate random hours worked
   */
  private static generateRandomHours(min: number, max: number): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
  }
  
  /**
   * Calculate tip out for a distributor (import from tipCalculations.ts)
   */
  private static calculateTipOutForDistributor(
  salesAmount: number,
  totalTips: number,
  distributorGroup: any,
  allGroups: any[]
    ): number {
      let totalTipOut = 0;
      
      if (!distributorGroup.gratuityConfig?.recipientGroupIds) {
        return 0;
      }
      
      const processedPools = new Set<string>(); // Track pools we've already counted
      
      distributorGroup.gratuityConfig.recipientGroupIds.forEach((recipientId: string) => {
        const recipientGroup = allGroups.find((g: any) => 
          g._id?.toString() === recipientId || g.id === recipientId
        );
        if (!recipientGroup) return;
        
        const tipPoolId = recipientGroup.gratuityConfig?.tipPoolId;
        
        // If this group is in a pool, check if we've already processed this pool
        if (tipPoolId) {
          if (processedPools.has(tipPoolId)) {
            return; // Skip - already counted this pool
          }
          processedPools.add(tipPoolId);
        }
        
        const distributionType = recipientGroup.gratuityConfig?.distributionType || 'percentage';
        const percentage = recipientGroup.gratuityConfig?.percentage;
        const fixedAmount = recipientGroup.gratuityConfig?.fixedAmount;
        const distributionBasis = distributorGroup.gratuityConfig?.distributionBasis || 'gratuities';
        
        if (distributionType === 'fixed') {
          totalTipOut += fixedAmount || 0;
        } else if (distributionType === 'percentage' && percentage) {
          const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
          totalTipOut += baseAmount * (percentage / 100);
        }
      });
      
      return parseFloat(totalTipOut.toFixed(2));
    }
  
  /**
   * Daily maintenance: Remove shifts older than 90 days and create today's shift
   */
  static async performDailyMaintenance(): Promise<void> {
    const db = await this.getDb();
    
    console.log('🔧 Running daily maintenance...');
    
    // 1. Delete shifts older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);
    
    const deleteResult = await db.collection('daily_shifts').deleteMany({
      date: { $lt: ninetyDaysAgo }
    });
    
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} shifts older than 90 days`);
    
    // 2. Check if today's shift already exists
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingShift = await db.collection('daily_shifts').findOne({ date: today });
    
    if (existingShift) {
      console.log('✅ Today\'s shift already exists, skipping creation');
      return;
    }
    
    // 3. Create today's shift
    const staffMembers = await this.getAllStaffMembers();
    const staffGroups = await this.getAllStaffGroups();
    
    const dayOfWeek = today.getDay();
    const isClosed = dayOfWeek === 1 || dayOfWeek === 2; // Monday or Tuesday
    
    const todayShift = await this.generateShiftForDate(
      today,
      staffMembers,
      staffGroups,
      isClosed
    );
    
    await db.collection('daily_shifts').insertOne(todayShift);
    
    console.log(`✅ Created shift for ${today.toISOString().split('T')[0]} (${isClosed ? 'CLOSED' : 'OPEN'})`);
  }
  
  }
  
  // static async seedInitialData(): Promise<void> {
  // console.log('🌱 Checking if seeding is needed...');  
  // const db = await this.getDb();
  
  // const existingCount = await db.collection('staff_members').countDocuments();
  // console.log(`📊 Existing members: ${existingCount}`);
  
  // if (existingCount > 0) {
  //   console.log('✅ Data already exists');  
  //   return;
  // }

  // console.log('🌱 Starting seeding...');
  
  // try {
  //   const { mockStaffMembers } = await import('../../../mock-data');  
  //   console.log(`📋 Loaded ${mockStaffMembers.length} members from mock data`);
    
  //   const membersToInsert: StaffMemberDocument[] = mockStaffMembers.map(member => ({
  //     firstName: member.firstName,  
  //     lastName: member.lastName,
  //     dateCreated: member.dateCreated,
  //   }));

  //   const result = await db.collection<StaffMemberDocument>('staff_members').insertMany(membersToInsert);
  //   console.log(`✅ Successfully seeded ${result.insertedCount} members`);
    
  // } catch (error) {
  //   console.error('❌ Seeding failed:', error);  
  //   throw error;
  // }
  // }

  // static async forceSeedData(): Promise<void> {
  //   console.log('🔄 === FORCE SEEDING ===');  
    
  //   try {
  //     const db = await this.getDb();  
      
  //     // Clear existing
  //     console.log('🗑️ Clearing existing data...');
  //     const deleted = await db.collection('staff_members').deleteMany({});
  //     console.log(`🗑️ Deleted ${deleted.deletedCount} existing members`);
      
  //     // Re-seed
  //     await this.seedInitialData();
      
  //   } catch (error) {
  //     console.error('❌ Force seeding failed:', error);  
  //     throw error;
  //   }
  // }
  /**
 * Generate 90 days of historical shift data for demo purposes 
 * Monday/Tuesday = closed (all zeros)
 * Wed-Sun = realistic data
 */  
