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
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] }
] as const;


export const ponsV2BondingCurveReadAbi = [
  { type:'function', name:'token', stateMutability:'view', inputs:[], outputs:[{type:'address'}] },
  { type:'function', name:'pairToken', stateMutability:'view', inputs:[], outputs:[{type:'address'}] },
  { type:'function', name:'graduated', stateMutability:'view', inputs:[], outputs:[{type:'bool'}] },
  {
    type:'function', name:'getReserves', stateMutability:'view', inputs:[],
    outputs:[{name:'quoteReserve_',type:'uint256'},{name:'tokenReserve_',type:'uint256'}]
  }
] as const;
