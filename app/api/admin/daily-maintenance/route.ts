import { NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';

/**
 * Daily maintenance endpoint
 * - Deletes shifts older than 90 days
 * - Creates today's shift if it doesn't exist
 * 
 * This should be called once per day by a cron job
 */
export async function POST(request: Request) {
  try {
    // Optional: Add authentication/secret key for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }
    
    console.log('⏰ Running daily maintenance...');
    
    await StaffService.performDailyMaintenance();
    
    return NextResponse.json({
      success: true,
      message: 'Daily maintenance completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Daily maintenance failed:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET endpoint to check last maintenance run
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Daily maintenance endpoint is active',
    timestamp: new Date().toISOString()
  });
}
