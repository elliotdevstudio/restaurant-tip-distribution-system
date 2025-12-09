'use client';

import { StaffMember } from '../../../types';

interface StaffMemberSelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  staffMembers: StaffMember[];  
}

export default function StaffMemberSelector({ 
  selectedIds, 
  onSelectionChange,
  staffMembers = [] // Receive from parent
}: StaffMemberSelectorProps) {
  
  const handleToggle = (memberId: string) => {
    if (selectedIds.includes(memberId)) {
      onSelectionChange(selectedIds.filter(id => id !== memberId));
    } else {
      onSelectionChange([...selectedIds, memberId]);
    }
  };

  if (!staffMembers || staffMembers.length === 0) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">
          No staff members available. Please create staff members first.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Staff Members *
      </label>
      <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded p-3">
        {(staffMembers || []).map(member => (
          <label 
            key={member.id}
            className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(member.id)}
              onChange={() => handleToggle(member.id)}
              className="mr-3"
            />
            <span className="font-medium">
              {member.firstName} {member.lastName}
            </span>
          </label>
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-2">
        {selectedIds.length} member{selectedIds.length !== 1 ? 's' : ''} selected
      </p>
    </div>
  );
}
