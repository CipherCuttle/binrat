import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PONS_VAULT_CHAIN_ID,
  PONS_VAULT_PINS_V1,
  assertPonsVaultPinsCoherent
} from '../src/ponsVault/pins.js';

test('PonsVault V1 pins are internally coherent and chain-scoped',()=>{
  assert.equal(PONS_VAULT_CHAIN_ID,4663);
  assert.doesNotThrow(()=>assertPonsVaultPinsCoherent());
  assert.equal(
    PONS_VAULT_PINS_V1.stakeBurnFactory.vaultImplementation.toLowerCase(),
    PONS_VAULT_PINS_V1.stakeBurnBeacon.implementation.toLowerCase()
  );
});

test('Stake & Burn upgrade control remains explicit rather than described as immutable',()=>{
  const p=PONS_VAULT_PINS_V1;
  assert.equal(p.stakeBurnBeacon.owner.toLowerCase(),p.stakeBurnFactory.address.toLowerCase());
  assert.equal(p.stakeBurnFactory.owner.toLowerCase(),p.controllingEoa.address.toLowerCase());
  assert.equal(p.controllingEoa.codeState,'EOA_NO_RUNTIME_CODE');
});
