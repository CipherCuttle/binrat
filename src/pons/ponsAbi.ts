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


export const ponsV2FactoryOutcomeReadAbi = [
  {
    type:'function',
    name:'getLaunchedToken',
    stateMutability:'view',
    inputs:[{name:'token',type:'address'}],
    outputs:[{
      name:'',
      type:'tuple',
      components:[
        {name:'token',type:'address'},
        {name:'curve',type:'address'},
        {name:'deployer',type:'address'},
        {name:'creatorFeeRecipient',type:'address'},
        {name:'pairToken',type:'address'},
        {name:'graduationThreshold',type:'uint256'},
        {name:'poolFee',type:'uint24'},
        {name:'tickSpacing',type:'int24'},
        {name:'creatorTaxBps',type:'uint16'},
        {name:'buybackEnabled',type:'bool'},
        {name:'phase',type:'uint8'},
        {name:'sweptQuote',type:'uint256'},
        {name:'sweptTokens',type:'uint256'},
        {name:'sweptAt',type:'uint256'},
        {name:'exists',type:'bool'}
      ]
    }]
  }
] as const;
