-- Additive only. Arc V1.1 rows remain in their original 5042-constrained tables.
CREATE TABLE IF NOT EXISTS rat_v11_pons_discovery_snapshots (
  discovery_id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL CHECK(chain_id = 4663),
  source_checkpoint TEXT NOT NULL,
  rule_version TEXT NOT NULL CHECK(rule_version = 'RATS_PONS_DEPLOYER_RECURRENCE_V1'),
  coverage_status TEXT NOT NULL CHECK(coverage_status = 'PARTIAL'),
  snapshot_json TEXT NOT NULL,
  generated_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_v11_pons_discovery_expiry
  ON rat_v11_pons_discovery_snapshots(expires_at_ms);

CREATE TABLE IF NOT EXISTS rat_v11_pons_public_receipts (
  receipt_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES rat_v1_cases(case_id),
  chain_id INTEGER NOT NULL CHECK(chain_id = 4663),
  receipt_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_v11_pons_public_receipts_case ON rat_v11_pons_public_receipts(case_id);
CREATE INDEX IF NOT EXISTS idx_rat_v11_pons_public_receipts_expiry ON rat_v11_pons_public_receipts(expires_at_ms);
