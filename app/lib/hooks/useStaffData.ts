/**
 * Custom SWR hooks for fetching staff data with caching and revalidation
 * 
 * Benefits:
 * - Automatic caching
 * - Request deduplication
 * - Background revalidation
 * - Optimistic updates
 * - Error retry logic
 */

import useSWR, { mutate } from 'swr';
import type { StaffMember, AnyStaffGroup, DailyShift } from '../../../types';

// ============================================
// Types
// ============================================

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

interface StaffMembersResponse {
  success: boolean;
  members: StaffMember[];
  count: number;
}

interface StaffGroupsResponse {
  success: boolean;
  groups: AnyStaffGroup[];
  count?: number;
}

interface DailyShiftResponse {
  success: boolean;
  shift: DailyShift;
}

// ============================================
// Fetcher Functions
// ============================================

/**
 * Generic fetcher for SWR
 */
const fetcher = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'An error occurred while fetching data');
  }
  
  return response.json();
};

/**
 * POST fetcher for mutations
 */
const postFetcher = async <T,>(url: string, data: any): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'An error occurred');
  }
  
  return response.json();
};

// ============================================
// SWR Configuration Options
// ============================================

const defaultSWRConfig = {
  revalidateOnFocus: false,        // Don't refetch when window regains focus
  revalidateOnReconnect: true,     // Refetch when reconnecting to internet
  dedupingInterval: 2000,          // Dedupe requests within 2 seconds
  shouldRetryOnError: true,        // Retry on error
  errorRetryCount: 3,              // Retry up to 3 times
};

const staffDataConfig = {
  ...defaultSWRConfig,
  revalidateOnMount: true,         // Always fetch on mount
  refreshInterval: 0,              // Don't auto-refresh (manual only)
};

// ============================================
// Staff Members Hooks
// ============================================

/**
 * Fetch all staff members with automatic caching
 */
export function useStaffMembers() {
  const { data, error, isLoading, mutate: refresh } = useSWR<StaffMembersResponse>(
    '/api/staff-members',
    fetcher,
    staffDataConfig
  );

  return {
    members: data?.members || [],
    count: data?.count || 0,
    isLoading,
    isError: error,
    error,
    refresh, // Manual refresh function
  };
}

/**
 * Create a new staff member with optimistic updates
 */
export async function createStaffMember(
  firstName: string,
  lastName: string,
): Promise<StaffMember> {
  const response = await postFetcher<{ success: boolean; member: StaffMember }>(
    '/api/staff-members',
    { firstName, lastName }
  );

  if (!response.success) {
    throw new Error('Failed to create staff member');
  }

  // Revalidate the staff members list
  await mutate('/api/staff-members');

  return response.member;
}

/**
 * Delete a staff member
 */
export async function deleteStaffMember(id: string): Promise<void> {
  const response = await fetch(`/api/staff-members/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete staff member');
  }

  // Revalidate the staff members list
  await mutate('/api/staff-members');
}

// ============================================
// Staff Groups Hooks
// ============================================

/**
 * Fetch all staff groups with automatic caching
 */
export function useStaffGroups() {
  const { data, error, isLoading, mutate: refresh } = useSWR<StaffGroupsResponse>(
    '/api/staff/groups',
    fetcher,
    staffDataConfig
  );

  return {
    groups: data?.groups || [],
    count: data?.count || data?.groups.length || 0,
    isLoading,
    isError: error,
    error,
    refresh,
  };
}

/**
 * Create a new staff group with optimistic updates
 */
export async function createStaffGroup(groupData: any): Promise<AnyStaffGroup> {
  const response = await postFetcher<{ success: boolean; group: AnyStaffGroup }>(
    '/api/staff/groups',
    groupData
  );

  if (!response.success) {
    throw new Error('Failed to create staff group');
  }

  // Revalidate both groups and members (since members might be assigned)
  await Promise.all([
    mutate('/api/staff/groups'),
    mutate('/api/staff-members'),
  ]);

  return response.group;
}

/**
 * Update a staff group
 */
export async function updateStaffGroup(id: string, groupData: any): Promise<AnyStaffGroup> {
  const response = await fetch(`/api/staff/groups/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(groupData),
  });

  if (!response.ok) {
    throw new Error('Failed to update staff group');
  }

  const result = await response.json();

  // Revalidate groups
  await mutate('/api/staff/groups');

  return result.group;
}

