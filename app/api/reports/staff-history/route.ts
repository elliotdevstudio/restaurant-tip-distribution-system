import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';

// GET staff member shift history
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const staffId = searchParams.get('staffId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!staffId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: 'staffId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const history = await StaffService.getStaffMemberShiftHistory(
      staffId,
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching staff history:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch staff history' },
      { status: 500 }
    );
  }
}