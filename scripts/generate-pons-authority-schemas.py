"""Generate interface schemas only; no values, authority, or execution receipts."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent / 'docs' / 'schemas'
root.mkdir(exist_ok=True)
digest = {'type': 'string', 'pattern': '^[a-f0-9]{64}$'}
hex32 = {'type': 'string', 'pattern': '^0x[a-fA-F0-9]{64}$'}
address = {'type': 'string', 'pattern': '^0x[a-fA-F0-9]{40}$'}
nonzero_address = {**address, 'not': {'const': '0x0000000000000000000000000000000000000000'}}
uint = {'type': 'string', 'pattern': '^(0|[1-9][0-9]*)$'}
text = {'type': 'string'}
mapping = {'type': 'object', 'additionalProperties': text}
def const(value):
    return {'const': value}
def obj(properties):
    return {'type': 'object', 'properties': properties, 'required': list(properties), 'additionalProperties': False}
asset = obj({'status': const('VERIFIED'), 'kind': {'enum': ['NATIVE_ETH', 'ERC20']}, 'address': address, 'evidenceDigest': digest})
asset['allOf'] = [
    {'if': {'properties': {'kind': const('NATIVE_ETH')}}, 'then': {'properties': {'address': const('0x0000000000000000000000000000000000000000')}}},
    {'if': {'properties': {'kind': const('ERC20')}}, 'then': {'properties': {'address': nonzero_address}}},
]
asset_fields = ['pairQuoteAsset', 'vaultQuoteAsset', 'feeAccountingAsset', 'rewardAccountingAsset', 'claimAsset']
assets = obj({name: asset for name in asset_fields})
staking = obj({'required': const(True), 'template': const('staking'), 'configBytes': {'type': 'string', 'pattern': '^0x([a-fA-F0-9]{2})+$'}, 'minimumFeesBeforePayoutWei': uint, 'contractMinimumPayoutWei': uint, 'lock': obj({'kind': {'enum': ['NO_SUPPORTED_LOCK', 'CONFIGURED']}, 'seconds': uint}), 'creationRuleEvidenceDigest': digest, 'vaultPrediction': const('PROVISIONAL')})
prediction = obj({'classification': {'enum': ['IMMUTABLE', 'PROVISIONAL']}, 'address': {'anyOf': [nonzero_address, {'type': 'null'}]}, 'derivationEvidenceDigest': {'anyOf': [digest, {'type': 'null'}]}})
prediction['allOf'] = [{'if': {'properties': {'classification': const('IMMUTABLE')}}, 'then': {'properties': {'address': nonzero_address, 'derivationEvidenceDigest': digest}}, 'else': {'properties': {'address': {'type': 'null'}, 'derivationEvidenceDigest': {'type': 'null'}}}}]
authority = obj({'address': nonzero_address, 'codeHash': hex32, 'owner': {'anyOf': [nonzero_address, {'type': 'null'}]}})
manifest = obj({'schemaVersion': const('binrat.pons-semantic-manifest/1'), 'chainId': const(4663), 'rail': const('PONS_V2_NATIVE_ETH_PONSVault_STAKING'), 'wallet': obj({'address': nonzero_address, 'accountType': const('EOA'), 'codeHash': hex32}), 'contracts': {'type': 'object', 'required': ['ponsFactory', 'launcher', 'registry', 'stakingFactory', 'stakingBeacon', 'stakingImplementation', 'launchDeployer', 'memeHook', 'feeEscrow', 'locker', 'graduationExecutor'], 'additionalProperties': authority}, 'bindings': {'type': 'object', 'additionalProperties': nonzero_address}, 'authorityReadPlanDigest': digest, 'controllerCodeHashes': {'type': 'object', 'additionalProperties': hex32}, 'config': obj({'id': uint, 'expectedEconomics': hex32, 'launchFeeWei': uint, 'economics': mapping, 'configuration': mapping}), 'metadata': obj({'name': text, 'symbol': text, 'logo': text, 'description': text, 'socials': obj({k: text for k in ['twitter', 'telegram', 'discord', 'website', 'farcaster']})}), 'policy': obj({'creatorTaxBps': const(0), 'buybackEnabled': const(False), 'openingBuyWei': const('0'), 'privatePresale': const('NONE'), 'discountedInsiderRound': const('NONE'), 'hiddenTeamAllocation': const('NONE'), 'laterFounderPurchase': const('PUBLIC_MARKET_DISCLOSED')}), 'staking': staking, 'roles': {'type': 'object', 'required': ['creator', 'deployer', 'creatorFeeRecipient', 'vaultController'], 'additionalProperties': {'anyOf': [nonzero_address, {'enum': ['ACTUAL_VAULT', 'LAUNCH_WALLET']}]}}, 'assets': assets, 'call': obj({'creatorFeeRecipient': nonzero_address, 'salt': hex32, 'selector': const('0x969e6741')}), 'predictions': obj({'token': prediction, 'curve': prediction}), 'postconditions': mapping, 'behaviorEvidenceDigest': digest, 'upstreamRiskDeclarationDigest': digest, 'workingRatStatus': const('PLANNED'), 'productionEntitlementActive': const(False), 'digest': digest})
envelope = obj({'schemaVersion': const('binrat.pons-execution-envelope/1'), 'manifestDigest': digest, 'chainId': const(4663), 'from': nonzero_address, 'nonce': uint, 'to': nonzero_address, 'calldata': {'type': 'string', 'pattern': '^0x969e6741([a-fA-F0-9]{2})+$'}, 'calldataHash': hex32, 'valueWei': uint, 'gasLimit': uint, 'maxFeePerGasWei': uint, 'maxPriorityFeePerGasWei': uint, 'approvedFeeCeilingWei': uint, 'createdAtMs': {'type': 'integer', 'minimum': 0}, 'expiresAtMs': {'type': 'integer', 'minimum': 0}, 'digest': digest})
facts = obj({'schemaVersion': const('binrat.pons-launch-facts/1'), 'chainId': const(4663), 'verifiedLaunchState': const('VERIFIED'), 'manifestDigest': digest, 'executionVerificationDigest': digest, 'upstreamRiskDeclarationDigest': digest, 'token': nonzero_address, 'curve': nonzero_address, 'vault': nonzero_address, 'transaction': hex32, 'blockNumber': uint, 'blockHash': hex32, 'ponsFactory': nonzero_address, 'stakingFactory': nonzero_address, 'pair': const('NATIVE_ETH'), 'assets': assets, 'creatorTaxBps': const(0), 'buybackEnabled': const(False), 'openingBuyWei': const('0'), 'roles': {'type': 'object', 'additionalProperties': nonzero_address}, 'economics': mapping, 'stakingConfiguration': staking, 'workingRatStatus': const('PLANNED'), 'productionEntitlementActive': const(False), 'digest': digest})
signed = obj({'schemaVersion':const('binrat.pons-signed-envelope/1'),'manifestDigest':digest,'envelopeDigest':digest,'localSignedTxHash':hex32,'signedTransaction':{'type':'string','pattern':'^0x02([a-fA-F0-9]{2})+$'},'digest':digest})
for filename, schema in [('PONS_SIGNED_ENVELOPE_V1.schema.json', signed), ('PONS_LAUNCH_MANIFEST_V1.schema.json', manifest), ('PONS_EXECUTION_ENVELOPE_V1.schema.json', envelope), ('PONS_LAUNCH_FACTS_V1.schema.json', facts)]:
    schema = {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$id': 'urn:binrat:' + filename, **schema}
    (root / filename).write_text(json.dumps(schema, indent=2) + '\n')
