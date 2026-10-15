/** Bounded Ethereum receipt trie reconstruction using the installed viem RLP/Keccak.
 * No persistent trie, external service or general indexing facility. */
import { keccak256, toRlp, type Hex, type RpcTransactionReceipt } from 'viem';
import { FORWARD_LIMITS, forwardRequire } from '../public/forwardCase.js';
type Node = Hex | readonly Node[];
type Entry = { key: number[]; value: Hex };
const bytes = (v: unknown): v is Hex => typeof v === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(v);
function quantity(v: string): Hex {
  forwardRequire(/^0x[0-9a-fA-F]+$/.test(v), 'FORWARD_RECEIPTS_ROOT_UNAVAILABLE');
  const s = BigInt(v).toString(16); return s === '0' ? '0x' : `0x${s.length % 2 ? '0' : ''}${s}`;
}
function compact(path: number[], leaf: boolean): Hex {
  const p = path.length % 2 ? [(leaf ? 3 : 1), ...path] : [(leaf ? 2 : 0), 0, ...path];
  return `0x${p.map(n => n.toString(16)).join('')}`;
}
function reference(node: Node): Node {
  const encoded = toRlp(node); return encoded.length < 66 ? node : keccak256(encoded);
}
function trie(entries: Entry[], offset: number): Node {
  if (entries.length === 1) return [compact(entries[0].key.slice(offset), true), entries[0].value];
  let shared = offset;
  while (entries.every(e => e.key.length > shared && e.key[shared] === entries[0].key[shared])) shared++;
  if (shared > offset) return [compact(entries[0].key.slice(offset, shared), false), reference(trie(entries, shared))];
  const branch: Node[] = Array.from({ length: 17 }, () => '0x');
  for (let n = 0; n < 16; n++) {
    const group = entries.filter(e => e.key[offset] === n);
    if (group.length) branch[n] = reference(trie(group, offset + 1));
  }
  const end = entries.find(e => e.key.length === offset); if (end) branch[16] = end.value;
  return branch;
}
export function forwardReceiptRoot(receipts: readonly RpcTransactionReceipt[]): Hex {
  forwardRequire(Array.isArray(receipts) && receipts.length <= FORWARD_LIMITS.transactionsPerBlock, 'FORWARD_RECEIPTS_ROOT_UNAVAILABLE');
  const entries = receipts.map((r: RpcTransactionReceipt, index: number) => {
    forwardRequire(BigInt(r.transactionIndex) === BigInt(index) && (r.status === '0x0' || r.status === '0x1') &&
      bytes(r.logsBloom) && r.logsBloom.length === 514 && r.logs.length <= FORWARD_LIMITS.logsPerBlock,
    'FORWARD_RECEIPTS_ROOT_UNAVAILABLE');
    const logs: Node[] = r.logs.map(l => {
      forwardRequire(bytes(l.address) && l.address.length === 42 && bytes(l.data) && l.topics.length <= 4 &&
        l.topics.every(t => bytes(t) && t.length === 66), 'FORWARD_RECEIPTS_ROOT_UNAVAILABLE');
      return [l.address, l.topics, l.data];
    });
    const encoded = toRlp([quantity(r.status), quantity(r.cumulativeGasUsed), r.logsBloom, logs]);
    const type = BigInt(r.type ?? '0x0');
    forwardRequire(type >= 0n && type < 128n, 'FORWARD_RECEIPTS_ROOT_UNAVAILABLE');
    const value: Hex = type === 0n ? encoded : `0x${type.toString(16).padStart(2, '0')}${encoded.slice(2)}`;
    const key = toRlp(quantity(`0x${index.toString(16)}`)).slice(2).split('').map(s => parseInt(s, 16));
    return { key, value };
  });
  return keccak256(entries.length ? toRlp(trie(entries, 0)) : toRlp('0x'));
}
