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
