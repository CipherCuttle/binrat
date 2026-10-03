CREATE TABLE IF NOT EXISTS binrat_public_snapshots (
  chain_id INTEGER PRIMARY KEY CHECK(chain_id = 4663),
  checkpoint_block TEXT NOT NULL,
  checkpoint_block_hash TEXT NOT NULL,
  feed_digest TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  verified_at_ms INTEGER NOT NULL,
  publication_version INTEGER NOT NULL CHECK(publication_version > 0)
);
