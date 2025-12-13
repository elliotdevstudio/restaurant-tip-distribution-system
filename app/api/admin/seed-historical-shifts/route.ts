import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConnection } from '../../../lib/mongodb';
import { StaffService } from '../../../lib/services/staffService';

/**
 * Recalculate Historical Shifts Endpoint
 * 
 * One-time use: Recalculates tip distributions for all historical shifts
 * - Fetches all shifts from database
 * - Gets current staff group configurations
 * - Runs tip distribution calculations
 * - Updates shifts with calculated tip-outs
 * 
 * Security: Requires CRON_SECRET header for authorization
 */

/**
 * Calculate recipient group tip-outs using the exact logic from demo page
 * Handles both pooled and standalone recipients
 */
function calculateRecipientGroupTipOuts(
  entries: any[],
  staffGroups: any[]
): Map<string, number> {
  const totals = new Map<string, number>();
  const recipientGroups = staffGroups.filter(g => !g.gratuityConfig.distributesGratuities);
  const poolGroups = new Map<string, typeof recipientGroups>();
  const standaloneGroups: typeof recipientGroups = [];
  
  // Separate pooled and standalone recipient groups
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
  
  // Process POOLED groups
  poolGroups.forEach((groupsInPool, poolId) => {
    const poolConfig = groupsInPool[0].gratuityConfig;
    let poolTotalTipOut = 0;
    
    // Find source distributor groups for this pool
    const sourceDistributorGroups = staffGroups.filter(g => 
      g.gratuityConfig.distributesGratuities && 
      groupsInPool.some(poolGroup => 
        g.gratuityConfig.recipientGroupIds?.includes(poolGroup.id)
      )
    );
    
    // Calculate total pool from all distributors
    sourceDistributorGroups.forEach(distributorGroup => {
      const distributionType = poolConfig.distributionType || 'percentage';
      const percentage = poolConfig.percentage;
      const fixedAmount = poolConfig.fixedAmount;
      const distributionBasis = distributorGroup.gratuityConfig.distributionBasis || 'gratuities';
      
      const distributorEntries = entries.filter(e => 
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
    
    // Calculate hours for each group in the pool
    let totalPoolHours = 0;
    const groupHoursMap = new Map<string, number>();
    
    groupsInPool.forEach(poolGroup => {
      const groupEntries = entries.filter(e => e.groupId === poolGroup.id);
      const groupHours = groupEntries.reduce((sum: number, e: any) => sum + (e.hoursWorked || 0), 0);
      groupHoursMap.set(poolGroup.id, groupHours);
      totalPoolHours += groupHours;
    });
    
    // Distribute pool proportionally by hours
    if (totalPoolHours > 0) {
      groupsInPool.forEach(poolGroup => {
        const groupHours = groupHoursMap.get(poolGroup.id) || 0;
        const groupShare = (groupHours / totalPoolHours) * validPoolTotal;
        const validGroupShare = isNaN(groupShare) ? 0 : parseFloat(groupShare.toFixed(2));
        totals.set(poolGroup.id, validGroupShare);
      });
    } else {
      // Equal split if no hours
      const equalShare = validPoolTotal / groupsInPool.length;
      groupsInPool.forEach(poolGroup => {
        totals.set(poolGroup.id, parseFloat(equalShare.toFixed(2)));
      });
    }
  });
  
  // Process STANDALONE groups
  standaloneGroups.forEach(recipientGroup => {
    let totalTipOut = 0;
    
    // Find source distributor groups
    const sourceDistributorGroups = staffGroups.filter(g => 
      g.gratuityConfig.distributesGratuities && 
      g.gratuityConfig.recipientGroupIds?.includes(recipientGroup.id)
    );
    
    sourceDistributorGroups.forEach(distributorGroup => {
      const distributionType = recipientGroup.gratuityConfig.distributionType || 'percentage';
      const percentage = recipientGroup.gratuityConfig.percentage;
      const fixedAmount = recipientGroup.gratuityConfig.fixedAmount;
      const distributionBasis = distributorGroup.gratuityConfig.distributionBasis || 'gratuities';
      
      const distributorEntries = entries.filter(e => 
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
}

/**
 * Calculate group hour totals for recipients
 */
function calculateGroupHourTotals(
  entries: any[],
  staffGroups: any[]
): Map<string, number> {
  const totals = new Map<string, number>();
  
  staffGroups
    .filter(g => !g.gratuityConfig.distributesGratuities)
    .forEach(group => {
      const groupEntries = entries.filter(e => e.groupId === group.id);
      const totalHours = groupEntries.reduce((sum, e) => sum + (e.hoursWorked || 0), 0);
      totals.set(group.id, totalHours);
    });
  
  return totals;
}

/**
 * Calculate tip distributions for all entries in a shift
 * Uses exact logic from demo page for consistency
 */
function calculateTipDistributions(
  entries: any[],
  staffGroups: any[]
): any[] {
  // Calculate group tip-outs using demo page logic
  const recipientGroupTipOuts = calculateRecipientGroupTipOuts(entries, staffGroups);
  const groupHourTotals = calculateGroupHourTotals(entries, staffGroups);

  // Update each entry with calculated amounts
  return entries.map(entry => {
    const updatedEntry = { ...entry };
    
    if (entry.isDistributor) {
      // Calculate distributor's tip-out amount
      const group = staffGroups.find(g => g.id === entry.groupId);
      if (!group || !group.gratuityConfig.recipientGroupIds || 
          group.gratuityConfig.recipientGroupIds.length === 0) {
        updatedEntry.tipOutAmount = 0;
        updatedEntry.totalTips = (entry.creditCardTips || 0) + (entry.cashTips || 0);
        updatedEntry.netTips = updatedEntry.totalTips;
        return updatedEntry;
      }

      const totalTips = (entry.creditCardTips || 0) + (entry.cashTips || 0);
      const salesAmount = entry.salesAmount || 0;
      const distributionBasis = group.gratuityConfig.distributionBasis || 'gratuities';

      let totalTipOut = 0;
      
      group.gratuityConfig.recipientGroupIds.forEach((recipientId: string) => {
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
      
      updatedEntry.tipOutAmount = parseFloat(totalTipOut.toFixed(2));
      updatedEntry.totalTips = totalTips;
      updatedEntry.netTips = parseFloat((totalTips - totalTipOut).toFixed(2));
      
    } else {
      // Calculate recipient's share
      const groupTipOut = recipientGroupTipOuts.get(entry.groupId) || 0;
      const groupHours = groupHourTotals.get(entry.groupId) || 0;
      
      if (groupHours === 0 || !groupHours) {
        updatedEntry.tipsReceived = 0;
      } else {
        const safeHoursWorked = entry.hoursWorked || 0;
        const safeTipOut = groupTipOut || 0;
        const safeGroupHours = groupHours || 1;

        const tipOutReceived = (safeHoursWorked / safeGroupHours) * safeTipOut;
        const finalTipOut = isNaN(tipOutReceived) ? 0 : tipOutReceived;

        updatedEntry.tipsReceived = parseFloat(finalTipOut.toFixed(2));
      }
    }
    
    return updatedEntry;
  });
}

export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error('❌ CRON_SECRET not configured');
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      );
    }

    const providedSecret = authHeader?.replace('Bearer ', '');
    
    if (providedSecret !== expectedSecret) {
      console.error('❌ Invalid CRON_SECRET');
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔑 Authorization verified');
    console.log('🔄 Starting historical shift recalculation...');

    // Get staff groups for tip distribution configurations
    const staffGroups = await StaffService.getAllStaffGroups();
    console.log(`📋 Loaded ${staffGroups.length} staff groups`);

    if (staffGroups.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No staff groups found' },
        { status: 400 }
      );
    }

    // Get database connection
    const db = await DatabaseConnection.getDatabase('staff_management');
    const shiftsCollection = db.collection('daily_shifts');

    // Fetch all shifts
    const shifts = await shiftsCollection.find({}).toArray();
    console.log(`📅 Found ${shifts.length} shifts to recalculate`);

    if (shifts.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No shifts found in database' },
        { status: 404 }
      );
    }

    // Recalculate each shift
    let updatedCount = 0;
    let errorCount = 0;

    for (const shift of shifts) {
      try {
        if (!shift.entries || shift.entries.length === 0) {
          continue;
        }

        // Run tip distribution calculations
        const updatedEntries = calculateTipDistributions(shift.entries, staffGroups);

        // Update shift in database
        await shiftsCollection.updateOne(
          { _id: shift._id },
          { 
            $set: { 
              entries: updatedEntries,
              updatedAt: new Date()
            } 
          }
        );

        updatedCount++;
      } catch (error) {
        console.error(`❌ Error recalculating shift ${shift.date}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ Recalculation complete: ${updatedCount} shifts updated, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: 'Historical shift recalculation completed',
      stats: {
        totalShifts: shifts.length,
        updatedShifts: updatedCount,
        errors: errorCount,
        staffGroups: staffGroups.length
      }
    });

  } catch (error) {
    console.error('❌ Recalculation failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Recalculation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}