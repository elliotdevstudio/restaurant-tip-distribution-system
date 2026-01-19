'use client';

import { useAtom } from 'jotai';
import { useState, useEffect } from 'react';
import { staffMembersAtom, staffGroupsAtom } from '../../atoms/staffAtoms';
import StaffMemberForm from '../../components/staff/StaffMemberForm';
import { StaffMember } from '../../../types';
import { Users, UserPlus, Edit3, Trash2, Calendar, Tag, AlertCircle } from 'lucide-react';
import '../../animations.css';

export default function StaffMembersPage() {
  const [staffMembers, setStaffMembers] = useAtom(staffMembersAtom);
  const [staffGroups, setStaffGroups] = useAtom(staffGroupsAtom);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('📋 Loading staff members and groups...');
        
        const membersResponse = await fetch('/api/staff-members');
        const membersData = await membersResponse.json();
        
        if (membersData.success) {
          console.log(`✅ Loaded ${membersData.members.length} staff members`);
          setStaffMembers(membersData.members);
        }

        const groupsResponse = await fetch('/api/staff/groups');
        const groupsData = await groupsResponse.json();
        
        if (groupsData.success) {
          console.log(`✅ Loaded ${groupsData.groups.length} staff groups`);
          setStaffGroups(groupsData.groups);
          
          if (groupsData.groups.length > 0) {
            console.log('Sample group:', groupsData.groups[0]);
            console.log('Sample group staffMemberIds:', groupsData.groups[0].staffMemberIds);
          }
          if (membersData.members.length > 0) {
            console.log('Sample member ID:', membersData.members[0].id);
          }
        }
      } catch (error) {
        console.error('❌ Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [setStaffMembers, setStaffGroups]);

  const handleCreateMember = async (data: { firstName: string; lastName: string }) => {
    try {
      const response = await fetch('/api/staff-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (result.success) {
        setStaffMembers(prev => [...prev, result.member]);
        setShowForm(false);
      } else {
        alert(result.message || 'Failed to create staff member');
      }
    } catch (error) {
      console.error('Failed to create staff member:', error);
      alert('Failed to create staff member. Please try again.');
    }
  };

  const handleUpdateMember = async (data: { firstName: string; lastName: string }) => {
    if (!editingMember) return;

    try {
      const response = await fetch(`/api/staff-members/${editingMember.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (result.success) {
        setStaffMembers(prev => prev.map(member => 
          member.id === editingMember.id ? result.member : member
        ));
        setShowForm(false);
        setEditingMember(null);
      } else {
        alert(result.message || 'Failed to update staff member');
      }
    } catch (error) {
      console.error('Failed to update staff member:', error);
      alert('Failed to update staff member. Please try again.');
    }
  };

  const handleEditMember = (member: StaffMember) => {
    setEditingMember(member);
    setShowForm(true);
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to delete ${memberName}? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/staff-members/${memberId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      if (result.success) {
        setStaffMembers(prev => prev.filter(member => member.id !== memberId));
      } else {
        alert(result.message || 'Failed to delete staff member');
      }
    } catch (error) {
      console.error('Failed to delete staff member:', error);
      alert('Failed to delete staff member. Please try again.');
    }
  };

  const getMemberGroups = (memberId: string) => {
    const memberGroups = staffGroups.filter(group => 
      group.staffMemberIds.includes(memberId)
    );
    
    if (memberGroups.length === 0) {
      console.log(`No groups found for member ${memberId}`);
      console.log('Available groups:', staffGroups.map(g => ({ 
        id: g.id, 
        name: g.name, 
        members: g.staffMemberIds 
      })));
    }
    
    return memberGroups;
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

  const sortedMembers = [...staffMembers].sort((a, b) => 
    a.lastName.localeCompare(b.lastName)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 md:gap-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Staff Members</h1>
              <p className="text-gray-600">
                {staffMembers.length} {staffMembers.length === 1 ? 'member' : 'members'} • {staffGroups.length} {staffGroups.length === 1 ? 'group' : 'groups'} available
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingMember(null);
              setShowForm(true);
            }}
            className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm hover:shadow-md flex items-center justify-center md:justify-start gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Add Staff Member
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 pb-4 border-b-2 border-gray-200">
            {editingMember ? 'Edit Staff Member' : 'Add New Staff Member'}
          </h2>
          <StaffMemberForm
            onSubmit={editingMember ? handleUpdateMember : handleCreateMember}
            onCancel={() => {
              setShowForm(false);
              setEditingMember(null);
            }}
            initialData={editingMember || undefined}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {sortedMembers.length === 0 ? (
            <div className="p-6 md:p-12">
              <div className="text-center">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Staff Members Yet</h3>
                <p className="text-gray-600 mb-6">Get started by adding your first staff member</p>
                <button
                  onClick={() => {
                    setEditingMember(null);
                    setShowForm(true);
                  }}
                  className="px-6 py-3 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" />
                  Add Your First Staff Member
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW - Hidden on mobile */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Groups
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Date Added
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedMembers.map((member) => {
                      const memberGroups = getMemberGroups(member.id);
                      
                      return (
                        <tr key={member.id} className="hover:bg-blue-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="text-sm font-semibold text-gray-900">
                                  {member.lastName}, {member.firstName}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {memberGroups.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {memberGroups.map(group => (
                                  <span
                                    key={group.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-lg border border-blue-200"
                                  >
                                    <Tag className="w-3 h-3" />
                                    {group.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 italic">
                                <AlertCircle className="w-4 h-4" />
                                No group assigned
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              {new Date(member.dateCreated).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditMember(member)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 border-2 border-blue-300 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                              >
                                <Edit3 className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteMember(member.id, `${member.firstName} ${member.lastName}`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border-2 border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARD VIEW - Shown only on mobile */}
              <div className="md:hidden space-y-4 p-4">
                {sortedMembers.map((member) => {
                  const memberGroups = getMemberGroups(member.id);
                  
                  return (
                    <div
                      key={member.id}
                      className="bg-white rounded-lg shadow-md p-4 border border-gray-200 animate-fade-in-slide-up"
                    >
                      {/* Name Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {member.lastName}, {member.firstName}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(member.dateCreated).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Groups Section */}
                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Groups</p>
                        {memberGroups.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {memberGroups.map(group => (
                              <span
                                key={group.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded border border-blue-200"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {group.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 italic">
                            <AlertCircle className="w-3 h-3" />
                            No group assigned
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleEditMember(member)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-blue-600 hover:text-blue-700 border-2 border-blue-300 rounded-lg hover:bg-blue-50 transition-colors font-medium"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id, `${member.firstName} ${member.lastName}`)}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-600 hover:text-red-700 border-2 border-red-300 rounded-lg hover:bg-red-50 transition-colors font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}