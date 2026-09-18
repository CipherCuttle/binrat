import type { D1DatabaseLike } from './d1Types.js';

export class D1SyncLeaseStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async claim(
    leaseName: string,
    ownerToken: string,
    nowMs: number,
    leaseMs = 840_000
  ): Promise<boolean> {
    validateName(leaseName, 'SYNC_LEASE_NAME_INVALID');
    validateName(ownerToken, 'SYNC_LEASE_OWNER_INVALID');
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('SYNC_LEASE_TIME_INVALID');
    if (!Number.isSafeInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 900_000) {
      throw new Error('SYNC_LEASE_DURATION_INVALID');
    }

    const result = await this.db.prepare(`
      INSERT INTO binrat_sync_leases (
        lease_name,owner_token,lease_until_ms,updated_at_ms
      ) VALUES (?,?,?,?)
      ON CONFLICT(lease_name) DO UPDATE SET
        owner_token=excluded.owner_token,
        lease_until_ms=excluded.lease_until_ms,
        updated_at_ms=excluded.updated_at_ms
      WHERE binrat_sync_leases.lease_until_ms <= excluded.updated_at_ms
         OR binrat_sync_leases.owner_token = excluded.owner_token
    `).bind(leaseName, ownerToken, nowMs + leaseMs, nowMs).run();

    if (!result.success) throw new Error('SYNC_LEASE_CLAIM_FAILED');
    return Number(result.meta?.changes ?? 0) === 1;
  }

  async release(leaseName: string, ownerToken: string): Promise<void> {
    validateName(leaseName, 'SYNC_LEASE_NAME_INVALID');
    validateName(ownerToken, 'SYNC_LEASE_OWNER_INVALID');
    const result = await this.db.prepare(
      'DELETE FROM binrat_sync_leases WHERE lease_name = ? AND owner_token = ?'
    ).bind(leaseName, ownerToken).run();
    if (!result.success) throw new Error('SYNC_LEASE_RELEASE_FAILED');
  }
}

function validateName(value: string, code: string): void {
  if (!/^[A-Za-z0-9:_-]{1,200}$/.test(value)) throw new Error(code);
}
