import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConnection } from '../../../lib/mongodb';
import { StaffService } from '../../../lib/services/staffService';

/**
 * One-time Historical Shift Seeding Endpoint
 * 
 * Creates shifts for the past 90 days using current staff members and groups
 * - Mondays & Tuesdays: Business closed (all zeros)
 * - Wed-Sun: Realistic sales and tip data
 * 
 * Security: Requires CRON_SECRET header for authorization
 */

function generateRandomHours(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function generateRealisticSales(): { salesAmount: number; creditCardTips: number } {
  const minSales = 949.99;
  const maxSales = 2499.99;
  const minTipPercent = 0.17;
  const maxTipPercent = 0.23;

  const salesAmount = parseFloat(
    (Math.random() * (maxSales - minSales) + minSales).toFixed(2)
  );

  const tipPercent = Math.random() * (maxTipPercent - minTipPercent) + minTipPercent;
  const creditCardTips = parseFloat((salesAmount * tipPercent).toFixed(2));

  return { salesAmount, creditCardTips };
}

function isBusinessClosed(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  return dayOfWeek === 1 || dayOfWeek === 2; // Monday or Tuesday
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
    console.log('🌱 Starting historical shift seeding...');

    // Get current staff members and groups
    const staffMembers = await StaffService.getAllStaffMembers();
    const staffGroups = await StaffService.getAllStaffGroups();

    if (staffMembers.length === 0 || staffGroups.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'No staff members or groups found. Please create staff first.' 
        },
        { status: 400 }
      );
    }

    console.log(`📋 Found ${staffMembers.length} staff members and ${staffGroups.length} groups`);

    // Get database connection
    const db = await DatabaseConnection.getDatabase('staff_management');
    const shiftsCollection = db.collection('daily_shifts');

    // Check if shifts already exist
    const existingCount = await shiftsCollection.countDocuments();
    if (existingCount > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Database already has ${existingCount} shifts. Clear them first if you want to reseed.` 
        },
        { status: 400 }
      );
    }

    // Generate shifts for past 90 days
    const shifts = [];
    const today = new Date();
    
    for (let i = 89; i >= 0; i--) {
      const shiftDate = new Date(today);
      shiftDate.setDate(today.getDate() - i);
      const dateString = shiftDate.toISOString().split('T')[0];
      
      const closed = isBusinessClosed(shiftDate);
      const entries: any[] = [];

      // Create entries for each staff member
      staffMembers.forEach(member => {
        // Find member's group
        const memberGroup = staffGroups.find(g => g.staffMemberIds.includes(member.id));
        
        if (memberGroup) {
          const isDistributor = memberGroup.gratuityConfig.distributesGratuities;

          if (closed) {
            // CLOSED DAY: All zeros
            entries.push({
              staffId: member.id,
              staffName: `${member.firstName} ${member.lastName}`,
              groupId: memberGroup.id,
              groupName: memberGroup.name,
              hoursWorked: 0,
              salesAmount: 0,
              creditCardTips: 0,
              cashTips: 0,
              isDistributor
            });
          } else {
            // OPEN DAY: Realistic data
            if (isDistributor) {
              const { salesAmount, creditCardTips } = generateRealisticSales();
              const hoursWorked = generateRandomHours(4, 8);
              
              entries.push({
                staffId: member.id,
                staffName: `${member.firstName} ${member.lastName}`,
                groupId: memberGroup.id,
                groupName: memberGroup.name,
                hoursWorked,
                salesAmount,
                creditCardTips,
                cashTips: 0,
                isDistributor: true
              });
            } else {
              // Recipients: just hours
              const hoursWorked = generateRandomHours(4, 8);
              
              entries.push({
                staffId: member.id,
                staffName: `${member.firstName} ${member.lastName}`,
                groupId: memberGroup.id,
                groupName: memberGroup.name,
                hoursWorked,
                isDistributor: false
              });
            }
          }
        }
      });

      // Create shift document
      shifts.push({
        date: dateString,
        type: 'FULL_DAY',
        entries,
        createdAt: new Date(shiftDate),
        updatedAt: new Date(shiftDate),
        status: closed ? 'closed' : 'open'
      });
    }

    // Insert all shifts
    console.log(`📦 Inserting ${shifts.length} shifts...`);
    const result = await shiftsCollection.insertMany(shifts);
    
    // Calculate stats
    const closedDays = shifts.filter(s => s.status === 'closed').length;
    const openDays = shifts.filter(s => s.status === 'open').length;
    
    const stats = {
      totalShifts: result.insertedCount,
      openDays,
      closedDays,
      dateRange: {
        oldest: shifts[0].date,
        newest: shifts[shifts.length - 1].date
      },
      staffMembers: staffMembers.length,
      staffGroups: staffGroups.length
    };

    console.log('✅ Historical seeding complete!', stats);

    return NextResponse.json({
      success: true,
      message: 'Historical shifts created successfully',
      stats
    });

  } catch (error) {
    console.error('❌ Historical seeding failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Seeding failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}