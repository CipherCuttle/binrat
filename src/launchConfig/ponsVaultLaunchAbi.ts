import { parseAbi, type Address, type Hex } from 'viem';

/** Pinned production UI ABI. This is not a verified Solidity ABI. */
export const PONS_VAULT_UI_ABI_PROVENANCE = {
  classification: 'PINNED_PRODUCTION_UI_ABI',
  sourceSurface: 'https://www.ponsvault.com/launch',
  uiDeploymentId: 'dpl_3GqtGP7hXYxb4sBTYSiwpaGPMHsb',
  productionBundleSha256: '580d679b7163dbfae91300ea0b2c7c9ba8dd8f8e9268c8383660f351c60a7b53',
  bundlePath: '/_next/static/chunks/10opw2r9zotbj.js',
  launcher: '0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA',
  selector: '0x969e6741',
  sourceRuntimeBinding: 'UNRESOLVED'
} as const;

export const PONS_LAUNCH_WITH_VAULT_SIGNATURE =
  'launchWithVault((string,string,string,string,(string,string,string,string,string),address,uint16,bool,bytes32,bytes32),uint256,address,bytes32,bytes)' as const;
export const PONS_LAUNCH_WITH_VAULT_SELECTOR = '0x969e6741' as const;
export const PONS_LAUNCH_WITH_VAULT_ABI = parseAbi([
  'function launchWithVault((string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt) params,uint256 launchConfigId,address pairToken,bytes32 templateId,bytes vaultConfig) payable returns (address token,address vault)',
  'event Launched(address indexed token,address indexed vault,address indexed creator,address curve,address pairToken,bytes32 templateId)'
] as const);

export interface PonsLaunchParamsV1 {
  name: string; symbol: string; logo: string; description: string;
  socials: { twitter: string; telegram: string; discord: string; website: string; farcaster: string };
  creatorFeeRecipient: Address; creatorTaxBps: number; buybackEnabled: boolean;
  expectedEconomics: Hex; salt: Hex;
}
