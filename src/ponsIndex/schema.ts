/** Separate, opt-in PONS_DB schema. Never merge into Arc D1 silently. */
export const PONS_D1_SCHEMA_SQL = String.raw`-- Isolated Robinhood/Pons D1 schema. NOT part of the live Arc schema.
-- Provision only against a separately authorized PONS_DB; no automatic migration.
CREATE TABLE IF NOT EXISTS pons_checkpoints (
 chain_id INTEGER PRIMARY KEY CHECK(chain_id=4663),
 authority_id TEXT NOT NULL,
 from_block INTEGER NOT NULL CHECK(from_block>=26841846),
 next_block INTEGER NOT NULL CHECK(next_block>=from_block),
 last_block INTEGER NOT NULL,
 last_hash TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('READY','REORG_HALT')),
 updated_at_ms INTEGER NOT NULL,
 version INTEGER NOT NULL CHECK(version>=0)
);
CREATE TABLE IF NOT EXISTS pons_launch_facts (
 fact_id TEXT PRIMARY KEY,
 chain_id INTEGER NOT NULL CHECK(chain_id=4663),
 authority_id TEXT NOT NULL,
 launch_id TEXT NOT NULL,
 event_id TEXT NOT NULL,
 block_number INTEGER NOT NULL CHECK(block_number>=26841846),
 block_hash TEXT NOT NULL,
 tx_hash TEXT NOT NULL,
 log_index INTEGER NOT NULL CHECK(log_index>=0),
 token TEXT NOT NULL,
 deployer TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 UNIQUE(chain_id,tx_hash,log_index,block_hash)
);
CREATE INDEX IF NOT EXISTS pons_facts_recent ON pons_launch_facts(chain_id,block_number DESC,log_index DESC);
CREATE INDEX IF NOT EXISTS pons_facts_creator ON pons_launch_facts(chain_id,deployer,block_number,log_index);
CREATE INDEX IF NOT EXISTS pons_facts_launch ON pons_launch_facts(chain_id,launch_id);
CREATE TRIGGER IF NOT EXISTS pons_facts_immutable_update BEFORE UPDATE ON pons_launch_facts BEGIN SELECT RAISE(ABORT,'PONS_FACT_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS pons_facts_immutable_delete BEFORE DELETE ON pons_launch_facts BEGIN SELECT RAISE(ABORT,'PONS_FACT_IMMUTABLE'); END;
CREATE TABLE IF NOT EXISTS pons_range_receipts (
 receipt_id TEXT PRIMARY KEY,
 chain_id INTEGER NOT NULL CHECK(chain_id=4663),
 from_block INTEGER NOT NULL,
 through_block INTEGER NOT NULL,
 through_hash TEXT NOT NULL,
 fact_count INTEGER NOT NULL,
 captured_at_ms INTEGER NOT NULL,
 UNIQUE(chain_id,from_block,through_block)
);
CREATE TABLE IF NOT EXISTS pons_reorg_alerts (
 alert_id TEXT PRIMARY KEY,
 chain_id INTEGER NOT NULL CHECK(chain_id=4663),
 checkpoint_block INTEGER NOT NULL,
 expected_hash TEXT NOT NULL,
 observed_hash TEXT NOT NULL,
 detected_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pons_invariant_guard (must_be_zero INTEGER NOT NULL CHECK(must_be_zero=0));
`;
