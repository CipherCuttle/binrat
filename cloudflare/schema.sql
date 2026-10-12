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
CREATE INDEX IF NOT EXISTS idx_launches_chain_source_block_numeric
  ON launches(chain_id, source, CAST(block_number AS INTEGER), log_index, launch_id);
CREATE INDEX IF NOT EXISTS idx_launches_chain_block_numeric
  ON launches(chain_id, CAST(block_number AS INTEGER));
CREATE INDEX IF NOT EXISTS idx_launches_chain_source_creator_block_numeric
  ON launches(chain_id, source, creator, CAST(block_number AS INTEGER), log_index, launch_id);

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

CREATE TABLE IF NOT EXISTS binrat_public_snapshots (
  chain_id INTEGER PRIMARY KEY CHECK(chain_id = 4663),
  checkpoint_block TEXT NOT NULL,
  checkpoint_block_hash TEXT NOT NULL,
  feed_digest TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  verified_at_ms INTEGER NOT NULL,
  publication_version INTEGER NOT NULL CHECK(publication_version > 0)
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

CREATE TABLE IF NOT EXISTS rat_v1_cases (
  case_id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rat_v1_watches (
  user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  chain_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type = 'CREATOR'),
  entity_id TEXT NOT NULL,
  generation TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  start_block INTEGER NOT NULL,
  start_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  last_update_id INTEGER NOT NULL,
  policy TEXT NOT NULL CHECK(policy = 'CREATOR_RECURRENCE_V1'),
  PRIMARY KEY(user_id,chat_id,chain_id,entity_type,entity_id)
);
CREATE INDEX IF NOT EXISTS idx_rat_v1_watch_entity
  ON rat_v1_watches(chain_id,entity_type,entity_id,enabled,start_block);

CREATE TABLE IF NOT EXISTS rat_v1_commands (
  update_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  reply TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rat_v1_dig_requests (
  update_id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  day_utc INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_v1_dig_budget ON rat_v1_dig_requests(day_utc,user_id);

CREATE TABLE IF NOT EXISTS rat_v1_outbox (
  delivery_id TEXT PRIMARY KEY,
  observation_id TEXT NOT NULL,
  finding_id TEXT NOT NULL,
  case_id TEXT NOT NULL REFERENCES rat_v1_cases(case_id),
  chain_id INTEGER NOT NULL,
  launch_id TEXT NOT NULL,
  block_hash TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  chat_id INTEGER NOT NULL,
  watch_generation TEXT NOT NULL,
  watch_start_block INTEGER NOT NULL,
  watch_created_at_ms INTEGER NOT NULL,
  event_timestamp_ms INTEGER,
  attention TEXT NOT NULL CHECK(attention = 'ALERT'),
  reason TEXT NOT NULL CHECK(reason = 'EXPLICIT_FUTURE_CREATOR_RECURRENCE'),
  state TEXT NOT NULL CHECK(state IN ('PENDING','SENDING','SENT','UNKNOWN','FAILED','CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_ms INTEGER,
  telegram_message_id INTEGER,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(user_id,chat_id,chain_id,observation_id)
);
CREATE INDEX IF NOT EXISTS idx_rat_v1_outbox_pending ON rat_v1_outbox(state,created_at_ms);
CREATE INDEX IF NOT EXISTS idx_rat_v1_outbox_watch ON rat_v1_outbox(watch_generation,state);

-- Rewinds invalidate unsent work inside the same transaction that removes evidence.
-- SENT receipts survive; WHY still requires the original canonical evidence.
CREATE TRIGGER IF NOT EXISTS rat_v1_launch_rewind BEFORE DELETE ON launches
BEGIN
  UPDATE rat_v1_outbox SET state = 'CANCELLED'
  WHERE chain_id = OLD.chain_id AND launch_id = OLD.launch_id AND state = 'PENDING';
END;

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
CREATE INDEX IF NOT EXISTS idx_rat_v11_pons_discovery_expiry ON rat_v11_pons_discovery_snapshots(expires_at_ms);

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

-- Native Telegram DIG input receipts. Private-principal scoped; no user text.
CREATE TABLE IF NOT EXISTS rat_ui_prompts (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action = 'DIG'),
  source_update_id INTEGER NOT NULL,
  card_message_id INTEGER NOT NULL,
  prompt_message_id INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  PRIMARY KEY(chat_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_rat_ui_prompts_expiry ON rat_ui_prompts(expires_at_ms);

CREATE TABLE IF NOT EXISTS binrat_invariant_guard (
  must_be_zero INTEGER NOT NULL CHECK (must_be_zero = 0)
);

-- Disabled owner pilot. Apply explicitly; never reuses Arc creator-watch tables.
CREATE TABLE IF NOT EXISTS pons_tripwire_watches (
  owner_id TEXT NOT NULL,
  chat_id INTEGER NOT NULL CHECK(chat_id > 0),
  deployer TEXT NOT NULL,
  generation TEXT NOT NULL UNIQUE,
  source_launch_id TEXT NOT NULL,
  start_block INTEGER NOT NULL CHECK(start_block >= 0),
  start_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('ACTIVE','CANCELLED','REORG')),
  cursor_block INTEGER NOT NULL,
  cursor_log_index INTEGER NOT NULL,
  cursor_launch_id TEXT NOT NULL,
  next_allowed_ms INTEGER NOT NULL,
  PRIMARY KEY(owner_id,deployer)
);
CREATE INDEX IF NOT EXISTS idx_pons_tripwire_watch_state ON pons_tripwire_watches(state,created_at_ms,deployer);
-- Five total slots include cancelled watches; reopening reuses a slot. The
-- owner pilot cannot accumulate an unbounded subscription table.
CREATE TRIGGER IF NOT EXISTS pons_tripwire_watch_cap BEFORE INSERT ON pons_tripwire_watches
WHEN NOT EXISTS(SELECT 1 FROM pons_tripwire_watches WHERE owner_id=NEW.owner_id AND deployer=NEW.deployer)
  AND (SELECT COUNT(*) FROM (SELECT 1 FROM pons_tripwire_watches LIMIT 5))>=5
BEGIN SELECT RAISE(ABORT,'PONS_TRIPWIRE_WATCH_LIMIT'); END;
CREATE TABLE IF NOT EXISTS pons_tripwire_outbox (
  delivery_id TEXT PRIMARY KEY,
  watch_generation TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  chat_id INTEGER NOT NULL CHECK(chat_id > 0),
  deployer TEXT NOT NULL,
  launch_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  block_hash TEXT NOT NULL,
  evidence_digest TEXT NOT NULL,
  launch_authority_json TEXT NOT NULL,
  fact_payload_json TEXT NOT NULL,
  event_timestamp_ms INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PENDING','SENDING','SENT','UNKNOWN','FAILED','CANCELLED')),
  attempt_count INTEGER NOT NULL CHECK(attempt_count BETWEEN 0 AND 1),
  last_attempt_ms INTEGER,
  telegram_message_id INTEGER,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(owner_id,event_id)
);
CREATE INDEX IF NOT EXISTS idx_pons_tripwire_pending ON pons_tripwire_outbox(state,created_at_ms,delivery_id);
CREATE INDEX IF NOT EXISTS idx_pons_tripwire_generation ON pons_tripwire_outbox(watch_generation,created_at_ms DESC,delivery_id DESC);
CREATE TABLE IF NOT EXISTS pons_tripwire_daily_budget (
  day_utc INTEGER NOT NULL,
  principal TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts BETWEEN 1 AND 5),
  PRIMARY KEY(day_utc,principal)
);
CREATE TRIGGER IF NOT EXISTS pons_tripwire_launch_rewind BEFORE DELETE ON launches
BEGIN
  UPDATE pons_tripwire_outbox SET state='CANCELLED'
  WHERE launch_id=OLD.launch_id AND state='PENDING';
END;
