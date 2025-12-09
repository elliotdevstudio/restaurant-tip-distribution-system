'use client'

import { useAtom } from 'jotai';
import { useAtomValue } from 'jotai';
import { useState, useEffect } from 'react';
import { staffGroupFormAtom, staffGroupsAtom, nestedGroupCreationAtom } from '../../atoms/staffAtoms';
import { AnyStaffGroup, CreateStaffGroupRequest, StaffGroupFormState } from '../../../types';
import { createStaffGroup, updateStaffGroup } from '../../lib/hooks/useStaffData';
import StaffMemberSelector from './StaffMemberSelector';
import GratuityConfigStep from './GratuityConfigStep';
import DistributionConfigStep from './DistributionConfigStep';

interface StaffGroupFormProps {
  onClose: () => void;
  onSuccess: () => void;
  editingGroup?: any;
  staffMembers: StaffMember[];    // ← Should be here
  staffGroups: AnyStaffGroup[];   // ← Should be here
}

export default function StaffGroupForm({ 
  onClose, 
  onSuccess, 
  editingGroup,
  staffMembers,
  staffGroups 
}: StaffGroupFormProps) {

  console.log('🔍 StaffGroupForm received props:', {
    staffMembers: staffMembers?.length,
    staffGroups: staffGroups?.length,
    editingGroup: editingGroup?.name
  });

  const availableGroups = staffGroups || [];
  const [formState, setFormState] = useState<StaffGroupFormState>({
    name: '',
    description: '',
    selectedStaffMemberIds: [],
    distributesGratuities: undefined,
    sourceGroupIds: undefined,
    distributionType: undefined,
    distributionBasis: undefined,
    contributionSource: undefined,
    fixedAmount: undefined,
    percentage: undefined,
    recipientGroupIds: [],
    useSharedTipPool: false,  // ← Make sure this is explicitly false
    sharedTipPoolId: undefined,
    isCreatingSourceGroup: false,
    showGratuityModal: false,
    step: 'basic'
  });

  // const [nestedState, setNestedState] = useAtom(nestedGroupCreationAtom);


  // Initialize form when component mounts or initialData changes
  useEffect(() => {
    if (editingGroup) {
      console.log('🔧 Initializing form for editing:', editingGroup);
      setFormState({
        name: editingGroup.name,
        description: editingGroup.description || '',
        selectedStaffMemberIds: editingGroup.staffMemberIds,
        distributesGratuities: editingGroup.gratuityConfig.distributesGratuities,
        sourceGroupIds: editingGroup.gratuityConfig.sourceGroupIds || [],
        distributionType: editingGroup.gratuityConfig.distributionType,
        fixedAmount: editingGroup.gratuityConfig.fixedAmount,
        percentage: editingGroup.gratuityConfig.percentage,
        recipientGroupIds: editingGroup.gratuityConfig.recipientGroupIds || [],
        isCreatingSourceGroup: false,
        showGratuityModal: false,
        step: 'basic'
      });
    } else {
      console.log('🆕 Initializing form for new group');
      setFormState({
        name: '',
        description: '',
        selectedStaffMemberIds: [],
        distributesGratuities: undefined,
        sourceGroupIds: [],
        distributionType: undefined,
        fixedAmount: undefined,
        percentage: undefined,
        recipientGroupIds: [],
        isCreatingSourceGroup: false,
        showGratuityModal: false,
        step: 'basic'
      });
    }
  }, [editingGroup]);

  const updateForm = (updates: Partial<StaffGroupFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
  }

  const handleNext = () => {
    console.log('📝 handleNext called from step:', formState.step);

    if (formState.step === 'basic') {
      updateForm({ step: 'gratuity-setup' });
    } else if (formState.step === 'gratuity-setup') {
      // If they chose to distribute, go to contribution source step
      if (formState.distributesGratuities === true) {
        updateForm({ step: 'contribution-source' });
      } else {
        // If they chose to receive, skip contribution source and go to connection setup
        updateForm({ step: 'connection-setup' });
      }
    } else if (formState.step === 'contribution-source') {
      updateForm({ step: 'connection-setup' });
    } else if (formState.step === 'connection-setup') {
      updateForm({ step: 'review' });
    }
  };

  const handleBack = () => {
    console.log('📝 handleBack called from step:', formState.step);

    if (formState.step === 'gratuity-setup') {
      updateForm({ step: 'basic' });
    } else if (formState.step === 'contribution-source') {
      updateForm({ step: 'gratuity-setup' });
    } else if (formState.step === 'connection-setup') {
      // Go back to contribution source if distributor, otherwise gratuity setup
      if (formState.distributesGratuities === true) {
        updateForm({ step: 'contribution-source' });
      } else {
        updateForm({ step: 'gratuity-setup' });
      }
    } else if (formState.step === 'review') {
      updateForm({ step: 'connection-setup' });
    }
  };

  const handleSubmit = async () => {
  console.log('📤 Submitting form:', { isEdit: !!editingGroup, formState });

  const request: CreateStaffGroupRequest = {
  name: formState.name,
  description: formState.description,
  staffMemberIds: formState.selectedStaffMemberIds,
  gratuityConfig: {
    distributesGratuities: formState.distributesGratuities || false,
    contributionSource: formState.contributionSource,
    distributionBasis: formState.distributionBasis,  
    sourceGroupIds: formState.sourceGroupIds || [],
    distributionType: formState.distributionType,
    fixedAmount: formState.fixedAmount,
    percentage: formState.percentage,
    recipientGroupIds: formState.recipientGroupIds || []
  }
  };
  console.log('🔍 Form state at submit:', {
  useSharedTipPool: formState.useSharedTipPool,
  sharedTipPoolId: formState.sharedTipPoolId,
  recipientGroupIds: formState.recipientGroupIds,
  willApplyPoolId: !!(formState.useSharedTipPool && formState.sharedTipPoolId)
});
  try {
    // melanie,arthur,michelle, lesley runners
        if (formState.useSharedTipPool && formState.sharedTipPoolId && formState.recipientGroupIds) {
          for (const recipientId of formState.recipientGroupIds) {
            const recipientGroup = staffGroups.find(g => g.id === recipientId);
            if (!recipientGroup) continue;
            
            await updateStaffGroup(recipientId, {
              name: recipientGroup.name,
              description: recipientGroup.description,
              staffMemberIds: recipientGroup.staffMemberIds,
              gratuityConfig: {
                ...recipientGroup.gratuityConfig,
                tipPoolId: formState.sharedTipPoolId  // Add pool ID
              }
            });
          }
        }
    if (editingGroup) {
      await updateStaffGroup(editingGroup.id, request);
    } else {
      await createStaffGroup(request);
    }
    onSuccess(); // Call success callback
  } catch (error) {
    console.error('Failed to save group:', error);
    alert('Failed to save group');
  }
  };

  const canProceedFromBasic = formState.name.trim() !== '' && formState.selectedStaffMemberIds.length > 0;
  const canProceedFromGratuity = formState.distributesGratuities !== undefined;
  const canProceedFromContributionSource = 
  formState.contributionSource !== undefined && 
  formState.distributionBasis !== undefined;
  
  // Validation for percentage warning
  const getPercentageWarning = (): string | null => {
    if (formState.distributionType !== 'percentage' || !formState.percentage) {
      return null;
    }
    
    if (formState.percentage > 100) {
      return 'Percentage cannot exceed 100%';
    }
    
    if (formState.percentage > 30) {
      return 'Warning: This is a high percentage (>30%). Are you sure?';
    }
    
    return null;
  };

  const canSubmit = canProceedFromBasic && 
                    canProceedFromGratuity && 
                    (formState.distributesGratuities ? canProceedFromContributionSource : true);
  
  // RENDER THE DIFFERENT STEPS


  const renderBasicStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Basic Information</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Group Name *
        </label>
        <input
          type="text"
          value={formState.name}
          onChange={(e) => updateForm({ name: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2"
          placeholder="Enter group name (e.g., Servers, Kitchen Staff)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description (optional)
        </label>
        <textarea
          value={formState.description || ''}
          onChange={(e) => updateForm({ description: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2"
          rows={3}
          placeholder="Enter description"
        />
      </div>

      <StaffMemberSelector
        selectedIds={formState.selectedStaffMemberIds}
        onSelectionChange={(ids) => updateForm({ selectedStaffMemberIds: ids })}
        staffMembers={staffMembers} 
      />

      <div className="flex justify-end space-x-4">
        <button onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
          Cancel
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceedFromBasic}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderGratuityStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Gratuity Configuration</h3>
      
      <div>
        <p className="mb-3 text-gray-700">Does this group distribute or receive gratuities?</p>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
            <input
              type="radio"
              name="gratuityType"
              checked={formState.distributesGratuities === true}
              onChange={() => updateForm({ 
                distributesGratuities: true,
                sourceGroupIds: [],
                distributionType: undefined,
                fixedAmount: undefined,
                percentage: undefined,
                contributionSource: undefined // Reset when switching
              })}
              className="mt-1 text-blue-600"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">This group distributes gratuities</span>
              <p className="text-sm text-gray-500 mt-1">
                Members of this group collect tips and share them with other groups (e.g., Servers, Bartenders)
              </p>
            </div>
          </label>
          
          <label className="flex items-start space-x-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
            <input
              type="radio"
              name="gratuityType"
              checked={formState.distributesGratuities === false}
              onChange={() => updateForm({ 
                distributesGratuities: false,
                recipientGroupIds: [],
                contributionSource: undefined // Recipients don't need contribution source
              })}
              className="mt-1 text-blue-600"
            />
            <div className="flex-1">
              <span className="font-medium text-gray-900">This group receives gratuities</span>
              <p className="text-sm text-gray-500 mt-1">
                Members of this group receive tips from distributor groups (e.g., Kitchen Staff, Bussers)
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={handleBack} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceedFromGratuity}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderContributionSourceStep = () => (
  <div className="space-y-6">
    <h3 className="text-lg font-medium">Contribution Source & Distribution Basis</h3>
    
    {/* Part 1: What do they collect? */}
    <div>
      <p className="mb-3 text-gray-700 font-medium">
        1. What does this group collect from customers?
      </p>
      <div className="space-y-3">
        <label className="flex items-start space-x-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
          <input
            type="radio"
            name="contributionSource"
            checked={formState.contributionSource === 'gratuities'}
            onChange={() => updateForm({ contributionSource: 'gratuities' })}
            className="mt-1 text-blue-600"
          />
          <div className="flex-1">
            <span className="font-medium text-gray-900">Tips/Gratuities Only</span>
            <p className="text-sm text-gray-500 mt-1">
              This group receives tips from customers (credit card + cash)
            </p>
            <div className="mt-2 p-3 bg-blue-50 rounded text-sm text-blue-800">
              <strong>Example:</strong> Server collects $150 in tips from tables
            </div>
          </div>
        </label>
        
        <label className="flex items-start space-x-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 transition-colors">
          <input
            type="radio"
            name="contributionSource"
            checked={formState.contributionSource === 'sales'}
            onChange={() => updateForm({ contributionSource: 'sales' })}
            className="mt-1 text-blue-600"
          />
          <div className="flex-1">
            <span className="font-medium text-gray-900">Sales + Tips</span>
            <p className="text-sm text-gray-500 mt-1">
              This group tracks both sales amounts and tips received
            </p>
            <div className="mt-2 p-3 bg-blue-50 rounded text-sm text-blue-800">
              <strong>Example:</strong> Server has $1,000 in sales and receives $150 in tips
            </div>
          </div>
        </label>
      </div>
    </div>

    {/* Part 2: What basis for tip out calculation? (only show if contribution source selected) */}
    {formState.contributionSource && (
      <div className="space-y-4 p-4 bg-purple-50 rounded border-2 border-purple-200">
        <h4 className="font-medium text-purple-900">
          2. How should tip-outs be calculated?
        </h4>
        <p className="text-sm text-gray-600">
          When sharing tips with other groups, calculate the amount based on:
        </p>
        
        <div className="space-y-3">
          <label className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-purple-300 bg-white">
            <input
              type="radio"
              name="distributionBasis"
              value="sales"
              checked={formState.distributionBasis === 'sales'}
              onChange={() => updateForm({ distributionBasis: 'sales' })}
              className="mt-1 text-purple-600"
            />
            <div className="flex-1">
              <span className="font-medium">Percentage of Sales</span>
              <p className="text-xs text-gray-500 mt-1">
                Tip out amount = Sales Amount × Percentage
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Example: $1,000 sales × 5% = $50 distributed to kitchen
              </p>
            </div>
          </label>
          
          <label className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-purple-300 bg-white">
            <input
              type="radio"
              name="distributionBasis"
              value="gratuities"
              checked={formState.distributionBasis === 'gratuities'}
              onChange={() => updateForm({ distributionBasis: 'gratuities' })}
              className="mt-1 text-purple-600"
            />
            <div className="flex-1">
              <span className="font-medium">Percentage of Tips Received</span>
              <p className="text-xs text-gray-500 mt-1">
                Tip out amount = Tips Received × Percentage
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Example: $200 tips × 5% = $10 distributed to kitchen
              </p>
            </div>
          </label>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Why this matters:</p>
              <p className="mt-1">
                {formState.distributionBasis === 'sales' 
                  ? 'Basing tip-outs on sales is more stable but might be higher amounts.'
                  : 'Basing tip-outs on gratuities ties the amount directly to actual tips received.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    )}

    <div className="flex justify-between">
      <button onClick={handleBack} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
        Back
      </button>
      <button
        onClick={handleNext}
        disabled={!formState.contributionSource || !formState.distributionBasis}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  </div>
);

const renderConnectionStep = () => {
  const availableConnections = formState.distributesGratuities 
    ? availableGroups.filter(group => 
        group.gratuityConfig.distributesGratuities === false && 
        group.id !== (editingGroup?.id)
      )
    : availableGroups.filter(group => 
        group.gratuityConfig.distributesGratuities === true && 
        group.id !== (editingGroup?.id)
      );

  const currentConnections = formState.distributesGratuities 
    ? (formState.recipientGroupIds || [])
    : (formState.sourceGroupIds || []);
  
  const handleConnectionToggle = (groupId: string) => {
    const newConnections = currentConnections.includes(groupId)
      ? currentConnections.filter(id => id !== groupId)
      : [...currentConnections, groupId];
    
    if (formState.distributesGratuities) {
      updateForm({ recipientGroupIds: newConnections });
    } else {
      updateForm({ sourceGroupIds: newConnections });
    }
  };

  const percentageWarning = getPercentageWarning();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Group Connections</h3>
      
      <div>
        <p className="mb-3 text-gray-700">
          {formState.distributesGratuities 
            ? 'Select which groups will receive gratuities from this group:'
            : 'Select which groups will distribute gratuities to this group:'
          }
        </p>
        
        {availableConnections.length > 0 ? (
          <div className="space-y-2 p-4 bg-gray-50 rounded max-h-60 overflow-y-auto">
            {availableConnections.map(group => (
              <label key={group.id} className="flex items-center space-x-2 p-2 hover:bg-white rounded">
                <input
                  type="checkbox"
                  checked={currentConnections.includes(group.id)}
                  onChange={() => handleConnectionToggle(group.id)}
                  className="rounded border-gray-300"
                />
                <div className="flex-1">
                  <span className="font-medium">{group.name}</span>
                  {group.description && (
                    <div className="text-sm text-gray-500">{group.description}</div>
                  )}
                  <div className="text-xs text-gray-400">
                    {group.gratuityConfig.distributesGratuities ? 'Distributes gratuities' : 'Receives gratuities'}
                  </div>
                </div>
              </label>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800">
              No available groups to connect with. 
              {formState.distributesGratuities 
                ? ' Create groups that receive gratuities first.'
                : ' Create groups that distribute gratuities first.'
              }
            </p>
          </div>
        )}
        
        {currentConnections.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded">
            <p className="text-blue-800 font-medium">
              {formState.distributesGratuities ? 'Distributing to' : 'Receiving from'} {currentConnections.length} group{currentConnections.length !== 1 ? 's' : ''}
            </p>
            <div className="text-sm text-blue-600 mt-1">
              {currentConnections.map(connectionId => {
                const connectedGroup = availableGroups.find(g => g.id === connectionId);
                return connectedGroup ? connectedGroup.name : connectionId;
              }).join(', ')}
            </div>
          </div>
        )}
      </div>
      
      {/* Distribution Method for Recipient Groups */}
      {!formState.distributesGratuities && currentConnections.length > 0 && (
        <div className="space-y-4 p-4 bg-white rounded border-2 border-blue-200">
          <h4 className="font-medium text-blue-900">Distribution Method</h4>
          <p className="text-sm text-gray-600">How should this group receive gratuities?</p>
          
          <div className="space-y-3">
            <label className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300">
              <input
                type="radio"
                name="distributionType"
                checked={formState.distributionType === 'percentage'}
                onChange={() => updateForm({ 
                  distributionType: 'percentage',
                  fixedAmount: undefined 
                })}
                className="mt-1 text-blue-600"
              />
              <div className="flex-1">
                <span className="font-medium">Percentage (%)</span>
                <p className="text-xs text-gray-500 mt-1">
                  Receive a percentage of each distributor's tips
                </p>
              </div>
            </label>
            
            {formState.distributionType === 'percentage' && (
              <div className="ml-9 space-y-2">
                <input
                  type="number"
                  placeholder="Enter percentage (e.g., 15)"
                  value={formState.percentage || ''}
                  onChange={(e) => updateForm({ percentage: parseFloat(e.target.value) || undefined })}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                  min="0"
                  max="100"
                  step="0.1"
                />
                {percentageWarning && (
                  <div className={`p-3 rounded text-sm ${
                    formState.percentage! > 100 
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  }`}>
                    {percentageWarning}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Example: 15% means this group receives 15% of each distributor member's tips
                </p>
              </div>
            )}
            
            <label className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-blue-300">
              <input
                type="radio"
                name="distributionType"
                checked={formState.distributionType === 'fixed'}
                onChange={() => updateForm({ 
                  distributionType: 'fixed',
                  percentage: undefined 
                })}
                className="mt-1 text-blue-600"
              />
              <div className="flex-1">
                <span className="font-medium">Fixed Amount ($)</span>
                <p className="text-xs text-gray-500 mt-1">
                  Receive a fixed dollar amount from each distributor
                </p>
              </div>
            </label>
            
            {formState.distributionType === 'fixed' && (
              <div className="ml-9 space-y-2">
                <input
                  type="number"
                  placeholder="Enter dollar amount (e.g., 25.00)"
                  value={formState.fixedAmount || ''}
                  onChange={(e) => updateForm({ fixedAmount: parseFloat(e.target.value) || undefined })}
                  className="border border-gray-300 rounded px-3 py-2 w-full"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-gray-500">
                  Example: $25 means this group receives $25 from each distributor member
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW: Tip Pool for RECIPIENT groups */}
      {!formState.distributesGratuities && 
       formState.distributionType === 'percentage' && 
       formState.percentage && (
        <div className="mt-6 p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-3 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/>
            </svg>
            Tip Pool Sharing (Optional)
          </h4>

          {(() => {
            // Find other recipient groups with same percentage
            const eligiblePoolGroups = staffGroups.filter(g => 
              !g.gratuityConfig.distributesGratuities && // Is recipient
              g.gratuityConfig.percentage === formState.percentage && // Same percentage
              g.id !== editingGroup?.id // Not this group
            );

            if (eligiblePoolGroups.length === 0) {
              return (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <p className="text-sm text-gray-600">
                    No other recipient groups with {formState.percentage}% exist yet.
                    You'll be able to share tips with other groups when more are created.
                  </p>
                </div>
              );
            }

            return (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  You can share this {formState.percentage}% with other groups instead of each receiving the full amount.
                </p>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.useSharedTipPool || false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Check if any eligible groups already have a pool
                        let existingPoolId = null;
                        for (const group of eligiblePoolGroups) {
                          if (group.gratuityConfig.tipPoolId) {
                            existingPoolId = group.gratuityConfig.tipPoolId;
                            break;
                          }
                        }
                        
                        const poolId = existingPoolId || `pool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        
                        // Auto-select all eligible groups
                        updateForm({ 
                          useSharedTipPool: true, 
                          sharedTipPoolId: poolId,
                          poolWithGroupIds: eligiblePoolGroups.map(g => g.id)
                        });
                      } else {
                        updateForm({ 
                          useSharedTipPool: false, 
                          sharedTipPoolId: undefined,
                          poolWithGroupIds: []
                        });
                      }
                    }}
                    className="mt-1 h-4 w-4 text-purple-600"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">
                      Share {formState.percentage}% with {eligiblePoolGroups.length} other group{eligiblePoolGroups.length !== 1 ? 's' : ''}
                    </span>
                    <p className="text-sm text-gray-600 mt-1">
                      All groups will split a single {formState.percentage}% pool based on hours worked.
                    </p>
                  </div>
                </label>

                {formState.useSharedTipPool && (
                  <div className="mt-4 p-3 bg-white border border-purple-200 rounded">
                    <p className="text-xs font-medium text-purple-900 mb-2">Groups in this pool:</p>
                    <ul className="text-sm text-purple-800 space-y-1">
                      <li>• {formState.name || 'This group'} (new)</li>
                      {eligiblePoolGroups.map(group => (
                        <li key={group.id}>• {group.name}</li>
                      ))}
                    </ul>
                    <div className="mt-3 p-2 bg-purple-100 rounded">
                      <p className="text-xs text-purple-700">
                        <strong>Total tip out from each distributor: {formState.percentage}%</strong>
                        <br />
                        Split proportionally based on hours worked across all groups.
                      </p>
                    </div>
                  </div>
                )}

                {/* Visual comparison */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded border ${!formState.useSharedTipPool ? 'border-orange-400 bg-orange-50' : 'border-gray-300 bg-gray-50'}`}>
                    <div className="text-xs font-medium mb-2">❌ Without Sharing</div>
                    <div className="text-xs space-y-1">
                      <div>This group: {formState.percentage}%</div>
                      {eligiblePoolGroups.map(g => (
                        <div key={g.id}>{g.name}: {formState.percentage}%</div>
                      ))}
                      <div className="pt-2 border-t mt-2 font-bold text-orange-600">
                        Total: {formState.percentage * (eligiblePoolGroups.length + 1)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className={`p-3 rounded border ${formState.useSharedTipPool ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'}`}>
                    <div className="text-xs font-medium mb-2">✅ With Sharing</div>
                    <div className="text-xs space-y-1">
                      <div>Shared pool for all groups</div>
                      <div className="text-gray-600">Split by hours worked</div>
                      <div className="pt-2 border-t mt-2 font-bold text-green-600">
                        Total: {formState.percentage}%
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={handleBack} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={formState.percentage! > 100}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};


  const renderReviewStep = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Review & Submit</h3>
      
      <div className="bg-gray-50 p-4 rounded space-y-3">
        <div><strong>Name:</strong> {formState.name}</div>
        <div><strong>Description:</strong> {formState.description || 'None'}</div>
        <div><strong>Staff Members:</strong> {formState.selectedStaffMemberIds.length} selected</div>
        <div><strong>Gratuity Role:</strong> {formState.distributesGratuities ? 'Distributes gratuities' : 'Receives gratuities'}</div>
        
        {/* Show contribution source for distributor groups */}
        {formState.distributesGratuities && formState.contributionSource && (
          <div>
            <strong>Contribution Source:</strong>{' '}
            {formState.contributionSource === 'gratuities' 
              ? 'Total Gratuities Collected (CC + Cash tips)'
              : 'Percentage of Sales'
            }
          </div>
        )}
        
        {/* Show connections for distributor groups */}
        {formState.distributesGratuities && (formState.recipientGroupIds || []).length > 0 && (
          <div>
            <strong>Distributing To:</strong>
            <ul className="ml-4 list-disc">
              {(formState.recipientGroupIds || []).map(groupId => {
                const group = availableGroups.find(g => g.id === groupId);
                return <li key={groupId}>{group ? group.name : groupId}</li>;
              })}
            </ul>
          </div>
        )}
        
        {/* Show connections and distribution method for receiver groups */}
        {!formState.distributesGratuities && (formState.sourceGroupIds || []).length > 0 && (
          <>
            <div>
              <strong>Receiving From:</strong>
              <ul className="ml-4 list-disc">
                {(formState.sourceGroupIds || []).map(groupId => {
                  const group = availableGroups.find(g => g.id === groupId);
                  return <li key={groupId}>{group ? group.name : groupId}</li>;
                })}
              </ul>
            </div>
            
            {formState.distributionType && (
              <div className="mt-2 p-3 bg-blue-50 rounded">
                <strong>Distribution Method:</strong>
                <div className="ml-2">
                  {formState.distributionType === 'fixed' && (
                    <span>Fixed Amount: ${formState.fixedAmount?.toFixed(2)}</span>
                  )}
                  {formState.distributionType === 'percentage' && (
                    <span>Percentage: {formState.percentage}%</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={handleBack} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
          Back
        </button>
        <div className="space-x-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {editingGroup ? 'Update Group' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );

  console.log('🔍 Current form step:', formState.step);
  console.log('🔍 Gratuity setting:', formState.distributesGratuities);
  console.log('🔍 Contribution source:', formState.contributionSource);
  console.log('🔍 Available groups:', availableGroups.length);

  return (
  // Full-screen overlay
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - click to close */}
      <div 
        className="fixed inset-0 backdrop-blur-md transition-all duration-900" 
        onClick={onClose}
      />
      
      {/* Modal Container - Centers content vertically */}
      <div className="flex min-h-full items-center justify-center p-4">
        
        {/* Modal Content - White box with content */}
        <div 
          className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
          {/* Close Button (X) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold z-10"
            aria-label="Close modal"
          >
            ×
          </button>

          {/* Scrollable Content Area */}
          <div className="overflow-y-auto max-h-[85vh] p-6">
            <h2 className="text-xl font-semibold mb-6">
              {editingGroup ? `Edit "${editingGroup.name}"` : 'Create New Staff Group'}
            </h2>
            
            {/* Step indicator */}
            <div className="flex items-center mb-6 text-xs">
              {/* Your existing step indicator code stays here */}
              {/* Step 1: Basic */}
              <div className={`flex items-center ${formState.step === 'basic' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  formState.step === 'basic' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}>1</div>
                <span className="ml-2 hidden sm:inline">Basic</span>
              </div>
              <div className="flex-1 h-px bg-gray-200 mx-2"></div>
              
              {/* Step 2: Gratuity */}
              <div className={`flex items-center ${formState.step === 'gratuity-setup' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  formState.step === 'gratuity-setup' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}>2</div>
                <span className="ml-2 hidden sm:inline">Gratuity</span>
              </div>
              <div className="flex-1 h-px bg-gray-200 mx-2"></div>
              
              {/* Step 3: Contribution (conditional) */}
              {formState.distributesGratuities === true && (
                <>
                  <div className={`flex items-center ${formState.step === 'contribution-source' ? 'text-blue-600' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      formState.step === 'contribution-source' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                    }`}>3</div>
                    <span className="ml-2 hidden sm:inline">Source</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200 mx-2"></div>
                </>
              )}
              
              {/* Step 4/3: Connections */}
              <div className={`flex items-center ${formState.step === 'connection-setup' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  formState.step === 'connection-setup' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}>{formState.distributesGratuities === true ? '4' : '3'}</div>
                <span className="ml-2 hidden sm:inline">Connect</span>
              </div>
              <div className="flex-1 h-px bg-gray-200 mx-2"></div>
              
              {/* Step 5/4: Review */}
              <div className={`flex items-center ${formState.step === 'review' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  formState.step === 'review' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}>{formState.distributesGratuities === true ? '5' : '4'}</div>
                <span className="ml-2 hidden sm:inline">Review</span>
              </div>
            </div>

            {/* Render current step - Your existing code stays here */}
            {formState.step === 'basic' && renderBasicStep()}
            {formState.step === 'gratuity-setup' && renderGratuityStep()}
            {formState.step === 'contribution-source' && renderContributionSourceStep()}
            {formState.step === 'connection-setup' && renderConnectionStep()}
            {formState.step === 'review' && renderReviewStep()}
          </div>
        </div>
      </div>
    </div>
  );
}

  