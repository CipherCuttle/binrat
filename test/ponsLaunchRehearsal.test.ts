import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decodeFunctionData, decodeFunctionResult, encodeAbiParameters, encodeFunctionData, getFunctionSelector, stringToHex, type Hex } from 'viem';
import { simulatePonsLaunchRehearsal } from '../src/launchConfig/ponsLaunchRehearsal.js';
import { PONS_LAUNCH_WITH_VAULT_ABI, PONS_LAUNCH_WITH_VAULT_SELECTOR, PONS_LAUNCH_WITH_VAULT_SIGNATURE, PONS_VAULT_UI_ABI_PROVENANCE } from '../src/launchConfig/ponsVaultLaunchAbi.js';
import { PONS_LAUNCH_RUNTIME_HASH_V1, PONS_STAKING_TEMPLATE_ID, PONS_ZERO_ADDRESS, assertPonsLauncherRuntimeHash, createPonsRehearsalReceipt, inspectPonsLaunchRehearsalInputs, ownerInputBlockers, ponsLaunchSelectorFromCanonicalSignature, validatePonsLaunchPolicy } from '../src/launchConfig/ponsLaunchRehearsal.js';

const historical = JSON.parse(await readFile(new URL('./fixtures/pons-rwa-historical-tx.json', import.meta.url), 'utf8')) as { hash: string; to: string; input: Hex; value: string };
const syntheticFixture = JSON.parse(await readFile(new URL('../docs/fixtures/PONSVault_SYNTHETIC_STAKING_CALL_V1.json', import.meta.url), 'utf8')) as { calldata: Hex; template: string; pairToken: string; minimumFeesBeforePayoutRaw: string; creatorTaxBps: number };

test('canonical production UI signature hashes to the pinned selector', () => {
  assert.equal(getFunctionSelector(PONS_LAUNCH_WITH_VAULT_SIGNATURE), PONS_LAUNCH_WITH_VAULT_SELECTOR);
  assert.equal(ponsLaunchSelectorFromCanonicalSignature(), PONS_LAUNCH_WITH_VAULT_SELECTOR);
});

test('checked-in machine-readable ABI artifact pins the same selector and explicit source classification', async () => {
  const artifact = JSON.parse(await readFile(new URL('../docs/PONSVault_PRODUCTION_UI_ABI_V1.json', import.meta.url), 'utf8')) as Record<string, any>;
  assert.equal(artifact.classification, 'PINNED_PRODUCTION_UI_ABI');
  assert.equal(getFunctionSelector(artifact.canonicalSignature), PONS_LAUNCH_WITH_VAULT_SELECTOR);
  assert.equal(artifact.selector, PONS_LAUNCH_WITH_VAULT_SELECTOR);
  assert.equal(artifact.function.name, 'launchWithVault');
  assert.equal(artifact.function.outputs[0].name, 'token');
  assert.equal(artifact.function.outputs[1].name, 'vault');
});

test('mined RWA launch calldata decodes and re-encodes byte-for-byte', () => {
  assert.equal(historical.hash, '0x30aa4930d0572dbffd67de63d2a01a24ca426098a75ba304ad89b17a081a4f98');
  assert.equal(historical.to.toLowerCase(), PONS_VAULT_UI_ABI_PROVENANCE.launcher.toLowerCase());
  const decoded = decodeFunctionData({ abi: PONS_LAUNCH_WITH_VAULT_ABI, data: historical.input });
  assert.equal(decoded.functionName, 'launchWithVault');
  assert.equal(decoded.args[3], stringToHex('rwa', { size: 32 }));
  assert.equal(BigInt(historical.value), 500000000000000n);
  assert.equal(encodeFunctionData({ abi: PONS_LAUNCH_WITH_VAULT_ABI, functionName: 'launchWithVault', args: decoded.args }), historical.input);
});

test('synthetic Staking fixture with pinned minimum payout and explicit salt round-trips exactly', () => {
  const fixture = syntheticFixture;
  const data = fixture.calldata;
  const decoded = decodeFunctionData({ abi: PONS_LAUNCH_WITH_VAULT_ABI, data });
  const config = encodeAbiParameters([{ type: 'uint256' }], [BigInt(fixture.minimumFeesBeforePayoutRaw)]);
  assert.equal(fixture.template, 'staking');
  assert.equal(fixture.pairToken, PONS_ZERO_ADDRESS);
  assert.equal(decoded.args[3], PONS_STAKING_TEMPLATE_ID);
  assert.equal(decoded.args[2], PONS_ZERO_ADDRESS);
  assert.equal(decoded.args[0].creatorTaxBps, fixture.creatorTaxBps, 'historical fixture tax is synthetic, not BINRAT policy');
  assert.equal(decoded.args[4], config);
  assert.equal(encodeFunctionData({ abi: PONS_LAUNCH_WITH_VAULT_ABI, functionName: 'launchWithVault', args: decoded.args }), data);
});

