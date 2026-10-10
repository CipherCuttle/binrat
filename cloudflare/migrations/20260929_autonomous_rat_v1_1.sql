-- S2 discovery snapshots are shared, bounded and contain no Telegram identity.
CREATE TABLE IF NOT EXISTS rat_v11_discovery_snapshots (
  discovery_id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL CHECK(chain_id = 5042),
  source_checkpoint TEXT NOT NULL,
  rule_version TEXT NOT NULL CHECK(rule_version = 'RATS_CREATOR_RECURRENCE_V1'),
  coverage_status TEXT NOT NULL CHECK(coverage_status = 'PARTIAL'),
  snapshot_json TEXT NOT NULL,
  generated_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_v11_discovery_expiry
  ON rat_v11_discovery_snapshots(expires_at_ms);

-- Public receipt payloads are deliberately separate from private command/outbox state.
CREATE TABLE IF NOT EXISTS rat_v11_public_receipts (
  receipt_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES rat_v1_cases(case_id),
  chain_id INTEGER NOT NULL CHECK(chain_id = 5042),
  receipt_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_v11_public_receipts_case ON rat_v11_public_receipts(case_id);
CREATE INDEX IF NOT EXISTS idx_rat_v11_public_receipts_expiry ON rat_v11_public_receipts(expires_at_ms);
