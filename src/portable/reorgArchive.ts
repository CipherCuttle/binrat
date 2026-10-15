import { randomUUID } from 'node:crypto';
import type { PortableDatabase } from './sqlite.js';

export const REORG_ARCHIVE_SCHEMA = `CREATE TABLE IF NOT EXISTS portable_reorg_archive (
  archive_id INTEGER PRIMARY KEY, reorg_id TEXT NOT NULL, source_table TEXT NOT NULL,
  invalidated_at_ms INTEGER NOT NULL, row_json TEXT NOT NULL
);`;

const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';

/** Private forensic copies, never queried by the public API. Original JSON
 * payload bytes remain JSON string values; no source authority is promoted. */
export function archiveRows(database: PortableDatabase, table: string, where: string, values: (string | number)[], id = randomUUID()) {
  if (!/^[a-z0-9_]+$/.test(table)) throw new Error('ARCHIVE_TABLE_INVALID');
  const columns = database.sql.prepare(`PRAGMA table_info(${quote(table)})`).all() as { name: string }[];
  if (!columns.length) return;
  const object = columns.map(c => "'" + c.name.replaceAll("'", "''") + "'," + quote(c.name)).join(',');
  database.sql.prepare(`INSERT INTO portable_reorg_archive(reorg_id,source_table,invalidated_at_ms,row_json)
    SELECT ?,?,?,json_object(${object}) FROM ${quote(table)} WHERE ${where}`).run(id, table, Date.now(), ...values);
}

export function quarantineSnapshot(database: PortableDatabase) {
  archiveRows(database, 'binrat_public_snapshots', 'chain_id=4663', []);
  database.sql.prepare('DELETE FROM binrat_public_snapshots WHERE chain_id=4663').run();
  database.sql.prepare("UPDATE binrat_runtime_state SET source_verified=0,live_caught_up=0,last_sync_error='REORG_QUARANTINED' WHERE chain_id=4663").run();
}

export function archiveRewind(database: PortableDatabase, block: bigint) {
  const n = Number(block), id = randomUUID();
  const launches = "launch_id IN (SELECT launch_id FROM launches WHERE chain_id=4663 AND CAST(block_number AS INTEGER)>=?)";
  for (const [table, column] of [['launches','block_number'],['provenance_facts','observed_block'],
    ['provenance_edges','observed_block'],['launch_observations','observed_block'],
    ['pons_outcome_receipts','observed_block'],['pons_token_identity_receipts','observed_block'],
    ['pons_funding_receipts','transfer_block'],['pons_funding_scan_state','launch_block'],
    ['rat_radar_swap_receipts','block_number']] as const) {
    // Skip legacy tables without that block field; all launch-linked rows are
    // separately archived below, including implicit foreign-key cascades.
    const fields = database.sql.prepare(`PRAGMA table_info(${quote(table)})`).all() as { name: string }[];
    if (fields.some(f => f.name === column)) archiveRows(database, table, `chain_id=4663 AND CAST(${quote(column)} AS INTEGER)>=?`, [n], id);
  }
  for (const table of ['provenance_facts','launch_observations','pons_outcome_receipts','pons_token_identity_receipts',
    'pons_funding_receipts','pons_funding_scan_state','pons_funding_retry_state','rat_watch_alerts']) {
    archiveRows(database, table, launches, [n], id);
  }
  for (const table of ['chain_checkpoints','rat_radar_pool_cursors','launch_history_backfill_state']) {
    archiveRows(database, table, 'chain_id=4663', [], id);
  }
}
