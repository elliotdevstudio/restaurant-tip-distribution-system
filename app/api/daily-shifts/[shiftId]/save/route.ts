import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../../lib/services/staffService';

// POST save complete daily shift data
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shiftId: string }> }
) {
  try {
    const { shiftId } = await params;
    const body = await request.json();
    const { staffData, groupSummaries, shiftTotals } = body;
    
    if (!staffData || !groupSummaries || !shiftTotals) {
      return NextResponse.json(
        { success: false, message: 'Missing required data (staffData, groupSummaries, or shiftTotals)' },
        { status: 400 }
      );
    }
    
    const updatedShift = await StaffService.saveCompleteDailyShift(
      shiftId,
      { staffData, groupSummaries, shiftTotals }
    );
    
    return NextResponse.json({
      success: true,
      shift: updatedShift,
      message: 'Daily shift data saved successfully'
    });
  } catch (error) {
    console.error('Error saving daily shift:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save daily shift' },
      { status: 500 }
    );
  }
}