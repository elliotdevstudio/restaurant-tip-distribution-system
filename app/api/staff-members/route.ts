import { NextRequest, NextResponse } from 'next/server';
import { StaffService } from '../../lib/services/staffService';

// Track if indexes have been created
let indexesCreated = false;

// GET all staff members
export async function GET() {
  
  console.log('🔥 Members API called - starting initialization...');
  
  try {
    // Create indexes on first run
    if (!indexesCreated) {
      await StaffService.ensureIndexes();
      indexesCreated = true;
    }
    
    // Seed initial data if needed
    await StaffService.seedInitialData();
    
    // Fetch members
    const members = await StaffService.getAllStaffMembers();
    
    console.log(`📤 Returning ${members.length} members to frontend`);
    
    return NextResponse.json({
      success: true,
      members,
      count: members.length
    });
  } catch (error) {
    console.error('❌ Error in members API:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch staff members',
        error: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    );
  }
}


// POST create new staff member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName } = body;

    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, message: 'First name and last name are required' },
        { status: 400 }
      );
    }

    const member = await StaffService.createStaffMember(
      firstName,
      lastName,
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