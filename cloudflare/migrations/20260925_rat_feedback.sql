-- Additive migration. Apply BEFORE enabling RAT_FEEDBACK_ENABLED in production.
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

