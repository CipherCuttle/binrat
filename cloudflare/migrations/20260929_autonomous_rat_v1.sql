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
