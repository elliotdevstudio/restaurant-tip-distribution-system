'use client';

import React, { useState } from 'react';
import { 
  useStaffData,
  deleteStaffGroup,
  updateStaffGroup
} from '../../lib/hooks/useStaffData';
import StaffGroupForm from '../../components/staff/StaffGroupForm';
import { UsersRound, Trash2, Edit3, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

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
    refreshGroups();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading staff groups...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-900 mb-2">Error Loading Data</h2>
              <p className="text-red-700">{error?.message || 'Unknown error'}</p>
              <button
                onClick={() => refreshGroups()}
                className="mt-4 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <UsersRound className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Staff Groups</h1>
              <p className="text-gray-600">Organize staff and configure tip distribution</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm hover:shadow-md"
          >
            + Create New Group
          </button>
        </div>
      </div>

      {/* Groups List */}
      <div className="space-y-6">
        {groups.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12">
            <div className="text-center">
              <UsersRound className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Staff Groups Yet</h3>
              <p className="text-gray-600 mb-6">Create your first group to start organizing staff and configuring tip distribution</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Create Your First Group
              </button>
            </div>
          </div>
        ) : (
          groups.map((group) => {
            const isDistributor = group.gratuityConfig.distributesGratuities;
            const memberCount = group.staffMemberIds.length;
            const recipientCount = group.gratuityConfig.recipientGroupIds?.length || 0;
            const sourceCount = group.gratuityConfig.sourceGroupIds?.length || 0;

            return (
              <div key={group.id} className="bg-white rounded-lg shadow-md overflow-hidden border-2 border-gray-200 hover:border-blue-300 transition-all">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-xl font-bold text-gray-900">
                          {group.name}
                        </h3>
                        <span className={`px-3 py-1 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${
                          isDistributor 
                            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                            : 'bg-green-100 text-green-700 border border-green-200'
                        }`}>
                          {isDistributor ? (
                            <>
                              <TrendingUp className="w-4 h-4" />
                              Distributor
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-4 h-4" />
                              Recipient
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <UsersRound className="w-4 h-4" />
                          {memberCount} {memberCount === 1 ? 'member' : 'members'}
                        </span>
                        {isDistributor && recipientCount > 0 && (
                          <span className="text-gray-500">
                            → Distributes to {recipientCount} {recipientCount === 1 ? 'group' : 'groups'}
                          </span>
                        )}
                        {!isDistributor && sourceCount > 0 && (
                          <span className="text-gray-500">
                            ← Receives from {sourceCount} {sourceCount === 1 ? 'group' : 'groups'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(group)}
                        className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 border-2 border-blue-300 rounded-lg hover:bg-blue-50 transition-colors font-medium flex items-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(group.id, group.name)}
                        className="px-4 py-2 text-sm text-red-600 hover:text-red-700 border-2 border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Group Configuration Details */}
                  {isDistributor && (
                    <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <div className="text-sm">
                        <div className="font-semibold text-blue-900 mb-2">Distribution Configuration:</div>
                        <div className="text-blue-700 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>Contribution based on: <strong>{group.gratuityConfig.contributionSource === 'sales' ? 'Sales' : 'Tips'}</strong></span>
                          </div>
                          {group.gratuityConfig.distributionBasis && (
                            <div className="flex items-start gap-2">
                              <span className="text-blue-500">•</span>
                              <span>Distribution calculated from: <strong>{group.gratuityConfig.distributionBasis === 'sales' ? 'Sales' : 'Gratuities'}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {!isDistributor && (
                    <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                      <div className="text-sm">
                        <div className="font-semibold text-green-900 mb-2">Receives:</div>
                        <div className="text-green-700 font-medium">
                          {group.gratuityConfig.distributionType === 'percentage' 
                            ? `${group.gratuityConfig.percentage}% from each distributor`
                            : `$${group.gratuityConfig.fixedAmount?.toFixed(2)} fixed amount per distributor`
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Members List */}
                  {memberCount > 0 && (
                    <div className="mt-4 pt-4 border-t-2 border-gray-100">
                      <div className="text-sm font-semibold text-gray-700 mb-3">Group Members:</div>
                      <div className="flex flex-wrap gap-2">
                        {group.staffMemberIds.map(memberId => {
                          const member = members.find(m => m.id === memberId);
                          return member ? (
                            <span key={memberId} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-200 transition-colors">
                              {member.firstName} {member.lastName}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {memberCount === 0 && (
                    <div className="mt-4 pt-4 border-t-2 border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-gray-500 italic">
                        <AlertCircle className="w-4 h-4" />
                        No members assigned to this group yet
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
          staffMembers={members}
          staffGroups={groups}
        />
      )}
    </div>
  );
}