test('synthetic return fixture decodes token then vault', () => {
  const result = encodeAbiParameters([{ type: 'address' }, { type: 'address' }], [
    '0x0d5afa91c20be6df39b2e970b3737c68b70a358d', '0x757ef16e4ea4c703d3e0cbc77cb61599597974e1'
  ]);
  const [token, vault] = decodeFunctionResult({ abi: PONS_LAUNCH_WITH_VAULT_ABI, functionName: 'launchWithVault', data: result });
  assert.equal(token.toLowerCase(), '0x0d5afa91c20be6df39b2e970b3737c68b70a358d');
  assert.equal(vault.toLowerCase(), '0x757ef16e4ea4c703d3e0cbc77cb61599597974e1');
});

test('simulation uses eth_call only after fresh preflight and rejects malformed output', async () => {
  const plan = JSON.parse(await readFile(new URL('../docs/BINRAT_PONS_LAUNCH_PLAN_V1.json', import.meta.url), 'utf8'));
  const preflight = JSON.parse(await readFile(new URL('../docs/fixtures/PONS_PREFLIGHT_V1_CURRENT.json', import.meta.url), 'utf8'));
  const params = { name:'SYNTHETIC',symbol:'SYN',logo:'ipfs://x',description:'fixture',socials:{twitter:'',telegram:'',discord:'',website:'',farcaster:''},creatorFeeRecipient:'0x1111111111111111111111111111111111111111',creatorTaxBps:0,buybackEnabled:false,expectedEconomics:`0x${'22'.repeat(32)}`,salt:`0x${'33'.repeat(32)}` } as const;
  const data = encodeFunctionData({ abi:PONS_LAUNCH_WITH_VAULT_ABI,functionName:'launchWithVault',args:[params,1n,PONS_ZERO_ADDRESS,PONS_STAKING_TEMPLATE_ID,encodeAbiParameters([{type:'uint256'}],[100000000000000000n])] });
  const request = { chainId:4663 as const,from:'0x1111111111111111111111111111111111111111' as const,to:PONS_VAULT_UI_ABI_PROVENANCE.launcher as `0x${string}`,value:'0x0' as Hex,data,calldataHash:'0x' as Hex,templateConfigBytes:'0x' as Hex,manifestInputDigest:'fixture' };
  const output = encodeAbiParameters([{type:'address'},{type:'address'}],['0x0d5afa91c20be6df39b2e970b3737c68b70a358d','0x757ef16e4ea4c703d3e0cbc77cb61599597974e1']);
  const calls: unknown[] = [];
  const client = { getChainId:async()=>4663, call:async (args:unknown)=>{ calls.push(args); return {data:output}; } } as any;
  const result = await simulatePonsLaunchRehearsal(client,request,plan,preflight);
  assert.equal(result.token.toLowerCase(),'0x0d5afa91c20be6df39b2e970b3737c68b70a358d');
  assert.equal(result.vault.toLowerCase(),'0x757ef16e4ea4c703d3e0cbc77cb61599597974e1');
  assert.equal(calls.length,1);
  await assert.rejects(simulatePonsLaunchRehearsal({ ...client,call:async()=>({data:'0x12'}) },request,plan,preflight),/PONS_REHEARSAL_RETURN_MALFORMED/);
});

test('selected launcher and runtime stay pinned; alternate deployment cannot substitute', () => {
  assert.equal(PONS_VAULT_UI_ABI_PROVENANCE.launcher, '0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA');
  assert.equal(PONS_LAUNCH_RUNTIME_HASH_V1, '0x5a6baeade01d8119231385e1a6f38c50388b2f30063d3c6c3e5736e590ad12a0');
  assert.notEqual(PONS_VAULT_UI_ABI_PROVENANCE.launcher.toLowerCase(), '0xd948edcdb832529bb3458b0463f5e02bb448888e');
  assert.throws(() => assertPonsLauncherRuntimeHash(`0x${'00'.repeat(32)}`), /RUNTIME_DRIFT/);
  assert.doesNotThrow(() => assertPonsLauncherRuntimeHash(PONS_LAUNCH_RUNTIME_HASH_V1));
});

