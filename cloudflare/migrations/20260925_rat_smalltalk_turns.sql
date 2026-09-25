-- Additive migration: brief private AI smalltalk context, 30-minute TTL.

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
