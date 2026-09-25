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

CREATE TABLE IF NOT EXISTS holder_auth_challenges (
  nonce TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  domain TEXT NOT NULL,
  uri TEXT NOT NULL,
  message TEXT NOT NULL,
  issued_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  consumed_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_holder_auth_challenges_expiry
  ON holder_auth_challenges(expires_at_ms, consumed_at_ms);

CREATE TABLE IF NOT EXISTS holder_auth_sessions (
  session_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  access_tier TEXT NOT NULL CHECK (access_tier IN ('FREE','HOLDER')),
  policy_id TEXT NOT NULL,
  eligibility_status TEXT NOT NULL,
  issued_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  invalidated_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_holder_auth_sessions_wallet_expiry
  ON holder_auth_sessions(wallet, expires_at_ms);

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

CREATE TABLE IF NOT EXISTS rat_watch_subscriptions (
  chat_id INTEGER NOT NULL,
  creator TEXT NOT NULL,
  start_block TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (chat_id, creator)
);
CREATE INDEX IF NOT EXISTS idx_rat_watch_subscriptions_creator
  ON rat_watch_subscriptions(creator, chat_id);

CREATE TABLE IF NOT EXISTS rat_watch_alerts (
  alert_id TEXT PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  creator TEXT NOT NULL,
  launch_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING','SENT')),
  telegram_message_id INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(chat_id, launch_id)
);
CREATE INDEX IF NOT EXISTS idx_rat_watch_alerts_pending
  ON rat_watch_alerts(state, created_at_ms, alert_id);


CREATE TABLE IF NOT EXISTS rat_radar_swap_receipts (
  activity_id TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  launch_id TEXT NOT NULL REFERENCES launches(launch_id) ON DELETE CASCADE,
  pool TEXT NOT NULL,
  token TEXT NOT NULL,
  token0 TEXT NOT NULL,
  token1 TEXT NOT NULL,
  block_number TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  token_side TEXT NOT NULL CHECK (token_side IN ('TOKEN0','TOKEN1')),
  amount0 TEXT NOT NULL,
  amount1 TEXT NOT NULL,
  sqrt_price_x96 TEXT NOT NULL,
  liquidity TEXT NOT NULL,
  tick INTEGER NOT NULL,
  launched_token_delta TEXT NOT NULL,
  launched_token_flow TEXT NOT NULL CHECK (
    launched_token_flow IN ('POOL_TO_RECIPIENT','CALLBACK_SIDE_TO_POOL','ZERO_DELTA')
  ),
  evidence_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(chain_id, pool, tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS idx_rat_radar_swap_launch_order
  ON rat_radar_swap_receipts(chain_id, launch_id, block_number, log_index);
CREATE INDEX IF NOT EXISTS idx_rat_radar_swap_recipient_order
  ON rat_radar_swap_receipts(chain_id, recipient, block_number, log_index);
CREATE INDEX IF NOT EXISTS idx_rat_radar_swap_sender_order
  ON rat_radar_swap_receipts(chain_id, sender, block_number, log_index);


CREATE TABLE IF NOT EXISTS rat_radar_pool_cursors (
  launch_id TEXT PRIMARY KEY REFERENCES launches(launch_id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  next_block TEXT NOT NULL,
  retry_after_ms INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_radar_pool_cursor_schedule
  ON rat_radar_pool_cursors(chain_id, retry_after_ms, next_block, launch_id);

CREATE TABLE IF NOT EXISTS rat_conversation_context (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('CREATOR','LAUNCH','NONE')),
  value TEXT NOT NULL,
  last_bot_reply TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  PRIMARY KEY(chat_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_rat_conversation_context_expiry
  ON rat_conversation_context(expires_at_ms);


-- Only explicitly harmless, privately addressed AI exchanges; never facts or feedback.
-- Read access enforces expires_at_ms independently from this cleanup index.
CREATE TABLE IF NOT EXISTS rat_smalltalk_turns (
  update_id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_text TEXT NOT NULL CHECK (length(user_text) BETWEEN 1 AND 500),
  bot_reply TEXT NOT NULL CHECK (length(bot_reply) BETWEEN 1 AND 320),
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_smalltalk_turns_principal
  ON rat_smalltalk_turns(chat_id, user_id, created_at_ms DESC, update_id DESC);
CREATE INDEX IF NOT EXISTS idx_rat_smalltalk_turns_expiry
  ON rat_smalltalk_turns(expires_at_ms);

CREATE TABLE IF NOT EXISTS rat_ai_daily_budget (
  day_utc INTEGER NOT NULL,
  principal TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts >= 0 AND attempts <= 120),
  PRIMARY KEY(day_utc,principal)
);

CREATE TABLE IF NOT EXISTS rat_feedback (
  update_id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('BUG','IDEA','GENERAL')),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 5 AND 1200),
  created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_feedback_user ON rat_feedback(user_id, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_rat_feedback_created ON rat_feedback(created_at_ms);

CREATE TABLE IF NOT EXISTS rat_feedback_budget (
  day_utc INTEGER NOT NULL,
  principal TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts >= 0 AND attempts <= 100),
  PRIMARY KEY(day_utc,principal)
);

CREATE TABLE IF NOT EXISTS binrat_invariant_guard (
  must_be_zero INTEGER NOT NULL CHECK (must_be_zero = 0)
);
