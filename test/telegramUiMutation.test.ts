import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicShareReceipt } from '../src/autonomous/share.js';
import { dig } from '../src/autonomous/evidence.js';
import { mutateWatch } from '../src/autonomous/watches.js';
import { FREE_CAPACITY } from '../src/autonomous/entitlements.js';
import { autonomousFixture, CREATOR, PRINCIPAL } from './support/autonomousFixture.js';

const target={chainId:4663 as const,entityType:'CREATOR' as const,entityId:CREATOR};

test('WATCH double tap preserves boundary and performs no second source read or DIG reservation', async () => {
  const f=await autonomousFixture(); let calls=0;
  const source={...f.source,head:async()=>{calls++;return f.source.head();}};
  try {
    await mutateWatch(f.db,PRINCIPAL,800,target,'WATCH',FREE_CAPACITY,f.now(),source);
    const row=await f.db.prepare('SELECT generation,start_block,start_hash,created_at_ms FROM rat_v1_watches').first<Record<string,unknown>>();
    await mutateWatch(f.db,PRINCIPAL,801,target,'WATCH',FREE_CAPACITY,f.now(),source);
    const again=await f.db.prepare('SELECT generation,start_block,start_hash,created_at_ms FROM rat_v1_watches').first<Record<string,unknown>>();
    assert.equal(calls,1); assert.deepEqual(again,row);
    const reservations=await f.db.prepare('SELECT COUNT(*) n FROM rat_v1_dig_requests').first<{n:number}>();
    assert.equal(reservations?.n,1);
  } finally { f.db.close(); }
});

test('SHARE double tap reuses exactly one still-valid canonical public receipt', async () => {
  const f=await autonomousFixture();
  try {
    const receipt=await dig(f.db,target,f.now());
    const first=await createPublicShareReceipt(f.db,receipt.caseId,f.now());
    const second=await createPublicShareReceipt(f.db,receipt.caseId,f.now()+1);
    assert.equal(second.receiptId,first.receiptId);
    const rows=await f.db.prepare('SELECT COUNT(*) n FROM rat_v11_pons_public_receipts WHERE case_id=?').bind(receipt.caseId).first<{n:number}>();
    assert.equal(rows?.n,1);
  } finally { f.db.close(); }
});
