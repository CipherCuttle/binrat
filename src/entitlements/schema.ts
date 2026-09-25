// Separate candidate schema: NOT part of cloudflare/schema.sql or any deployed migration.
export const ENTITLEMENTS_CANDIDATE_SQL = `
CREATE TABLE IF NOT EXISTS candidate_entitlement_periods (
  account_id TEXT NOT NULL,
  period_id TEXT NOT NULL,
  funding_source TEXT NOT NULL CHECK (funding_source='OFFLINE_FIXTURE'),
  funding_ref TEXT NOT NULL UNIQUE,
  global_cap_units INTEGER NOT NULL CHECK(global_cap_units>=0),
  arc_cap_units INTEGER NOT NULL CHECK(arc_cap_units>=0),
  pons_cap_units INTEGER NOT NULL CHECK(pons_cap_units>=0),
  expires_at_ms INTEGER NOT NULL CHECK(expires_at_ms>0),
  state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','REVOKED')),
  PRIMARY KEY(account_id,period_id)
);
CREATE TABLE IF NOT EXISTS candidate_entitlement_reservations (
  account_id TEXT NOT NULL,
  period_id TEXT NOT NULL,
  request_key TEXT NOT NULL,
  chain_id INTEGER NOT NULL CHECK(chain_id IN (5042,4663)),
  cost_class TEXT NOT NULL CHECK(cost_class IN ('EXTENDED_RADAR','DEEP_REPLAY','PRO_ALERT')),
  units INTEGER NOT NULL CHECK(units BETWEEN 1 AND 1000000),
  state TEXT NOT NULL CHECK(state IN ('RESERVED','CONSUMED','RELEASED','REFUNDED')),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY(account_id,period_id,request_key),
  FOREIGN KEY(account_id,period_id)
    REFERENCES candidate_entitlement_periods(account_id,period_id)
);
CREATE INDEX IF NOT EXISTS idx_candidate_entitlement_account_cost
  ON candidate_entitlement_reservations(account_id,period_id,state,chain_id);
`;
