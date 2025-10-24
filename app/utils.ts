export const getRandomTips = (min: number, max: number): number => {
  return +(Math.random() * (max - min) + min).toFixed(2);
}

// Random hours generator
export function generateRandomHours(min = 4, max = 8.15): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

// Validation: Check if all numbers balance
export function validateShiftBalance(
  contributions: IndividualContribution[],
  payouts: MemberPayout[]
): { balanced: boolean; discrepancy: number } {
  const totalDistributed = contributions.reduce((sum, c) => sum + c.totalContribution, 0);
  const totalPaidOut = payouts.reduce((sum, p) => sum + p.payout, 0);
  const discrepancy = Math.abs(totalDistributed - totalPaidOut);
  
  return {
    balanced: discrepancy < 0.01, // Allow 1 cent rounding error
    discrepancy
  };
}