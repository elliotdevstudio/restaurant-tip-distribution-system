'use client';

import React, { useState } from 'react';
import { 
  useStaffMembers, 
  createStaffMember, 
  deleteStaffMember 
} from '../lib/hooks/useStaffData';

export default function StaffMembersPage() {
  const { members, isLoading, isError, error, refresh } = useStaffMembers();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      await createStaffMember(
        formData.firstName,
        formData.lastName,
      );

      setFormData({ firstName: '', lastName: '' });
      console.log('✅ Staff member created');
    } catch (error) {
      console.error('Failed to create staff member:', error);
      alert('Failed to create staff member');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;

    try {
      await deleteStaffMember(id);
      console.log('✅ Staff member deleted');
    } catch (error) {
      console.error('Failed to delete staff member:', error);
      alert('Failed to delete staff member');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading staff members...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Staff Members</h2>
          <p className="text-red-700">{error?.message || 'Unknown error'}</p>
          <button
            onClick={() => refresh()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Members</h1>
        <p className="text-gray-600">Manage your restaurant staff</p>
      </div>

      {/* Create Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Add New Staff Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Add Staff Member'}
          </button>
        </form>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">All Staff Members ({members.length})</h2>
            <button
              onClick={() => refresh()}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {members.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No staff members yet. Add one above!
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {members.map((member) => (
              <div key={member.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">
                    {member.firstName} {member.lastName}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(member.id, `${member.firstName} ${member.lastName}`)}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
