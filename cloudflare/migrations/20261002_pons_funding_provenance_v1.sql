CREATE TABLE IF NOT EXISTS pons_funding_receipts (
  funding_id TEXT PRIMARY KEY,
  funding_version TEXT NOT NULL CHECK(funding_version = 'BINRAT_PONS_PRELAUNCH_NATIVE_INBOUND_V1'),
  chain_id INTEGER NOT NULL CHECK(chain_id = 4663),
  launch_id TEXT NOT NULL UNIQUE REFERENCES launches(launch_id) ON DELETE CASCADE,
  deployer TEXT NOT NULL,
  launch_block TEXT NOT NULL,
  launch_block_hash TEXT NOT NULL,
  source_address TEXT NOT NULL,
  transfer_tx_hash TEXT NOT NULL,
  transfer_block TEXT NOT NULL,
  transfer_block_hash TEXT NOT NULL,
  transfer_timestamp_ms INTEGER NOT NULL,
  value_wei TEXT NOT NULL,
  evidence_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pons_funding_source
  ON pons_funding_receipts(chain_id, source_address, launch_block);
CREATE INDEX IF NOT EXISTS idx_pons_funding_transfer_block
  ON pons_funding_receipts(chain_id, transfer_block);

CREATE TABLE IF NOT EXISTS pons_funding_scan_state (
  launch_id TEXT PRIMARY KEY REFERENCES launches(launch_id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL CHECK(chain_id = 4663),
  deployer TEXT NOT NULL,
  launch_block TEXT NOT NULL,
  launch_block_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status = 'NO_MATCH'),
  checked_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pons_funding_scan_status
  ON pons_funding_scan_state(chain_id, status, launch_block);

CREATE TABLE IF NOT EXISTS pons_funding_retry_state (
  launch_id TEXT PRIMARY KEY REFERENCES launches(launch_id) ON DELETE CASCADE,
  launch_block_hash TEXT NOT NULL,
  failure_count INTEGER NOT NULL CHECK(failure_count >= 0),
  retry_after_ms INTEGER NOT NULL,
  last_error TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pons_funding_retry_schedule
  ON pons_funding_retry_state(retry_after_ms, updated_at_ms);
