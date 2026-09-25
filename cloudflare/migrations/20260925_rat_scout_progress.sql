-- Additive candidate-only migration; deployment not authorized.

-- One temporary, update-bound photo ID per Telegram /scout request. No user message text.
CREATE TABLE IF NOT EXISTS rat_scout_progress (
  update_id INTEGER PRIMARY KEY,
  chat_id INTEGER NOT NULL,
  telegram_message_id INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rat_scout_progress_expiry
  ON rat_scout_progress(expires_at_ms);

