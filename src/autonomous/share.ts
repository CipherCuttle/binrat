import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { canonicalJson } from '../evidence/canonical.js';
import { why } from './evidence.js';
import { renderReceipt, type Receipt } from './model.js';

const RECEIPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const BOT_USERNAME = 'BinratBot';

export interface PublicShareReceipt {
  schemaVersion: 'binrat.public-receipt/1';
  receiptId: string;
  caseId: string;
  chainId: number;
  subject: Receipt['subject'];
  findingType: 'DIG' | 'RATS' | 'ALERT';
  publicEvidenceRefs: Receipt['evidenceRefs'];
  coverage: Receipt['coverage'];
  finding: Receipt;
  createdAt: number;
  expiresAt: number;
}

export async function createPublicShareReceipt(db: D1DatabaseLike, caseId: string, now: number): Promise<PublicShareReceipt> {
  const finding = await why(db, caseId, now);
  const table = finding.chainId === 4663 ? 'rat_v11_pons_public_receipts' : 'rat_v11_public_receipts';
  // A button may be tapped repeatedly, and a transport retry can arrive after a
  // successful write. Reuse only a still-valid receipt and validate it through
  // the same reconstruction path used by public access.
  const existing = await db.prepare(`SELECT receipt_id FROM ${table}
    WHERE case_id=? AND expires_at_ms>? ORDER BY created_at_ms DESC,receipt_id DESC LIMIT 1`)
    .bind(finding.caseId,now).first<{ receipt_id: string }>();
  if (existing) {
    try { return await openPublicShareReceipt(db,existing.receipt_id,now); }
    catch { /* stale/tampered rows are never reused; a fresh validated case follows. */ }
  }
  const publicReceiptBase = {
    schemaVersion: 'binrat.public-receipt/1' as const,
    caseId: finding.caseId, chainId: finding.chainId, subject: finding.subject,
    findingType: finding.discovery ? 'RATS' as const :
      finding.claim === 'CREATOR_LAUNCH_OBSERVED' ? 'ALERT' as const : 'DIG' as const,
    publicEvidenceRefs: finding.evidenceRefs, coverage: finding.coverage, finding,
    createdAt: now, expiresAt: now + RECEIPT_RETENTION_MS
  };
  await prunePublicReceipts(db, now);
  for (let tries=0; tries<3; tries++) {
    const receiptId = crypto.randomUUID().replaceAll('-', '');
    const receipt: PublicShareReceipt = { ...publicReceiptBase, receiptId };
    const result = await db.prepare(`INSERT OR IGNORE INTO ${table}
      (receipt_id,case_id,chain_id,receipt_json,created_at_ms,expires_at_ms) VALUES (?,?,?,?,?,?)`)
      .bind(receiptId,receipt.caseId,receipt.chainId,JSON.stringify(receipt),now,receipt.expiresAt).run();
    if (!result.success) throw new Error('SHARE_WRITE_FAILED');
    if (result.meta?.changes === 1) return receipt;
  }
  throw new Error('SHARE_ID_UNAVAILABLE');
}

export async function openPublicShareReceipt(db: D1DatabaseLike, receiptId: string, now: number): Promise<PublicShareReceipt> {
  if (!/^[0-9a-f]{32}$/.test(receiptId)) throw new Error('PUBLIC_RECEIPT_UNAVAILABLE');
  await Promise.all([prunePublicReceipts(db, now), prunePonsPublicReceipts(db, now)]);
  const row = await db.prepare(`SELECT receipt_json FROM rat_v11_pons_public_receipts WHERE receipt_id=? AND expires_at_ms>?
    UNION ALL SELECT receipt_json FROM rat_v11_public_receipts WHERE receipt_id=? AND expires_at_ms>? LIMIT 1`)
    .bind(receiptId,now,receiptId,now).first<{ receipt_json: string }>();
  if (!row) throw new Error('PUBLIC_RECEIPT_UNAVAILABLE');
  let receipt: PublicShareReceipt;
  try { receipt = JSON.parse(row.receipt_json) as PublicShareReceipt; } catch { throw new Error('PUBLIC_RECEIPT_UNAVAILABLE'); }
  if (!isPublicShareReceipt(receipt,receiptId)) throw new Error('PUBLIC_RECEIPT_UNAVAILABLE');
  // Reconstruct from the canonical case, never from URL state or a private owner record.
  const current = await why(db, receipt.caseId, now);
  if (canonicalJson(current) !== canonicalJson(receipt.finding)) throw new Error('PUBLIC_RECEIPT_UNAVAILABLE');
  return receipt;
}

