import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConnection } from '../../../lib/mongodb';

/**
 * Daily Maintenance API Endpoint
 * 
 * This endpoint is called by GitHub Actions daily to:
 * 1. Delete shifts older than 90 days
 * 2. Create today's shift WITH generated demo data
 * 
 * Security: Requires CRON_SECRET header for authorization
 */

// ============================================
// DATA GENERATION HELPERS (same logic as demo page)
// ============================================

function generateRandomHours(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function generateRealisticDistributorData() {
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

  return { salesAmount, creditCardTips, cashTips };
}

function calculateTipOutForDistributor(
  entry: any,
  distributorGroup: any,
  allGroups: any[]
): number {
  if (!distributorGroup.gratuityConfig?.recipientGroupIds?.length) {
    return 0;
  }

  let totalTipOut = 0;
  const totalTips = (entry.creditCardTips || 0) + (entry.cashTips || 0);
  const salesAmount = entry.salesAmount || 0;

  distributorGroup.gratuityConfig.recipientGroupIds.forEach((recipientId: string) => {
    const recipientGroup = allGroups.find((g: any) => g._id.toString() === recipientId);
    if (!recipientGroup) return;

    const percentage = recipientGroup.gratuityConfig?.percentage || 0;
    const distributionBasis = distributorGroup.gratuityConfig?.distributionBasis || 'gratuities';

    if (percentage > 0) {
      const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
      totalTipOut += (baseAmount * percentage) / 100;
    }
  });

  return parseFloat(totalTipOut.toFixed(2));
}

function calculateRecipientTipOuts(
  entries: any[],
  staffGroups: any[]
): Map<string, number> {
  const totals = new Map<string, number>();

  // Get all recipient groups
  const recipientGroups = staffGroups.filter(
    (g: any) => !g.gratuityConfig?.distributesGratuities
  );

  recipientGroups.forEach((recipientGroup: any) => {
    let totalTipOut = 0;
    const recipientGroupId = recipientGroup._id.toString();

    // Find all distributor groups that tip out to this recipient
    const distributorGroups = staffGroups.filter(
      (g: any) =>
        g.gratuityConfig?.distributesGratuities &&
        g.gratuityConfig?.recipientGroupIds?.includes(recipientGroupId)
    );

    distributorGroups.forEach((distributorGroup: any) => {
      const distributorEntries = entries.filter(
        (e: any) => e.groupId === distributorGroup._id.toString() && e.isDistributor
      );

      const percentage = recipientGroup.gratuityConfig?.percentage || 0;
      const distributionBasis = distributorGroup.gratuityConfig?.distributionBasis || 'gratuities';

      distributorEntries.forEach((entry: any) => {
        const totalTips = (entry.creditCardTips || 0) + (entry.cashTips || 0);
        const salesAmount = entry.salesAmount || 0;
        const baseAmount = distributionBasis === 'sales' ? salesAmount : totalTips;
        totalTipOut += (baseAmount * percentage) / 100;
      });
    });

    totals.set(recipientGroupId, parseFloat(totalTipOut.toFixed(2)));
  });

  return totals;
}

function generateShiftEntries(staffMembers: any[], staffGroups: any[]): any[] {
  const entries: any[] = [];

  staffMembers.forEach((member: any) => {
    const memberGroups = staffGroups.filter((g: any) =>
      g.staffMemberIds?.some((id: any) => id.toString() === member._id.toString())
    );

    if (memberGroups.length > 0) {
      const group = memberGroups[0];
      const isDistributor = group.gratuityConfig?.distributesGratuities || false;

      const entry: any = {
        staffId: member._id.toString(),
        staffName: `${member.firstName} ${member.lastName}`,
        groupId: group._id.toString(),
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
        entry.tipOutAmount = calculateTipOutForDistributor(entry, group, staffGroups);
        entry.netTips = entry.totalTips - entry.tipOutAmount;
      }

      entries.push(entry);
    }
  });

  // Calculate tipsReceived for recipients
  const recipientTipOuts = calculateRecipientTipOuts(entries, staffGroups);

  entries.forEach((entry: any) => {
    if (!entry.isDistributor) {
      const groupTipOut = recipientTipOuts.get(entry.groupId) || 0;
      const groupEntries = entries.filter(
        (e: any) => e.groupId === entry.groupId && !e.isDistributor
      );
      const totalGroupHours = groupEntries.reduce((sum: number, e: any) => sum + e.hoursWorked, 0);

      if (totalGroupHours > 0) {
        entry.tipsReceived = parseFloat(
          ((entry.hoursWorked / totalGroupHours) * groupTipOut).toFixed(2)
        );
      } else {
        entry.tipsReceived = 0;
      }
    }
  });

  return entries;
}

// ============================================
// HOLIDAY CHECK
// ============================================

function isHoliday(dateString: string): boolean {
  // dateString format: "YYYY-MM-DD"
  const monthDay = dateString.slice(5); // "MM-DD"
  
  const holidays = [
    '12-25', // Christmas Day
    '01-01', // New Year's Day
  ];
  
  return holidays.includes(monthDay);
}

// ============================================
// MAIN ENDPOINT
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error('❌ CRON_SECRET not configured in environment variables');
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      );
    }

    const providedSecret = authHeader?.replace('Bearer ', '');

    if (providedSecret !== expectedSecret) {
      console.error('❌ Invalid CRON_SECRET provided');
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔑 Authorization verified');

    // Connect to database
    const db = await DatabaseConnection.getDatabase('staff_management');
    const shiftsCollection = db.collection('daily_shifts');
    const staffMembersCollection = db.collection('staff_members');
    const staffGroupsCollection = db.collection('staff_groups');

    // Calculate cutoff date (90 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0];

    console.log(`🗑️  Deleting shifts older than ${cutoffDateString}...`);

    // Delete old shifts
    const deleteResult = await shiftsCollection.deleteMany({
      date: { $lt: cutoffDateString }
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} old shifts`);

    // Create today's shift if it doesn't exist
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Checking for today's shift (${today})...`);

    const existingShift = await shiftsCollection.findOne({ date: today });

    let shiftCreated = false;
    let entriesGenerated = 0;

    if (!existingShift) {
      // Check if today is a holiday
      if (isHoliday(today)) {
        console.log(`🎄 ${today} is a holiday - creating empty shift (business closed)`);
        
        const newShift = {
          date: today,
          type: 'FULL_DAY',
          entries: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          status: 'open'
        };

        await shiftsCollection.insertOne(newShift);
        shiftCreated = true;
      } else {
        // Fetch staff members and groups
        const staffMembers = await staffMembersCollection.find({}).toArray();
        const staffGroups = await staffGroupsCollection.find({}).toArray();

        console.log(`👥 Found ${staffMembers.length} staff members and ${staffGroups.length} groups`);

        if (staffMembers.length > 0 && staffGroups.length > 0) {
          // Generate realistic demo data
          const entries = generateShiftEntries(staffMembers, staffGroups);
          entriesGenerated = entries.length;

          const newShift = {
            date: today,
            type: 'FULL_DAY',
            entries: entries,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'open'
          };

          await shiftsCollection.insertOne(newShift);
          console.log(`✅ Created shift for ${today} with ${entries.length} entries`);
          shiftCreated = true;
        } else {
          // No staff/groups - create empty shift
          console.log(`⚠️ No staff members or groups found - creating empty shift`);

          const newShift = {
            date: today,
            type: 'FULL_DAY',
            entries: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'open'
          };

          await shiftsCollection.insertOne(newShift);
          shiftCreated = true;
        }
      }
    } else {
      console.log(`ℹ️  Shift for ${today} already exists with ${existingShift.entries?.length || 0} entries`);
    }

    // Get current stats
    const totalShifts = await shiftsCollection.countDocuments();
    const oldestShift = await shiftsCollection
      .find()
      .sort({ date: 1 })
      .limit(1)
      .toArray();
    const newestShift = await shiftsCollection
      .find()
      .sort({ date: -1 })
      .limit(1)
      .toArray();

    const stats = {
      totalShifts,
      oldestDate: oldestShift[0]?.date || null,
      newestDate: newestShift[0]?.date || null,
      deletedCount: deleteResult.deletedCount,
      shiftCreated,
      entriesGenerated,
      isHoliday: isHoliday(today)
    };

    console.log('📊 Maintenance stats:', stats);

    return NextResponse.json({
      success: true,
      message: 'Daily maintenance completed successfully',
      stats
    });

  } catch (error) {
    console.error('❌ Daily maintenance failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Maintenance failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
