import { NextRequest, NextResponse } from 'next/server';
import { DatabaseConnection } from '../../../lib/mongodb';

interface ReportQuery {
  timeRange: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  viewType: 'all-groups' | 'single-group' | 'single-member';
  startDate?: string;
  endDate?: string;
  groupId?: string;
  memberId?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const query: ReportQuery = {
      timeRange: searchParams.get('timeRange') as any || 'weekly',
      viewType: searchParams.get('viewType') as any || 'all-groups',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      groupId: searchParams.get('groupId') || undefined,
      memberId: searchParams.get('memberId') || undefined,
    };

    // Calculate date range based on timeRange
    const { startDate, endDate } = calculateDateRange(query);

    // Connect to database
    const db = await DatabaseConnection.getDatabase('staff_management');
    const shiftsCollection = db.collection('daily_shifts');

    // Build query filter
    const filter: any = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Fetch shifts
    const shifts = await shiftsCollection
      .find(filter)
      .sort({ date: 1 })
      .toArray();

    // Process data based on viewType
    const reports = processShiftData(shifts, query);

    return NextResponse.json({
      success: true,
      reports,
      dateRange: { startDate, endDate },
      totalRecords: reports.length
    });

  } catch (error) {
    console.error('Error fetching shift reports:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch shift reports',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function calculateDateRange(query: ReportQuery): { startDate: string; endDate: string } {
  const today = new Date();
  let startDate: Date;
  let endDate: Date = today;

  if (query.timeRange === 'custom' && query.startDate && query.endDate) {
    return {
      startDate: query.startDate,
      endDate: query.endDate
    };
  }

  switch (query.timeRange) {
    case 'daily':
      startDate = new Date(today);
      break;
    case 'weekly':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      break;
    case 'biweekly':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 14);
      break;
    case 'monthly':
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 1);
      break;
    default:
      startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

function processShiftData(shifts: any[], query: ReportQuery): any[] {
  // Use a Map to aggregate data by staff member
  const aggregatedData = new Map<string, any>();

  shifts.forEach(shift => {
    if (!shift.entries || shift.entries.length === 0) return;

    shift.entries.forEach((entry: any) => {
      // Filter based on viewType
      if (query.viewType === 'single-group' && entry.groupId !== query.groupId) {
        return;
      }
      if (query.viewType === 'single-member' && entry.staffId !== query.memberId) {
        return;
      }

      const key = entry.staffId;

      if (!aggregatedData.has(key)) {
        // Initialize new staff member entry
        aggregatedData.set(key, {
          staffId: entry.staffId,
          staffName: entry.staffName,
          groupId: entry.groupId,
          groupName: entry.groupName,
          hoursWorked: 0,
          salesAmount: 0,
          creditCardTips: 0,
          cashTips: 0,
          totalTips: 0,
          isDistributor: entry.isDistributor || false,
          shiftCount: 0
        });
      }

      // Aggregate values
      const staffData = aggregatedData.get(key);
      staffData.hoursWorked += entry.hoursWorked || 0;
      staffData.salesAmount += entry.salesAmount || 0;
      staffData.creditCardTips += entry.creditCardTips || 0;
      staffData.cashTips += entry.cashTips || 0;
      staffData.totalTips += (entry.creditCardTips || 0) + (entry.cashTips || 0);
      staffData.shiftCount += 1;
    });
  });

  // Convert Map to array and sort by staff name
  const reports = Array.from(aggregatedData.values()).sort((a, b) => {
    // Sort by group name first (if showing all groups)
    if (query.viewType === 'all-groups' && a.groupName !== b.groupName) {
      return (a.groupName || '').localeCompare(b.groupName || '');
    }
    // Then by staff name
    return (a.staffName || '').localeCompare(b.staffName || '');
  });

  return reports;
}
