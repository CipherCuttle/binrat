CREATE TABLE IF NOT EXISTS pons_token_identity_receipts (
  identity_id TEXT PRIMARY KEY,
  identity_version TEXT NOT NULL CHECK(identity_version = 'BINRAT_PONS_TOKEN_IDENTITY_V1'),
  chain_id INTEGER NOT NULL CHECK(chain_id = 4663),
  launch_id TEXT NOT NULL UNIQUE REFERENCES launches(launch_id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  observed_block TEXT NOT NULL,
  observed_block_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL CHECK(decimals BETWEEN 0 AND 255),
  evidence_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pons_token_identity_token
  ON pons_token_identity_receipts(chain_id, token);
