import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../lib/services/staffService';
import { ShiftType } from '../../../types';

// GET daily shifts (with optional date range)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const type = searchParams.get('type') as ShiftType | null;

    if (startDate && endDate) {
      const shifts = await StaffService.getDailyShiftsByDateRange(
        new Date(startDate),
        new Date(endDate),
        type || undefined
      );
      return NextResponse.json({ success: true, shifts });
    }

    // If no date range, get recent shifts (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date();

    const shifts = await StaffService.getDailyShiftsByDateRange(
      thirtyDaysAgo,
      today,
      type || undefined
    );

    return NextResponse.json({ success: true, shifts });
  } catch (error) {
    console.error('Error fetching daily shifts:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch daily shifts' },
      { status: 500 }
    );
  }
}

// POST create new daily shift

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, type, entries } = body;  // ADD entries here

    if (!date || !type) {
      return NextResponse.json(
        { success: false, message: 'Date and type are required' },
        { status: 400 }
      );
    }

    if (!['AM', 'PM', 'FULL_DAY'].includes(type)) {
      return NextResponse.json(
        { success: false, message: 'Type must be AM, PM, or FULL_DAY' },
        { status: 400 }
      );
    }

    const shift = await StaffService.createDailyShift(
      new Date(date), 
      type,
      entries  // PASS entries to the service
    );
    
    return NextResponse.json({ 
      success: true, 
      shift,
      message: entries ? 'Daily shift updated successfully' : 'Daily shift created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating daily shift:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create daily shift' },
      { status: 500 }
    );
  }
}
