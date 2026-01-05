import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConnection } from '../../../lib/mongodb';

/**
 * Backfill Missing Shifts Endpoint
 * 
 * Fills in any missing dates in the last 90 days with empty shifts
 * Excludes Christmas Day (Dec 25) and New Year's Day (Jan 1)
 * 
 * Security: Requires CRON_SECRET header for authorization
 */
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

    // Calculate date range (last 90 days)
    const today = new Date();
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(today.getDate() - 90);

    console.log(`📅 Backfilling shifts from ${ninetyDaysAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);

    // Get all existing shift dates
    const existingShifts = await shiftsCollection
      .find(
        {
          date: {
            $gte: ninetyDaysAgo.toISOString().split('T')[0],  
            $lte: today.toISOString().split('T')[0]
          }
        },
        { projection: { date: 1 } }
      )
      .toArray();

    const existingDates = new Set(
      existingShifts.map(shift => {
    // Handle both Date objects and strings
      if (typeof shift.date === 'string') {
        return shift.date; // Already a string
      }
        return shift.date.toISOString().split('T')[0]; // Convert Date to string
      })
    );

    console.log(`📊 Found ${existingDates.size} existing shifts`);

    // Helper: Check if date is a holiday (closed day)
    const isHoliday = (date: Date): boolean => {
      const month = date.getMonth() + 1; // 1-indexed
      const day = date.getDate();
      
      // Christmas Day: December 25
      if (month === 12 && day === 25) return true;
      
      // New Year's Day: January 1
      if (month === 1 && day === 1) return true;
      
      return false;
    };

    // Generate all dates in range
    const missingShifts = [];
    let currentDate = new Date(ninetyDaysAgo);
    
    while (currentDate <= today) {
      const dateString = currentDate.toISOString().split('T')[0];
      
      // Skip if shift already exists
      if (!existingDates.has(dateString)) {
        // Skip if it's a holiday (business closed)
        if (!isHoliday(currentDate)) {
          missingShifts.push({
            date: currentDate.toISOString().split('T')[0],
            type: 'FULL_DAY',
            entries: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'open'
          });
        } else {
          console.log(`🎄 Skipping holiday: ${dateString}`);
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`✨ Found ${missingShifts.length} missing dates to backfill`);

    // Insert missing shifts
    let insertedCount = 0;
    if (missingShifts.length > 0) {
      const result = await shiftsCollection.insertMany(missingShifts);
      insertedCount = result.insertedCount;
      console.log(`✅ Inserted ${insertedCount} missing shifts`);
    } else {
      console.log('ℹ️  No missing shifts to backfill');
    }

    // Get final stats
    const totalShifts = await shiftsCollection.countDocuments();

    return NextResponse.json({
      success: true,
      message: 'Backfill completed successfully',
      stats: {
        totalShifts,
        existingShifts: existingDates.size,
        backfilledShifts: insertedCount,
        holidaysSkipped: missingShifts.length > 0 ? 
          (90 - existingDates.size - insertedCount) : 0
      }
    });

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Backfill failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}