import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';

// GET single staff member
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const members = await StaffService.getAllStaffMembers();
    const member = members.find(m => m.id === memberId);
    
    if (!member) {
      return NextResponse.json(
        { success: false, message: 'Staff member not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch staff member' },
      { status: 500 }
    );
  }
}

// PUT update staff member
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const body = await request.json();
    const { firstName, lastName } = body;
    
    const updatedMember = await StaffService.updateStaffMember(memberId, {
      firstName,
      lastName,
    });
    
    return NextResponse.json({
      success: true,
      member: updatedMember,
      message: 'Staff member updated successfully'
    });
  } catch (error) {
    console.error('Error updating staff member:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update staff member' },
      { status: 500 }
    );
  }
}

// DELETE staff member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    await StaffService.deleteStaffMember(memberId);
    
    return NextResponse.json({
      success: true,
      message: 'Staff member deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete staff member' },
      { status: 500 }
    );
  }
}