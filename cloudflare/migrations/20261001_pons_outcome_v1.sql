CREATE TABLE IF NOT EXISTS pons_outcome_receipts (
  observation_id TEXT PRIMARY KEY,
  observation_version TEXT NOT NULL CHECK(observation_version = 'BINRAT_PONS_OUTCOME_OBSERVATION_V1'),
  chain_id INTEGER NOT NULL CHECK(chain_id = 4663),
  launch_id TEXT NOT NULL REFERENCES launches(launch_id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  curve TEXT NOT NULL,
  horizon_ms INTEGER NOT NULL CHECK(horizon_ms IN (300000,3600000,86400000)),
  target_timestamp_ms INTEGER NOT NULL,
  observed_block TEXT NOT NULL,
  observed_block_hash TEXT NOT NULL,
  observed_timestamp_ms INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK(phase IN ('CURVE','GRADUATED')),
  pair_token TEXT NOT NULL,
  quote_decimals INTEGER NOT NULL CHECK(quote_decimals BETWEEN 0 AND 255),
  estimated_fdv_quote_raw TEXT,
  status TEXT NOT NULL CHECK(status IN ('COMPLETE','PARTIAL')),
  evidence_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(launch_id,horizon_ms,observation_version)
);
CREATE INDEX IF NOT EXISTS idx_pons_outcome_launch_horizon
  ON pons_outcome_receipts(chain_id,launch_id,horizon_ms);
CREATE INDEX IF NOT EXISTS idx_pons_outcome_observed_block
  ON pons_outcome_receipts(chain_id,observed_block);
