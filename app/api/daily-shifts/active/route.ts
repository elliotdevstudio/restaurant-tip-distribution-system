import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';
import { ShiftType } from '../../../../types';

// GET active shift
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const type = searchParams.get('type') as ShiftType | null;

    const shift = await StaffService.getActiveShift(
      date ? new Date(date) : undefined,
      type || undefined
    );

    if (!shift) {
      return NextResponse.json(
        { success: false, message: 'No active shift found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error('Error fetching active shift:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch active shift' },
      { status: 500 }
    );
  }
}