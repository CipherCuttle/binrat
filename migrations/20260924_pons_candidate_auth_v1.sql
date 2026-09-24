-- Additive Robinhood/Pons candidate authentication tables. Never copy Arc sessions.
CREATE TABLE IF NOT EXISTS pons_candidate_auth_challenges (
  nonce TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  domain TEXT NOT NULL,
  uri TEXT NOT NULL,
  message TEXT NOT NULL,
  chain_id INTEGER NOT NULL CHECK(chain_id=4663),
  policy_id TEXT NOT NULL CHECK(policy_id='binrat.pons-candidate/v1'),
  issued_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  consumed_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pons_candidate_challenges_expiry
  ON pons_candidate_auth_challenges(expires_at_ms,consumed_at_ms);
CREATE TABLE IF NOT EXISTS pons_candidate_auth_sessions (
  session_hash TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  domain TEXT NOT NULL,
  chain_id INTEGER NOT NULL CHECK(chain_id=4663),
  policy_id TEXT NOT NULL CHECK(policy_id='binrat.pons-candidate/v1'),
  access_tier TEXT NOT NULL CHECK(access_tier='FREE'),
  issued_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  invalidated_at_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pons_candidate_sessions_scope
  ON pons_candidate_auth_sessions(domain,chain_id,policy_id,expires_at_ms);
