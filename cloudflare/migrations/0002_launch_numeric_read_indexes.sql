CREATE INDEX IF NOT EXISTS idx_launches_chain_source_block_numeric
  ON launches(chain_id, source, CAST(block_number AS INTEGER), log_index, launch_id);
CREATE INDEX IF NOT EXISTS idx_launches_chain_block_numeric
  ON launches(chain_id, CAST(block_number AS INTEGER));
CREATE INDEX IF NOT EXISTS idx_launches_chain_source_creator_block_numeric
  ON launches(chain_id, source, creator, CAST(block_number AS INTEGER), log_index, launch_id);
