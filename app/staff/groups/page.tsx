'use client';
import { useAtom } from 'jotai';
import { useState, useEffect } from 'react';
import { staffGroupsAtom, staffMembersAtom } from '../../atoms/staffAtoms';
import StaffGroupForm from '../../components/staff/StaffGroupForm';
import { CreateStaffGroupRequest, CreateStaffGroupResponse, AnyStaffGroup } from '../../../types';

export default function StaffGroupsPage() {
  const [staffGroups, setStaffGroups] = useAtom(staffGroupsAtom);
  const [staffMembers, setStaffMembers] = useAtom(staffMembersAtom);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingGroup, setEditingGroup] = useState<AnyStaffGroup | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('🔄 Loading staff data...');
        
        const membersResponse = await fetch('/api/staff/members');
        const membersData = await membersResponse.json();
        
        if (membersData.success) {
          console.log(`✅ Loaded ${membersData.members.length} staff members`);
          setStaffMembers(membersData.members);
        }

        const groupsResponse = await fetch('/api/staff/groups');
        const groupsData = await groupsResponse.json();
        
        if (groupsData.success) {
          setStaffGroups(groupsData.groups);
        }
        
      } catch (error) {
        console.error('❌ Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [setStaffMembers, setStaffGroups]);

  const handleCreateGroup = async (request: CreateStaffGroupRequest): Promise<void> => {
    try {
      const response = await fetch('/api/staff/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const result: CreateStaffGroupResponse = await response.json();
      
      if (result.success) {
        setStaffGroups(prev => [...prev, result.group]);
        setShowForm(false);
      } else {
        alert(result.message || 'Failed to create group');
      }
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

  const handleUpdateGroup = async (request: CreateStaffGroupRequest): Promise<void> => {
    console.log('📝 handleUpdateGroup called with:', { editingGroup, request });
    
    if (!editingGroup) {
      console.error('❌ No editing group set!');
      return;
    }

    try {
      // ✨ UPDATED: REST-style URL with path parameter
      console.log(`📤 Making PUT request to /api/staff/groups/${editingGroup.id}`);
      
      const response = await fetch(`/api/staff/groups/${editingGroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text);
        alert(`Server error: ${response.status}`);
        return;
      }

      const result = await response.json();
      console.log('📨 API response:', result);
      
      if (result.success) {
        setStaffGroups(prev => prev.map(group => 
          group.id === editingGroup.id ? result.group : group
        ));
        setShowForm(false);
        setEditingGroup(null);
        console.log('✅ Group updated successfully');
      } else {
        console.error('❌ Update failed:', result.message);
        alert(result.message || 'Failed to update group');
      }
    } catch (error) {
      console.error('❌ Update error:', error);
      alert('Failed to update group. Please try again.');
    }
  };

  const handleEditGroup = (group: AnyStaffGroup) => {
    console.log('🔧 Starting edit for group:', group);
    setEditingGroup(group);
    setShowForm(true);
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to delete "${groupName}"? This cannot be undone.`)) {
      return;
    }

    try {
      // ✨ UPDATED: REST-style URL with path parameter
      const response = await fetch(`/api/staff/groups/${groupId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        setStaffGroups(prev => prev.filter(group => group.id !== groupId));
        console.log('✅ Group deleted successfully');
      } else {
        alert(result.message || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Failed to delete group:', error);
      alert('Failed to delete group. Please try again.');
    }
  };

  const toggleGroupDetails = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const getStaffMemberName = (memberId: string) => {
    const member = staffMembers.find(m => m.id === memberId);
    return member ? `${member.firstName} ${member.lastName}` : 'Unknown';
  };

  const getConnectedGroupName = (groupId: string) => {
    const group = staffGroups.find(g => g.id === groupId);
    return group ? group.name : 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Staff Groups</h1>
        <div className="text-sm text-gray-500">
          {staffMembers.length} staff members loaded
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={staffMembers.length === 0}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create New Group
        </button>
      </div>

      {staffMembers.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="text-yellow-800">
            No staff members loaded. Please ensure the database is seeded with staff data.
          </div>
        </div>
      )}

      {showForm ? (
        <StaffGroupForm
          onSubmit={editingGroup ? handleUpdateGroup : handleCreateGroup}
          onCancel={() => {
            setShowForm(false);
            setEditingGroup(null);
          }}
          initialData={editingGroup || undefined}
        />
      ) : (
        <div className="grid gap-4">
          {staffGroups.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No staff groups created yet. Click "Create New Group" to get started.
            </div>
          ) : (
            staffGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              
              return (
                <div key={group.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{group.name}</h3>
                      {group.description && (
                        <p className="text-gray-600 mt-1">{group.description}</p>
                      )}
                      <div className="mt-2 text-sm text-gray-500">
                        {group.staffMemberIds.length} staff members • {' '}
                        {group.gratuityConfig.distributesGratuities ? 'Distributes' : 'Receives'} gratuities
                        {/* ✨ NEW: Show contribution source for distributor groups */}
                        {group.gratuityConfig.distributesGratuities && group.gratuityConfig.contributionSource && (
                          <> • {group.gratuityConfig.contributionSource === 'sales' ? 'Based on Sales' : 'Based on Tips'}</>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => toggleGroupDetails(group.id)}
                        className="px-3 py-1 text-purple-600 border border-purple-300 rounded hover:bg-purple-50 text-sm"
                      >
                        {isExpanded ? 'Hide Details' : 'Show Details'}
                      </button>
                      <button
                        onClick={() => handleEditGroup(group)}
                        className="px-3 py-1 text-blue-600 border border-blue-300 rounded hover:bg-blue-50 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="px-3 py-1 text-red-600 border border-red-300 rounded hover:bg-red-50 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Expandable Details Section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                      {/* Staff Members List */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Staff Members:</h4>
                        <div className="bg-gray-50 rounded p-3">
                          {group.staffMemberIds.length > 0 ? (
                            <ul className="space-y-1">
                              {group.staffMemberIds.map((memberId, index) => (
                                <li key={memberId} className="text-sm text-gray-700">
                                  {index + 1}. {getStaffMemberName(memberId)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No staff members</p>
                          )}
                        </div>
                      </div>

                      {/* Gratuity Configuration */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Gratuity Configuration:</h4>
                        <div className="bg-blue-50 rounded p-3 space-y-2">
                          <div className="text-sm">
                            <span className="font-medium">Type:</span>{' '}
                            <span className="text-blue-900">
                              {group.gratuityConfig.distributesGratuities ? 'Distributes Gratuities' : 'Receives Gratuities'}
                            </span>
                          </div>

                          {/* ✨ NEW: Show contribution source for distributor groups */}
                          {group.gratuityConfig.distributesGratuities && group.gratuityConfig.contributionSource && (
                            <div className="text-sm">
                              <span className="font-medium">Contribution Source:</span>{' '}
                              <span className="text-blue-900">
                                {group.gratuityConfig.contributionSource === 'sales' 
                                  ? 'Percentage of Sales'
                                  : 'Total Gratuities Collected (CC + Cash)'
                                }
                              </span>
                            </div>
                          )}

                          {/* Show distribution method for receiver groups */}
                          {!group.gratuityConfig.distributesGratuities && group.gratuityConfig.distributionType && (
                            <div className="text-sm">
                              <span className="font-medium">Distribution Method:</span>{' '}
                              <span className="text-blue-900">
                                {group.gratuityConfig.distributionType === 'fixed' 
                                  ? `Fixed Amount: $${group.gratuityConfig.fixedAmount?.toFixed(2)}`
                                  : `Percentage: ${group.gratuityConfig.percentage}%`
                                }
                              </span>
                            </div>
                          )}

                          {/* Show connected groups for distributors */}
                          {group.gratuityConfig.distributesGratuities && (group.gratuityConfig.recipientGroupIds || []).length > 0 && (
                            <div className="text-sm">
                              <span className="font-medium">Distributing To:</span>
                              <ul className="ml-4 mt-1 space-y-1">
                                {(group.gratuityConfig.recipientGroupIds || []).map(recipientId => (
                                  <li key={recipientId} className="text-blue-900">
                                    • {getConnectedGroupName(recipientId)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Show connected groups for receivers */}
                          {!group.gratuityConfig.distributesGratuities && (group.gratuityConfig.sourceGroupIds || []).length > 0 && (
                            <div className="text-sm">
                              <span className="font-medium">Receiving From:</span>
                              <ul className="ml-4 mt-1 space-y-1">
                                {(group.gratuityConfig.sourceGroupIds || []).map(sourceId => (
                                  <li key={sourceId} className="text-blue-900">
                                    • {getConnectedGroupName(sourceId)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}