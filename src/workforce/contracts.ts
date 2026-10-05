/** Offline-only contract loader. No production route imports this module. */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import { sha256Hex } from '../evidence/canonical.js';

export const SCHEMA_NAMES = [
  'RAT_JOB_CONTRACT_V1', 'RAT_PROFILE_V1', 'RAT_HANDOFF_V1', 'RAT_JOB_RECEIPT_V1',
  'TOOL_MANIFEST_V1', 'SKILL_MANIFEST_V1', 'EVAL_CASE_V1'
] as const;
export type SchemaName = typeof SCHEMA_NAMES[number];
const ajv = new Ajv2020({ strict: true, allErrors: true });
for (const name of SCHEMA_NAMES) {
  ajv.addSchema(JSON.parse(readFileSync(resolve('contracts/rat-workforce/v1', `${name}.schema.json`), 'utf8')));
}
const validators = new Map<SchemaName, ValidateFunction>();
for (const name of SCHEMA_NAMES) validators.set(name, ajv.getSchema(`urn:binrat:workforce:v1:${name}`)!);

export function assertContract<T>(name: SchemaName, value: unknown): asserts value is T {
  const validate = validators.get(name)!;
  if (!validate(value)) throw new Error(`CONTRACT_INVALID:${name}:${ajv.errorsText(validate.errors)}`);
}
export type RatId = 'RAT_ZERO' | 'TRIPWIRE' | 'SNIFFER';
export type Tool = 'READ_TRANSFER_FIXTURE' | 'READ_RECIPIENT_WINDOW_FIXTURE' |
  'READ_PONS_LAUNCH_FIXTURE' | 'BUILD_CASE_DIFF' | 'DECIDE_ALERT';
export interface Authority { research: true; network: false; provider: false; delivery: false; capital: false }
export interface Budget { maxToolCalls: number; maxHandoffs: number; maxModelCalls: 0; maxCostMicrousd: 0 }
export interface Usage { toolCalls: number; handoffs: number; modelCalls: 0; costMicrousd: 0 }
export interface Subject { chainId: 4663; entityType: 'WALLET' | 'CREATOR'; entityId: string }
export interface Job {
  schemaVersion: 'binrat.rat-job/1'; mode: 'OFFLINE_REPLAY'; jobId: string; leadRat: 'SNIFFER';
  subject: Subject; objective: 'FOLLOW_FUNDER_TO_FUTURE_PONS_LAUNCH'; authority: Authority;
  budget: Budget; window: { fromBlock: string; toBlock: string };
}
interface EventBase {
  id: string; chainId: 4663; blockNumber: string; blockHash: string; availableAtBlock: string; digest: string;
}
export interface Transfer extends EventBase {
  kind: 'NATIVE_TRANSFER'; from: string; to: string; txHash: string; valueWei: string;
}
export interface RecipientWindow extends EventBase {
  kind: 'RECIPIENT_WINDOW'; recipient: string; fromBlock: string; toBlock: string; complete: boolean; seen: boolean;
}
export interface Launch extends EventBase {
  kind: 'PONS_LAUNCH'; launcher: string; creator: string; token: string; pool: string; txHash: string; logIndex: number;
}
export type SourceEvent = Transfer | RecipientWindow | Launch;
export type ClaimKind = 'NATIVE_TRANSFER_OBSERVED' | 'RECIPIENT_NOT_SEEN_IN_WINDOW' |
  'PONS_REPORTED_DEPLOYER_LAUNCH' | 'FUNDING_PRECEDES_LAUNCH';
export interface Claim {
  kind: ClaimKind; subject: Subject; evidenceRefs: string[]; scope: 'DECLARED_FIXTURE_WINDOW_ONLY';
}
export interface Handoff {
  schemaVersion: 'binrat.rat-handoff/1'; handoffId: string; jobId: string; fromRat: 'SNIFFER'; toRat: 'RAT_ZERO';
  objective: 'CHECK_FUTURE_PONS_LAUNCH'; subject: Subject; createdAtBlock: string; afterBlock: string;
  evidenceRefs: string[]; authority: Authority; remainingBudget: Budget;
}
export interface Profile {
  schemaVersion: 'binrat.rat-profile/1'; ratId: RatId; publicStatus: 'LIVE' | 'BUILDING' | 'NEXT';
  executionMode: 'OFFLINE_REPLAY'; objective: string; toolRefs: ManifestRef[]; skillRefs: ManifestRef[];
  refusalRules: string[]; evalRefs: string[]; manifestDigest: string;
}
interface ManifestRef { id: string; digest: string }
interface ToolManifest {
  schemaVersion: 'binrat.tool-manifest/1'; id: string; tool: Tool; authority: Authority;
  effect: 'DETERMINISTIC_FIXTURE_ONLY'; charge: { toolCalls: 1; modelCalls: 0; costMicrousd: 0 }; manifestDigest: string;
}
interface SkillManifest {
  schemaVersion: 'binrat.skill-manifest/1'; id: string; ratId: RatId; objective: string; procedure: string[];
  requiredEvidence: string[]; forbiddenClaims: string[]; evalRefs: string[]; manifestDigest: string;
}
export interface CompetencePack { profiles: Profile[]; tools: ToolManifest[]; skills: SkillManifest[] }

export async function assertSeal(value: object, field: string): Promise<void> {
  const copy = { ...value } as Record<string, unknown>;
  const supplied = copy[field]; delete copy[field];
  if (supplied !== await sha256Hex(copy)) throw new Error(`DIGEST_MISMATCH:${field}`);
}

export async function loadCompetencePack(): Promise<CompetencePack> {
  const dir = resolve('competence/rat-workforce/v1');
  const pack: CompetencePack = { profiles: [], tools: [], skills: [] };
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const value: unknown = JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
    const version = (value as { schemaVersion?: string }).schemaVersion;
    if (version === 'binrat.rat-profile/1') {
      assertContract<Profile>('RAT_PROFILE_V1', value); pack.profiles.push(value);
    } else if (version === 'binrat.tool-manifest/1') {
      assertContract<ToolManifest>('TOOL_MANIFEST_V1', value); pack.tools.push(value);
    } else {
      assertContract<SkillManifest>('SKILL_MANIFEST_V1', value); pack.skills.push(value);
    }
    await assertSeal(value, 'manifestDigest');
  }
  for (const rat of ['RAT_ZERO', 'TRIPWIRE', 'SNIFFER'] as const) {
    const profiles = pack.profiles.filter(p => p.ratId === rat);
    if (profiles.length !== 1) throw new Error('PROFILE_SET_INVALID');
    const profile = profiles[0]!;
    if (profile.publicStatus !== { RAT_ZERO: 'LIVE', TRIPWIRE: 'BUILDING', SNIFFER: 'NEXT' }[rat]) {
      throw new Error('PROFILE_STATUS_DRIFT');
    }
    for (const ref of profile.toolRefs) {
      if (pack.tools.filter(t => t.id === ref.id && t.manifestDigest === ref.digest).length !== 1) {
        throw new Error('TOOL_MANIFEST_BINDING_INVALID');
      }
    }
    for (const ref of profile.skillRefs) {
      if (pack.skills.filter(s => s.id === ref.id && s.ratId === rat && s.manifestDigest === ref.digest).length !== 1) {
        throw new Error('SKILL_MANIFEST_BINDING_INVALID');
      }
    }
  }
  return pack;
}
