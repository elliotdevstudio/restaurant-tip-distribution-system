'use client'
import { useState } from 'react';
import { StaffGroupFormState, AnyStaffGroup } from '../../../types';
import GratuitySourceModal from './GratuitySourceModal';

interface GratuityConfigStepProps {
  formState: StaffGroupFormState;
  availableGroups: AnyStaffGroup[];
  onUpdateForm: (updates: Partial<StaffGroupFormState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function GratuityConfigStep({
  formState,
  availableGroups,
  onUpdateForm,
  onNext,
  onBack
}: GratuityConfigStepProps) {
  const handleGratuityToggle = (distributes: boolean) => {
    onUpdateForm({
      distributesGratuities: distributes,
      showGratuityModal: !distributes // Show modal if this group receives gratuities
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Gratuity Configuration</h2>
      
      <div className="space-y-4">
        <div>
          <p className="mb-3 text-gray-700">Does this group distribute gratuities?</p>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="distributesGratuities"
                checked={formState.distributesGratuities === true}
                onChange={() => handleGratuityToggle(true)}
                className="text-blue-600"
              />
              <span>Yes, this group distributes gratuities</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="distributesGratuities"
                checked={formState.distributesGratuities === false}
                onChange={() => handleGratuityToggle(false)}
                className="text-blue-600"
              />
              <span>No, this group receives gratuities</span>
            </label>
          </div>
        </div>
      </div>

      <GratuitySourceModal
        isOpen={formState.showGratuityModal}
        availableGroups={availableGroups}
        onSelectGroup={(groupId) => {
          onUpdateForm({ 
            sourceGroupIds: [groupId], 
            showGratuityModal: false,
            step: 'gratuity-setup'
          });
        }}
        onCreateNewGroup={() => {
          onUpdateForm({ 
            isCreatingSourceGroup: true,
            showGratuityModal: false
          });
        }}
        onClose={() => onUpdateForm({ showGratuityModal: false })}
      />

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={formState.distributesGratuities === undefined}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

