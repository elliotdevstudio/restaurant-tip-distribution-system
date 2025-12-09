'use client';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useState, useEffect } from 'react';
import { staffMembersAtom, staffGroupsAtom } from '../../atoms/staffAtoms';
import StaffMemberForm from '../../components/staff/StaffMemberForm';
import { StaffMember } from '../../../types';

export default function StaffMembersPage() {
  const [staffMembers, setStaffMembers] = useAtom(staffMembersAtom);
  const [staffGroups, setStaffGroups] = useAtom(staffGroupsAtom); // Changed from useAtomValue to useAtom
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load data if not already loaded
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('📋 Loading staff members and groups...');
        
        // Load staff members
        const membersResponse = await fetch('/api/staff-members');
        const membersData = await membersResponse.json();
        
        if (membersData.success) {
          console.log(`✅ Loaded ${membersData.members.length} staff members`);
          setStaffMembers(membersData.members);
        }

        // Load staff groups
        const groupsResponse = await fetch('/api/staff/groups');
        const groupsData = await groupsResponse.json();
        
        if (groupsData.success) {
          console.log(`✅ Loaded ${groupsData.groups.length} staff groups`);
          setStaffGroups(groupsData.groups);
          
          // Debug: Show sample group and member IDs
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
    
    // Debug log
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
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg">Loading staff members...</div>
        </div>
      </div>
    );
  }

  // Sort staff members alphabetically by last name
  const sortedMembers = [...staffMembers].sort((a, b) => 
    a.lastName.localeCompare(b.lastName)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Staff Members</h1>
          <p className="text-sm text-gray-500 mt-1">
            {staffMembers.length} members • {staffGroups.length} groups loaded
          </p>
        </div>
        <button
          onClick={() => {
            setEditingMember(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add Staff Member
        </button>
      </div>

      {showForm ? (
        <StaffMemberForm
          onSubmit={editingMember ? handleUpdateMember : handleCreateMember}
          onCancel={() => {
            setShowForm(false);
            setEditingMember(null);
          }}
          initialData={editingMember || undefined}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-md">
          {sortedMembers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No staff members found. Click "Add Staff Member" to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Groups
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Added
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedMembers.map((member) => {
                    const memberGroups = getMemberGroups(member.id);
                    
                    return (
                      <tr key={member.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {member.lastName}, {member.firstName}
                          </div>
                          <div className="text-xs text-gray-400">ID: {member.id.substring(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4">
                          {memberGroups.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {memberGroups.map(group => (
                                <span
                                  key={group.id}
                                  className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded"
                                >
                                  {group.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              No group assigned
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(member.dateCreated).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEditMember(member)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id, `${member.firstName} ${member.lastName}`)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}