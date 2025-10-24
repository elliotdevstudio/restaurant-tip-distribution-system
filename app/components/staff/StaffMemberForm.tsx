'use client';
import { useState, useEffect } from 'react';
import { StaffMember } from '../../../types';

interface StaffMemberFormProps {
  onSubmit: (data: { firstName: string; lastName: string; collectsSales: boolean }) => Promise<void>;
  onCancel: () => void;
  initialData?: StaffMember;
}

export default function StaffMemberForm({ onSubmit, onCancel, initialData }: StaffMemberFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [collectsSales, setCollectsSales] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.firstName);
      setLastName(initialData.lastName);
      setCollectsSales(initialData.collectsSales);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ firstName, lastName, collectsSales });
  };

  const canSubmit = firstName.trim() !== '' && lastName.trim() !== '';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">
        {initialData ? 'Edit Staff Member' : 'Add New Staff Member'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Enter first name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            placeholder="Enter last name"
          />
        </div>

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={collectsSales}
              onChange={(e) => setCollectsSales(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm font-medium text-gray-700">
              This staff member collects sales
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Check this for servers, cashiers, or anyone who handles customer transactions
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {initialData ? 'Update' : 'Create'} Staff Member
          </button>
        </div>
      </form>
    </div>
  );
}