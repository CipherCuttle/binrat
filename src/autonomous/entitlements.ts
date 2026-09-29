/** Capacity only. No factual projection consumes a profile or a wallet balance. */
export type CapacityProfile = 'FREE' | 'PRO' | 'HOLDER';
export interface Principal { userId: number; chatId: number }
export interface Capacity {
  profile: CapacityProfile;
  watchLimit: number;
  digsPerDay: number;
  globalDigsPerDay: number;
  historyDepth: number;
  alertPolicy: 'CREATOR_RECURRENCE_V1';
  groupSlots: number;
  deepDigsPerDay: number;
}
export interface EntitlementProvider { resolve(principal: Principal): Promise<Readonly<Capacity>> }
export const FREE_CAPACITY: Readonly<Capacity> = Object.freeze({
  profile: 'FREE', watchLimit: 25, digsPerDay: 30, globalDigsPerDay: 1000,
  historyDepth: 5, alertPolicy: 'CREATOR_RECURRENCE_V1', groupSlots: 0, deepDigsPerDay: 0
});
// Intentionally no env switch, session argument, funding fixture or holder balance.
export class FreeEntitlements implements EntitlementProvider {
  async resolve(_principal: Principal): Promise<Readonly<Capacity>> { return FREE_CAPACITY; }
}

export function assertPrincipal(p: Principal): void {
  if (!Number.isSafeInteger(p.userId) || p.userId <= 0 || p.userId !== p.chatId) {
    throw new Error('PRIVATE_DM_REQUIRED');
  }
}
