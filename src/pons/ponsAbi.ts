export const ponsTokenLaunchedEvent = {
  type: 'event', name: 'TokenLaunched', anonymous: false,
  inputs: [
    { indexed: true, name: 'token', type: 'address' },
    { indexed: true, name: 'curve', type: 'address' },
    { indexed: true, name: 'deployer', type: 'address' },
    { indexed: false, name: 'pairToken', type: 'address' },
    { indexed: false, name: 'launchConfigId', type: 'uint256' },
    { indexed: false, name: 'graduationThreshold', type: 'uint256' }
  ]
} as const;

export const ponsErc20Abi = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }
] as const;
