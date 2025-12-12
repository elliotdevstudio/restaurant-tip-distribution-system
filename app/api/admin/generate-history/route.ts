import { NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';

/**
 * Generate 90 days of historical shift data
 * Call once to populate demo database
 */
export async function POST() {
  try {
    console.log('🚀 Starting historical data generation...');
    
    // First, ensure we have staff and groups
    const members = await StaffService.getAllStaffMembers();
    const groups = await StaffService.getAllStaffGroups();
    
    if (members.length === 0 || groups.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Please create staff members and groups first'
      }, { status: 400 });
    }
    
    // Generate 90 days of data
    await StaffService.generateHistoricalShifts();
    
    return NextResponse.json({
      success: true,
      message: 'Generated 90 days of historical shift data',
      staffCount: members.length,
      groupCount: groups.length
    });
    
  } catch (error) {
    console.error('❌ Failed to generate historical data:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
