import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../../lib/services/staffService';
import { CreateStaffGroupRequest, CreateStaffGroupResponse } from '../../../../types';

// GET ALL 
export async function GET() {
  try {
    const groups = await StaffService.getAllStaffGroups();
    
    return NextResponse.json({
      groups,
      success: true
    });
  } catch (error) {
    console.error('Error fetching staff groups:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}

// CREATE STAFF GROUP
export async function POST(request: NextRequest) {
  try {
    const body: CreateStaffGroupRequest = await request.json();
    
    // Validate required fields
    if (!body.name || !body.staffMemberIds || body.staffMemberIds.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Name and at least one staff member are required' 
        },
        { status: 400 }
      );
    }

    const newGroup = await StaffService.createStaffGroup(body);

    const response: CreateStaffGroupResponse = {
      group: newGroup,
      success: true,
      message: 'Group created successfully'
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Error creating staff group:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}