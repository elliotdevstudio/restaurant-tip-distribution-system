import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../../lib/services/staffService';

// GET single staff group
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params; // ✅ Await params
    const groups = await StaffService.getAllStaffGroups();
    const group = groups.find(g => g.id === groupId);

    if (!group) {
      return NextResponse.json(
        { success: false, message: 'Group not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      group,
      success: true
    });
  } catch (error) {
    console.error('Error fetching staff group:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch group' },
      { status: 500 }
    );
  }
}

// UPDATE staff group
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params; // ✅ Await params
    const updates = await request.json();
    console.log('📨 Received group update request:', { groupId, updates });

    const updatedGroup = await StaffService.updateStaffGroup(groupId, updates);

    return NextResponse.json({
      group: updatedGroup,
      success: true,
      message: 'Group updated successfully'
    });

  } catch (error) {
    console.error('Error updating staff group:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update group'
      },
      { status: 500 }
    );
  }
}

// DELETE staff group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const { groupId } = await params; // ✅ Await params
    await StaffService.deleteStaffGroup(groupId);

    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting staff group:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to delete group'
      },
      { status: 500 }
    );
  }
}
