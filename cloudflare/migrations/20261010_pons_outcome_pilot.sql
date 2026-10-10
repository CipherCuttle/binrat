-- Additive, offline only in A2.2. No default authorization or jobs.
CREATE TABLE IF NOT EXISTS pons_outcome_pilots (
  pilot_id TEXT PRIMARY KEY CHECK(length(pilot_id) BETWEEN 1 AND 64),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  start_block INTEGER NOT NULL CHECK(start_block>=0),
  valid_from_ms INTEGER NOT NULL CHECK(valid_from_ms>=0),
  expires_ms INTEGER NOT NULL CHECK(expires_ms>valid_from_ms AND expires_ms-valid_from_ms<=172800000),
  rpc_remaining INTEGER NOT NULL CHECK(rpc_remaining BETWEEN 0 AND 1200),
  cycles_remaining INTEGER NOT NULL CHECK(cycles_remaining BETWEEN 0 AND 120),
  next_enqueue_ms INTEGER NOT NULL DEFAULT 0,
  pending_cycle TEXT,
  pending_at_ms INTEGER
);
CREATE TABLE IF NOT EXISTS pons_outcome_jobs (
  pilot_id TEXT NOT NULL REFERENCES pons_outcome_pilots(pilot_id),
  launch_id TEXT NOT NULL CHECK(length(launch_id)=64),
  horizon_ms INTEGER NOT NULL CHECK(horizon_ms IN (300000,3600000,86400000)),
  launch_timestamp_ms INTEGER NOT NULL CHECK(launch_timestamp_ms>=0),
  due_ms INTEGER NOT NULL CHECK(due_ms=launch_timestamp_ms+horizon_ms),
  state TEXT NOT NULL DEFAULT 'READY' CHECK(state IN ('READY','DONE','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 2),
  last_error TEXT,
  PRIMARY KEY(pilot_id,launch_id,horizon_ms)
);
CREATE INDEX IF NOT EXISTS idx_pons_outcome_due ON pons_outcome_jobs(pilot_id,state,due_ms,launch_id,horizon_ms);
CREATE TRIGGER IF NOT EXISTS pons_outcome_cohort_cap BEFORE INSERT ON pons_outcome_jobs
WHEN NOT EXISTS (SELECT 1 FROM pons_outcome_jobs WHERE pilot_id=NEW.pilot_id AND launch_id=NEW.launch_id)
 AND (SELECT COUNT(DISTINCT launch_id) FROM pons_outcome_jobs WHERE pilot_id=NEW.pilot_id)>=20
BEGIN SELECT RAISE(ABORT,'PONS_OUTCOME_COHORT_LIMIT'); END;