test('ABI source classification and unresolved source binding cannot become authorization', () => {
  assert.equal(PONS_VAULT_UI_ABI_PROVENANCE.classification, 'PINNED_PRODUCTION_UI_ABI');
  assert.equal(PONS_VAULT_UI_ABI_PROVENANCE.sourceRuntimeBinding, 'UNRESOLVED');
  const receipt = createPonsRehearsalReceipt({ status:'REHEARSAL_PASS', launchAuthorized:true, signing:true, broadcast:true });
  assert.equal(receipt.sourceRuntimeBinding, 'UNRESOLVED');
  assert.equal(receipt.launchAuthorized, false);
  assert.equal(receipt.signing, false);
  assert.equal(receipt.broadcast, false);
});

test('missing exact call fields are enumerated while social strings may be empty', () => {
  const empty = { launchWalletAddress:null,name:null,symbol:null,logo:null,description:null,socials:null,creatorFeeRecipient:null,expectedEconomics:null,salt:null,launchConfigId:null,minimumFeesBeforePayoutWei:null,transactionValueWei:null,openingBuyWei:'0',pairToken:PONS_ZERO_ADDRESS,template:'staking',creatorTaxBps:0,buybackEnabled:false } as const;
  assert.deepEqual(ownerInputBlockers(empty), ['launchWalletAddress','name','symbol','logo','description','creatorFeeRecipient','expectedEconomics','salt','launchConfigId','minimumFeesBeforePayoutWei','transactionValueWei','socials']);
  assert.deepEqual(ownerInputBlockers({ ...empty, launchWalletAddress:'0x1111111111111111111111111111111111111111', name:'BINRAT', symbol:'BINRAT', logo:'ipfs://x', description:'', socials:{twitter:'',telegram:'',discord:'',website:'',farcaster:''}, creatorFeeRecipient:'0x1111111111111111111111111111111111111111', expectedEconomics:`0x${'00'.repeat(32)}`, salt:`0x${'00'.repeat(32)}`, launchConfigId:'1', minimumFeesBeforePayoutWei:'100000000000000000', transactionValueWei:'500000000000000' }), ['description']);
});

test('product policy rejects nonzero tax, buyback, non-native pair, other template and Arc leakage', () => {
  const base = { launchWalletAddress:'0x1111111111111111111111111111111111111111',name:'BINRAT',symbol:'BINRAT',logo:'ipfs://x',description:'x',socials:{twitter:'',telegram:'',discord:'',website:'',farcaster:''},creatorFeeRecipient:'0x1111111111111111111111111111111111111111',expectedEconomics:`0x${'00'.repeat(32)}`,salt:`0x${'00'.repeat(32)}`,launchConfigId:'1',minimumFeesBeforePayoutWei:'100000000000000000',transactionValueWei:'1',openingBuyWei:'0',pairToken:PONS_ZERO_ADDRESS,template:'staking',creatorTaxBps:0,buybackEnabled:false } as const;
  assert.throws(() => validatePonsLaunchPolicy({ ...base, creatorTaxBps:1 }), /CREATOR_TAX/);
  assert.throws(() => validatePonsLaunchPolicy({ ...base, buybackEnabled:true }), /BUYBACK/);
  assert.throws(() => validatePonsLaunchPolicy({ ...base, pairToken:'0x1111111111111111111111111111111111111111' }), /PAIR_TOKEN/);
  assert.throws(() => validatePonsLaunchPolicy({ ...base, template:'rwa' }), /TEMPLATE/);
  assert.throws(() => validatePonsLaunchPolicy({ ...base, arcWalletAddress:'0x1111111111111111111111111111111111111111' }), /ARC_WALLET/);
  const blocked = inspectPonsLaunchRehearsalInputs({ ...base, launchWalletAddress:null, name:null });
  assert.equal(blocked.status, 'BLOCKED_OWNER_INPUTS');
  assert.deepEqual(blocked.missingInputs, ['launchWalletAddress','name']);
  assert.equal(blocked.signing, false);
  assert.equal(blocked.broadcast, false);
  assert.equal(blocked.launchAuthorized, false);
});
