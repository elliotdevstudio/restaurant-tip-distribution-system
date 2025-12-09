'use client';

import React, { useState } from 'react';
import { 
  useStaffData,
  deleteStaffGroup,
  updateStaffGroup
} from '../../lib/hooks/useStaffData';
import StaffGroupForm from '../../components/staff/StaffGroupForm';

export default function StaffGroupsPage() {
  const { members, groups, isLoading, isError, error, refreshGroups } = useStaffData();
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete group "${name}"? This cannot be undone.`)) return;

    try {
      await deleteStaffGroup(id);
      console.log('✅ Group deleted');
    } catch (error) {
      console.error('Failed to delete group:', error);
      alert('Failed to delete group');
    }
  };

  const handleEdit = (group: any) => {
    setEditingGroup(group);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingGroup(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingGroup(null);
    refreshGroups(); // Refresh the groups list
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading staff data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Data</h2>
          <p className="text-red-700">{error?.message || 'Unknown error'}</p>
          <button
            onClick={() => refreshGroups()}
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Groups</h1>
            <p className="text-gray-600">Organize staff and configure tip distribution</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            + Create New Group
          </button>
        </div>
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">No staff groups yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Create Your First Group
            </button>
          </div>
        ) : (
          groups.map((group) => {
            const isDistributor = group.gratuityConfig.distributesGratuities;
            const memberCount = group.staffMemberIds.length;
            const recipientCount = group.gratuityConfig.recipientGroupIds?.length || 0;
            const sourceCount = group.gratuityConfig.sourceGroupIds?.length || 0;

            return (
              <div key={group.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        {group.name}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className={`px-2 py-1 rounded ${isDistributor ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {isDistributor ? '📤 Distributor' : '📥 Recipient'}
                        </span>
                        <span>👥 {memberCount} members</span>
                        {isDistributor && recipientCount > 0 && (
                          <span>→ {recipientCount} recipient groups</span>
                        )}
                        {!isDistributor && sourceCount > 0 && (
                          <span>← {sourceCount} source groups</span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(group)}
                        className="px-4 py-2 text-sm text-purple-600 hover:text-purple-700 border border-purple-300 rounded hover:bg-purple-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(group.id, group.name)}
                        className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border border-red-300 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Group Details */}
                  {isDistributor && (
                    <div className="mt-4 p-4 bg-blue-50 rounded">
                      <div className="text-sm">
                        <div className="font-medium text-blue-900 mb-2">Distribution Settings:</div>
                        <div className="text-blue-700 space-y-1">
                          <div>• Contribution: Based on {group.gratuityConfig.contributionSource === 'sales' ? 'Sales' : 'Tips'}</div>
                          {group.gratuityConfig.distributionBasis && (
                            <div>• Distribution: Based on {group.gratuityConfig.distributionBasis === 'sales' ? 'Sales' : 'Gratuities'}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isDistributor && (
                    <div className="mt-4 p-4 bg-green-50 rounded">
                      <div className="text-sm">
                        <div className="font-medium text-green-900 mb-2">Receives:</div>
                        <div className="text-green-700">
                          {group.gratuityConfig.distributionType === 'percentage' 
                            ? `${group.gratuityConfig.percentage}% from each distributor`
                            : `$${group.gratuityConfig.fixedAmount?.toFixed(2)} fixed amount`
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Members List */}
                  {memberCount > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">Members:</div>
                      <div className="flex flex-wrap gap-2">
                        {group.staffMemberIds.map(memberId => {
                          const member = members.find(m => m.id === memberId);
                          return member ? (
                            <span key={memberId} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                              {member.firstName} {member.lastName}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Group Form Modal */}
      {showForm && (
      <StaffGroupForm
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        editingGroup={editingGroup}
        staffMembers={members}     // ← Make sure this line exists
        staffGroups={groups}        // ← Make sure this line exists
      />
      )}
    </div>
  );
}
