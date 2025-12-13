import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConnection } from '@/app/lib/mongodb';

/**
 * Daily Maintenance API Endpoint
 * 
 * This endpoint is called by GitHub Actions daily to:
 * 1. Delete shifts older than 90 days
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

    // Calculate cutoff date (90 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffDateString = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`🗑️  Deleting shifts older than ${cutoffDateString}...`);

    // Delete old shifts
    const deleteResult = await shiftsCollection.deleteMany({
      date: { $lt: cutoffDateString }
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} old shifts`);

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
      deletedCount: deleteResult.deletedCount
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