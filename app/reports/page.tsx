'use client';

import { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp, Users, DollarSign, Clock } from 'lucide-react';

type TimeRange = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
type ViewType = 'all-groups' | 'single-group' | 'single-member';

interface ShiftReport {
  date: string;
  staffName?: string;
  groupName?: string;
  hoursWorked: number;
  salesAmount: number;
  creditCardTips: number;
  cashTips: number;
  totalTips: number;
}

export default function ShiftReportsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');
  const [viewType, setViewType] = useState<ViewType>('all-groups');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [reports, setReports] = useState<ShiftReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [staffGroups, setStaffGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [staffMembers, setStaffMembers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);

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

  const handleSearch = async () => {
    setLoading(true);
    
    try {
      // Build query parameters
      const params = new URLSearchParams({
        timeRange,
        viewType
      });

      if (timeRange === 'custom') {
        if (!startDate || !endDate) {
          alert('Please select both start and end dates for custom range');
          setLoading(false);
          return;
        }
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }

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

    // Create CSV content
    const headers = ['Date', 'Staff Name', 'Group', 'Hours', 'Sales', 'CC Tips', 'Cash Tips', 'Total Tips'];
    const rows = reports.map(r => [
      r.date,
      r.staffName || '',
      r.groupName || '',
      r.hoursWorked,
      r.salesAmount.toFixed(2),
      r.creditCardTips.toFixed(2),
      r.cashTips.toFixed(2),
      r.totalTips.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shift-reports-${new Date().toISOString().split('T')[0]}.csv`;
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

        {/* Time Range Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="inline w-4 h-4 mr-1" />
            Time Range
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'biweekly', label: 'Bi-Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'custom', label: 'Custom Range' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setTimeRange(option.value as TimeRange)}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  timeRange === option.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range */}
        {timeRange === 'custom' && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* View Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Users className="inline w-4 h-4 mr-1" />
            View By
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all-groups', label: 'All Groups (with Member Totals)' },
              { value: 'single-group', label: 'Single Group (with Member Totals)' },
              { value: 'single-member', label: 'Individual Staff Member' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setViewType(option.value as ViewType)}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  viewType === option.value
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional Dropdowns */}
        {viewType === 'single-group' && (
          <div className="mb-6">
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
          <div className="mb-6">
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

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search Reports'}
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={reports.length === 0}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Results Table */}
      {reports.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Report Results ({reports.length} entries)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    <Calendar className="inline w-4 h-4 mr-1" />
                    Date
                  </th>
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
                {reports.map((report, index) => (
                  <tr key={index} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.date}
                    </td>
                    {viewType !== 'single-member' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {report.staffName}
                      </td>
                    )}
                    {viewType === 'all-groups' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {report.groupName}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {report.hoursWorked.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${report.salesAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${report.creditCardTips.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${report.cashTips.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                      ${report.totalTips.toFixed(2)}
                    </td>
                  </tr>
                ))}
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