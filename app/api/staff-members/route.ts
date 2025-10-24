import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../lib/services/staffService';

// GET all staff members
export async function GET() {
  try {
    const members = await StaffService.getAllStaffMembers();
    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error('Error fetching staff members:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch staff members' },
      { status: 500 }
    );
  }
}

// POST create new staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, collectsSales } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, message: 'First name and last name are required' },
        { status: 400 }
      );
    }

    const member = await StaffService.createStaffMember(
      firstName,
      lastName,
      collectsSales || false
    );

    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (error) {
    console.error('Error creating staff member:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create staff member' },
      { status: 500 }
    );
  }
}