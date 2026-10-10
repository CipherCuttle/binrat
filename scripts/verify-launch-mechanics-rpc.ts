import { readFile } from 'node:fs/promises';
import {
  createPublicClient,
  getAddress,
  http,
  keccak256,
  type Address,
  type Hex
} from 'viem';
import { validateLaunchMechanicsReceipt } from '../src/launchMechanics/receipt.js';

const RPC_URL = process.env.ARC_RPC_URL ?? 'https://rpc.mainnet.arc.io';
const receipt = await loadReceipt();
const client = createPublicClient({ transport: http(RPC_URL) });

if (await client.getChainId() !== receipt.chainId) fail('chain ID');

const codeAuthorities = [
  [receipt.launcher.identity.value.address, receipt.launcher.identity.value.runtimeBytecodeKeccak256],
  [receipt.tokenMechanics.implementationAuthority.value.factoryAddress,
    receipt.tokenMechanics.implementationAuthority.value.factoryRuntimeBytecodeKeccak256],
  [receipt.liquidity.lockerIdentity.value.address,
    receipt.liquidity.lockerIdentity.value.runtimeBytecodeKeccak256],
  [receipt.uniswap.deployment.value.factoryAddress,
    receipt.uniswap.deployment.value.factoryRuntimeBytecodeKeccak256],
  [receipt.uniswap.deployment.value.positionManagerAddress,
    receipt.uniswap.deployment.value.positionManagerRuntimeBytecodeKeccak256]
] as const;

for (const [address, expectedHash] of codeAuthorities) {
  const code = await client.getCode({ address: address as Address });
  if (!code || keccak256(code) !== expectedHash) fail(`runtime bytecode ${address}`);
}

const creationChecks = [
  [receipt.launcher.identity.value.creationTransaction, receipt.launcher.identity.value.address],
  [receipt.tokenMechanics.implementationAuthority.value.factoryCreationTransaction,
    receipt.tokenMechanics.implementationAuthority.value.factoryAddress],
  [receipt.liquidity.lockerIdentity.value.creationTransaction, receipt.liquidity.lockerIdentity.value.address]
] as const;

for (const [hash, expectedAddress] of creationChecks) {
  const transactionReceipt = await receiptWithRetry(hash as Hex);
  if (!transactionReceipt.contractAddress || !sameAddress(transactionReceipt.contractAddress, expectedAddress)) {
    fail(`creation transaction ${hash}`);
  }
}

const positionManager = receipt.uniswap.deployment.value.positionManagerAddress as Address;
for (const sample of receipt.sampleLaunches) {
  const transactionReceipt = await receiptWithRetry(sample.launchTransaction as Hex);
  if (transactionReceipt.blockNumber !== BigInt(sample.launchBlock)) fail(`launch block ${sample.name}`);
  if (!sameAddress(transactionReceipt.from, sample.creatorAddress)) fail(`creator address ${sample.name}`);

  const poolCreated = transactionReceipt.logs.find((log) => sameAddress(log.address, receipt.uniswap.deployment.value.factoryAddress));
  if (!poolCreated || poolCreated.topics.length < 4) fail(`PoolCreated event ${sample.name}`);
  const emittedPool = getAddress(`0x${poolCreated.data.slice(-40)}`);
  const emittedTokens = [topicAddress(poolCreated.topics[1]!), topicAddress(poolCreated.topics[2]!)];
  if (!sameAddress(emittedPool, sample.poolAddress)) fail(`pool address ${sample.name}`);
  if (!emittedTokens.some((address) => sameAddress(address, sample.tokenAddress))) fail(`token address ${sample.name}`);

  const positionMint = transactionReceipt.logs.find((log) =>
    sameAddress(log.address, positionManager) && log.topics.length === 4 && BigInt(log.topics[3]!) === BigInt(sample.positionId)
  );
  if (!positionMint) fail(`position ID ${sample.name}`);

  const positionOwner = await client.readContract({
    address: positionManager,
    abi: [{ type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] }],
    functionName: 'ownerOf',
    args: [BigInt(sample.positionId)]
  });
  if (!sameAddress(positionOwner, sample.lockerAddress)) fail(`position custody ${sample.name}`);

  const totalSupply = await client.readContract({
    address: sample.tokenAddress as Address,
    abi: [{ type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }],
    functionName: 'totalSupply'
  });
  if (totalSupply.toString() !== receipt.tokenMechanics.fixedSupply.value.totalSupplyRaw) {
    fail(`total supply ${sample.name}`);
  }
}

const manifestResponse = await fetch(receipt.sources.find((source) => source.id === 'uniswap_5042_manifest')!.url);
if (!manifestResponse.ok) fail('Uniswap deployment manifest retrieval');
const manifest = await manifestResponse.json() as {
  chainId: string;
  latest: Record<string, { address: string; deploymentTxn: string; commitHash: string }>;
};
if (
  manifest.chainId !== String(receipt.chainId) ||
  !sameAddress(manifest.latest.UniswapV3Factory!.address, receipt.uniswap.deployment.value.factoryAddress) ||
  manifest.latest.UniswapV3Factory!.deploymentTxn !== receipt.uniswap.deployment.value.factoryDeploymentTransaction ||
  !sameAddress(manifest.latest.NonfungiblePositionManager!.address, receipt.uniswap.deployment.value.positionManagerAddress) ||
  manifest.latest.NonfungiblePositionManager!.deploymentTxn !== receipt.uniswap.deployment.value.positionManagerDeploymentTransaction
) fail('Uniswap deployment manifest binding');

console.log(JSON.stringify({
  status: 'PASS',
  verifiedAt: new Date().toISOString(),
  chainId: receipt.chainId,
  receiptDigest: receipt.receiptDigest,
  runtimeAuthorities: codeAuthorities.length,
  creationTransactions: creationChecks.length,
  sampleLaunches: receipt.sampleLaunches.length,
  uniswapManifestCommit: receipt.uniswap.deployment.value.manifestRepositoryCommit
}, null, 2));

async function loadReceipt(): Promise<any> {
  const parsed = JSON.parse(await readFile(new URL('../docs/LAUNCH_MECHANICS_VERIFICATION_V0.json', import.meta.url), 'utf8'));
  await validateLaunchMechanicsReceipt(parsed);
  return parsed;
}

function topicAddress(topic: Hex): Address {
  return getAddress(`0x${topic.slice(-40)}`);
}

function sameAddress(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

async function receiptWithRetry(hash: Hex) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await client.getTransactionReceipt({ hash });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function fail(subject: string): never {
  throw new Error(`LAUNCH_MECHANICS_RPC_BINDING_FAILED: ${subject}`);
}
