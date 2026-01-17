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
    const groupsCollection = db.collection('staff_groups');

    // Build query filter
    const filter: any = {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Fetch shifts and groups
    const [shifts, groups] = await Promise.all([
      shiftsCollection.find(filter).sort({ date: 1 }).toArray(),
      groupsCollection.find({}).toArray()
    ]);

    // Create group config map
    const groupConfigMap = new Map();
    groups.forEach(group => {
      groupConfigMap.set(group._id.toString(), {
        name: group.name,
        isDistributor: group.gratuityConfig?.distributesGratuities || false,
        isRecipient: group.gratuityConfig?.receivesGratuities || false,
        tipOutRecipients: group.gratuityConfig?.tipOutRecipients || []
      });
    });

    // Process data based on viewType
    const reports = processShiftData(shifts, query, groupConfigMap, groups);

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
  // If dates are provided in query params (from frontend), use them directly
  if (query.startDate && query.endDate) {
    return {
      startDate: query.startDate,
      endDate: query.endDate
    };
  }

  // Fallback: calculate from today (should rarely happen)
  const today = new Date();
  let startDate: Date;
  let endDate: Date = today;

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

function processShiftData(
  shifts: any[], 
  query: ReportQuery, 
  groupConfigMap: Map<string, any>, 
  allGroups: any[]
): any[] {
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
          tipsReceived: 0,
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
      staffData.tipsReceived += entry.tipsReceived || 0;
      
      // Only count as a shift if hours were worked
      if (entry.hoursWorked > 0) {
        staffData.shiftCount += 1;
      }
    });
  });

  // Convert Map to array
  let reports = Array.from(aggregatedData.values());

  // Build reports with group headers
  const reportsWithHeaders: any[] = [];
  const groupedByGroup = new Map<string, any[]>();

  // Group staff by their group
  reports.forEach(report => {
    if (!groupedByGroup.has(report.groupId)) {
      groupedByGroup.set(report.groupId, []);
    }
    groupedByGroup.get(report.groupId).push(report);
  });

  // Build final array with headers
  Array.from(groupedByGroup.entries())
    .sort((a, b) => a[1][0].groupName.localeCompare(b[1][0].groupName))
    .forEach(([groupId, members]) => {
      const groupConfig = groupConfigMap.get(groupId);
      const firstMember = members[0];

      if (groupConfig) {
        const groupName = firstMember.groupName;
        const isDistributor = groupConfig.isDistributor;
        
        // Build group description lines
        const headerLines: string[] = [];
        
        if (isDistributor) {
          // Main distributor header
          headerLines.push(`${groupName} - distributor`);
          
          // Add tip-out details (one line per recipient)
          groupConfig.tipOutRecipients.forEach((tipOut: any) => {
            // Find recipient group name
            const recipientGroup = allGroups.find(g => g._id.toString() === tipOut.recipientGroupId);
            const recipientName = recipientGroup?.name || 'Unknown Group';
            
            if (tipOut.tipOutType === 'PERCENTAGE') {
              headerLines.push(`  ${tipOut.amount}% of sales to ${recipientName}`);
            } else {
              headerLines.push(`  $${tipOut.amount} (fixed) to ${recipientName}`);
            }
          });
        } else {
          // Recipient group - find who tips them out
          const distributors = allGroups.filter(g => 
            g.gratuityConfig?.tipOutRecipients?.some((r: any) => r.recipientGroupId === groupId)
          );
          
          if (distributors.length > 0) {
            const fromDistributor = distributors[0];
            const tipOutConfig = fromDistributor.gratuityConfig.tipOutRecipients.find(
              (r: any) => r.recipientGroupId === groupId
            );
            
            let recipientDesc = `${groupName} - recipient`;
            if (tipOutConfig?.tipPoolId) {
              recipientDesc += ' - pooled';
            }
            recipientDesc += ` - receives from ${fromDistributor.name}`;
            
            headerLines.push(recipientDesc);
          } else {
            headerLines.push(`${groupName} - recipient`);
          }
        }

        // Add group header row(s)
        headerLines.forEach((line, idx) => {
          reportsWithHeaders.push({
            isGroupHeader: true,
            isMainHeader: idx === 0,
            groupName: firstMember.groupName,
            groupDescription: line,
            groupId: groupId
          });
        });
      }

      // Add staff members (sorted by name)
      members
        .sort((a, b) => a.staffName.localeCompare(b.staffName))
        .forEach(member => reportsWithHeaders.push(member));
    });

  return reportsWithHeaders;
}