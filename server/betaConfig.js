export const BETA_CONFIG = {
  endDate: new Date('2026-09-30T23:59:59Z'),
  gracePeriodDays: 30,
  discountPercent: 10,
  discountDurationMonths: 12,
};

export function isBetaActive() {
  return new Date() < BETA_CONFIG.endDate;
}

export function isBetaGracePeriodActive() {
  const graceEnd = new Date(BETA_CONFIG.endDate);
  graceEnd.setDate(graceEnd.getDate() + BETA_CONFIG.gracePeriodDays);
  return new Date() >= BETA_CONFIG.endDate && new Date() < graceEnd;
}

export function getBetaStatus() {
  const now = new Date();
  const graceEnd = new Date(BETA_CONFIG.endDate);
  graceEnd.setDate(graceEnd.getDate() + BETA_CONFIG.gracePeriodDays);

  if (now < BETA_CONFIG.endDate) {
    const daysRemaining = Math.ceil((BETA_CONFIG.endDate - now) / (1000 * 60 * 60 * 24));
    return { phase: 'active', daysRemaining, endDate: BETA_CONFIG.endDate.toISOString() };
  }
  if (now < graceEnd) {
    const daysRemaining = Math.ceil((graceEnd - now) / (1000 * 60 * 60 * 24));
    return { phase: 'grace', daysRemaining, endDate: graceEnd.toISOString() };
  }
  return { phase: 'ended', daysRemaining: 0, endDate: BETA_CONFIG.endDate.toISOString() };
}
