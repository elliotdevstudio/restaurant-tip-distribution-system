'use client';

import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, Download, TrendingUp, Users, DollarSign, Clock } from 'lucide-react';
import './reports.css'; // Custom styles for date picker

type TimeRange = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
type ViewType = 'all-groups' | 'single-group' | 'single-member';
type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday, 6 = Saturday

interface ShiftReport {
  // Staff member fields
  staffId?: string;
  staffName?: string;
  groupId?: string;
  groupName?: string;
  hoursWorked?: number;
  salesAmount?: number;
  creditCardTips?: number;
  cashTips?: number;
  totalTips?: number;
  tipsReceived?: number;
  isDistributor?: boolean;
  shiftCount?: number;
  
  // Group header fields
  isGroupHeader?: boolean;
  isMainHeader?: boolean;
  groupDescription?: string;
}

const WEEK_DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function ShiftReportsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');
  const [viewType, setViewType] = useState<ViewType>('all-groups');
  const [weekStartDay, setWeekStartDay] = useState<WeekStartDay>(0); // Default: Sunday
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date | null>(new Date()); // For weekly/biweekly picker
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(new Date()); // For monthly picker
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [staffGroups, setStaffGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [staffMembers, setStaffMembers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);

  const formatDateString = (dateString: string): string => {
    const [year, month, day] = dateString.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString();
  };

  // Fetch staff groups and members on mount
  useEffect(() => {
    const fetchStaffData = async () => {
      try {
        const [groupsRes, membersRes] = await Promise.all([
          fetch('/api/staff/groups'),
          fetch('/api/staff-members')
        ]);

        const groupsData = await groupsRes.json();
        const membersData = await membersRes.json();

        if (groupsData.success) {
          setStaffGroups(groupsData.groups || []);
        }

        if (membersData.success) {
          setStaffMembers(membersData.members || []);
        }
      } catch (error) {
        console.error('Error fetching staff data:', error);
      }
    };

    fetchStaffData();
  }, []);

  // Update selectedWeekStart when weekStartDay changes (but preserve user selection)
  useEffect(() => {
    if (timeRange === 'weekly' || timeRange === 'biweekly') {
      // Find the most recent date matching weekStartDay
      const today = new Date();
      const currentDay = today.getDay();
      const daysToSubtract = (currentDay - weekStartDay + 7) % 7;
      const mostRecentStartDay = new Date(today);
      mostRecentStartDay.setDate(today.getDate() - daysToSubtract);
      
      // Only auto-set if user hasn't manually selected, or if the day-of-week changed
      if (!selectedWeekStart || selectedWeekStart.getDay() !== weekStartDay) {
        setSelectedWeekStart(mostRecentStartDay);
      }
    }
  }, [weekStartDay, timeRange]);

  // Helper function to check if a date should be highlighted (is a valid week start)
  const isWeekStartDay = (date: Date): boolean => {
    return date.getDay() === weekStartDay;
  };

  // Helper function to filter only valid start days for the date picker
  const filterWeekStartDates = (date: Date): boolean => {
    return date.getDay() === weekStartDay;
  };

  // Calculate date range based on time range and week start day
  const calculateDateRange = (): { startDate: string; endDate: string } | null => {
    let start: Date;
    let end: Date;

    switch (timeRange) {
      case 'daily':
        if (!customStartDate) return null;
        start = new Date(customStartDate);
        start.setUTCHours(0, 0, 0, 0);
        end = new Date(customStartDate);
        end.setUTCHours(23, 59, 59, 999);
        break;

      case 'weekly':
        if (!selectedWeekStart) return null;
        // Use the selected date as the week start
        start = new Date(selectedWeekStart);
        start.setUTCHours(0, 0, 0, 0);
        // End is 6 days later
        end = new Date(selectedWeekStart);
        end.setUTCHours(23, 59, 59, 999);
        end.setDate(end.getDate() + 6);
        break;

      case 'biweekly':
        if (!selectedWeekStart) return null;
        // Use the selected date as the bi-week start
        start = new Date(selectedWeekStart);
        start.setUTCHours(0, 0, 0, 0);
        // End is 13 days later (2 weeks)
        end = new Date(selectedWeekStart);
        end.setUTCHours(23, 59, 59, 999);
        end.setDate(end.getDate() + 13);
        break;

      case 'monthly':
        if (!selectedMonth) return null;
        // Start of month
        start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
        start.setUTCHours(0, 0, 0, 0);
        // End of month
        end = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
        end.setUTCHours(23, 59, 59, 999);
        break;

      case 'custom':
        if (!customStartDate || !customEndDate) {
          return null;
        }
        start = new Date(customStartDate);
        start.setUTCHours(0, 0, 0, 0);
        end = new Date(customEndDate);
        end.setUTCHours(23, 59, 59, 999);
        break;

      default:
        return null;
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };

  const handleSearch = async () => {
    setLoading(true);

    try {
      const range = calculateDateRange();
      
      if (!range) {
        alert('Please select valid dates');
        setLoading(false);
        return;
      }

      // Build query parameters
      const params = new URLSearchParams({
        timeRange,
        viewType,
        startDate: range.startDate,
        endDate: range.endDate
      });

      if (viewType === 'single-group' && selectedGroup) {
        params.append('groupId', selectedGroup);
      }

      if (viewType === 'single-member' && selectedMember) {
        params.append('memberId', selectedMember);
      }

      // Fetch data
      const response = await fetch(`/api/reports/shifts?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setReports(data.reports);
        setDateRange(data.dateRange);
      } else {
        console.error('Failed to fetch reports:', data.message);
        alert('Failed to fetch reports: ' + data.message);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      alert('Error fetching reports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (reports.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = ['Staff Name', 'Group', 'Shifts', 'Hours', 'Sales', 'CC Tips', 'Cash Tips', 'Total Tips/Received'];
    const rows: any[] = [];
    
    reports.forEach(r => {
      if (r.isGroupHeader) {
        // Add group header row
        if (r.isMainHeader) {
          rows.push(['', '', '', '', '', '', '', '']); // Spacing before main header
        }
        rows.push([r.groupDescription, '', '', '', '', '', '', '']); // Header line
      } else {
        // Regular staff row - only process if it has the required fields
        rows.push([
          r.staffName || '',
          r.groupName || '',
          r.shiftCount || 0,
          (r.hoursWorked || 0).toFixed(2),
          (r.salesAmount || 0).toFixed(2),
          (r.creditCardTips || 0).toFixed(2),
          (r.cashTips || 0).toFixed(2),
          ((r.isDistributor ? r.totalTips : r.tipsReceived) || 0).toFixed(2)
        ]);
      }
    });

    const csvContent = [
      `Report Period: ${dateRange?.startDate || ''} to ${dateRange?.endDate || ''}`,
      `Week Start Day: ${WEEK_DAYS.find(d => d.value === weekStartDay)?.label}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift-reports-${dateRange?.startDate || 'unknown'}-to-${dateRange?.endDate || 'unknown'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shift Reports</h1>
            <p className="text-gray-600">Search and analyze historical shift data</p>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
          Search Filters
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Time Range Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Week Start Day (only show for weekly/biweekly) */}
          {(timeRange === 'weekly' || timeRange === 'biweekly') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Week Starts On
              </label>
              <select
                value={weekStartDay}
                onChange={(e) => setWeekStartDay(Number(e.target.value) as WeekStartDay)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {WEEK_DAYS.map(day => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* View Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users className="inline w-4 h-4 mr-1" />
              View By
            </label>
            <select
              value={viewType}
              onChange={(e) => setViewType(e.target.value as ViewType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all-groups">All Groups (with Member Totals)</option>
              <option value="single-group">Single Group (with Member Totals)</option>
              <option value="single-member">Individual Staff Member</option>
            </select>
          </div>
        </div>

        {/* Conditional Group/Member Dropdowns */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {viewType === 'single-group' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Group</label>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a group...</option>
                {staffGroups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
          )}

          {viewType === 'single-member' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Staff Member</label>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a staff member...</option>
                {staffMembers.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.lastName}, {member.firstName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Week/Bi-week Start Date Picker */}
        {(timeRange === 'weekly' || timeRange === 'biweekly') && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select {timeRange === 'weekly' ? 'Week' : 'Bi-Week'} Start Date
            </label>
            <div className="flex flex-col md:flex-row items-start gap-4 w-full">
              <DatePicker
                selected={selectedWeekStart}
                onChange={(date: Date | null) => setSelectedWeekStart(date)}
                filterDate={filterWeekStartDates}
                dateFormat="MM/dd/yyyy"
                className="px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
                placeholderText={`Select a ${WEEK_DAYS.find(d => d.value === weekStartDay)?.label}`}
                highlightDates={[selectedWeekStart].filter(Boolean) as Date[]}
                inline
              />
              <div className="w-full md:flex-1 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  📅 {timeRange === 'weekly' ? 'Week' : 'Bi-Week'} Period
                </p>
                {selectedWeekStart && (
                  <>
                    <p className="text-sm text-blue-700">
                      <strong>Start:</strong> {selectedWeekStart.toLocaleDateString()}
                    </p>
                    <p className="text-sm text-blue-700">
                      <strong>End:</strong> {new Date(selectedWeekStart.getTime() + (timeRange === 'weekly' ? 6 : 13) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      Only {WEEK_DAYS.find(d => d.value === weekStartDay)?.label}s are selectable
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Monthly Date Picker */}
        {timeRange === 'monthly' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Month
            </label>
            <div className="flex flex-col md:flex-row items-start gap-4 w-full">
              <DatePicker
                selected={selectedMonth}
                onChange={(date: Date | null) => setSelectedMonth(date)}
                dateFormat="MMMM yyyy"
                showMonthYearPicker
                className="px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
                placeholderText="Select a month"
                inline
              />
              <div className="w-full md:flex-1 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  📅 Month Period
                </p>
                {selectedMonth && (
                  <>
                    <p className="text-sm text-blue-700">
                      <strong>Start:</strong> {new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-blue-700">
                      <strong>End:</strong> {new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      {new Date(selectedMonth.getFullYear(), selectedMonth.getMonth()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Custom Date Range Pickers */}
        {timeRange === 'custom' && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <DatePicker
                selected={customStartDate}
                onChange={(date: Date | null) => setCustomStartDate(date)}
                selectsStart
                startDate={customStartDate}
                endDate={customEndDate}
                dateFormat="MM/dd/yyyy"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholderText="Select start date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <DatePicker
                selected={customEndDate}
                onChange={(date: Date | null) => setCustomEndDate(date)}
                selectsEnd
                startDate={customStartDate}
                endDate={customEndDate}
                dateFormat="MM/dd/yyyy"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholderText="Select end date"
              />
            </div>
          </div>
        )}

        {/* Daily Date Picker */}
        {timeRange === 'daily' && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <DatePicker
              selected={customStartDate}
              onChange={(date: Date | null) => {
                setCustomStartDate(date);
                setCustomEndDate(date);
              }}
              dateFormat="MM/dd/yyyy"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholderText="Select a date"
              maxDate={new Date()}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-6">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Searching...' : 'Search Reports'}
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={reports.length === 0}
            className="w-full sm:w-auto px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Results Table */}
      {reports.length > 0 && dateRange && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Report Results ({reports.length} staff members)
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Period: {formatDateString(dateRange.startDate)} - {formatDateString(dateRange.endDate)}
                  {(timeRange === 'weekly' || timeRange === 'biweekly') && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Week starts: {WEEK_DAYS.find(d => d.value === weekStartDay)?.label}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-white">
                <tr>
                  {viewType !== 'single-member' && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      <Users className="inline w-4 h-4 mr-1" />
                      Staff
                    </th>
                  )}
                  {viewType === 'all-groups' && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Group
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Shifts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <Clock className="inline w-4 h-4 mr-1" />
                    Hours
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <DollarSign className="inline w-4 h-4 mr-1" />
                    Sales
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    CC Tips
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Cash Tips
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Total Tips
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((report, index) => {
                  // Check if this is a group header
                  if (report.isGroupHeader) {
                    return (
                      <tr 
                        key={`header-${report.groupId}-${index}`} 
                        className={report.isMainHeader ? "bg-gray-200 font-bold" : "bg-gray-100 font-semibold"}
                      >
                        <td 
                          colSpan={viewType === 'all-groups' ? 8 : 7} 
                          className={`px-6 py-2 text-sm ${report.isMainHeader ? 'text-gray-900' : 'text-gray-700'}`}
                        >
                          {report.groupDescription}
                        </td>
                      </tr>
                    );
                  }
                  
                  // Regular staff member row - only render if NOT a group header
                  return (
                    <tr key={`staff-${report.staffId}-${index}`} className="hover:bg-blue-50 transition-colors">
                      {viewType !== 'single-member' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {report.staffName}
                        </td>
                      )}
                      {viewType === 'all-groups' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 border border-blue-200 rounded">
                            {report.groupName}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {report.shiftCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {(report.hoursWorked || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(report.salesAmount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(report.creditCardTips || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(report.cashTips || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        ${((report.isDistributor ? report.totalTips : report.tipsReceived) || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {reports.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">
            No reports to display. Select your filters and click "Search Reports" to view data.
          </p>
        </div>
      )}
    </div>
  );
}