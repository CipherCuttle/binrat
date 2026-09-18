CREATE TABLE IF NOT EXISTS launches (
  launch_id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  block_number TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  source TEXT NOT NULL,
  launcher TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  token TEXT NOT NULL,
  creator TEXT NOT NULL,
  pool TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  image_uri TEXT NOT NULL,
  website TEXT NOT NULL,
  twitter TEXT NOT NULL,
  telegram TEXT NOT NULL,
  observed_at_ms INTEGER NOT NULL,
  authority_json TEXT NOT NULL,
  UNIQUE(chain_id, tx_hash, token),
  UNIQUE(chain_id, token)
);
CREATE INDEX IF NOT EXISTS idx_launches_chain_block ON launches(chain_id, block_number);
CREATE INDEX IF NOT EXISTS idx_launches_creator_order ON launches(chain_id, creator, block_number, log_index);

CREATE TABLE IF NOT EXISTS provenance_facts (
  fact_id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  launch_id TEXT NOT NULL UNIQUE REFERENCES launches(launch_id) ON DELETE CASCADE,
  creator TEXT NOT NULL,
  observed_block TEXT NOT NULL,
  observed_block_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  source_event_id TEXT NOT NULL,
  evidence_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provenance_facts_creator_order
  ON provenance_facts(chain_id, creator, observed_block, log_index);

CREATE TABLE IF NOT EXISTS provenance_edges (
  edge_id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  evidence_class TEXT NOT NULL,
  observed_block TEXT NOT NULL,
  observed_block_hash TEXT NOT NULL,
  source_fact_ids_json TEXT NOT NULL,
  derivation_version TEXT NOT NULL,
  evidence_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provenance_edges_order ON provenance_edges(chain_id, observed_block, edge_id);

CREATE TABLE IF NOT EXISTS launch_observations (
  observation_id TEXT PRIMARY KEY,
  observation_version TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  launch_id TEXT NOT NULL REFERENCES launches(launch_id) ON DELETE CASCADE,
  horizon_ms INTEGER NOT NULL,
  observed_block TEXT NOT NULL,
  observed_block_hash TEXT NOT NULL,
  observed_timestamp_ms INTEGER NOT NULL,
  evidence_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(launch_id, horizon_ms, observation_version)
);
CREATE INDEX IF NOT EXISTS idx_launch_observations_launch_horizon
  ON launch_observations(chain_id, launch_id, horizon_ms);
CREATE INDEX IF NOT EXISTS idx_launch_observations_observed_block
  ON launch_observations(chain_id, observed_block);

CREATE TABLE IF NOT EXISTS launch_history_backfill_state (
  chain_id INTEGER PRIMARY KEY,
  next_block TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chain_checkpoints (
  chain_id INTEGER PRIMARY KEY,
  block_number TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  guard_block_number TEXT,
  guard_block_hash TEXT
);

-- A failing CHECK inside D1 batch() aborts and rolls back the whole batch.
-- The store uses this only as an invariant tripwire; successful operations insert no rows.
CREATE TABLE IF NOT EXISTS binrat_runtime_state (
  chain_id INTEGER PRIMARY KEY,
  source_verified INTEGER NOT NULL,
  live_caught_up INTEGER NOT NULL,
  head_block TEXT,
  target_block TEXT,
  observation_ready INTEGER NOT NULL,
  history_backfill_complete INTEGER NOT NULL,
  history_backfill_target_block TEXT,
  last_sync_error TEXT,
  last_history_error TEXT,
  last_observation_error TEXT,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binrat_sync_leases (
  lease_name TEXT PRIMARY KEY,
  owner_token TEXT NOT NULL,
  lease_until_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_update_receipts (
  update_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('CLAIMED','REPLIED','IGNORED','RATE_LIMITED')),
  claim_expires_at_ms INTEGER,
  chat_id INTEGER,
  intent TEXT,
  renderer_version TEXT,
  voice_variant INTEGER,
  plan_digest TEXT,
  reply_digest TEXT,
  answer_plan_json TEXT,
  receipt_ids_json TEXT,
  telegram_message_id INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_rate_windows (
  chat_id INTEGER PRIMARY KEY,
  started_at_ms INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS binrat_invariant_guard (
  must_be_zero INTEGER NOT NULL CHECK (must_be_zero = 0)
);
