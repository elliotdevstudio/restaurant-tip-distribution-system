import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';

// GET group performance report
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const groupId = searchParams.get('groupId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!groupId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: 'groupId, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    const report = await StaffService.getGroupPerformanceReport(
      groupId,
      new Date(startDate),
      new Date(endDate)
    );

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('Error fetching group performance:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch group performance' },
      { status: 500 }
    );
  }
}