/**
 * Delete a staff group
 */
export async function deleteStaffGroup(id: string): Promise<void> {
  const response = await fetch(`/api/staff/groups/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete staff group');
  }

  // Revalidate groups
  await mutate('/api/staff/groups');
}

// ============================================
// Daily Shifts Hooks
// ============================================

/**
 * Fetch all daily shifts
 */
export function useDailyShifts() {
  const { data, error, isLoading, mutate: refresh } = useSWR<{ success: boolean; shifts: DailyShift[] }>(
    '/api/daily-shifts',
    fetcher,
    {
      ...defaultSWRConfig,
      refreshInterval: 30000, // Auto-refresh every 30 seconds for shifts
    }
  );

  return {
    shifts: data?.shifts || [],
    isLoading,
    isError: error,
    error,
    refresh,
  };
}

/**
 * Fetch a specific daily shift
 */
export function useDailyShift(shiftId: string | null) {
  const { data, error, isLoading, mutate: refresh } = useSWR<DailyShiftResponse>(
    shiftId ? `/api/daily-shifts/${shiftId}` : null,
    fetcher,
    {
      ...defaultSWRConfig,
      refreshInterval: 10000, // Refresh every 10 seconds for active shift
    }
  );

  return {
    shift: data?.shift || null,
    isLoading,
    isError: error,
    error,
    refresh,
  };
}

/**
 * Create a new daily shift
 */
export async function createDailyShift(
  date: string,
  type: 'FULL_DAY' | 'LUNCH' | 'DINNER'
): Promise<DailyShift> {
  const response = await postFetcher<DailyShiftResponse>(
    '/api/daily-shifts',
    { date, type }
  );

  if (!response.success) {
    throw new Error('Failed to create daily shift');
  }

  // Revalidate shifts list
  await mutate('/api/daily-shifts');

  return response.shift;
}

/**
 * Update a daily shift
 */
export async function updateDailyShift(shiftId: string, shiftData: any): Promise<DailyShift> {
  const response = await fetch(`/api/daily-shifts/${shiftId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shiftData),
  });

  if (!response.ok) {
    throw new Error('Failed to update daily shift');
  }

  const result = await response.json();

  // Revalidate both the specific shift and the list
  await Promise.all([
    mutate(`/api/daily-shifts/${shiftId}`),
    mutate('/api/daily-shifts'),
  ]);

  return result.shift;
}

// ============================================
// Combined Hooks (Fetch Multiple Resources)
// ============================================

/**
 * Fetch both staff members and groups together
 * Useful for pages that need both
 */
export function useStaffData() {
  const membersResult = useStaffMembers();
  const groupsResult = useStaffGroups();

  return {
    members: membersResult.members,
    groups: groupsResult.groups,
    isLoading: membersResult.isLoading || groupsResult.isLoading,
    isError: membersResult.isError || groupsResult.isError,
    error: membersResult.error || groupsResult.error,
    refreshMembers: membersResult.refresh,
    refreshGroups: groupsResult.refresh,
    refreshAll: async () => {
      await Promise.all([
        membersResult.refresh(),
        groupsResult.refresh(),
      ]);
    },
  };
}

// ============================================
// Cache Management Utilities
// ============================================

/**
 * Clear all cached data (useful for logout or reset)
 */
export function clearAllCache() {
  mutate(
    () => true, // Clear all keys
    undefined,
    { revalidate: false }
  );
}

/**
 * Manually revalidate specific endpoints
 */
export async function revalidateStaffData() {
  await Promise.all([
    mutate('/api/staff-members'),
    mutate('/api/staff/groups'),
  ]);
}

/**
 * Prefetch data (useful for preloading)
 */
export async function prefetchStaffData() {
  await Promise.all([
    mutate('/api/staff-members', fetcher('/api/staff-members')),
    mutate('/api/staff/groups', fetcher('/api/staff/groups')),
  ]);
}