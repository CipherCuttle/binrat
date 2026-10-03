export const PONS_VAULT_CHAIN_ID = 4663 as const;

export const PONS_VAULT_PINS_V1 = Object.freeze({
  ponsFactory: Object.freeze({
    address: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
    runtimeCodeHash: '0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84'
  }),
  launcher: Object.freeze({
    address: '0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA',
    reportedFactory: '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e',
    reportedRegistry: '0xaA9C86049A258D4A076d3eF367F69C231C9746D5'
  }),
  registry: Object.freeze({
    address: '0xaA9C86049A258D4A076d3eF367F69C231C9746D5',
    runtimeCodeHash: '0x0818f2fd53a4ccaf9edcb34a9fc7b0980f659dfa99862439c813e0719caaa93f',
    owner: '0x897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b'
  }),
  stakeBurnFactory: Object.freeze({
    address: '0x537483c5B33e2192CfB202d7C50d58975524B047',
    owner: '0x897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b',
    beacon: '0xf72b3b54220a2e64ee87895d570a2c72a00a3fe4',
    vaultImplementation: '0xf0453c814cf6a76a8e3507f8fafffe359f28b6cb'
  }),
  stakeBurnBeacon: Object.freeze({
    address: '0xf72b3b54220a2e64ee87895d570a2c72a00a3fe4',
    owner: '0x537483c5B33e2192CfB202d7C50d58975524B047',
    implementation: '0xf0453c814cf6a76a8e3507f8fafffe359f28b6cb'
  }),
  controllingEoa: Object.freeze({
    address: '0x897ac30f73ba92e1efbc1df1e67f8b5f4b3ecd2b',
    codeHash: '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    codeState: 'EOA_NO_RUNTIME_CODE'
  })
});

export type PonsVaultPinKey = keyof typeof PONS_VAULT_PINS_V1;

export function assertPonsVaultPinsCoherent(): void {
  const p=PONS_VAULT_PINS_V1;
  if (p.launcher.reportedFactory.toLowerCase() !== p.ponsFactory.address.toLowerCase()) {
    throw new Error('PONS_VAULT_LAUNCHER_FACTORY_MISMATCH');
  }
  if (p.launcher.reportedRegistry.toLowerCase() !== p.registry.address.toLowerCase()) {
    throw new Error('PONS_VAULT_LAUNCHER_REGISTRY_MISMATCH');
  }
  if (p.stakeBurnFactory.beacon.toLowerCase() !== p.stakeBurnBeacon.address.toLowerCase()) {
    throw new Error('PONS_VAULT_BEACON_MISMATCH');
  }
  if (p.stakeBurnFactory.vaultImplementation.toLowerCase() !== p.stakeBurnBeacon.implementation.toLowerCase()) {
    throw new Error('PONS_VAULT_IMPLEMENTATION_MISMATCH');
  }
  if (p.stakeBurnBeacon.owner.toLowerCase() !== p.stakeBurnFactory.address.toLowerCase()) {
    throw new Error('PONS_VAULT_BEACON_OWNER_MISMATCH');
  }
  if (p.stakeBurnFactory.owner.toLowerCase() !== p.registry.owner.toLowerCase()) {
    throw new Error('PONS_VAULT_CONTROL_OWNER_MISMATCH');
  }
  if (p.controllingEoa.address.toLowerCase() !== p.stakeBurnFactory.owner.toLowerCase()) {
    throw new Error('PONS_VAULT_CONTROL_EOA_MISMATCH');
  }
}
