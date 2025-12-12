import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';
import { ShiftType } from '../../../../types';

// GET active shift
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');
    const typeParam = searchParams.get('type') as ShiftType | null;
    
    // Default to today if no date provided
    const date = dateParam ? new Date(dateParam) : new Date();
    const type: ShiftType = typeParam || 'FULL_DAY';
    
    const shift = await StaffService.getDailyShift(date, type);
    
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