-- Apply separately to an explicitly selected candidate D1 database before enabling flags.
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
