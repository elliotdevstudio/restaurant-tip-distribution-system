import { useAtomValue } from 'jotai';
import {
  staffBaseAmountsAtom,
  individualContributionsAtom,
  recipientPoolsAtom,
  memberPayoutsAtom,
  groupSummariesAtom,
  shiftTotalsAtom,
  tipEntriesAtom,
  shiftStaffAssignmentsAtom
} from '../atoms/staffAtoms';

export function useShiftCalculations() {
  const baseAmounts = useAtomValue(staffBaseAmountsAtom);
  const contributions = useAtomValue(individualContributionsAtom);
  const pools = useAtomValue(recipientPoolsAtom);
  const payouts = useAtomValue(memberPayoutsAtom);
  const groupSummaries = useAtomValue(groupSummariesAtom);
  const shiftTotals = useAtomValue(shiftTotalsAtom);
  const tipEntries = useAtomValue(tipEntriesAtom);
  const assignments = useAtomValue(shiftStaffAssignmentsAtom);

  const prepareShiftDataForSave = () => {
    // Transform data into format expected by API
    const staffData = assignments.map(assignment => {
      const entry = tipEntries.find(e => e.staffId === assignment.staffId);
      const contribution = contributions.find(c => c.staffId === assignment.staffId);
      const payout = payouts.find(p => p.staffId === assignment.staffId);
      
      return {
        staffId: assignment.staffId,
        firstName: '', // Will be filled by backend
        lastName: '', // Will be filled by backend
        groupId: assignment.activeGroupId,
        groupName: assignment.activeGroupName,
        hoursWorked: entry?.hoursWorked || 0,
        salesAmount: entry?.salesAmount,
        creditCardTips: entry?.creditCardTips,
        cashTips: entry?.cashTips,
        totalTipsCollected: contribution?.baseAmount,
        contributionAmount: contribution?.totalContribution,
        netTipAmount: contribution?.netTakeHome,
        receivedAmount: payout?.payout
      };
    });

    return {
      staffData,
      groupSummaries,
      shiftTotals
    };
  };

  return {
    baseAmounts,
    contributions,
    pools,
    payouts,
    groupSummaries,
    shiftTotals,
    prepareShiftDataForSave
  };
}