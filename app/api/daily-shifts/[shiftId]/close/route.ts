import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../../lib/services/staffService';

// POST close a daily shift
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  try {
    const { shiftId } = await params;
    const closedShift = await StaffService.closeDailyShift(shiftId);
    return NextResponse.json({ 
      success: true, 
      shift: closedShift,
      message: 'Daily shift closed successfully'
    });
  } catch (error) {
    console.error('Error closing daily shift:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to close daily shift' },
      { status: 500 }
    );
  }
}