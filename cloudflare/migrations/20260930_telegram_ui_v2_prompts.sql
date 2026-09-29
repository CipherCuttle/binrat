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
