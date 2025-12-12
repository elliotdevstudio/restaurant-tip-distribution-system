import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';

// GET single daily shift
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  try {
    const { shiftId } = await params;
    const shift = await StaffService.getDailyShiftById(shiftId);
    if (!shift) {
      return NextResponse.json(
        { success: false, message: 'Shift not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error('Error fetching daily shift:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch daily shift' },
      { status: 500 }
    );
  }
}

// DELETE daily shift
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  try {
    const { shiftId } = await params;
    await StaffService.deleteDailyShift(shiftId);
    return NextResponse.json({
      success: true,
      message: 'Daily shift deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting daily shift:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete daily shift' },
      { status: 500 }
    );
  }
}