export function telegramDeepLink(receiptId: string): string {
  if (!/^[0-9a-f]{32}$/.test(receiptId)) throw new Error('PUBLIC_RECEIPT_UNAVAILABLE');
  return `https://t.me/${BOT_USERNAME}?start=receipt_${receiptId}`;
}

export function renderShareArtifact(receipt: PublicShareReceipt): string {
  const link = telegramDeepLink(receipt.receiptId);
  const reason = receipt.finding.discovery?.reasons[0]?.text ??
    `Indexed ${receipt.chainId === 4663 ? 'Pons' : 'ArcPad'} evidence exists for ${receipt.subject.entityType.toLowerCase()} ${receipt.subject.entityId}.`;
  const text = `🐀 BINRAT RECEIPT\n\n${reason}\n\nOpen the receipts:\n${link}`;
  const shareUrl = `https://t.me/share/url?${new URLSearchParams({ url: link, text }).toString()}`;
  return [
    '🐀 receipt packed. Public evidence only.',
    `Open: ${link}`,
    `Share: ${shareUrl}`,
    `Expires: ${new Date(receipt.expiresAt).toISOString().slice(0,10)} UTC.`
  ].join('\n\n');
}

export function renderOpenedReceipt(receipt: PublicShareReceipt): string {
  const watch = receipt.subject.entityType === 'CREATOR' && receipt.chainId === 4663
    ? `WATCH: /watch 4663:CREATOR:${receipt.subject.entityId}`
    : receipt.subject.entityType === 'CREATOR'
      ? 'WATCH unavailable for Arc 5042 historical receipts; WHY remains public.'
      : 'WATCH unavailable for this role in V1; WHY remains public.';
  return [
    '🐀 SOMEBODY LEFT YOU A RECEIPT.',
    `Subject: ${receipt.chainId === 4663 ? 'Robinhood/Pons' : 'Arc'} ${receipt.chainId} · ${receipt.subject.entityType} ${receipt.subject.entityId}`,
    `Finding: ${receipt.findingType}`,
    renderReceipt(receipt.finding,'WHY'),
    watch,
    'This is public evidence. No sharer, watch owner, entitlement, chat or private context came with it.'
  ].join('\n\n');
}

async function prunePublicReceipts(db: D1DatabaseLike, now: number): Promise<void> {
  const result = await db.prepare('DELETE FROM rat_v11_public_receipts WHERE expires_at_ms<=?').bind(now).run();
  if (!result.success) throw new Error('SHARE_RETENTION_FAILED');
}

async function prunePonsPublicReceipts(db: D1DatabaseLike, now: number): Promise<void> {
  const result = await db.prepare('DELETE FROM rat_v11_pons_public_receipts WHERE expires_at_ms<=?').bind(now).run();
  if (!result.success) throw new Error('SHARE_RETENTION_FAILED');
}

function isPublicShareReceipt(value: PublicShareReceipt, receiptId: string): boolean {
  const finding = value.finding;
  return value.schemaVersion === 'binrat.public-receipt/1' && value.receiptId === receiptId &&
    (value.chainId === 5042 || value.chainId === 4663) && value.caseId === finding?.caseId && value.subject?.entityId === finding?.subject?.entityId &&
    value.subject?.entityType === 'CREATOR' && Array.isArray(value.publicEvidenceRefs) &&
    value.publicEvidenceRefs.length > 0 && value.publicEvidenceRefs.length <= 5 &&
    value.publicEvidenceRefs.every(ref => /^0x[0-9a-f]{64}$/.test(ref.txHash) && /^0x[0-9a-f]{64}$/.test(ref.blockHash));
}
